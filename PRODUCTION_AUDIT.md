# PRODUCTION AUDIT — "What's My Pick?"

**Full pre-soft-launch production & stress-test review — fresh pass on the current build**
Date: 2026-08-11 · Branch: `claude/mobile-game-production-audit-3wu60i`
Method: full source read of every gameplay, data, migration, economy, cosmetic, payment, and shell file; the effective Postgres grant/RLS/policy set computed across all 11 migrations; every RPC body traced to its client call sites; `npm ci` + `npm run build` + `npm run lint` + `npm run typecheck` **all run and all pass**; multi-disciplinary review (engineering, backend, QA, game design, UX/UI, economy, security, analytics, accessibility, release) with each prior finding re-verified as FIXED / PARTIAL / STILL-PRESENT and new issues hunted.

> **Scope note.** This is an audit only. **No application code was changed.** This report supersedes the previous `PRODUCTION_AUDIT.md`, which was written at an earlier commit and is now stale: a large fix series has since landed (server-authoritative gameplay migration `0007`, `submit_mystery_word` `0010`, `play_again_mystery` `0011`, chat correctness, full Dutch localization, accessibility, analytics, push scaffolding, IAP reconciliation). Every claim below reflects the code **as it stands now**.

---

## 1. Executive Summary

**The team has done the work.** Since the last audit almost every P0/P1 was genuinely addressed, and the verification bears it out: the build, lint, and typecheck are clean; secret words are off the wire; the four permanent soft-locks are closed; turn order survives roster changes; the answer-merge race is fixed; chat no longer drops in-flight sends; analytics is wired into the gameplay funnel; a real Terms/EULA is surfaced at the name gate; IAP entitlements reconcile against RevenueCat on native; the resubscribe/battery loop is gone. This is no longer "a strong build that needs a hardening pass" — the hardening pass happened.

**But the hardening secured the wrong half of the problem.** The migration moved score/correctness/reveal/word-lock into `SECURITY DEFINER` RPCs — which stops a client *forging* a result — but it shipped those RPCs **without any caller authorization or rate limiting**, and it left the `mystery_rooms` table (and most of `mystery_players`/`mystery_guesses`) fully client-writable under the original `using(true)` RLS. The net effect is that the *computation* is trustworthy while the *authorization* is wide open. Concretely, on the current build a player can still:

- **Win any round without playing** — call `submit_mystery_guess` targeting their **own** row with their **own** known word; the reveal drops the active-player count and can force the finish (self-guess win); or brute-force the RPC against an opponent over the bundled word list with **no server-side cooldown**.
- **Leak every secret word mid-game** — any anon `UPDATE mystery_rooms SET status='finished'` fires the reveal trigger, which copies all secrets into the public, realtime-broadcast column. The exact disclosure SEC-1 was built to prevent is one write away.
- **Grief any room in the world** — reset it (`play_again_mystery` takes only a room code), force-finish it, seize `host_id`, flip `is_public`, eliminate other players, overwrite another player's secret, or delete every active public game.

**And one new reliability soft-lock replaced the old ones.** Every 5 question-cycles the game enters a mandatory **hint round** that blocks all play until every active player submits a hint — and unlike every other phase, it has **no timeout, no auto-fill, and no enforcement**. One player backgrounding their phone during a hint break freezes the whole room until the 2-hour cron. It is the same class of bug STUCK-1 fixed everywhere *except* here.

**One config gap hollows the launch itself:** **push has no `aps-environment` entitlement in the repo**, so the fully-wired turn-notification feature silently sends nothing — a dead re-engagement channel that *looks* implemented. *(A second claimed gap — a 404'ing privacy/terms domain — was **withdrawn as a false positive** after the owner confirmed the pages really are hosted at that subpath. See §15.)*

**None of this reads as "cheap."** The UI is a genuine, coherent design system; the engine is robust and thoughtfully commented; the meta is deep. What remains is a sharply-defined, mostly-small set of fixes — authorization on the RPCs, one more soft-lock, two CI/entitlement config lines, and a short list of correctness/polish residue.

**Ship now: NO** — but the gap to yes is now narrow and concrete (see §19).

**Headline numbers**

| Dimension | Score | Δ vs prior |
|---|---|---|
| Technical | 6.5/10 | ▲ from 6 |
| Gameplay | 6/10 | ▲ from 5 |
| UX | 7/10 | ▲ from 6 |
| UI | 8.5/10 | ▲ from 8 |
| Performance | 7/10 | ▲ from 6 |
| Security | 4/10 | ▲ from 3 |
| Retention | 5.5/10 | ▲ from 5 |
| Social | 6/10 | ▲ from 5 |
| Production readiness | 6/10 | ▲ from 5 |
| **Overall** | **6/10** | ▲ from 5 |

---

## 1a. Implementation Status (fixes applied after the audit)

The audit above was the diagnosis. Following approval to "fix everything needed for a launch without flaws," the P0/P1 set and most P2s were implemented in six committed batches. Two new migrations were added: **`0012_authorize_gameplay.sql`** (authorization/integrity) and **`0013_chat_rate_limit.sql`** (chat guardrails). `npm run lint`, `npm run typecheck`, and `npm run build` all pass.

**Resolved**

- **Security/integrity (0012).** `mystery_rooms.status` is revoked from clients; every transition goes through a validated `mystery_set_status` RPC that finishes a room only when the finish condition is truly met — so **force-finish (and the secret leak via the reveal trigger) is impossible** (SEC-2a). `submit_mystery_guess` now rejects a non-member/eliminated guesser, a room not in play, a **self-target**, an already-revealed target, and enforces the **guess cooldown server-side** (SEC-N1) — self-guess and dictionary brute-force are no longer deterministic wins. `submit_mystery_word` is word_entry-only and rejects empty/unguessable words (SEC-N3/STUCK-3). `play_again_mystery` is finished-only (SEC-N2). `mystery_guesses` UPDATE/DELETE revoked (SEC-2b); `mystery_secrets` is RPC-only (SEC-N3); `push_tokens` DELETE locked (SEC-N6). The guess RPC also records the target's `user_id`, fixing the **GAME-N5** regression (correct-guess alert + Notebook attribution + re-guess filtering work again).
- **Reliability.** Hint round now has a **timeout** with placeholder auto-fill (GAME-N1); the turn deadline is **refreshed server-side when a question completes**, killing the post-answer-timeout enforcement stampede/turn-hijack (GAME-N4); phase deadlines are minted server-side (clock-skew proof, GAME-N6); the Notebook clamps its page index (GAME-N2); an eliminated turn-holder's turn is claimed by the present fallback instead of vanishing (GAME-N3); host is reclaimed on the results screen if the host's app died (STUCK-4); word-entry host handoff is crash-safe (GAME-N7).
- **Chat.** Own message reconciles from the insert's returned row (CHAT-1); unread badge reconciles missed messages on wake (CHAT-2); history snapshot merges instead of full-replace (CHAT-3); display-side length cap (CHAT-5); server-side per-user flood limit + length truncation (CHAT-4, migration 0013).
- **UX/a11y.** Both How-to-Play modals use the accessible Dialog (UX-1/A11Y-1); BrowseLobbies distinguishes offline from empty with a retry (UX-3) and no longer flashes the list to a spinner on background refetch (UX-5); failed kick surfaces a toast (UX-4); 44px hit targets on chat emotes/send, Playing leave, Home Join (UX-2); localized emote/send aria-labels + refresh label + CategorySelector dialog name (A11Y-3/4/5).
- **Launch.** `aps-environment` push entitlement added with a CI archive check (LAUNCH-2); `armv7`→`arm64` (LAUNCH-3); age-rating wording fixed — `privacy.html`'s Children section no longer claims "general audiences" and deliberately states no tier number, since the App Store Connect questionnaire (authoritative) returned **4+** (LAUNCH-4; the audit's "should be 12+" claim was itself wrong — see §15); purchase + share funnels instrumented (ANA-2). Legal-page links were consolidated onto a single `links.js` (ProfileSettings no longer keeps its own copy) — but note **LAUNCH-1 itself was withdrawn as a false positive**; the URLs were already correct, and the changes made against that false premise were reverted (§15).
- **Economy.** Global cross-room hourly reward cap on top of the per-room cap (ECON-1); tab-close mid-match forfeits the win streak (ECON-2).

**Deliberately deferred (documented, not launch-blocking)**

- **SEC-3** (client-authoritative economy) and **SEC-5/SEC-6** (spoofable reports, evadable mute) are **inherent to the login-less guest model** — closing them needs real per-user auth binding, out of scope for a login-less party game; they are contained to cosmetics/vanity. **Host seizure / `is_public` flip** remain possible for a room you've joined (low-severity grief, same root cause). **SEC-N5** (analytics events unthrottled) and web-only **SEC-4** are P3 residuals.
- **ECON-3** (buy any non-rotated item on demand) is a shop-UI design change, left for a product decision. **PERF-1** (bundle split), **NET-1/2/3** (peer-profile channel sharing), remaining **UX/A11Y P3 polish** (switch-row hit area, word-grid density, emoji-only semantics, contrast), and the **product gaps** (solo/bot practice, friends/rematch loop) are post-launch items in the roadmap below.

The section-by-section findings below are retained as the original diagnosis; the ID references above map directly onto them.

---

## 2. Game Overview (verified against implementation)

**What's My Pick?** is a real-time multiplayer party game in the 20-questions family. Every feature below was traced to working code.

- **Core loop:** 2–12 players join a room (code or public browse). Each secretly picks a word from a shared category (or a custom word). Players take turns asking yes/no questions; everyone answers about their own secret word; players use the accumulated clue table (the Notebook) to guess opponents' words. A correct guess reveals that player's word, scores +1, and removes them from the pool. Game ends when ≤1 player remains unguessed.
- **Twists:** a **hint round** every 5 completed question-cycles (each active player submits a free-text hint); an **auto-question** system that fires from a static per-category bank when the 30s turn timer expires or the asker backgrounds the app; a 45s **answer timeout** breaker so an absent answerer can't freeze the room.
- **Identity:** login-less. Every player is a random `guest_xxxxxxxxx` in `localStorage` (`guestIdentity.js`), signed in or not. Optional email/Google/Apple sign-in exists on web only and never gates gameplay. Native iOS v1 ships account-less by design (a defensible Guideline 5.1.1(v)/4.8 posture) — account UI is hidden on native (`platform.js`).
- **Backend:** Supabase only — Postgres + Realtime + RLS. Game tables `mystery_rooms/players/questions/guesses/chats`, plus the new **`mystery_secrets`** (isolated, no select policy, out of Realtime), `player_profiles`, `player_reports`, `analytics_events`, `push_tokens`. Server logic lives in five `SECURITY DEFINER`/RPC functions (`submit_mystery_answer`, `submit_mystery_guess`, `submit_mystery_word`, `play_again_mystery`, `resolve_stalled_question`) plus `server_now`, a reveal-on-finish trigger, and two Edge Functions (`delete-account`, `notify-turn`). Stale-lobby cleanup via `pg_cron`.
- **Progression/meta:** per-match Picks (soft currency) + XP/levels (cap 50, clamped) + daily/weekly/season challenges + daily-login streak (server-time keyed). A large cosmetic catalog — 27 emblems (illustrated art), 37 banners, 20 borders, titles, name colors — across 6 rarities + a "special" tier, grouped into 9 collections with completion rewards. Profiles sync to Supabase so peers see loadouts in lobbies/cards.
- **Monetization:** 6 premium category packs via Apple IAP (RevenueCat, non-consumable). Picks/cosmetics are grind-only. Entitlements reconcile against RevenueCat on native launch.
- **Social:** per-room chat (optimistic send + retry, emote rain, mute, display-side profanity filter, unread badge), player cards, report, host kick.
- **Platform:** React 18 + Vite 6 + Tailwind, wrapped with Capacitor 8 for iOS. Framer Motion, canvas-confetti, optional Sentry, iCloud KV backup of identity/progression, analytics.

**Target player:** casual social players, friends-and-family groups, plus public-lobby drop-in. Dutch + English are both first-class (device-language detection + `<html lang>` sync).

---

## 3. Player Journey Audit

Walking the journey as a brand-new player against current code.

| Step | State | Verdict |
|---|---|---|
| **Install / first launch** | Dark launch screen; iCloud identity restore race (3s cap) before minting an id; server-time sync at boot. | ✅ Good |
| **Name gate** | Clean single input; how-to-play auto-opens once; day-1 reward toast sequenced after. Terms/Privacy line shown at the gate (`Home.jsx:333`). | ✅ Good (but see UX-A11Y-2) |
| **Home** | Strong hero, clear Create / Join / Browse. "Game in progress" rejoin banner after an iOS kill is excellent. | ✅ Good |
| **Create → visibility sheet → lobby** | Public/private creates the room; room-code copy + native share; category picker; 3-2-1 cancelable start. | ✅ Good |
| **Invite-link join (the growth path)** | **FIXED since last audit.** Invited visitors now set a name and see the invite screen *before* a player row is created (`MysteryGame.jsx:187,284-314`). Residual: the invite screen has no how-to-play link, so link-arrivals are named but never taught the rules (UX-7, P3). | ✅ Mostly good |
| **Word entry** | 60s shared deadline (server-time), word grid, custom input, readiness strip. Empty/normalize-empty custom words rejected before lock-in; `startPlaying` re-verifies the live roster. Persistent ≤15s warning banner before eject (3+ players). | ✅ Good |
| **Playing** | Turn timer, Notebook, guess modal, chat, players tab. Turn order survives eliminations (keyed by `current_questioner_id`). Answer timeout breaker prevents the classic freeze. | ✅ Mostly good |
| **Hint round (every 5 cycles)** | **DEAD-END RISK.** Blocks all play until every active player submits — with **no timeout/enforcement** (GAME-N1, P1). One absent player freezes the room. | ❌ New soft-lock |
| **Answer** | Big clear Yes/No card; atomic server RPC merges answers. Answer results in history now carry `aria-label`. | ✅ Good |
| **Guess** | Server-authoritative correctness/reveal/score/finish. Client never sees opponents' words. **But** the RPC accepts a self-target and has no server cooldown (SEC-N1). | ⚠ integrity gap |
| **Win / Lose** | Confetti (reduce-motion aware), clear scoreboard, honest walkover handling. | ✅ Good |
| **Rewards** | Animated summary (Picks/XP/level-ups/unlocks/challenges). Idempotent per round; anti-farm guards. | ✅ Good |
| **Collection / Shop** | Deep album/shop/challenge hub; collection items buyable from the album; shop rotates full catalog 3-per-section daily (server-seeded). Residual: a specific *non-collection* item still only buyable on its rotation day (ECON-3). | ✅ Mostly good |
| **Profile / Share** | Real generated share card, native share sheet, text fallback. Share funnel is **un-instrumented** (ANA-2). | ✅ Good (blind) |
| **Chat** | Optimistic, retry, dedup, DELETE handling, capped memory. Residuals: own message can vanish on a dead socket → duplicate resends (CHAT-1); unread badge misses background-arriving messages (CHAT-2). | ⚠ residuals |
| **Return** | Rejoin banner + real connection-vs-not-found split on MysteryGame. | ✅ Good |

**Journey verdict:** the created-room *and* invited-player paths are now both solid end-to-end. The two live risks on the journey are the **hint-round soft-lock** and the **guess-integrity gap**.

---

## 4. Gameplay Audit ("Supercell-level" lens)

**Strengths.** The core mechanic is understandable in a sentence and hits the first-30-seconds/first-3-minutes bar with a friend in the room. Real design maturity: server-time shared deadlines, staggered peer enforcement, an answer-timeout breaker, turn identity that survives roster changes, the Notebook clue surface, hint-round pacing variety, and honest walkover handling. Winning is satisfying (confetti + haptics + reward summary); losing is fair.

**Weaknesses & risks (current).**
- **G-1 [P1] The core skill is defeatable without reading any secret.** Even with secrets now hidden, `submit_mystery_guess` has no server-side guess cooldown and accepts a self-target, so a modified client can brute-force an opponent over the bundled word list or self-guess to a forced win (see §8, SEC-N1). Honest play still functions — but the mechanic is not protected.
- **G-2 [P1] Hint round has no timeout (GAME-N1).** The one phase with no server-side breaker; the highest-severity remaining soft-lock (see §4a).
- **G-3 [P2] Guess cadence is still client-gated only.** `last_guess_at_question_count` is consumed by the RPC but never *enforced* by it; the eligibility check lives in `GuessModal.jsx`. A modified client guesses every turn.
- **G-4 [P3] Question variety is finite;** the auto-question bank is static per category (now with a Dutch bank, so no mid-round language switch). A very idle room repeats.
- **G-5 [P3] Long games have no natural close.** `max_rounds` exists in schema but is not enforced; a stalemate relies on players leaving.
- **G-6 [P4] No solo/practice or bot mode** — the cold-start dead-end (empty lobbies, no friends online) is still the biggest *product* gap (see §21).

---

## 4a. Game State-Machine & Soft-Lock Audit

**The four permanent-stuck paths from the last audit are FIXED. One new one replaces them.**

**Verified FIXED**
- **STUCK-1 (answer timeout):** `resolve_stalled_question` RPC (`0007:239`) plus a client interval that fires it once `serverNow() ≥ question.created_date + 45s + grace + staggered rank` (`PlayingPhase.jsx:280-303`); the asker is included as the last-rank waiter, so even the 2-player case resolves. Latch released on error (retryable).
- **STUCK-2 (host handoff on word-entry enforcement):** after deleting stalled players, host is reassigned to a survivor (`WordEntryPhase.jsx:119-126`); self-timeout routes through `leaveRoom`, which also hands off.
- **STUCK-3 (empty/unguessable word into play):** normalize-empty custom words rejected pre-lock-in (`WordEntryPhase.jsx:178-181`); `startPlaying` refetches live state and aborts if `roster.length < 2 || some(!word_submitted)` (`:207-212`).
- **GAME-1 (turn identity):** advances by `current_questioner_id` (`PlayingPhase.jsx:50-55,361`); positional index is a legacy fallback only.
- **GAME-2 (answer-merge race):** client-merge fallback runs *only* on genuine function-missing (`PGRST202`/`42883`); any other error re-throws (`PlayingPhase.jsx:407-424`) — the 0006 lost-update bug can't reappear.
- **GAME-4/5 (dup auto-question / disarm):** single `postingRef` shared by manual+auto paths with a fresh-state re-check; enforcement latches released on failed write.
- **GAME-7 (resubscribe loop):** `handleStatus` ignores `CLOSED`, acts only on `CHANNEL_ERROR`/`TIMED_OUT`, no-ops after `disposed` (`MysteryGame.jsx:111-123`).
- **GAME-8 (`unique(room_code,user_id)`):** created in `0007:258-267` with a `user_id` index; auto-join insert races swallowed.
- **GAME-10 (DELETE bypasses room filter):** `REPLICA IDENTITY FULL` + every handler re-checks `room_code` on the payload.

**STILL PRESENT / NEW**
- **GAME-N1 [P1] Hint round has no timeout → whole-room soft-lock.** The hint break blocks all question UI until every active player submits (`PlayingPhase.jsx:692,731`; `allHintsSubmitted` needs all `activePlayers2`, `:148-150`). **All three enforcement effects early-return during the break** (`:176,208,281`), and there is no hint timer, auto-hint, or in-play host-kick. One backgrounded/absent player freezes the room until the 2-hour cron. *Fix:* a hint-phase deadline + enforcement that auto-submits a placeholder or skips the absent player (mirror `resolve_stalled_question`). Complexity: S/M.
- **STUCK-4 [P2] Host tab-close/background at `finished` still strands Play Again.** `beforeunload` cleanup is registered **only** when `status==='lobby'` (`MysteryGame.jsx:213`); at `finished` the host row lingers with `host_id` unchanged, and Play Again is host-gated (`FinishedPhase.jsx:251`). Explicit leave hands off; a crash/close does not. *Fix:* presence-based host reassignment or a "claim host" button when the host is absent > N s.
- **GAME-N2 [P2] Notebook crash when the opponents list shrinks (latent).** `pageIdx` is never clamped when `opponents` shrinks; a player-row deletion mid-view makes `target` undefined and `Notebook.jsx:64/88` throws to the ErrorBoundary. Uncommon in play (leave uses eliminate, which keeps the row) but real. *Fix:* clamp `pageIdx` in an effect on `opponents.length`.
- **GAME-N3 [P2] Eliminated current-questioner → present fallback taps into a void for ~30–70s.** When the turn-holder leaves (eliminate mode keeps their row but they exit the asking roster), the identity lookup fails and the positional fallback (`PlayingPhase.jsx:97-99`) elects a different player whose UI shows "your turn" — but `submitQuestionText`'s fresh check compares `current_questioner_id` (still the departed player) to `me.id` and **silently returns** (`:346-348`): no toast, input intact, nothing happens. That player taps Ask into a void until an enforcer's auto-question fires in their name ~30–70s later and their typed question is lost. *Fix:* advance `current_questioner_id` in the leave path when the leaver holds the turn, or let `submitQuestionText` accept when the stored questioner is absent and `me` is the derived fallback.
- **GAME-N4 [P1] Stale `question_deadline` after an answer-timeout → enforcement stampede + turn hijack.** The shared `question_deadline` for turn N+1 is minted when question N is *created* (`PlayingPhase.jsx:362-368`) and is **never refreshed when a question completes**. Whenever answering outlasts deadline+grace — a slow-but-present answerer, or exactly the STUCK-1 forced-resolve path, or the end of every hint break — `currentQuestionPending` clears simultaneously for all clients against a deadline that is now 20–60s in the past. The rank stagger is defeated (every enforcer is eligible on the same tick), so they all pass the ~200–400ms fresh-state re-check window → duplicate auto-questions + multi-advance; and even a single enforcer beats the incoming asker's own fresh-deadline claim (which needs a write + realtime round-trip + 400ms debounce) → **a present player's turn is consumed by an auto-question in their name.** The same stale-deadline math also eats the next asker's real time when answering was merely slow (GAME-N6). *Fix (one SQL change fixes the whole family):* refresh `question_deadline = now()+30s` in `submit_mystery_answer`'s `pending=0` branch and in `resolve_stalled_question`; make enforcers stand down when the deadline predates the latest question's `updated_date`. Complexity: S.
- **GAME-N5 [P2] `target_player_id` regression → five guess/Notebook features silently broken.** The guess RPC records `p_target_player_id = selectedTarget.id` (the **row UUID**, `GuessModal.jsx:46` → `0007:188-194`), but every reader compares `target_player_id` against a **`user_id`** (the guest string): the correct-guess room alert word (`PlayingPhase.jsx:158`), the "guessed by X" reveal attribution and your per-target guess history in the Notebook (`Notebook.jsx:33,52`), and the wrong-guess strikethrough + re-guess exclusion (`GuessModal.jsx:28,72,180`). They never match, so the alert shows `?`, the Notebook attribution/history never render, and you can re-submit an already-wrong word. No score/finish corruption (the RPC resolves by row id internally; winners derive from `guesser_id`), but four visible features broke — **a regression introduced by the SEC-1 fix itself.** *Fix:* insert `target.user_id` into `target_player_id` in the RPC (one line, restores the app-wide convention), or change the readers. Complexity: S.
- **GAME-N6 [P3] Next asker's timer is eaten by answering time / word-entry deadline uses `Date.now()`.** Two clock issues: (1) because the turn-N+1 deadline is minted at question-N creation (GAME-N4) but the next asker is blocked until all answers land, slow answering (20–29s) leaves the next asker only 1–10 real seconds before an auto-ask; (2) `LobbyPhase.doStartGame` (`LobbyPhase.jsx:142`) mints the shared word-entry deadline from the host's raw `Date.now()` while everyone counts down against `serverNow()` — a skewed host shortens/mass-deletes. `syncServerTime()` is also one-shot at boot (no wake re-sync). *Fix:* refresh the deadline on completion (shares GAME-N4's fix); swap in `serverNow()` at `LobbyPhase.jsx:142`.
- **GAME-N7 [P3] Word-entry host handoff is not crash-safe.** `WordEntryPhase.jsx:120-126` deletes stalled players *then* reassigns host; if the deletes land but the room update fails, the retry finds `stalled` empty and early-returns (`:107`), leaving a dangling `host_id` (STUCK-2 re-materializes until the cron). *Fix:* reassign whenever the fresh roster lacks `room.host_id`, independent of `stalled`.

---

## 5. UX / UI Audit

**UI craft remains the standout (8.5/10):** one card material, one input well, one gold CTA, tokenized spacing, phase-consistent tab bars, real empty states, lighting logic. The accessible `Dialog` primitive (role/aria-modal/focus-trap/Escape/scroll-lock) is now used by Guess, Category, ShareCard, PlayerCard, Purchase, delete-confirm, and all leave confirms. Toasts are capped (`TOAST_LIMIT=3`) with a single live-region viewport.

**UX residue (verified):**
- **UX-1 [P1] Two How-to-Play modals bypass the accessible Dialog.** `Home.jsx:225-252` and `LobbyPhase.jsx:210-237` are hand-rolled `fixed inset-0` overlays — no role, no focus trap, no Escape, no scroll-lock — and this is the **first modal a brand-new player sees** (auto-shown after naming). Dismissal is also inconsistent: its backdrop isn't tap-dismissable while the adjacent Create sheet's is (UX-4). *Fix:* render both through `@/components/ui/dialog`.
- **UX-2 [P1] Sub-44px touch targets on high-frequency controls.** Chat emotes 36px (`ChatPanel.jsx:308`), chat send 40px (`:321`), Settings toggles ~20px with no row-level hit area (`switch.jsx:9` + `ProfileSettings.jsx:324`), Playing Leave 36px (`PlayingPhase.jsx:560`), Home Join 40px (`Home.jsx:427`), Notebook page-dots ~20px, word-grid cells ~28px. (Header buttons and Notebook arrows *were* bumped to 44px — good.)
- **UX-3 [P1/P2] BrowseLobbies conflates offline with empty.** A fetch throw does `setPublicLobbies([])` → renders "No open lobbies. Create one!" (`BrowseLobbies.jsx:65,229`) with no retry — the false dead-end UX-2 called out, still live on this one screen.
- **UX-4 [P2] Silent failures on kick / rejoin / clipboard.** Host kick logs to console only, no toast (`LobbyPhase.jsx:456`); eliminated-player rejoin has no catch/feedback (`MysteryGame.jsx:337`); auto-rejoin swallows failures (`:208`); `clipboard.writeText().catch(()=>{})` no-ops silently on older webviews (`LobbyPhase.jsx:90`, `PlayingPhase.jsx:574`) with no share/toast fallback.
- **UX-5 [P2] BrowseLobbies blanks the whole list to a spinner on every background refetch.** The debounced subscription calls the same `fetchLobbies` that flips the global `lobbiesLoading`, so *any* public-room event anywhere flashes every viewer's list to a centered spinner and loses scroll (`BrowseLobbies.jsx:58,119,219`) — a regression introduced by the NET-1 debounce fix. *Fix:* a separate silent `refreshing` flag.
- **UX-6 [P3] CategorySelector loses its accessible name in 2 of 3 views** (`titleId` set but only the categories view renders that id — `:85` vs `:157,197`).
- **UX-7 [P3] Invite-link players are named but never taught** (no rules link on the invite screen, unlike the Home path).
- **UX-8 [P3] Word-grid legibility** — 3-column `text-[11px]` cells at default size on small phones are cramped and double as too-small tap targets.
- **UX-9 [P3] Dead duplicate `index.css`.** Root `/index.css` is unused (only `src/index.css` is imported); a maintenance trap.
- **UX-10 [P3] `useToast` re-subscribes on every state change** (`use-toast.jsx:167` deps `[state]`) — the known shadcn bug; wasteful, harmless.

---

## 6. QA & Stress-Test Results (sequences, not isolated screens)

- **Backgrounded asker mid-question:** ✅ shared deadline + staggered peer enforcement + wake re-subscribe.
- **Backgrounded non-asker mid-question:** ✅ **now handled** by the 45s answer-timeout breaker (STUCK-1 fixed).
- **Backgrounded player during a HINT break:** ❌ **room freezes** (GAME-N1, P1) — the one uncovered phase.
- **Eliminate a player mid-turn:** ✅ turn order stable via `current_questioner_id` — ⚠ except when the *turn-holder* self-eliminates (GAME-N3).
- **Answer RPC 5xx/timeout:** ✅ no longer erases others' answers (GAME-2 fixed).
- **Two simultaneous correct guesses:** ✅ serialized on a row lock in the RPC; finish computed atomically (GAME-6 fixed).
- **Rapid chat send (2 fast):** ✅ both sent (CHAT-1 fixed) — ⚠ but own bubble can vanish on a dead socket → duplicate resend (CHAT-1-residual).
- **Background → return, messages arrived while away:** ❌ unread badge shows 0 (CHAT-2) — Realtime doesn't replay missed rows and the hook never reconciles a count.
- **Offline reopen mid-game:** ✅ real "connection problem / retry" on MysteryGame — ❌ but BrowseLobbies shows false "No lobbies" (UX-3).
- **App kill mid-round → reopen:** ✅ excellent rejoin banner.
- **Two tabs + Play Again self-farm:** ⚠ throttled (≥3-player bonus gate + 10 rounds/room/hour cap + zero-score void), not closed — 3 tabs or rotating rooms bypass; the economy write is client-side regardless (ECON-1/SEC-3).
- **Devtools read opponent's word:** ✅ impossible on the normal path (secret isolated) — ❌ but force-finish leaks all secrets (SEC-2a) and brute-force/self-guess win (SEC-N1).
- **Clock skew 30s fast:** ✅ server-time base — ⚠ except the word-entry deadline (GAME-N4).
- **Reward double-grant (StrictMode/remount):** ✅ in-flight Set + persisted idempotency key (ECON-7 fixed).

---

## 7. Backend / Network Audit

Supabase-only; realtime discipline is now good. Build/lint/typecheck pass.

**Verified FIXED:** BrowseLobbies subscription debounced 500ms + server-filtered to public rooms (NET-1); occupancy counts queried from `mystery_players` + 15s interval + wake refresh (NET-2, with a ≤15s lag caveat); one ref-counted shared `mystery_chats` channel fanning out to badge + panel (NET-3 chat portion); `withTimeout` 10s on filter/create/update/delete (NET-6); chat DELETE handled with `REPLICA IDENTITY FULL` (NET-7); chat memory capped at 200/history 60 (NET-8); resubscribe loop gone (NET-9); every handler re-checks `room_code` (NET-10); `idx_mystery_players_user` added (N+1 index).

**STILL PRESENT / NEW:**
- **NET-1 [P3] Peer-profiles channel multiplication + multiple 30s polls.** Every `usePeerProfiles` caller opens its own random channel and its own 30s interval; on the chat tab a client runs the phase's copy + ChatPanel's copy + any Notebook/GuessModal copy, all polling the same ids. *Fix:* one shared ref-counted per-room subscriber (mirror the chat one), or lift one instance and pass `profiles` down.
- **NET-2 [P3] Debounce has no max-wait.** BrowseLobbies (500ms) and MysteryGame (400ms) re-arm on every event, so under sustained churn the refetch/reload can be deferred indefinitely — updates starve exactly when activity is highest. *Fix:* leading+trailing or a "fire at least every N ms" clamp.
- **NET-3 [P3] 12-player cap is check-then-insert (TOCTOU).** Under open RLS, simultaneous joins can exceed 12 despite the client check (`MysteryGame.jsx:197`, `BrowseLobbies.jsx:149`). *Fix:* a trigger enforcing the cap.
- **NET-4 [P3] `withTimeout` rejects the caller but doesn't abort the underlying fetch** — acceptable, noted.

---

## 8. Security / Cheat Audit

**The trust model is intentional (open RLS, login-less).** The `0007` migration correctly moved score/correctness/reveal/word-lock into `SECURITY DEFINER` RPCs and revoked the two cheat-critical columns. **The gap is that it secured the computation but not the authorization or rate**, and left `mystery_rooms` (and most of `mystery_players`/`mystery_guesses`) fully client-writable. Two independent security passes corroborated the following.

**Verified FIXED (normal path):**
- **SEC-1:** secrets live in `mystery_secrets` (no select policy, comment "No select policy on purpose", not in the Realtime publication); `mystery_players.secret_word` is `''` until reveal; the client data layer is write-only to secrets; the guess RPC returns the word only when the guess is correct. `select('*')` and `REPLICA IDENTITY FULL` are safe during play.
- **SEC-2 (partial):** `score`/`word_revealed` UPDATE revoked via column re-grant (`0007:95`); `mystery_guesses` INSERT revoked so `correct=true` can't be forged on insert; correctness judged server-side.

**STILL PRESENT / NEW — the live integrity holes:**
- **SEC-2a [P1] `mystery_rooms` was never locked down → force-finish leaks every secret.** The room policy stays fully open (`0001:154`); `0007` revoked columns only on `mystery_players`. Any anon can `UPDATE mystery_rooms SET status='finished'`, which fires `reveal_words_on_finish` (`0007:120`), copying **every** player's real secret out of `mystery_secrets` into the public, realtime-broadcast `mystery_players.secret_word`. This re-opens SEC-1 at will, mid-game. The same open policy lets a client seize `host_id`, flip `is_public`, overwrite `current_questioner_id`/`category`, or `DELETE` rooms/players.
- **SEC-N1 [P1] `submit_mystery_guess` has no auth binding, membership check, or rate limit.** It trusts `p_guesser_id` (spoofable) and `p_room` (arbitrary), never checks the caller is a room member or that it's their turn, and enforces **no guess cooldown** (that gate is client-only). Exploits: (a) **self-guess win** — target your own row with your own known word → guaranteed `correct`, `+1`, self-reveal, which drops `active_left` and can force the finish; (b) **brute-force win** — loop the RPC over the bundled category word list against a target until `correct=true`; (c) **cooldown grief** — pass `p_guesser_id=victimId` to lock the victim out (`last_guess_at_question_count` set on their behalf); (d) cross-room resolution / awarding points to an arbitrary id.
- **SEC-N2 [P1] `play_again_mystery(p_room)` is callable by anyone against any room.** No host check, no membership check, no status guard (`0011`). Continuous calls = a room no group can ever start; a single call mid-game wipes questions/guesses/secrets and forces `lobby`.
- **SEC-2b [P2] `correct` is forgeable via UPDATE; opponents' guesses deletable.** `0007` revoked only INSERT on `mystery_guesses`; UPDATE/DELETE stay open (`0001:166`). After the RPC records your wrong guess, `UPDATE ... SET correct=true` inflates the shared winner/reward math (both `FinishedPhase` and `grantMatchRewards` read `guesses.correct`). You can also delete opponents' correct guesses.
- **SEC-2c [P2] Any player row is mutable/deletable.** The re-grant list leaves `is_eliminated`, `word_submitted`, `display_name`, `color`, `secret_word` client-writable on **any** row, plus INSERT/DELETE — eliminate opponents (or force a finish by eliminating everyone), un-submit them, or rewrite their name/color.
- **SEC-N3 [P2] `submit_mystery_word(p_room,p_user,p_word)` trusts `p_user`.** Overwrite any player's secret in `mystery_secrets` (the victim's real word no longer matches; reveal shows the substitution), or set `word_submitted=true` for others. Combined with the guess RPC, plant a known word on every opponent and "guess" it.
- **SEC-3 [P2] Economy is client-authoritative (by design).** `player_profiles` owner-stamping only stops *other* sessions editing *your* row; you can write anything to your own (`devUnlockAll` literally sets `owned=ALL, picks=99999`). Contained to cosmetics/vanity today — a hard blocker the day anything gameplay-affecting or a real leaderboard is gated on these values.
- **SEC-N4 [P3] `resolve_stalled_question` / `submit_mystery_answer` unauthenticated** — force any question complete (skip a turn / deny clues) or answer on any player's behalf (poison the Notebook).
- **SEC-N5 [P3] `analytics_events` insert is open, spoofable, unthrottled** — anyone can forge/flood product metrics. (Insert-only, no select — no data leak, but the metrics are corruptible.)
- **SEC-N6 [P3] `push_tokens` delete-any / arbitrary-owner insert** — delete a victim's token to suppress their notifications, or insert `(victimId, attackerToken)` so the victim's "your turn" pushes fire to the attacker's device (info leak about the victim's game state).
- **SEC-4 [P3] IAP entitlements:** reconciled to RevenueCat on native (a hand-edited unlock is wiped next launch) — but web is localStorage-only and never reconciled. Premium word lists ship in the bundle regardless.
- **SEC-5 [P3] Reports spoofable/evidence-free;** **SEC-6 [P3] mute/report/streak evadable by minting a new guest id** — inherent to the login-less model.

**Root cause & the decision.** Guest identity is an unauthenticated client-supplied string; every RPC accepts the actor's id/room as untrusted params, and the base tables are open. Meaningfully closing the gap means **binding writes to `auth.uid()`** — the anonymous-auth session already exists for profiles; extend it to the game tables, pass no `user_id` params, and have the RPCs derive the caller — **and locking the base game tables to SELECT-only for anon**, routing every state transition through an RPC that checks membership + turn + rate + finish invariants. `mystery_rooms` specifically must stop being client-writable (that alone closes the secret leak). Alternatively, accept honor-system play, **document it**, and stop presenting scores/wins/stats as authoritative — but note that "honor system" no longer covers the *secret leak*, which is a one-write disclosure, not a score.

**Verified GOOD:** no committed secrets (only the public anon + RevenueCat public keys ship; service-role stays in Edge Functions); `.gitignore` excludes `.env*`; dev backdoor (`?dev=`) inert unless built with `VITE_ENABLE_DEV_TOOLS=1` (no store build sets it); `delete-account` verifies the JWT and deletes only the caller; React escapes chat text (no XSS); `mystery_secrets` has no select policy; realtime filters are room-scoped.

---

## 9. Economy / Progression Audit

**Verified FIXED:** Season 1 Founder dead content (SEASON defs carry no `unlock`; hidden collections skipped — ECON-3 old); level-50 XP bar clamp + `maxed` state (ECON-8 old); reward idempotency race (in-flight Set + persisted key — ECON-7 old); daily-login streak + shop rotation keyed to `serverNow()` (ECON-5 old, online).

**STILL PRESENT / PARTIAL:**
- **ECON-1 [P2] Play-Again self-farm — throttled, not closed.** Guards added: winner/perfect/streak + the win stat require `players.length ≥ 3`; `topScore===0` voids; `REPLAY_CAP_PER_HOUR=10` per room. But a 1v1 still mints `complete` + per-guess + `host` every round; the cap is per-`room.id`, so rotating rooms (or a fresh guest id) removes the ceiling; and rewards are self-computed then upserted wholesale (SEC-3), so a determined farmer skips the game entirely. Casual two-tab farm is dead; the exploit class isn't.
- **ECON-2 [P2] Rage-quit preserves the streak** — `breakStreakOnLeave()` is wired only to the explicit Leave button (`PlayingPhase.jsx:466`); a tab-close/kill/background goes through `beforeunload` cleanup, which doesn't call it. (Moot under SEC-3.)
- **ECON-3 [P2] Spend loop still partial** — collection items are buyable anytime from the album and the shop rotates the full catalog 3-per-section daily, but a *specific non-collection* item can only be bought on its rotation day. Better than before; not a fully open "buy what I saved for."
- **ECON-4 [P3] Top-tier pricing** — the header's "Mythic ≈ 3–4 weeks" roughly holds for honest play but compresses under winner-heavy sessions and ECON-1; moot for a cheater under SEC-3.
- **ECON-5 [P3] Offline clock fallback** — daily/shop fall back to the device clock when offline (acknowledged in-code); moot under SEC-3.

**Correctly handled:** duplicate-ownership guards on every grant path; per-round idempotency; walkover void consistent between grant + UI; collection-completion and mid-match level unlocks both grant + celebrate; IAP layer clean.

---

## 10. Emblem / Collection Audit

The cosmetic system remains a genuine strength — Supercell-level breadth (27 illustrated emblems, 37 banners, 20 borders, titles, name colors, 9 collections, 6 rarities + special), explicit ownership states, satisfying unlock celebrations, and the lobby-as-showcase. Issues are economy-plumbing, not collection design:
- **COL-1 [P3]** Non-collection, non-rotated items still lack an on-demand purchase path (ECON-3).
- **COL-2 [P3]** No persistent "NEW / newly-affordable" indicator for freshly rotated stock or newly-reached level unlocks — discovery relies on the player noticing.
- **COL-3 [P4]** Rarity is still price-only; genuine scarcity (limited-time, challenge-gated) would make Mythic feel like the chase it's named for.
- **Founder/Royal** items remain intentionally unobtainable (`hidden`), and nothing advertises them as claimable — correct.

---

## 11. Chat / Social Audit

Chat is materially better: fire-and-forget sends with distinct temp ids (CHAT-1 old fixed), display-side profanity re-filter (CHAT-5 old fixed), steady-state dedup via `mergeMessage`, DELETE handling, capped memory, client-side send/emote cooldowns, one shared ref-counted channel.

**STILL PRESENT / NEW:**
- **CHAT-1 [P1] Own message vanishes on a dead socket → duplicate resend.** `create()` returns the persisted row but it's **discarded**; the optimistic bubble is removed and the code waits for the realtime echo (`ChatPanel.jsx:206-216`). If the socket is silently stalled while foregrounded, the sender's own saved message disappears → they retype → two rows land. *Fix:* reconcile from the returned row via `mergeMessage`, don't depend on the echo.
- **CHAT-2 [P2] Unread badge misses background-arriving messages.** The count derives only from live `create` events; on wake the channel reopens but Realtime doesn't replay missed rows and the hook never reconciles a count (`useUnreadChat.js:136-159`). Background the app, 5 messages arrive, foreground → badge shows 0. *Fix:* a `created_date > lastSeen` count query on reopen.
- **CHAT-3 [P2] Snapshot applied by full-replace clobbers live messages and wipes optimistic/failed bubbles.** The history fetch overwrites the whole list on mount and every `wakeEpoch` (`ChatPanel.jsx:100-111`): a message inserted between the query and `setMessages` is dropped permanently, and a `_failed` bubble awaiting a retry tap is erased on background→foreground. *Fix:* fold the snapshot through `mergeMessage` over current state.
- **CHAT-4 [P2] Rate limiting is client-side only under open RLS.** The 600ms send cooldown and 1500ms rain throttle live in the React client; a raw `insert` ignores both and floods the room / triggers continuous full-screen emote rain for everyone. The "CHAT-6 fixed" comment overstates the protection. *Fix:* a Postgres trigger or `SECURITY DEFINER` posting RPC rate-limiting per user/room.
- **CHAT-5 [P2] Message length enforced on send only; display renders unbounded text.** `MAX_MESSAGE_LENGTH=300` is applied in `send()` and `maxLength` only; a crafted client inserts a 50k-char message and every other client renders it in full (`ChatPanel.jsx:274`), blowing out the layout. *Fix:* `.slice(0, MAX)` on display too.
- **CHAT-6 [P3] `isMuted` re-reads + JSON.parses localStorage per message per render** (`mutes.js:10` called in a `.filter` over up to 200 messages) — 200 synchronous parses per render. *Fix:* read the muted set once per render.
- **CHAT-7 [P3] Non-idempotent unread increment on phase-transition overlap** (badge can jump by 2) and premature send-button re-enable with overlapping sends — minor.

**Missing social table-stakes (unchanged):** no durable block that survives a new guest id; no report *with message context*; no message reactions; no friends/recent-players/rematch-with-same-group loop (a real retention miss — see §21).

---

## 12. Performance Audit

Build, lint, typecheck all pass. `vendor` split done (react/motion/supabase separate chunks); non-core routes lazy-loaded.

- **PERF-1 [P2] Main app chunk is 459 kB / 137 kB gz.** `Home` + `MysteryGame` are eager and pull in the large static data modules (`questionBank.js`, `cosmetics.js`); `cloudBackup.js` is both statically and dynamically imported (build warning), keeping it in the main chunk. *Fix:* lazy-load the question/cosmetic data behind game start; make `cloudBackup` import consistently dynamic.
- **PERF-2 [P2] BrowseLobbies blanks to a spinner on every background refetch** (UX-5) — the clearest user-visible perf regression.
- **PERF-3 [P3] Peer-profiles channel multiplication + redundant 30s polls** (NET-1).
- **PERF-4 [P3] `isMuted` per-message localStorage parses** (CHAT-6).
- **PERF-5 [P4] Image weight:** `dist/assets` ≈ 3.4 MB across 64 webp; ~213 kB eager on Home (`logo` 120 kB + `home-hero` 93 kB); the shop renders many at once — consider lazy/virtualized grids.

**Verdict:** fine for the intended small-room use; the scaling risks are the eager data modules and peer-profile fan-out, not micro-optimizations.

---

## 13. Accessibility Audit

**Verified FIXED:** Dynamic Type re-enabled (`text-size-adjust:auto`, inputs ≥16px to avoid focus-zoom — A11Y-1 old); toasts have `role`/`aria-live` with a single viewport (A11Y-2 old); the accessible `Dialog` primitive with focus-trap/Escape/scroll-lock is used across most modals (A11Y-3 old, *except* the two How-to-Play modals — UX-1); the reduced-motion conflict is resolved (both blocks carry `:not(.animate-spin)`, so loaders still spin — A11Y-4 old); global focus-visible fallback ring (A11Y-5 old); `<MotionConfig reducedMotion="user">` + confetti gated on reduce-motion.

**STILL PRESENT:**
- **A11Y-1 [P1] The two How-to-Play modals are not accessible dialogs** (UX-1) — the first modal a new player meets.
- **A11Y-2 [P2] Sub-44px targets** (UX-2).
- **A11Y-3 [P2] Hardcoded English aria-labels leak into Dutch VoiceOver** — chat emote labels + "Send" (`ChatPanel.jsx:17,321`), Notebook arrows ("Previous/Next player"), `Dialog`/`toast` "Dismiss", and the ProfileSettings "Terms of Use" label (a `// TODO i18n` left in code). None go through `t`.
- **A11Y-4 [P2] Refresh button mislabeled** `aria-label={t.loading}` ("Loading…") — no `t.refresh` key exists (`BrowseLobbies.jsx:190`).
- **A11Y-5 [P2] CategorySelector announces unnamed in 2 of 3 views** (UX-6).
- **A11Y-6 [P3] Emoji-only semantics** remain in the hint-readiness list (`✅/⏳`) and Notebook guess rows (answer history itself was fixed).
- **A11Y-7 [P3] Contrast** — `text-slate-500` near the 4.5:1 floor for small text on dark glass (Terms line, input placeholders, "asked by").

---

## 14. Analytics Audit

**Product analytics now exists and is genuinely wired** — `analytics.js` + `0008_analytics.sql`, RLS-safe (insert-only, no select policy, not in Realtime, pseudonymous guest id + enum props, fire-and-forget, self-disables if the table is missing). Instrumented events (verified call sites): `app_open`, `name_set`, `lobby_created`, `lobby_joined`, `game_started`, `question_asked`, `guess_made`, `game_finished`, `play_again`.

**ANA-2 [P1/P2] The two funnels a soft-launch exists to measure are un-instrumented:**
- **Conversion:** `pack_viewed`/paywall impression (CategorySelector has zero analytics), `purchase_started`/`purchase_completed`/`purchase_failed`/`purchase_cancelled` (`payments.js` emits nothing), `restore_purchases`.
- **Virality:** `share_started`/`share_completed` (ShareCardModal — the entire viral loop).
- Also missing: `push_permission_granted/denied`, `account_deleted`.

The paywall could convert at 0% and the data would look identical. *Fix:* add `track()` at those ~6 sites before soft-launch. (Also note SEC-N5: the events table is spoofable/unthrottled — server-stamp identity or rate-limit if you'll trust the numbers.)

---

## 15. App Store / Launch Readiness Audit

**Verified GOOD / FIXED:** real Terms/EULA with a zero-tolerance UGC clause (`public/terms.html`), surfaced at the name gate and Settings via centralized `links.js`; analytics live; IAP a full RevenueCat/StoreKit integration (docs reconciled — the "no payment backend" contradiction is gone); iCloud KV backup mitigates the anon-identity SPOF; console noise down to 2 legitimate `console.error`s; dev-tools inert in store builds; Sentry opt-in with `sendDefaultPii:false`; valid icon/launch storyboard; complete account/data deletion.

**STILL PRESENT / NEW — the two that bite at submission:**
- **~~LAUNCH-1 [P1] Privacy/Terms/Support URLs 404 in shipped builds.~~ — WITHDRAWN: FALSE POSITIVE.** The audit claimed `SITE_BASE = https://jinnieoclock.com/whatsmypick` was wrong because "`public/*.html` deploy at domain root." **That was an assumption about the hosting, never verified** — and it was incorrect. The owner publishes the pages at exactly that subpath (`https://www.jinnieoclock.com/whatsmypick/privacy.html`), so the original default was right all along and nothing 404'd. Two "fixes" derived from this false premise were reverted: substituting a guessed domain, and deriving the base from `window.location.origin` (an Origin excludes the path, so that genuinely *would* have broken the subpath). `links.js` now carries the correct base with an optional `VITE_SITE_BASE` override, and the CI hard-fail added for this has been removed. **Lesson recorded:** this was the one finding in the report asserted from inference rather than evidence, and it was the one that was wrong — external hosting can't be verified from the repo and must be confirmed with the owner before being rated a launch blocker.
- **LAUNCH-2 [P1] Push has no `aps-environment` entitlement → the feature silently does nothing.** The plugin is installed, `registerPush()` is called, `notifyUser(...,'turn')` fires every turn, and the `push_tokens` table + `notify-turn` function exist — but `App.entitlements` has only the iCloud key (no `aps-environment`, no `remote-notification` background mode), so `register()` fails → no token is ever stored → `notify-turn` always sends 0. CI verifies the iCloud entitlement but not this one, so a signed build ships push-dead. *Fix:* add `aps-environment` + Push capability on the App ID / regenerated profile, set the `APNS_*` Supabase secrets, and add an `aps-environment` check to the CI entitlement guard.

**Also:**
- **LAUNCH-3 [P2] `armv7` in `UIRequiredDeviceCapabilities`** — 32-bit; the App Store is arm64-only. Stale Capacitor default. *Fix:* `arm64`.
- **LAUNCH-4 [P2] Age rating vs "general audiences." — RESOLVED, but the audit's premise was wrong.** The real defect was only that `privacy.html` claimed "suitable for general audiences" with no mention of stranger chat. The audit went further and asserted the rating "typically pushes to 12+" — **that was inferred, not verified, and it was wrong twice over**: (a) Apple retired 12+ in its 2025 tier revision (4+ / 9+ / 13+ / 16+ / 18+), and (b) with chat *and* the app's moderation controls declared, App Store Connect's questionnaire returned **4+**. The questionnaire is authoritative; 4+ is the correct rating. The Children section is now written **without any tier number** so it states the substance (chat with other players, filtering/report/mute/block, minimum data, no knowing collection from under-13s, deletion contact) and cannot contradict whatever the questionnaire returns. `APPSTORE.md §3a` now says to answer honestly and let Apple decide, rather than targeting a number. UGC controls satisfying Guideline 1.2 were already present. *No remaining action.*
- **LAUNCH-5 [P3] `privacy.html` over-describes native sign-in** that the native build hides; minor wording cleanup.

---

## 16. Complete Issue List

**P0 — Blocker**
- *(None strictly blocking a build/upload — but LAUNCH-2 ships a dead core feature, and SEC-2a/SEC-N1/SEC-N2 + GAME-N1 are launch-blocking in effect. Treated as P1 below. LAUNCH-1 was withdrawn as a false positive — see §15.)*

**P1 — Critical (fix before soft-launch)**
- **GAME-N1** Hint round has no timeout → one absent player freezes the room.
- **GAME-N4** Stale `question_deadline` after an answer-timeout → enforcement stampede hijacks a present player's turn.
- **SEC-2a** `mystery_rooms` client-writable → force-finish leaks every secret; host seizure; force-finish/flip-public.
- **SEC-N1** `submit_mystery_guess` no auth/cooldown/membership → self-guess win, brute-force win, cooldown grief.
- **SEC-N2** `play_again_mystery` callable by anyone → reset/deny any room.
- **CHAT-1** Own message vanishes on dead socket → duplicate resends.
- **UX-1 / A11Y-1** Two How-to-Play modals bypass the accessible Dialog (first modal a new player sees).
- **UX-2 / A11Y-2** Sub-44px touch targets on high-frequency in-game controls.
- **UX-3** BrowseLobbies offline == "No lobbies" dead-end (no retry).
- ~~**LAUNCH-1** Privacy/Terms/Support URLs 404 in shipped builds.~~ **Withdrawn — false positive** (the pages really are hosted at that subpath; see §15).
- **LAUNCH-2** Push has no `aps-environment` entitlement → notifications silently never send.
- **ANA-2** Purchase + share funnels un-instrumented → blind to conversion & virality.

**P2 — Important**
- **STUCK-4** Host tab-close at `finished` strands Play Again. **GAME-N2** Notebook crash on shrinking opponents. **GAME-N3** Eliminated turn-holder → present fallback taps into a void ~30–70s. **GAME-N5** `target_player_id` stores row-uuid not `user_id` → 4 guess/Notebook features silently broken (fix-induced regression).
- **SEC-2b** `correct` forgeable via UPDATE / opponents' guesses deletable. **SEC-2c** Any player row mutable/deletable (eliminate/rename opponents). **SEC-N3** `submit_mystery_word` trusts `p_user` (plant secrets). **SEC-3** Client-authoritative economy.
- **ECON-1** Play-Again self-farm throttled not closed. **ECON-2** Rage-quit preserves streak. **ECON-3** Spend loop still partial.
- **UX-4** Silent kick/rejoin/clipboard failures. **UX-5 / PERF-2** BrowseLobbies blanks to spinner on every background refetch.
- **CHAT-2** Unread badge misses background messages. **CHAT-3** Snapshot full-replace clobbers live/optimistic messages. **CHAT-4** Rate limiting client-side only. **CHAT-5** Unbounded message length on display.
- **A11Y-3** English aria-labels in Dutch. **A11Y-4** Refresh mislabeled "Loading". **A11Y-5** CategorySelector unnamed in 2/3 views.
- **PERF-1** 459 kB main chunk. **LAUNCH-3** `armv7`. ~~**LAUNCH-4** Age rating vs wording~~ — resolved (wording fixed; questionnaire returned 4+).

**P3 — Polish**
- **GAME-N6** Next asker's timer eaten by answering time; word-entry deadline uses `Date.now()`; server-time never re-synced. **GAME-N7** Word-entry host handoff not crash-safe. **GAME play-again fallback** hits revoked column under partial migration.
- **SEC-N4** Answer/resolve RPCs unauthenticated. **SEC-N5** Analytics spoofable/unthrottled. **SEC-N6** `push_tokens` delete-any/arbitrary-owner. **SEC-4** Web IAP localStorage-only. **SEC-5/6** Reports/mute evadable.
- **NET-1** Peer-profile channel multiplication + 30s polls. **NET-2** Debounce no max-wait. **NET-3** 12-cap TOCTOU.
- **CHAT-6** `isMuted` per-message parses. **CHAT-7** Non-idempotent unread / send-flag.
- **UX-6..UX-10** CategorySelector name, untaught invite players, word-grid density, dead duplicate `index.css`, `useToast` re-subscribe.
- **A11Y-6/7** Emoji-only in 2 spots, `text-slate-500` contrast.
- **ECON-4/5** Pricing / offline clock fallback. **COL-1/2** Spend path / NEW indicators. **LAUNCH-5** privacy.html wording.

**P4 — Future**
- **G-6** Solo/bot practice mode. **COL-3** Scarcity-based rarity. **PERF-5** Lazy/virtualized shop grids. Friends/rematch loop, message reactions (see §21).

---

## 17. QA Test Matrix

| Feature | Test | Expected | Actual / Risk | Sev |
|---|---|---|---|---|
| Onboarding | Fresh install → name gate | Name + rules, then home | ✅ Works | — |
| Onboarding | Open invite link as new user | Name + invite screen, then join | ✅ Named first (rules link absent) | P3 |
| Word entry | Timer expires (idle) | Removed/reset fairly, warned | ✅ Persistent warning banner + handoff | — |
| Word entry | Join in gap before Start | Blocked / must submit | ✅ `startPlaying` re-verifies live roster | — |
| Word entry | Custom "!!!" / "東京" / masked | Rejected as unguessable | ✅ normalize-empty rejected | — |
| Playing | Two players answer at once | Both recorded | ✅ Row-locked RPC | — |
| Playing | Backgrounded non-asker mid-question | Question resolves | ✅ 45s answer-timeout breaker | — |
| Playing | **Backgrounded player during HINT break** | Hint resolves / player skipped | ❌ Room freezes forever (GAME-N1) | **P1** |
| Playing | Eliminate a player mid-turn | Turn order stable | ✅ — ⚠ except turn-holder self-elim (GAME-N3) | P2 |
| Playing | Answer RPC 5xx/timeout | Retry, no data loss | ✅ Fallback scoped to function-missing | — |
| Playing | Answer-timeout fires, then next turn | Next asker gets a fresh 30s | ❌ Stale deadline → auto-ask hijacks their turn (GAME-N4) | **P1** |
| Guess | Correct guess → room alert / Notebook | Shows word + "guessed by X" | ❌ `target_player_id` mismatch → `?`, no attribution (GAME-N5) | P2 |
| Guess | Re-open guess after a wrong guess | Wrong word struck out / excluded | ❌ Filter dead, re-submittable (GAME-N5) | P2 |
| Playing | One device clock 30s fast | Timers fair | ✅ server-time — ⚠ word-entry deadline (GAME-N4) | P3 |
| Notebook | Opponent row deleted while viewing | No crash | ❌ Unclamped `pageIdx` → crash (GAME-N2) | P2 |
| Finished | Host's phone dies at results | Someone can Play Again | ❌ No handoff (STUCK-4) | P2 |
| Guess | Correct guess | +1, reveal, maybe finish | ✅ Server-authoritative | — |
| Guess | **Read opponent's word (devtools)** | Impossible | ✅ Secret isolated (normal path) | — |
| Guess | **Force `status='finished'`** | Rejected | ❌ Leaks every secret (SEC-2a) | **P1** |
| Guess | **Self-guess / brute-force** | Rejected / rate-limited | ❌ Self-guess & brute-force win (SEC-N1) | **P1** |
| Room | **Call `play_again_mystery` on any room** | Rejected (not host) | ❌ Anyone resets any room (SEC-N2) | **P1** |
| Guess | Forge `correct=true` via UPDATE | Rejected | ❌ UPDATE open (SEC-2b) | P2 |
| Rewards | 2 tabs + Play Again | No exploit | ⚠ Throttled, not closed (ECON-1) | P2 |
| Rewards | Finish match (StrictMode) | Grant once | ✅ Idempotent | — |
| Chat | Send 2 msgs fast | Both sent | ✅ (CHAT-1 old fixed) | — |
| Chat | Dead socket after send | Own bubble persists | ❌ Vanishes → duplicate resend (CHAT-1) | P1 |
| Chat | Background → return, msgs arrived | Badge accurate | ❌ Badge shows 0 (CHAT-2) | P2 |
| Chat | 50k-char injected message | Layout intact | ❌ Rendered unbounded (CHAT-5) | P2 |
| Offline | Reopen mid-game offline | "Connection problem, retry" | ✅ On MysteryGame | — |
| Offline | Browse lobbies, no network | Error + retry | ❌ Shows "No lobbies" (UX-3) | P1 |
| Scale | Public rooms churning | Silent list update | ❌ Whole list flashes to spinner (UX-5) | P2 |
| A11y | VoiceOver a join error | Announced | ✅ aria-live toasts | — |
| A11y | Enlarge system text | UI scales | ✅ Dynamic Type enabled | — |
| A11y | Open How-to-Play, keyboard | Focus trapped, Escape closes | ❌ Hand-rolled overlay (UX-1) | P1 |
| Launch | Tap Privacy in shipped build | Policy loads | ✅ Hosted at the configured subpath (LAUNCH-1 withdrawn) | — |
| Launch | Your turn while backgrounded | Push arrives | ❌ No `aps-environment` → silent (LAUNCH-2) | P1 |
| Deletion | Delete profile/account | All data removed | ✅ Complete | — |

---

## 18. Priority Roadmap

**Phase 0 — Decide (before any code)**
1. **Game-integrity decision (SEC-2a/SEC-N1/N2/2b/2c/N3).** The honest choice is now to **bind writes to `auth.uid()`** (the anon session already exists) and lock the base game tables to SELECT-only for anon, routing state transitions through RPCs that check membership + turn + rate + finish. At minimum, **`mystery_rooms` must stop being client-writable** (closes the secret leak) and the four gameplay RPCs must derive/verify the caller and rate-limit guesses. Note "honor system + document" no longer covers the secret leak — that's a one-write disclosure, not a score.

**Phase 1 — Launch blockers (P1)**
2. **Close the two remaining turn-freeze/hijack paths.** (a) Hint-round timeout (GAME-N1) — a hint deadline + enforcement mirroring `resolve_stalled_question`. (b) Refresh `question_deadline = now()+30s` server-side wherever a question completes (GAME-N4) — one ~10-line SQL change that also fixes GAME-N6 and the post-hint race. (Highest reliability priority.)
3. **Authorize the RPCs & lock `mystery_rooms`** (Phase-0 decision): server-side guess cooldown + membership + reject self-target; host/status guards on `play_again_mystery` and `submit_mystery_word`; revoke client UPDATE on `mystery_rooms` (route finish/host/visibility through checked RPCs); revoke UPDATE/DELETE on `mystery_guesses`.
4. ~~**LAUNCH-1** Inject `VITE_SITE_BASE` in CI.~~ Withdrawn — false positive; the baked-in base is correct (§15).
5. **LAUNCH-2** Add `aps-environment` entitlement + Push capability + `APNS_*` secrets; add a CI check.
6. **CHAT-1** Reconcile own message from the returned row, not the echo.
7. **UX-1/A11Y-1** Move both How-to-Play modals to the accessible Dialog.
8. **UX-2/A11Y-2** 44px hit areas on emotes/send/switches/leave/Join/notebook dots.
9. **UX-3** Real retry state on BrowseLobbies (distinguish offline from empty).
10. **ANA-2** Instrument `pack_viewed`, `purchase_*`, `restore`, `share_completed`.

**Phase 2 — Important (P2)**
11. STUCK-4 host reassignment at `finished`; GAME-N2 clamp `pageIdx`; GAME-N3 deterministic questioner advance; GAME-N5 one-line `target_player_id` RPC fix (restores 4 broken features).
12. SEC-3 (accept-and-document, or gate nothing sensitive on it); ECON-1 tighten (cap across rooms / server-check); ECON-2 break streak on `beforeunload`; ECON-3 open a "buy anytime" path.
13. UX-4 surface kick/rejoin/clipboard errors; UX-5/PERF-2 silent background refetch.
14. CHAT-2 count-on-wake; CHAT-3 merge snapshot; CHAT-4 server rate-limit; CHAT-5 display cap.
15. A11Y-3/4/5 localize aria-labels, fix refresh label, name all CategorySelector views.
16. PERF-1 lazy-load data modules + fix `cloudBackup` double-import; LAUNCH-3 `arm64` ✅; LAUNCH-4 age rating ✅ (4+ per Apple's questionnaire).

**Phase 3 — Polish (P3) & Future (P4)**
17. GAME-N4/N5, SEC-N4/N5/N6, NET-1/2/3, CHAT-6/7, UX-6..10, A11Y-6/7, ECON-4/5, COL-1/2, LAUNCH-5; then the product gaps in §21 (friends/rematch, solo/bot, reactions, scarcity).

---

## 19. Ship / No-Ship Assessment

| Dimension | Score | One-line justification |
|---|---|---|
| Technical | **6.5/10** | Clean build/lint/types; four soft-locks + turn/merge races fixed; held back by one new hint-round soft-lock and unauthorized RPCs. |
| Gameplay | **6/10** | Satisfying, now robust to backgrounding *except* hint rounds; core skill still defeatable via self-guess/brute-force. |
| UX | **7/10** | Invite onboarding + error states fixed; residue in touch targets, two modals, one offline dead-end. |
| UI | **8.5/10** | A real, coherent design system — the standout. |
| Performance | **7/10** | Good splits, N+1 index, debounced browse; a heavy main chunk and a spinner-flash regression remain. |
| Security | **4/10** | Computation hardened, authorization wide open: force-finish leaks secrets, self-guess/brute-force win, grief any room. |
| Retention | **5.5/10** | Deep cosmetics + live analytics + season content fixed; no working push, no rematch/friends, cold-start gap. |
| Social | **6/10** | Chat much improved; own-message loss, unread-on-wake gap, no durable block. |
| Production readiness | **6/10** | Terms/IAP/analytics done; the push-entitlement gap blocks a clean submission (the privacy-URL finding was withdrawn — §15). |
| **Overall** | **6/10** | A well-built game a **short, sharply-defined** hardening pass from soft-launch quality. |

### SHIP NOW: **NO**

**These are the exact issues preventing shipping:**
1. **GAME-N1 + GAME-N4 (P1)** — the hint round (every 5 cycles) has no timeout, so one backgrounded player freezes the room; and because the turn deadline isn't refreshed when a question completes, the answer-timeout recovery routinely fires a stampede of auto-questions that hijack a present player's turn. Two "the game just does the wrong thing" bugs on the normal path — the second is a ~10-line SQL fix.
2. **SEC-2a + SEC-N1 + SEC-N2 (P1)** — force-finish leaks every secret word; a self-guess or brute-force wins any round; anyone can reset any room. The security hardening secured computation but not authorization; `mystery_rooms` must be locked and the RPCs must verify their caller.
3. ~~**LAUNCH-1 (P1)** — privacy/terms/support links point at a 404.~~ **Withdrawn: false positive.** The pages are genuinely hosted at the configured subpath; this was inferred from the repo instead of confirmed with the owner, and it was wrong (§15).
4. **LAUNCH-2 (P1)** — push is fully wired but has no `aps-environment` entitlement, so it silently sends nothing. The one re-engagement channel is dead on arrival.
5. **CHAT-1 (P1)** — own messages can vanish on a stalled socket and get resent as duplicates, on the exact mobile app-switch path this game lives on.
6. **UX-1/UX-2/UX-3 (P1)** — the first modal a new player sees isn't an accessible dialog; core in-game controls are below 44px; and the Browse screen still shows a false "no lobbies" dead-end offline.
7. **ANA-2 (P1)** — the purchase and share funnels are un-instrumented, so a soft-launch would be blind to the two numbers (conversion, virality) it exists to learn.

Clear Phase 0 + Phase 1 and this is a confident soft-launch candidate — the UI, engine, and meta are already there; what's missing is authorization, one soft-lock, two config lines, and a short correctness/polish list.

---

## 20. Top 20 Things To Fix (ranked)

1. **GAME-N1 + GAME-N4** Hint-round timeout, and refresh `question_deadline` on question completion (one SQL change) so a present player's turn isn't hijacked after an answer-timeout. *P1*
2. **SEC-2a** Revoke client UPDATE on `mystery_rooms` (stops force-finish leaking every secret). *P1*
3. **SEC-N1** Bind `submit_mystery_guess` to the caller; reject self-target; server-side guess cooldown. *P1*
4. **SEC-N2** Guard `play_again_mystery`/`submit_mystery_word` to the room's host/member. *P1*
5. ~~**LAUNCH-1** Fix the privacy/terms/support URLs.~~ Withdrawn — false positive; they already resolve (§15). *(Slot intentionally left rather than renumbered, so the IDs still line up with the sections above.)*
6. **LAUNCH-2** Add the `aps-environment` push entitlement (+ APNs secrets, CI check). *P1*
7. **CHAT-1** Reconcile own chat message from the insert's returned row, not the echo. *P1*
8. **UX-1** Move both How-to-Play modals to the accessible Dialog. *P1*
9. **UX-2** 44px hit areas on emotes/send/switches/leave/Join/notebook dots. *P1*
10. **UX-3** Real offline retry state on BrowseLobbies. *P1*
11. **ANA-2** Instrument `pack_viewed`, `purchase_*`, `restore`, `share_completed`. *P1*
12. **STUCK-4** Host reassignment (or "claim host") at the finished screen. *P2*
13. **GAME-N2** Clamp Notebook `pageIdx` when the opponents list shrinks. *P2*
14. **SEC-2b/2c** Revoke `mystery_guesses` UPDATE/DELETE; stop cross-player row writes. *P2*
15. **CHAT-2/CHAT-3** Count background messages on wake; merge the snapshot instead of replacing. *P2*
16. **CHAT-5** Cap message length on display, not just on send. *P2*
17. **UX-5/PERF-2** Stop BrowseLobbies flashing the whole list to a spinner on background refetch. *P2*
18. **PERF-1** Lazy-load the question/cosmetic data modules; fix the `cloudBackup` double-import. *P2*
19. **A11Y-3/4/5** Localize aria-labels; fix the "Loading" refresh label; name all CategorySelector views. *P2*
20. **GAME-N5 + ECON-1 + LAUNCH-3** One-line `target_player_id` RPC fix (restores the correct-guess alert + Notebook attribution + re-guess filter); tighten the replay farm across rooms; `arm64`. *P2*

---

## 21. Things You Didn't Think To Ask About

- **The security hardening created a false sense of safety.** The code is now full of accurate comments ("SEC-1 keeps it off the player row", "client can't forge `correct`") that are *true for the path they guard* but sit next to wide-open doors (`mystery_rooms` UPDATE, unauthenticated RPCs). A reviewer skimming the migration would conclude the game is locked down. It is locked down against forging a *result*; it is not locked down against *authorization*. That gap between the comments' confidence and the actual posture is exactly where the remaining exploits live.
- **A game freezing in normal play is still the #1 thing players will complain about — you moved the freeze, you didn't remove it.** STUCK-1 killed the answer-freeze; GAME-N1 is the same bug relocated to the hint round. It still triggers when someone takes a phone call, still shows no error, still needs no cheater. This outranks every cosmetic item for launch.
- **The fix wave introduced its own regressions — budget a focused regression pass, not just new features.** Three of the findings above are *products of the fixes themselves*: the SEC-1 secret split changed `target_player_id` to a row-uuid and silently broke four guess/Notebook features (GAME-N5); the STUCK-1 answer-timeout synchronizes enforcers onto a stale deadline and hijacks the next turn (GAME-N4); the debounce that fixed the BrowseLobbies storm now flashes the whole list to a spinner (UX-5). A large, fast hardening pass with no automated gameplay tests will keep doing this. The single highest-leverage process fix is a handful of integration tests around guess resolution, the turn/deadline machine, and chat reconciliation — the three areas that have each regressed once already.
- **Cold-start / empty-lobby death spiral (unchanged).** No solo/bot practice mode; a new installer with no friends online and empty Browse has nothing to do. This is still the highest-impact *product* gap, above most bugs.
- **No "play again with the same people" loop (unchanged).** The strongest party-game retention hook is missing; the social graph evaporates every session. Recent-players + rematch would beat most of the P2 list for retention.
- **Push looks done but is dead (LAUNCH-2).** The most dangerous kind of gap: `notifyUser` fires, the function exists, the table exists — and nothing arrives, because one entitlement is missing and CI doesn't check for it. It will read as "push works" in code review and "push is broken" in production.
- **The paid content is still bundled and now brute-forceable.** Premium word lists ship in the JS, and `submit_mystery_guess` has no cooldown, so the words are both readable *and* the mechanism to "win" with them is un-throttled. Reconsider selling categories (which the client has) versus cosmetics (which, once SEC-3 is addressed, players can't self-grant).
- **Griefing blast radius is the whole app.** Open DELETE on every game table means one anon can wipe every in-progress room, and `play_again_mystery`/force-finish let them reset or end any room by code. Scope writes/deletes to the caller's participation to bound this before you have rooms worth griefing.
- **Moderation is still blind.** Reports carry no message content and a spoofable reporter id; the queue is floodable and un-actionable. The App Store checkbox is satisfied; real moderation is not.
- **Two `index.css` files, one dead.** Editing the root copy silently does nothing — a latent foot-gun.
- **Analytics is live but the numbers are corruptible (SEC-N5).** You can finally measure the funnel — but the events table is spoofable and unthrottled, so any conclusions you draw at scale are only as trustworthy as the absence of a bored attacker.

**The one-sentence version:** the team fixed almost everything the last audit found and the game is genuinely close — what's left is to **authorize the server actions it already moved server-side**, **close the one soft-lock it left uncovered**, **wire the two launch config lines** (privacy URL, push entitlement), and **instrument the money and share events** — after which this is a confident soft-launch.

---

*End of audit. No code was modified. Awaiting approval of the Phase 0 integrity decision and the Phase 1 plan before implementation.*
