# PRODUCTION AUDIT — "What's My Pick?"

**Full pre-soft-launch production & stress-test review**
Date: 2026-08-11 · Reviewed at commit on `claude/mobile-game-production-audit-s24bop`
Method: full source read of every gameplay, data, migration, economy, cosmetic, payment, and shell file; verified `npm run lint`, `npm run typecheck`, and a production `npm run build` (all pass); multi-disciplinary review across engineering, backend, QA, game design, UX/UI, economy, security, analytics, accessibility, and release.

> **Scope note.** This is an audit only. No application code was changed. Recommendations are prioritized at the end; implementation should begin only after you approve the plan.

---

## 1. Executive Summary

**What this is:** a genuinely good solo/small-team build with a professional visual identity, thoughtful engineering, and a rich cosmetic meta — held back from a professional soft-launch by a small number of structural issues, most of which trace back to one root cause: **the client is trusted for everything.**

The codebase is clean. Lint, typecheck, and a production build all pass with zero errors. The engineering comments show patterns that were clearly earned on real devices (shared deadlines instead of local timers, wake-up re-subscription, presence-based "away" detection, optimistic chat with retry, idempotent reward grants). The UI is not a template — it is a coherent dark-neon design system with real lighting logic. Account deletion, privacy plumbing, IAP restore, and the dev-tools gating are all handled correctly.

But the game is a **word-guessing game whose secret words are shipped in plaintext to every opponent's browser**, its scores and economy are written by the client with wide-open database permissions, its progression currency can be minted with two browser tabs, and it would launch with **zero product analytics** and **no push notifications** — i.e., blind and with no re-engagement channel. The Dutch localization is ~85% done and leaks English in high-visibility places. Accessibility is systematically weak in exactly the spots automated tools miss.

**And — most seriously for reliability — a live game can get permanently stuck in at least four distinct ways** (see §4a), the most common being that **one player backgrounding their phone mid-question freezes the whole room** because there is no answer timeout. Backgrounding is normal mobile behavior, so this hits real multi-device sessions routinely. Many failed writes are silently swallowed (`.catch(() => {})`), so these degrade with no user-facing error; the only universal backstop is a 2-hour cron.

**None of this reads as "cheap."** It reads as a strong build that needs one focused hardening pass before it meets its own ambition.

**Ship now: NO.** The blocking issues are enumerated in §19. The two most important: (1) fix the state-machine soft-locks so honest games can't freeze (§4a), and (2) close the secret-word/score exposure, or accept and clearly document that the game is honor-system only (and stop surfacing scores/stats as if they were authoritative).

**Headline numbers**

| Dimension | Score |
|---|---|
| Technical | 6/10 |
| Gameplay | 5/10 |
| UX | 6/10 |
| UI | 8/10 |
| Performance | 6/10 |
| Security | 3/10 |
| Retention | 5/10 |
| Social | 5/10 |
| Production readiness | 5/10 |
| **Overall** | **5/10** |

---

## 2. Game Overview (verified against implementation)

**What's My Pick?** is a real-time multiplayer party game in the 20-questions family. It is **not** assumption — every feature below was traced to working code.

- **Core loop:** 2–12 players join a room (code or public browse). Each secretly picks a word from a shared category (or a custom word). Players take turns asking yes/no questions; everyone answers about their own secret word; players use the accumulated yes/no "clue table" (the Notebook) to guess opponents' words. A correct guess reveals that player's word, scores +1, and removes them from the "to-guess" pool. Last-standing / highest-score ends the round.
- **Twists:** a **hint round** every 5 full question-cycles (each active player submits a free-text hint); an **auto-question** system that fires from a static per-category bank when a turn timer (30s) expires or a player backgrounds the app.
- **Identity:** login-less. Every player is a random `guest_xxxxxxxxx` in `localStorage` (`guestIdentity.js`). Optional email/Google/Apple sign-in exists on web only and never gates gameplay. Native iOS v1 ships account-less by design (a defensible Guideline 5.1.1(v)/4.8 posture).
- **Backend:** Supabase only — Postgres + Realtime + RLS. Five game tables (`mystery_rooms/players/questions/guesses/chats`) plus `player_profiles` and `player_reports`. No app server. One Edge Function (`delete-account`) using the service-role key. Stale-lobby cleanup via `pg_cron` hourly.
- **Progression/meta:** per-match Picks (soft currency) + XP/levels (cap 50) + daily/weekly/season challenges + daily-login streak. A large cosmetic catalog — emblems, banners, borders, titles, name colors — across 6 rarities (common → mythic + a "special" tier), grouped into collections with completion rewards. Profiles sync to Supabase so peers see each other's cosmetics in lobbies/cards.
- **Monetization:** **6 premium category packs** via Apple IAP (RevenueCat, non-consumable, $2.99 each). Picks/cosmetics are **grind-only** (no currency IAP). *(Note: the README's "no payments" line is stale — payments are wired.)*
- **Social:** per-room chat (emotes, emote-rain, optimistic send + retry), player cards, mute (local), report (write-only table), host kick.
- **Platform:** React 18 + Vite 6 + Tailwind, wrapped with Capacitor 8 for iOS. Framer Motion, canvas-confetti, Sentry (optional), iCloud KV backup of identity/progression.

**Target player:** casual social players, friends-and-family groups, plus public-lobby drop-in. Dutch + English markets (NL is a first-class language).

---

## 3. Player Journey Audit

Walking the journey as a brand-new player, step by step.

| Step | State | Verdict |
|---|---|---|
| **Install / first launch** | Dark launch screen, iCloud identity restore race (3s cap) before minting an id — thoughtful. | ✅ Good |
| **Name gate** | Clean single input; keyboard handled well (resize disabled to avoid jump). After naming, how-to-play auto-opens once, then the day-1 reward toast — nicely sequenced. | ✅ Good |
| **Home** | Strong hero, clear Create / Join / Browse. "Game in progress" rejoin banner after an iOS kill is excellent. | ✅ Good |
| **Create → visibility sheet → lobby** | Public/private choice creates the room. Room-code copy + native share. Category picker. 3-2-1 cancelable start. | ✅ Good |
| **⚠ Invite-link join (the growth path)** | **BROKEN.** A first-timer who taps a shared link lands on `/mystery/:code`, is **auto-joined with an empty display name** and **never sees the rules or name gate** (`MysteryGame.jsx:100-101,165-175`; `guestIdentity.js` returns `name:''`). Avatar shows `?`, the join toast reads "… joined." This is the single most important acquisition path and it drops new users in nameless and untaught. **[UX-1, P1]** |
| **Word entry** | 60s shared deadline, word grid, custom input, readiness strip. Timeout can **eject** a non-submitter with only a 3.5s toast (silent to VoiceOver). Word grid is the densest, smallest-target, highest-stakes tap in the game. **[UX-9/UX-12]** |
| **Playing** | Turn timer, Notebook clue table, guess modal, chat, players tab. Solid. Auto-question explainer banner (persistent, not a toast) is a nice touch. | ✅ Mostly good |
| **Answer** | Yes/No is a big clear card; atomic server RPC merges answers (good). Answer results in history are **emoji-only** (`✅/❌`), ambiguous to screen readers. | ⚠ minor |
| **Win / Lose** | Confetti (reduce-motion aware), clear scoreboard, "no one scored" walkover handled honestly. | ✅ Good |
| **Rewards** | Animated reward summary (Picks/XP/level-ups/unlocks/challenges). Genuinely satisfying. | ✅ Good |
| **Progression / Collection** | Deep, polished album/shop/challenge hub. But **you can't buy an item that isn't in today's 3-slot rotation** (`Profile.jsx`), a broken spend loop. **[ECON-4]** |
| **Profile / Share** | Real generated share card (not a screenshot), native share sheet, text fallback. | ✅ Good |
| **Chat** | Works, optimistic, retry. But a **second message sent while the first is in flight is silently dropped** (`ChatPanel.jsx:142-147`), and the **unread badge stops updating after the app is backgrounded once** (`useUnreadChat.js`). **[CHAT-1, CHAT-2]** |
| **Return** | Rejoin banner + Settings "leave/rejoin" cover it. But **re-opening offline shows "Room not found"** — a false dead-end (`MysteryGame.jsx:128-130,216`). **[UX-2]** |

**Journey verdict:** the *created-room* path is polished end to end; the *invited-player* path — the one that actually grows the game — is the weakest link.

---

## 4. Gameplay Audit ("Supercell-level" lens)

**Strengths**
- The core mechanic is understandable in one sentence and the first-30-seconds/first-3-minutes bar is met once you're in a room with a friend.
- Real design maturity: shared deadlines make turns robust to backgrounding; the "auto-question" keeps a stalled game moving; the Notebook is a genuinely good clue-tracking surface; hint rounds add pacing variety; the walkover (0-correct) case is handled honestly instead of crowning phantom winners.
- Winning feels satisfying (confetti + haptics + reward summary). Losing is fair (you see everyone's word and the clue table).

**Weaknesses & risks**
- **G-1 [P1] Skill is unprotected from trivial cheating.** The entire challenge is "deduce the secret word," yet secret words are readable client-side (see §8, SEC-1). A curious player wins every round instantly. This doesn't crash anything, but it quietly guts the reason to play.
- **G-2 [P2] Question variety is finite and English-only.** The auto-question bank (`questionBank.js`) is per-category but static; a room that idles a lot will see repeats, and in a Dutch game the auto-questions and hardcoded fallbacks ("Is it bigger than a cat?") switch the game into English mid-round and store that permanently in history/notebook. **[LOC-2]**
- **G-3 [P2] Guess cadence is client-gated only.** `canGuess` (guess cooldown) is enforced in the client; nothing server-side prevents a modified client from guessing every turn.
- **G-4 [P3] Turn/enforcement races.** Deadline enforcement is staggered and re-checks fresh state (good), but two enforcers firing inside the stagger window can still occasionally post a duplicate auto-question. Low frequency, self-limited by `enforcedKeyRef`.
- **G-5 [P3] Long games have no natural close.** `max_rounds` exists in the schema (default 10) but is not enforced in play; games end only when players are guessed out or leave. Fine for parties, but a stalemate (nobody guessing) relies on people leaving.
- **G-6 [P4] No solo/practice or bot mode.** With no friends online and empty public lobbies (cold-start), a new installer can hit a dead end with nothing to do. A single-player tutorial round vs. a bot would de-risk both onboarding and empty-lobby churn.

**Reason to play another round / return tomorrow:** cosmetics + daily login + challenges provide it — but the economy exploit (§9, ECON-1) and the broken spend loop (ECON-4) undercut "what am I working toward," and there's **no push notification** to actually pull anyone back (§14/§15).

---

## 4a. Game State-Machine & Soft-Lock Audit (can the game get permanently stuck?)

**Yes — four distinct ways today**, plus several correctness races that steal turns, double-award, or reintroduce a bug a prior migration was written to kill. This is the reliability story behind the lowered Gameplay/Technical scores. The state machine is `lobby → word_entry → playing → finished`, driven entirely by clients writing shared rows; the only server logic is the `submit_mystery_answer` RPC and the hourly 2-hour-stale cron. Because clients are authoritative and many writes are swallowed with `.catch(() => {})`, these failures are silent.

**The four permanent-stuck paths**

- **STUCK-1 [P0] No answer timeout — one ghost player freezes the entire room.** The turn-deadline/enforcement machinery covers only the *asker* being absent; **answers have no deadline anywhere**. `currentQuestionPending` stays true until *every* active non-asker answers (`PlayingPhase.jsx:81-84`), and the enforcement loop explicitly bails while a question is pending (`:180`). `beforeunload` cleanup only runs in lobby (`MysteryGame.jsx:179`). So if any player's app is killed / phone dies mid-question (their row stays active), the question waits on them **forever** — `isMyTurnToAsk` is false for everyone, nobody can advance, and the room is soft-locked on "waiting for answers" until that player returns, someone happens to guess their word, or the 2h cron deletes the room. **Backgrounding mid-game is the normal mobile case, so this hits virtually every real multi-device session.** *Fix:* extend enforcement to fire when pending past deadline+grace — auto-fill/skip the missing answer or eliminate the chronically-absent player (mirroring word-entry's stalled-player removal). Complexity: M.
- **STUCK-2 [P1] Host removed by word-entry enforcement strands the room.** Word-entry enforcement *deletes* stalled players (`WordEntryPhase.jsx:111`) but **never hands off `host_id`** (unlike `roomLifecycle.leaveRoom`). If the host backgrounds during word entry and is deleted, the "Everyone Ready" start button (host-gated, `:342`) and lobby-return (also host-gated) point at a deleted player → room dead until the cron. *Fix:* reassign host to the first survivor after deleting stalled players. Complexity: S.
- **STUCK-3 [P1] A player can enter `playing` with an empty (or unguessable) secret word → unfinishable game.** Auto-join is allowed during `word_entry` (`MysteryGame.jsx:154-175`, row defaults `secret_word=''`), and `startPlaying` (`WordEntryPhase.jsx:166-176`) **does not re-verify** all players submitted — the button merely rendered when `allSubmitted` was last true. A player who joins in the gap before the host taps starts with `secret_word=''`, which `normalizeGuess` can never match (`GuessModal.jsx:43`). With two such players, the `stillActive <= 1` finish condition is unreachable via guessing. Same effect for profanity-masked custom words (`"kut"` → `"***"`) and symbol/non-Latin words that `normalizeGuess` empties (**GAME-8 / was noted as CHAT-adjacent**). *Fix:* in `startPlaying` refetch and abort if any `!word_submitted`; reject custom words whose `normalizeGuess` is empty or altered by `cleanText`; block auto-join once `allSubmitted`. Complexity: S.
- **STUCK-4 [P2] Host absent at `finished` → nobody can Play Again.** Play Again is host-only (`FinishedPhase.jsx:244-255`); a host whose app died still holds `host_id`, and there's no host reassignment outside explicit leave/lobby paths. Remaining players wait on a rematch that can never come. *Fix:* reuse the lobby presence channel in all phases and let any player claim host (or Play Again) when the host is absent > N seconds. Complexity: M.

**Turn-order & answer-merge correctness races**

- **GAME-1 [P1] Turn rotation shifts when the roster changes.** `current_questioner_index` is a positional index into a *live, shrinking* `askingPlayers` array, never remapped (`PlayingPhase.jsx:70-71,269`). When a player is eliminated, the questioner can instantly change mid-turn (input panel vanishes while typing); during the 400ms debounce window two clients can disagree about the roster, both see `isMyTurnToAsk`, and both post a question + advance the index (double turn, skipped player, skewed hint cadence & guess cooldown). *Fix:* store the questioner's `user_id` and advance to the next active player after it, or normalize the index transactionally on elimination. Complexity: M.
- **GAME-2 [P1] RPC fallback can erase other players' answers on any transient error.** `submitAnswer` falls back to a client read-modify-write on *any* RPC error, not just "function missing" (`PlayingPhase.jsx:304-316`) — including a 5xx/timeout where the RPC may have succeeded — overwriting the whole `answers` jsonb with a stale local map. **This reintroduces the exact lost-update bug migration 0006 was written to kill.** *Fix:* only fall back on function-missing (`42883`/`PGRST202`); otherwise surface + retry, or refetch the row before merging. Complexity: S.
- **GAME-3 [P1] Client clock skew breaks both timers.** Deadlines are minted from one client's clock and enforced against another's (`PlayingPhase.jsx:37,185-186`; `WordEntryPhase.jsx:96`) with only a 6s grace. A device 30s fast auto-asks on behalf of every asker every turn, and in word entry *deletes every not-yet-submitted player* ~6s in. *Fix:* derive a server-time offset once (`select now()` or a write echo) and use it in both countdown and enforcement; widen the grace. Complexity: M.
- **GAME-4 [P1] Duplicate auto-question / double turn-advance on wake, and manual-vs-timer race.** `handleAutoQuestion`/`submitQuestionText` do **no fresh-state re-check** before creating the question + advancing the index (only the *enforcer* path does), so a device waking after the deadline fires a stale-props tick that double-asks/double-advances (a player's turn is skipped, two "Auto" questions appear). `submittingQ` and `autoAsking` are two different in-flight flags, so a tap on "Ask" as the timer hits 0 runs both paths. *Fix:* route both through the enforcer's fresh-state re-check; merge the two guards. Complexity: S/M.
- **GAME-5 [P2] Failed enforcement permanently disarms that client for the turn.** `enforcedKeyRef`/`enforcedRef` are latched *before* the async write (`PlayingPhase.jsx:187-189`; `WordEntryPhase.jsx:97-98`); if the write fails, the key never changes (index/count unchanged) so it never retries — despite the comment claiming it will. In a 2-player game the sole enforcer's one blip = permanent stall. *Fix:* latch only after a successful write. Complexity: S.
- **GAME-6 [P2] Simultaneous correct guesses double-award and can miss the finish.** Correctness, reveal, score (+1 read-modify-write), and the `stillActive <= 1 → finished` check are all computed from local props (`GuessModal.jsx:58-76`); two players revealing the last two actives can each see `stillActive == 2` and neither writes `finished` → 0 active players, game limps on. Two players guessing the same target both score, changing the round winner. *Fix:* server-side guess resolution (ties into SEC-1), or refetch players before reveal/finish and skip if already revealed. Complexity: M (S for the refetch mitigation).

**Reliability / lifecycle**

- **GAME-7 [P2] Perpetual resubscribe / battery-drain loop.** `MysteryGame.jsx:90-96` schedules a 3s retry on channel `CLOSED`, but cleanup calls `clearTimeout` *before* `removeChannel` (`:132-136`), and supabase-js fires `CLOSED` on teardown — so each healthy epoch's own cleanup schedules a retry that bumps `sessionEpoch`, which tears down + resubscribes 4 channels + runs a 4-table `loadAll` **every ~3s for the rest of the session**. State stays correct (it's effectively polling), which masks the constant load/battery cost. *Fix:* mark disposal and no-op `handleStatus` after teardown, or ignore `CLOSED` (retry only on `CHANNEL_ERROR`/`TIMED_OUT`). Complexity: S.
- **GAME-8 [P3] No `unique (room_code, user_id)` constraint; 12-cap is check-then-insert.** `0001_init.sql:102` is a plain index; join paths read-then-create. Concurrent joins (synced guest id across devices, or many taps on a public lobby) yield duplicate/phantom player rows (feeds STUCK-1) or a 13th player. *Fix:* unique constraint + upsert; enforce the cap in a trigger. Complexity: S/M.
- **GAME-9 [P3] Notebook can crash on a shrinking opponents list.** `Notebook.jsx:31,64` dereferences `opponents[pageIdx]` and `target.user_id` unguarded; a player-row deletion mid-view throws to the ErrorBoundary. *Fix:* clamp `pageIdx` / guard `target`. Complexity: S.
- **GAME-10 [P3] DELETE realtime events bypass the room filter.** Supabase doesn't apply column filters to DELETE payloads, so `room_code=eq.X` channels receive every room's deletions app-wide and refetch (`MysteryGame.jsx:109-127`), and `max_rounds` is dead code (written, never read). *Fix:* re-check `room_code` before refetch in all handlers; remove or implement `max_rounds`. Complexity: S.

*(Additional lower-severity state-machine items — countdown not re-validated for solo start, non-atomic `submitQuestionText`/`playAgain` writes with console-only failure, hint-phase bookkeeping breaking on roster change, guess cooldown counting hint rows, refresh-in-lobby misread as a host kick because `sendBeacon` is described but not used — are folded into §16.)*

---

## 5. UX / UI Audit

**UI craft is the project's strongest dimension (8/10).** One card material, one input well, one gold CTA, one header button, tokenized; consistent spacing; phase-consistent tab bars; real empty states; lighting logic (rim light, inner shadow, cast shadow) rather than flat gradients. This genuinely looks like a shipped game.

**UX gaps (the last 10%):**

- **UX-1 [P1]** Invite-link players onboard nameless and untaught (see §3).
- **UX-2 [P1]** Offline/failed room load renders "Room not found" instead of a retry state (`MysteryGame.jsx:128-130`). Same anti-pattern in BrowseLobbies (network error → "No open lobbies", `BrowseLobbies.jsx:51-53`) and in silent `Play Again`/kick failures (`FinishedPhase.jsx:150`, `LobbyPhase.jsx:453`).
- **UX-3 [P2]** **Toast flood.** `TOAST_LIMIT = 20`, each 3.5s fixed. A public lobby filling up fires 7–11 stacked join toasts that blanket the UI (including the Start button). Destructive error toasts with long `e.message` also vanish in 3.5s — unreadable.
- **UX-4 [P2]** **Modal dismissal is inconsistent.** Some close on backdrop tap (create sheet, player card, purchase, collection, delete-confirm, share), others don't (how-to-play, GuessModal). None handle **Escape**. Users learn "tap outside" from half the app.
- **UX-5 [P2]** **Sub-44px touch targets** on primary controls: Join button 40px (`Home.jsx:412`), chat send 40px / emotes 36px, Playing leave 36px, Sound/Haptics switches 20×36px, Notebook page dots ~20px.
- **UX-6 [P2]** **Keyboard overlap risk** on the Playing ask-input, GuessModal submit, and WordEntry lock-in on short screens with the native keyboard open — needs on-device verification; no scroll-into-view guarantees the CTA stays visible.
- **UX-7 [P3]** Bottom-sheet modals inconsistently apply home-indicator safe-area padding (create sheet does; how-to-play, GuessModal don't) — primary buttons can sit in the gesture zone.
- **UX-8 [P3]** Nested interactive element in the Home profile card (a `span onClick` for Shop inside a `role=button` card) — not keyboard/SR reachable, high mis-tap.
- **UX-9 [P2]** Word-entry timeout ejects a player with only a fleeting toast — a severe consequence behind a weak, easily-missed cue.
- **UX-10 [P3]** Copy-room-code has no feedback in Playing and a false-success checkmark in Lobby (no `.catch` on `clipboard.writeText`).
- **UX-11 [P3]** `QuickEquip` renders a **blank panel with no empty state** if a player owns nothing in a bucket (new/reset players).
- **UX-12 [P3]** Word grid legibility floor: 11px cells, 3 columns, 60s clock — the highest-stakes tap has the smallest targets; Dutch (longer words) squeezes further. A scroll-friendly class already exists in CSS but is unused here.
- **UX-13 [P3]** ~8 concurrent infinite animations on idle Home (twinkle, drift, hero-float, hero-glow, gold-breathe, shimmer, two live-pulses) — battery cost on older devices; none pause when hidden.

*(Full UX list — ~30 items — in §16.)*

---

## 6. QA & Stress-Test Results

Findings from conceptual + code-level stress testing. (Matrix in §17.)

- **Rapid answer submission / simultaneous answers:** ✅ Handled. Migration 0006's `submit_mystery_answer` RPC merges atomically with a row lock; client falls back to a racy merge only if the RPC isn't deployed.
- **Rapid chat send:** ❌ **Silent drop** of the second message while the first is in flight (CHAT-1). No rate limit (CHAT-14).
- **Double correct-guess / score race:** ⚠ `score` is a client read-modify-write (`GuessModal.jsx:61`) from possibly-stale local state; concurrent correct guesses can miscount. Low frequency.
- **Reward double-grant:** ⚠ `grantMatchRewards` checks the idempotency key *before* the async body and writes it *after* (`playerProfile.js:327-405`); a StrictMode double-invoke/remount can double-pay (ECON-7).
- **App background / kill mid-round:** ⚠ **Split verdict.** For the *asker* being absent, shared deadlines + peer enforcement + wake re-subscribe handle it unusually well. But for a *non-asker* being absent, there is **no answer timeout at all** — the room soft-locks (STUCK-1, P0). And peer enforcement itself can permanently disarm on a single failed write (GAME-5) or misfire on clock skew (GAME-3).
- **Network loss / reconnect:** ⚠ Game channels self-heal (3s retry). **Chat channels do not** get the same `onStatus` retry (they pass `undefined`), so chat recovery depends solely on visibility/pageshow; the unread badge doesn't recover at all (CHAT-2).
- **Replay immediately ("Play Again"):** ❌ Enables the self-farm exploit (ECON-1) and resets in place.
- **Empty / very large question or player sets:** ✅ Guards use `Math.max(len,1)`; empty categories fall back to free-type; word grid handles 40–50 words.
- **Very long / very short text:** ⚠ Names capped (14) and words capped (30 custom), chat capped (300) — **all client-side only**, no DB `check` constraints (CHAT-15); a direct API call inserts unbounded text.
- **Duplicate player rows / auto-join race:** ✅ Guarded by `rejoiningRef` + existing-row checks; `room_code` unique with retry on collision.
- **Session expired / anon session change:** ⚠ Cloud sync silently stops if `auth.uid()` changes while the guest id persists (ECON-9).
- **Ghost non-asker / host death / empty-word join:** ❌ Four permanent soft-lock paths (STUCK-1..4, §4a) — the most serious reliability class in the app.
- **Idle realtime after first backgrounding:** ❌ Perpetual 3s resubscribe/refetch loop (GAME-7) silently drains battery all session.

---

## 7. Backend / Network Audit

Supabase-only; no app server. The realtime discipline is mostly good (room-scoped filters everywhere it matters), but several interactions don't scale and a few don't reconcile.

- **NET-1 [P2] BrowseLobbies refetch storm.** `MysteryRoom.subscribe(() => fetchLobbies(), 'is_public=eq.true')` fires a **full two-query refetch on every public-room event app-wide**, with **no debounce** (contrast MysteryGame's 400ms debounce). O(N) refetches per viewer as public lobbies churn.
- **NET-2 [P2] Stale lobby occupancy.** BrowseLobbies subscribes to `mystery_rooms` but the "3/12" count comes from `mystery_players` — joins/leaves fire no room event, so counts are stale and a "join" can hit a full room.
- **NET-3 [P2] Chat channel multiplication.** On the chat tab a client holds 4 game channels + `useUnreadChat`'s chat channel + `ChatPanel`'s chat channel (two identical `mystery_chats` subscriptions) + per-instance `usePeerProfiles` channels (which also poll every 30s). Every chat message is delivered twice.
- **NET-4 [P2] Snapshot/stream not reconciled (chat).** Initial fetch and live subscription are independent with no id-merge → a message in the gap is duplicated (key collision) or permanently missing; appends have no dedup (CHAT-3/4).
- **NET-5 [P3] N+1 on "active game" lookup.** `Home.jsx` and `ProfileSettings.jsx` query all of the guest's `mystery_players` rows then issue one `MysteryRoom.filter` per row in a loop, and there is **no index on `mystery_players(user_id)` alone** (only `(room_code)` and `(room_code,user_id)`), so this is a sequential scan.
- **NET-6 [P3] No request timeouts.** `api/db.js` has no `AbortController`/timeout; a hung request spins forever (MysteryGame loader, BrowseLobbies loader), whereas ResetPassword and the iCloud race both cap at 3s.
- **NET-7 [P3] Chat DELETE events ignored.** The schema grants a chat DELETE policy + `REPLICA IDENTITY FULL` specifically for delete payloads, but subscribers only handle `create` — a deleted/moderated message never disappears live.
- **NET-8 [P3] Unbounded chat memory.** Initial load caps at 60 but live appends are unbounded with no windowing and no "load older."
- **NET-9 [P2] Self-inflicted 3s poll loop after backgrounding** (GAME-7, §4a) — the single biggest wasted-traffic/battery source per client once a session has been backgrounded once.
- **NET-10 [P3] DELETE realtime events bypass the room filter** (GAME-10) — every ended game app-wide triggers a 4-table refetch on every open client.

**Correctly handled:** room-scoped realtime filters (`room_code=eq.…`, `is_public=eq.true`, `user_id=in.(…)`); channel cleanup on unmount (no classic leak); atomic answer RPC; unique `room_code` with retry; the `db.js` wrapper documents the "no filter = whole-app traffic" hazard.

---

## 8. Security / Cheat Audit

The trust model is stated in the repo as intentional: fully-open RLS (`using(true) with check(true)`) because there's no login and every player must read/write shared room state. That's a legitimate choice for a login-less party game — **but it has been conflated with "nothing sensitive is here," and one consequence breaks the game itself.**

- **SEC-1 [P0] Every player's secret word is shipped to every opponent's client.** `MysteryGame.jsx:64` loads the roster with `MysteryPlayer.filter({room_code})`; `db.js:25` is `select('*')`, which includes the plaintext `secret_word` column for **all** players. `mystery_players` has `REPLICA IDENTITY FULL` + realtime, so the word is also broadcast on submit. Proof it's client-side: `GuessModal.jsx:43-44` computes correctness in the browser against `selectedTarget.secret_word`. **A cheater opens devtools (or the network tab) and wins every round, invisibly and deterministically.** This is the core mechanic defeated for anyone who looks. *Impact:* critical for game integrity; low for data-privacy (it's a party-game word). Honest play still functions — which is why it's shippable-with-disclosure, but it is the #1 issue.
- **SEC-2 [P1] Scores, correctness, reveals, and room state are client-authored.** `correct` and `score` are written by the client (`GuessModal.jsx:45-61`); anyone can `insert` a guess with `correct:true`, `update` their own `score` to anything, force `status:'finished'`, seize `host_id`, flip `is_public`, or eliminate/reveal other players — globally, for any room, via the public anon key. Contrast: answering *was* hardened into an RPC (0006); scoring/guessing never were. Treat all scores/stats/leaderboards as untrusted.
- **SEC-3 [P2] Economy is client-authoritative.** Migrations 0004/0006 correctly stop a player editing *other* players' profiles (server-stamped `owner`), but a player can write anything to **their own** row: `picks=99999`, `owned=[all]`, `level=50`, `wins=9999` — and those are the values peers see on player cards. Acceptable while purely cosmetic; a hard blocker the day you add leaderboards or paid prestige.
- **SEC-4 [P2] IAP entitlements are localStorage-only.** `premiumPacks.js` stores unlocked packs in `localStorage`; the premium word lists ship in the JS bundle anyway. `localStorage.setItem('mystery_unlocked_packs', …)` unlocks all paid packs for free. RevenueCat re-sync only *adds* unlocks, never revokes a spoofed one. Direct (if small) revenue leak.
- **SEC-5 [P3] Reports are spoofable and evidence-free.** `player_reports` insert is `with check(true)` with client-supplied `reporter_id`; an attacker can mass-file against a victim (vary `reporter_id` to defeat the 0005 dedup index) and reports carry **no message content**, so the moderation queue is both floodable and un-actionable. Sanitize `reported_name` on display.
- **SEC-6 [P3] Mute/report/streak are evadable by clearing localStorage** (new guest id). Inherent to the guest model; means block/report are cosmetic against a determined abuser.

**Verified GOOD:** no committed secrets (only the public anon key + RevenueCat public key ship, by design; service-role stays in the Edge Function via `Deno.env`); `.gitignore` excludes `.env*`; dev backdoor (`?dev=unlock/reset`) is gated behind build-time `VITE_ENABLE_DEV_TOOLS` and is **inert** (not merely hidden) in store builds; `delete-account` verifies the JWT and only deletes the caller's own `user.id`; `authReturnTo.safeReturnTo()` is a careful open-redirect guard; ForgotPassword doesn't reveal account existence; React escapes chat text (no XSS despite open RLS).

**The core decision you must make:** either (a) close the loop — stop shipping `secret_word` to opponents (server-side guess-validation RPC + a column-excluding view/RLS predicate) and move `correct`/`score` into a `SECURITY DEFINER` RPC, reusing the exact 0006 pattern — or (b) accept honor-system play, **document it**, and stop presenting scores/wins/stats as authoritative.

---

## 9. Economy / Progression Audit

I verified the math against `progression.js`/`playerProfile.js`.

**Pacing (honest play):** average match ≈ 30–40 Picks (loser) to ~80 (winning host) to ~145 (winner+perfect+streak+host) — matches the design header's "~35 / ~75." Daily income ~230–280 casual, 500–700 engaged. Early game (first hour → first Common + 2–3 level-ups) checks out and gives good early dopamine. XP-to-50 ≈ 34,300 XP ≈ ~343 matches (~3 months casual) — a healthy long arc.

**But:**

- **ECON-1 [P1] Self-farm loop.** In a 2-player room (two browser tabs as two guests), each guesses the other's known word → **both** satisfy `isWinner` (tie at 1) **and** `perfect` (opponents=1). "Play Again" (`FinishedPhase.jsx:120-155`) wipes guesses and re-keys the idempotency guard, so every ~2-minute replay mints **~95–125 Picks per device** plus win/host/play challenge credit. ~3,000 Picks/hour → Mythic in <2h, whole catalog in a few sessions. The `topScore===0` void does not help (you control both alts). This destroys the meaning of the entire currency.
- **ECON-2 [P2] Top tiers are massively underpriced vs. intent.** Epic (800) is claimed "a week" but is ~3 days; Legendary (2000) "3 weeks" → ~8 days; Mythic (5000) "a season" → ~19 days. The prestige chase collapses in 2–3 weeks of honest play (and instantly under ECON-1).
- **ECON-3 [P2] Season 1 "Founder" reward is unobtainable — dead content.** The `SEASON` challenges reference unlocks `t_founder`/`bd_champion`/`em_galaxy` tied to `col_founder`/`col_royal`, but those collections are `hidden:true` and `bumpChallenges` skips hidden unlocks (`playerProfile.js:299`). Completing all Season 1 challenges pays **Picks only**; the marquee Founder emblem/title/border/name-color **never grant**, directly contradicting "Season 1 only, will never return." `nc_founder`/`t_puzzleking` are dead entries.
- **ECON-4 [P2] The spend loop is broken.** The shop shows only a date-seeded 3-per-type rotation; the Collection tab is now owned-only (a stale comment still claims otherwise). **Non-collection shop items** (e.g. `em_oni` 2000, `em_unicorn`, `t_legend`, most banners) have **no purchase path** unless they happen to roll into today's 3 slots. A player who saves 2,000 Picks for a specific emblem opens the shop and can't buy it. This is the most likely "where do I spend my Picks?" complaint.
- **ECON-5 [P2] Daily-login streak + shop rotation are device-clock exploitable.** Both key off local `todayKey()` with no server check; advancing the clock farms the login reward and rerolls the shop.
- **ECON-6 [P3] Rarity is price-only.** `RARITIES` is styling; there's no scarcity/RNG/limited-quantity behind "Mythic = the chase." With ~9 Epic banners at 800, Epic feels common.
- **ECON-7 [P3] Reward grant isn't concurrency-safe** (idempotency key written after the async body) — double-invoke can double-pay.
- **ECON-8 [P3] Level-50 dead end + XP bar overflow.** Past cap, `into` grows unbounded while `need` stays fixed, so the bar reads e.g. "5000/1325" and pins >100% forever. No MAX state, no prestige, nothing to buy once owned.
- **ECON-9 [P3] Rage-quit preserves the win streak** (streak only resets inside `grantMatchRewards`, which never runs if you leave before the results screen).

**Correctly handled:** duplicate-ownership guards on every grant path; per-round idempotency (barring ECON-7); walkover void consistent between grant + UI; collection-completion and mid-match level unlocks both grant + celebrate; IAP layer is clean.

---

## 10. Emblem / Collection Audit

The cosmetic system is a genuine strength — **Supercell-level breadth**: 27 emblems (with illustrated `.webp` art on rarity-lit tiles), 37 banners (layered CSS scenes + painted art), 20 borders (animated rarity frames), 14+ titles, 13 name colors, 9 collections with completion rewards, 6 rarities + a "special" ruby tier. Ownership states are explicit (equipped/owned/locked), rarity reads at a glance, unlock celebrations are satisfying, and the lobby doubles as a cosmetics showcase (peers see each other's loadouts live).

**Issues:**
- **COL-1 [P2]** Founder/Royal collection rewards are unobtainable dead content (see ECON-3).
- **COL-2 [P2]** No purchase path for non-rotated, non-collection shop items (ECON-4) — you can *see* the emblem in the collection album but can't buy it there anymore.
- **COL-3 [P3]** No persistent "NEW / newly-affordable" indicator for freshly rotated stock, newly reached level unlocks, or items you can now afford — discovery relies on the player noticing.
- **COL-4 [P3]** Collection completion desire is real but capped by the broken spend loop and the ~19-day Mythic clock: a motivated player finishes the *achievable* catalog fast, then hits the level-50/own-everything dead end (ECON-8).
- **COL-5 [P4]** Rarity would feel more meaningful with genuine scarcity (limited-time, challenge-gated) rather than price alone (ECON-6).

**Verdict:** the collection creates real desire; it's the *economy plumbing around it* (spend loop, dead season content, exploit) that undercuts it, not the collection design.

---

## 11. Chat / Social Audit

Chat is functional and thoughtfully built (optimistic send, tap-to-retry, near-bottom autoscroll, "N new" pill, emote rain, mute), but has real correctness gaps on the exact mobile paths this app is built around.

- **CHAT-1 [P1]** Second message sent while the first is in flight is **silently dropped** (input cleared before the `sending` guard aborts the send) — routine on flaky mobile networks; no bubble, no error.
- **CHAT-2 [P1]** `useUnreadChat` **never re-subscribes on wake** (deps `[roomCode, myId]`, no visibility bump) — after one background→foreground cycle the unread badge can stop updating for the rest of the session, and background-arriving messages are never counted.
- **CHAT-3 [P2]** No snapshot/stream reconciliation → duplicate (key-collision) or permanently-missing messages on open; appends have no id-dedup.
- **CHAT-4 [P2]** Optimistic own-message removal relies on the realtime echo; if the socket is dead at that moment, your own just-sent message vanishes until a wake-refetch.
- **CHAT-5 [P2]** Profanity filter is **send-side only** and trivially bypassed; received text is never filtered on display — the "UGC moderation" is non-authoritative.
- **CHAT-6 [P2]** No rate limit on send or emote-rain → spam/grief (one user spamming 🔥 = continuous full-screen rain for everyone). Combined with open RLS, no server backstop.
- **CHAT-7 [P2]** BrowseLobbies refetch storm + stale counts (NET-1/NET-2).
- **CHAT-8 [P3]** Chat DELETE events ignored (NET-7); live append order ≠ `created_date` order; no pagination / unbounded memory; wake-refetch discards failed/pending bubbles; unread pill counts your own optimistic add/remove churn as "new."
- **CHAT-9 [P3]** Reports spoofable/evidence-free (SEC-5); mute is local-only and evadable (SEC-6). There is **no persistent block** that survives a new guest id.

**Missing social table-stakes:** no "block" (only mute-this-device), no report *with context*, no reactions to specific messages, no typing/seen indicators (fine to omit), no friends/rematch-with-same-group loop (a real retention miss — see §21).

**Correctly handled:** room-scoped filters; React-escaped text (no XSS); channel cleanup; optimistic + retry; near-bottom autoscroll logic.

---

## 12. Performance Audit

- **PERF-1 [P2] Main JS bundle is 896 KB (269 KB gzip).** The eager core path (Home + MysteryGame) pulls in framer-motion + supabase + all mystery components + the full cosmetic catalog. Auth/Profile/Browse are code-split (good), but the core chunk is heavy for first paint on web; Vite warns. Native is less affected (local assets) but startup still parses it.
- **PERF-2 [P2] BrowseLobbies fetch storm** (NET-1) — the clearest real scaling bottleneck.
- **PERF-3 [P3] Chat channel multiplication + double delivery + 30s peer-profile polling** (NET-3) — per-connection overhead grows with participants.
- **PERF-4 [P3] Unbounded chat list** re-renders the whole `AnimatePresence` list per message (NET-8).
- **PERF-5 [P3] N+1 active-game lookups with no `user_id` index** (NET-5).
- **PERF-6 [P3] ~8 always-on Home animations** (UX-13) — battery on older devices; none pause when hidden.
- **PERF-7 [P4] Image weight:** logo 120 KB, hero 93 KB, dozens of 40–50 KB banner/emblem webp — fine individually, but the Profile shop renders many at once; consider lazy/virtualized grids.

**Verdict:** perfectly fine for the intended small-room, short-session use today; the scaling risks (NET-1, channel multiplication, N+1) are what bite at 10k–100k users, not micro-optimizations.

---

## 13. Accessibility Audit

Systematically weak in the places automated linting misses. (Corroborated by two independent passes.)

- **A11Y-1 [P1] Dynamic Type is globally disabled** (`text-size-adjust:100%`, `index.css:113`) while the UI leans on pervasive `text-[8px]`–`text-[11px]`. An iOS user who enlarges text gets **zero** relief anywhere. Fails WCAG 1.4.4.
- **A11Y-2 [P1] Toasts have no `aria-live`** (`toast.jsx`) — the app's entire error/status/feedback channel is **inaudible to VoiceOver** (join errors, word-submit errors, kicked-from-word-entry, daily reward). Bonus: `toaster.jsx` renders two stacked viewports.
- **A11Y-3 [P1] No modal is an accessible dialog** — ~10 overlays with no `role="dialog"`/`aria-modal`, no focus trap, no focus-on-open/restore, no Escape. Keyboard/VoiceOver users can reach the background behind the backdrop. The single biggest keyboard-a11y gap.
- **A11Y-4 [P2] Reduce-Motion freezes spinners.** Two `prefers-reduced-motion` blocks; the first (`index.css:418-425`) matches `*` with `!important` and kills the second block's `:not(.animate-spin)` exemption — so every loader freezes under Reduce Motion and reads as a hang (the exact outcome the code tried to avoid).
- **A11Y-5 [P2] Missing focus-visible** on most inline/custom buttons (only a handful of `.header-btn/.gold-btn/...` classes get a ring).
- **A11Y-6 [P2] Icon-only controls labelled with `title` not `aria-label`** (copy code, show word, skip-AI, Notebook arrows); refresh button mislabeled `aria-label="Loading"`; tab bar conveys the active tab by color only (no `aria-current`).
- **A11Y-7 [P2] Sub-44px targets** (UX-5).
- **A11Y-8 [P3] Answer results emoji-only** in question history (Notebook does it right with words) — ambiguous to screen readers.
- **A11Y-9 [P3] Contrast:** `text-slate-500` on the near-black bg ≈ 4.0:1 (below 4.5:1) at 10–11px in several spots.
- **A11Y-10 [P3] Silent/ambiguous states** (BrowseLobbies error → "empty", MysteryGame error → "not found", QuickEquip blank).

---

## 14. Analytics Audit

**There is no product analytics of any kind.** No Amplitude/Mixpanel/PostHog/Firebase/GA/Segment. The only telemetry is **optional** Sentry crash reporting (ships zero code unless `VITE_SENTRY_DSN` is set). The one `.track(` in the code is Supabase Realtime *presence*, not analytics.

**You would soft-launch blind.** You cannot answer any of the questions a soft-launch exists to answer:
- Where do players quit? (name gate? empty lobby? first question? word entry timeout?)
- How many start vs. finish a game? Replay rate?
- Which categories/modes are popular? Which packs get viewed vs. bought (conversion)?
- Where do errors happen? Where do players get stuck?
- Chat usage, share rate, D1/D7/D30 retention, DAU.

**ANA-1 [P1]:** Instrument ~10–12 core events before soft-launch (`app_open`, `name_set`, `lobby_created/joined`, `game_started/finished`, `guess_made`, `pack_viewed`, `purchase_started/succeeded/failed`, `restore_tapped`, `share_completed`). Use a privacy-light SDK or even a Supabase events table. Update the App Privacy questionnaire + policy if you add any. Without this, the soft-launch produces opinions, not data.

---

## 15. App Store / Launch Readiness Audit

- **LAUNCH-1 [P1] No product analytics** (ANA-1).
- **LAUNCH-2 [P1] Privacy/Support URLs likely 404.** `ProfileSettings.jsx:26` hardcodes `SITE_BASE = 'https://jinnieoclock.com/whatsmypick'` → `…/whatsmypick/privacy.html`, but the files deploy at site root (`public/privacy.html`) and `APPSTORE.md` itself writes the URL as `/privacy.html`. If the deploy is at the domain root, the in-app links **and the App Store Connect privacy URL** 404 — a metadata rejection. Verify on the real domain before submission.
- **LAUNCH-3 [P1] No Terms of Use / EULA for a live stranger-chat UGC app.** Guideline 1.2 expects a filter (present), report (present), block (only mute exists), contact (present), **and an EULA with a zero-tolerance clause users agree to** (absent). A common 1.2 rejection. Add a Terms page + surface it at the name gate and Settings.
- **LAUNCH-4 [P1] No push notifications.** No `@capacitor/push-notifications`, no APNs entitlement. **Zero re-engagement channel** — a serious retention gap for a session-based social game (your turn, chat reply, daily reward, friend online).
- **LAUNCH-5 [P2] IAP entitlement trust** (SEC-4).
- **LAUNCH-6 [P2] Age rating vs. "general audiences" claim.** Public lobbies + live stranger chat typically push the rating to 12+/17+; `privacy.html` claims "general audiences" and there's no age gate. Rate honestly.
- **LAUNCH-7 [P2] Stale/contradictory docs.** `premiumPacks.js:1-4` says "There is no real payment backend yet" — directly contradicting the shipped RevenueCat layer; README says "no payments"; `privacy.html` advertises sign-in that the native build doesn't offer. Reconcile before a reviewer notices.
- **LAUNCH-8 [P3] Localization leaks** (LOC-1/LOC-2 below) — a reviewer testing in Dutch sees English in the shop, category picker, auth flow, and auto-questions.
- **LAUNCH-9 [P3] Anonymous-sign-in dependency** is a silent single point of failure (needs the dashboard toggle ON, per migration 0004) — profile sync/backup silently pauses if off.
- **LAUNCH-10 [P3] `console.error` in 3 error paths** (harmless; optionally route through Sentry). Legacy `armv7` in `UIRequiredDeviceCapabilities`.

**Localization (new, cross-cutting):**
- **LOC-1 [P2]** Auth screens (Login/Register/Forgot/Reset) are **100% hardcoded English**; several aria-labels, rarity/type labels, category & pack names, and "Limited" badges bypass the `t` object. Default language is English with **no device-language detection**, and `<html lang>` never updates (screen readers mispronounce Dutch forever).
- **LOC-2 [P2]** Auto-question bank + hardcoded fallbacks are English-only — a Dutch game switches language mid-round and stores it permanently.

**Verified GOOD for launch:** valid 1024² alpha-free icon; launch storyboard; portrait-only forced-dark; `ITSAppUsesNonExemptEncryption=false`; complete/honest account+data deletion (guest and registered); error boundary wraps the tree and forwards to Sentry when present; no source maps shipped; `.npmrc` 7-day supply-chain cooldown; robust CI signing workflow; Restore Purchases present; dev backdoor inert in store builds.

---

## 16. Complete Issue List

**P0 — Blocker**
- **STUCK-1** No answer timeout → one backgrounded player permanently freezes the room (hits normal mobile sessions).
- **SEC-1** Secret words shipped in plaintext to every client → core game trivially cheatable.

**P1 — Critical (fix before soft-launch)**
- **STUCK-2** Word-entry enforcement deletes the host with no handoff → room stranded.
- **STUCK-3** Empty/masked/non-Latin secret word → game unfinishable.
- **GAME-1** Turn rotation shifts on roster change → turns stolen/skipped/doubled.
- **GAME-2** RPC fallback erases other players' answers on any transient error (reintroduces the 0006 bug).
- **GAME-3** Client clock skew breaks both timers (premature auto-ask / player deletion).
- **GAME-4** Duplicate auto-question + double turn-advance on wake / manual-vs-timer race.
- **SEC-2** Client-authored scores/correctness/room-state via open RLS (forgeable everywhere).
- **ECON-1** Two-tab "Play Again" self-farm mints the whole economy in hours.
- **UX-1** Invite-link players onboard nameless & untaught (breaks the growth loop).
- **UX-2** Offline/failed load shows false "Room not found"/"No lobbies" dead-ends.
- **CHAT-1** Second in-flight chat message silently dropped.
- **CHAT-2** Unread badge stops updating after one backgrounding.
- **A11Y-1** Dynamic Type disabled; 8–11px fixed type — no text scaling anywhere.
- **A11Y-2** Toasts have no `aria-live` (entire feedback channel silent to VoiceOver) + duplicated viewport.
- **A11Y-3** No modal is an accessible dialog (no focus trap/Escape/roles).
- **ANA-1 / LAUNCH-1** No product analytics — launch blind.
- **LAUNCH-2** Privacy/Support URLs likely 404 (metadata rejection risk).
- **LAUNCH-3** No Terms/EULA for stranger-chat UGC (1.2 rejection risk).
- **LAUNCH-4** No push notifications (no re-engagement).

**P2 — Important**
- **STUCK-4** Host absent at `finished` → nobody can Play Again. **GAME-5** Failed enforcement permanently disarms that client for the turn. **GAME-6** Simultaneous correct guesses double-award / can miss the finish. **GAME-7** Perpetual 3s resubscribe/battery-drain loop after first backgrounding.
- **SEC-3** Client-authoritative economy (self-only, but untrusted stats). **SEC-4** localStorage IAP entitlements (revenue leak). **SEC-5** Spoofable/evidence-free reports.
- **ECON-2** Top tiers 2.3–4.7× underpriced vs. intent. **ECON-3/COL-1** Season 1 Founder reward unobtainable (dead content). **ECON-4/COL-2** Broken spend loop (can't buy non-rotated items). **ECON-5** Clock-exploitable daily login/shop.
- **UX-3** Toast flood. **UX-4** Inconsistent modal dismissal / no Escape. **UX-5/A11Y-7** Sub-44px targets. **UX-6** Keyboard overlap on primary CTAs. **UX-9** Weak word-entry-eject cue.
- **NET-1/PERF-2** BrowseLobbies refetch storm (no debounce). **NET-2** Stale lobby counts. **NET-3/PERF-3** Chat channel multiplication + double delivery. **NET-4** Chat snapshot/stream not reconciled.
- **CHAT-5** Display-side profanity not filtered. **CHAT-6** No chat/emote rate limit.
- **PERF-1** 896 KB core bundle.
- **A11Y-4** Reduce-Motion freezes spinners. **A11Y-5** Missing focus-visible. **A11Y-6** `title` vs `aria-label`; mislabeled refresh; no `aria-current`.
- **LOC-1** Auth flow + labels un-localized, no device-language detection. **LOC-2** English auto-questions in NL games.
- **LAUNCH-6** Age rating vs. "general audiences." **LAUNCH-7** Stale/contradictory docs.

**P3 — Polish**
- **GAME-8** No `unique(room_code,user_id)`; check-then-insert (dup/phantom rows). **GAME-9** Notebook crash on shrinking opponents list. **GAME-10** DELETE events bypass room filter; `max_rounds` dead code. Plus: solo-start not re-validated during countdown, non-atomic `submitQuestionText`/`playAgain` writes, hint-phase bookkeeping breaks on roster change, guess cooldown counts hint rows, `leaveRoom` "last player" predicate inconsistent, refresh-in-lobby misread as host kick (`sendBeacon` described but unused).
- **G-2/G-3/G-4/G-5** Question variety, client-gated guess cadence, enforcement race, no round cap.
- **ECON-6** Rarity price-only. **ECON-7** Reward double-grant race. **ECON-8** Level-50 dead end + XP bar overflow. **ECON-9** Rage-quit preserves streak. **COL-3** No NEW/affordable indicators.
- **UX-7..UX-13** Safe-area on sheets, nested interactive, copy feedback, QuickEquip empty state, word-grid legibility, idle-Home animations.
- **NET-5..NET-8** N+1/no `user_id` index, no timeouts, DELETE events ignored, unbounded chat.
- **CHAT-8/CHAT-9** Ordering/pagination/wake-refetch/unread-count churn; local-only mute, no persistent block.
- **A11Y-8/9/10** Emoji-only answers, contrast, silent states.
- **SEC-6** Evadable mute/report/streak. **LAUNCH-9/10** Anon-sign-in SPOF, `console.error`, `armv7`.

**P4 — Future**
- **G-6** Solo/bot practice mode. **COL-5** Scarcity-based rarity. **PERF-7** Lazy/virtualized shop grids. Friends/rematch loop, message reactions (see §21).

---

## 17. QA Test Matrix

| Feature | Test | Expected | Actual / Risk | Sev |
|---|---|---|---|---|
| Onboarding | Fresh install → name gate | Name required, rules shown | ✅ Works (created-room path) | — |
| Onboarding | **Open invite link as new user** | Name gate + rules, then join | ❌ Auto-joined nameless, no rules (UX-1) | P1 |
| Create room | Happy path | Lobby with code | ✅ | — |
| Join room | Code / browse | Joins if room open | ✅ (re-checks live status) | — |
| Join room | Room started | Blocked with message | ✅ | — |
| Word entry | Submit word | Locks in | ✅ | — |
| Word entry | Timer expires (idle) | Removed/reset fairly | ⚠ Ejects with fleeting toast only (UX-9) | P2 |
| Playing | Answer question | Atomic merge | ✅ (RPC 0006) | — |
| Playing | Two players answer simultaneously | Both recorded | ✅ (row-locked RPC) | — |
| Playing | Timer expiry / backgrounded asker | Peer auto-asks | ✅ (staggered enforcement) | P3 (rare dup) |
| Playing | **Backgrounded non-asker mid-question** | Question resolves / player skipped | ❌ Room freezes forever (STUCK-1) | **P0** |
| Playing | Eliminate a player mid-turn | Turn order stable | ❌ Questioner shifts / turn stolen (GAME-1) | P1 |
| Playing | RPC 5xx/timeout on answer | Retry, no data loss | ❌ Fallback erases others' answers (GAME-2) | P1 |
| Playing | One device clock 30s fast | Timers still fair | ❌ Auto-asks every turn / deletes players (GAME-3) | P1 |
| Word entry | Host backgrounds, gets enforced out | Host handed off | ❌ Room stranded (STUCK-2) | P1 |
| Word entry | Join in gap before host taps Start | Blocked / must submit | ❌ Empty word → unfinishable (STUCK-3) | P1 |
| Word entry | Custom word "kut" / "東京" / "!!!" | Guessable | ❌ normalize-empty → unguessable (STUCK-3) | P1/P2 |
| Finished | Host's phone dies | Someone can Play Again | ❌ No rematch possible (STUCK-4) | P2 |
| Realtime | First app-switch, then idle | Quiet | ❌ 3s resubscribe/refetch loop all session (GAME-7) | P2 |
| Guess | Correct guess | +1, reveal, maybe finish | ⚠ Score is client RMW (race) | P3 |
| Guess | **Read opponent's word via devtools** | Impossible | ❌ `secret_word` client-readable (SEC-1) | **P0** |
| Guess | **Forge `correct:true` / set score** | Rejected | ❌ Open RLS accepts it (SEC-2) | P1 |
| Rewards | Finish match | Grant once | ⚠ Double-invoke can double-pay (ECON-7) | P3 |
| Rewards | **2 tabs + Play Again** | No exploit | ❌ ~100 Picks/2min self-farm (ECON-1) | P1 |
| Economy | Buy saved-for item | Purchasable | ❌ Not if outside daily rotation (ECON-4) | P2 |
| Economy | Advance device clock | No extra reward | ❌ Farms login + rerolls shop (ECON-5) | P2 |
| Season | Complete S1 challenges | Founder cosmetics grant | ❌ Never grant (ECON-3) | P2 |
| Chat | Send 2 msgs fast | Both sent | ❌ 2nd silently dropped (CHAT-1) | P1 |
| Chat | Background → return | Unread badge accurate | ❌ Badge stops updating (CHAT-2) | P1 |
| Chat | Reconnect | No dup/missing | ⚠ No reconcile (CHAT-3/4) | P2 |
| Chat | Spam / emote flood | Throttled | ❌ No rate limit (CHAT-6) | P2 |
| Offline | Reopen mid-game offline | "Connection problem, retry" | ❌ "Room not found" (UX-2) | P1 |
| Offline | Browse lobbies, no network | Error + retry | ❌ Shows "No lobbies" (UX-2) | P2 |
| App restart | Kill mid-round, reopen | Rejoin banner | ✅ Excellent | — |
| Scale | Many public lobbies churning | Debounced refetch | ❌ Refetch storm (NET-1) | P2 |
| Scale | Lobby fills up | Live counts | ❌ Stale counts (NET-2) | P2 |
| A11y | VoiceOver a join error | Announced | ❌ Toast silent (A11Y-2) | P1 |
| A11y | Enlarge system text | UI scales | ❌ No scaling (A11Y-1) | P1 |
| A11y | Reduce Motion on | Loaders still spin | ❌ Frozen (A11Y-4) | P2 |
| IAP | Restore purchases | Re-syncs entitlements | ✅ | — |
| IAP | Edit localStorage | Can't unlock free | ❌ Unlocks free (SEC-4) | P2 |
| Deletion | Delete profile/account | All data removed | ✅ Complete & honest | — |

---

## 18. Priority Roadmap

**Phase 0 — Decide (before any code)**
1. **Game-integrity decision (SEC-1/SEC-2):** honor-system-and-document, or lock down (server-side guess RPC + hide `secret_word` + `SECURITY DEFINER` score RPC, reusing the 0006 pattern). Everything else in security/economy flows from this. *(The same server-authoritative move also fixes GAME-6.)*

**Phase 1 — Launch blockers (P0/P1, ~2–3 weeks)**
2. **Fix the soft-locks first (highest reliability priority):** add an answer timeout / absent-non-asker handling (STUCK-1); host handoff on word-entry enforcement (STUCK-2); block empty/unguessable words entering play + re-verify submission in `startPlaying` (STUCK-3); host reassignment when absent at finished (STUCK-4).
3. **Harden the turn state machine:** key turns by `user_id` not a positional index (GAME-1); scope the RPC fallback to function-missing only (GAME-2); use a server-time offset for both timers (GAME-3); route auto-ask through the fresh-state re-check + single in-flight guard (GAME-4); latch enforcement only after a successful write (GAME-5); stop the `CLOSED` resubscribe loop (GAME-7); add `unique(room_code,user_id)` (GAME-8).
4. Implement the chosen integrity fix (SEC-1, SEC-2) and the economy anti-farm (ECON-1: require ≥3 distinct real players for winner/perfect/streak; cap rewarded same-room replays).
5. Invite-link onboarding: gate auto-join on `hasGuestName()`, show name + rules first (UX-1).
6. Real error/retry states (UX-2) across MysteryGame, BrowseLobbies, Play Again, kick.
7. Chat correctness: don't drop in-flight sends (CHAT-1); re-subscribe unread badge on wake (CHAT-2).
8. Accessibility launch set: `aria-live` toasts + de-dup viewport (A11Y-2); accessible dialog wrapper (A11Y-3); enable text scaling / raise micro-type floors (A11Y-1).
9. Analytics: instrument the core funnel (ANA-1).
10. Store metadata: fix privacy/support URLs (LAUNCH-2); add Terms/EULA (LAUNCH-3); decide push (LAUNCH-4 — at minimum plan it).

**Phase 2 — Important (P2, ~1–2 weeks)**
9. Economy: re-price top tiers or rewrite the claim (ECON-2); fix the spend loop / add "browse all" buy (ECON-4); resolve or remove Season 1 Founder (ECON-3); server-check daily login (ECON-5); move IAP entitlement of record to RevenueCat, not localStorage (SEC-4).
10. Network/perf: debounce BrowseLobbies + fix stale counts (NET-1/2); share one chat subscription (NET-3); reconcile snapshot/stream (NET-4).
11. UX: toast limit/coalesce (UX-3); consistent modal dismissal + Escape (UX-4); 44px targets (UX-5); keyboard-overlap fixes (UX-6).
12. Reduce-Motion spinner fix (A11Y-4); focus-visible (A11Y-5); aria-labels (A11Y-6).
13. Localization: auth flow + labels + device-language + NL auto-questions (LOC-1/2). Reconcile stale docs (LAUNCH-7). Age rating (LAUNCH-6). Display-side profanity + chat rate limit (CHAT-5/6).

**Phase 3 — Polish (P3) & Future (P4)**
14. Level-50 MAX/prestige + XP bar clamp (ECON-8); reward-grant lock (ECON-7); NEW indicators (COL-3); bundle split (PERF-1); `user_id` index + request timeouts (NET-5/6); DELETE-event handling + chat windowing (NET-7/8); remaining a11y/UX polish; **friends/rematch loop, solo/bot practice, message reactions** (§21).

---

## 19. Ship / No-Ship Assessment

| Dimension | Score | One-line justification |
|---|---|---|
| Technical | **6/10** | Clean build/lint/types and mature device-aware intent; but a client-authoritative, race-prone state machine (four soft-locks, turn-stealing, a battery-drain resubscribe loop), N+1s, heavy bundle, no analytics. |
| Gameplay | **5/10** | Understandable, satisfying core loop — undercut by four permanent-stuck paths, trivial cheatability, and finite/English-only variety. |
| UX | **6/10** | Strong flows where you *create*; the *invited* path and error handling are the weak 10%. |
| UI | **8/10** | A real, coherent design system — the standout. |
| Performance | **6/10** | Great for small rooms; clear scaling risks (refetch storm, channel multiplication, N+1) plus a self-inflicted 3s poll loop. |
| Security | **3/10** | Open-by-design RLS + plaintext secret words + client-authored scores/economy/IAP. |
| Retention | **5/10** | Deep cosmetics, but exploitable economy, dead season content, broken spend loop, no push, no analytics. |
| Social | **5/10** | Chat works but badge rots, no durable block, spoofable reports, no rematch/friends loop. |
| Production readiness | **5/10** | No analytics/push, URL-404 risk, no EULA, localization leaks, stale docs. |
| **Overall** | **5/10** | A strong build one focused hardening pass away from soft-launch quality. |

### SHIP NOW: **NO**

**These are the exact issues preventing shipping:**
1. **STUCK-1 (P0)** — with no answer timeout, one player backgrounding their phone mid-question freezes the whole room. This happens in normal play, not a corner case. (Plus STUCK-2/3/4 + GAME-1..7: three more stuck paths and a set of turn-order races.)
2. **SEC-1 (P0)** — the game's secret words are readable by every client; the core mechanic is trivially defeated. Fix it, or explicitly accept and document honor-system play and stop presenting scores as authoritative.
3. **ECON-1 (P1)** — the entire progression economy can be minted with two browser tabs.
4. **UX-1 (P1)** — invited players (the growth loop) arrive nameless and untaught.
5. **ANA-1 / LAUNCH-1 (P1)** — no analytics; a soft-launch would teach you nothing.
6. **LAUNCH-2/3 (P1)** — likely-404 privacy URL and a missing UGC EULA are concrete App Review rejection risks.
7. **CHAT-1/CHAT-2 (P1)** — silent message loss and a rotting unread badge on the exact mobile app-switch path this game lives on.
8. **A11Y-1/2/3 (P1)** — no text scaling, screen-reader-silent feedback, and no accessible dialogs.
9. **LAUNCH-4 (P1)** — no push notifications = no way to bring players back.

Clear Phase 0 + Phase 1 and this becomes a confident soft-launch candidate; the UI and engineering foundations are already there.

---

## 20. Top 20 Things To Fix (ranked)

1. **STUCK-1** Add an answer timeout so a backgrounded player can't freeze the room. *P0*
2. **SEC-1** Stop shipping `secret_word` to opponents (or document honor-system). *P0*
3. **STUCK-2/3/4 + GAME-1..5** Fix the remaining soft-locks and turn-order races (host handoff, empty-word block, host-reassign, key turns by user_id, scope the RPC fallback, server-time offset). *P1*
4. **ECON-1** Kill the 2-tab "Play Again" self-farm (≥3 real players for bonuses; cap replays). *P1*
5. **UX-1** Invite-link onboarding: name + rules before auto-join. *P1*
6. **ANA-1** Instrument the core analytics funnel. *P1*
7. **SEC-2** Move `correct`/`score` to a `SECURITY DEFINER` RPC. *P1*
8. **GAME-7** Stop the 3s resubscribe/battery-drain loop after backgrounding. *P2*
9. **CHAT-1** Stop silently dropping in-flight chat messages. *P1*
10. **CHAT-2** Re-subscribe/reconcile the unread badge on wake. *P1*
11. **UX-2** Real "connection problem / retry" states (no false "Room not found"). *P1*
12. **A11Y-2** `aria-live` on toasts + remove the duplicate viewport. *P1*
13. **A11Y-3** Shared accessible-dialog wrapper (focus trap, Escape, roles). *P1*
14. **A11Y-1** Allow text scaling; raise 8–11px floors. *P1*
15. **LAUNCH-2** Fix the privacy/support URLs (verify on the real domain). *P1*
16. **LAUNCH-3** Add a Terms/EULA with a UGC zero-tolerance clause. *P1*
17. **LAUNCH-4** Add push notifications (turn reminders, chat, daily reward). *P1*
18. **ECON-4** Fix the spend loop — let players buy what they saved for. *P2*
19. **ECON-3** Resolve or remove the unobtainable Season 1 Founder reward. *P2*
20. **LOC-1/LOC-2 · NET-1 · SEC-4 · A11Y-4** Finish Dutch; debounce Browse; RevenueCat-as-truth; unfreeze reduced-motion loaders. *P2*

---

## 21. Things You Didn't Think To Ask About

The most valuable section — problems a shipped-multiple-games team would flag that aren't on the original list.

- **Games freezing in normal play is the #1 thing players will actually complain about.** The soft-locks in §4a (especially STUCK-1: a backgrounded player freezing the room) don't need a cheater or scale — they trigger when someone takes a phone call mid-round. To a player this reads as "the game is broken," and there's no error, just a game that stops. This outranks every cosmetic/UX item for launch: a party game that hangs when one phone locks won't survive its first weekend of real sessions.
- **Cold-start / empty-lobby death spiral.** Before you have players, Browse Lobbies is empty and there's no solo/bot practice mode (G-6). A new installer with no friends online has literally nothing to do → immediate churn. **You need a single-player/tutorial-vs-bot round** to survive the pre-liquidity phase and to teach the game safely. This is the highest-impact *product* gap, above most bugs.
- **No "play again with the same people" loop.** The strongest party-game retention hook is "rematch this group." Today, leaving drops you to Home with no friends list, no recent-players, no rematch invite. The social graph evaporates every session. **Adding recent-players + rematch is a bigger retention win than most of the P2 list.**
- **No re-engagement at all (push).** Session-based social games live and die on "your turn" / "someone messaged" / "your daily reward" pushes. Its absence (LAUNCH-4) caps D1/D7 hard.
- **The word list *is* the paid content, and it ships in the bundle.** Premium packs (SEC-4) gate word *categories* whose words are already downloaded and, worse, visible via SEC-1. The paywall protects content the client already has. Reconsider whether categories are the right thing to sell (vs. cosmetics, which players *can't* trivially self-grant once SEC-3 is addressed).
- **Custom-word abuse.** Custom-word rooms let a player enter anything; the profanity filter is client-side, whole-word, and bypassable (`f u c k`, leetspeak, other languages), and the word is then shown to everyone on the results screen. This is a UGC surface Apple will probe.
- **Impersonation.** `display_name`/`host_name`/`asker_name` are self-asserted with no auth binding; anyone can post chat/questions as any name. Combined with open RLS, one player can impersonate another in-room.
- **"Ghost" lobbies at scale.** Cleanup relies on `beforeunload` (which iOS frequently never fires) + an hourly 2-hour-stale cron. Between those, abandoned rooms and orphaned player rows accumulate; public Browse can fill with dead lobbies (mitigated by presence "away" tags, but the rows persist). At 100k users this is visible clutter and wasted realtime traffic.
- **Everyone-can-delete-everything.** Open RLS DELETE means one malicious anon can wipe every in-progress game app-wide, not just their own. Even keeping reads open, **scope writes/deletes to the caller's participation** to bound the blast radius.
- **"What did they say?" moderation is blind.** Reports carry no message content (SEC-5), so even when a player reports abuse, you can't see or act on it. Your moderation queue is decorative.
- **Season with no earnable exclusive.** ECON-3 means Season 1's marquee reward never grants — the exact thing that's supposed to drive end-of-season play. Players who grind for "Founder" get nothing.
- **Level 50 / own-everything cliff.** ECON-8: a dedicated player hits a hard wall with a broken XP bar and nothing to spend on. No prestige, no sink. This is where your most engaged players — the ones who'd pay — fall off.
- **Localization trust.** A Dutch player who sees English in the shop, the category picker, the whole sign-in flow, and mid-game auto-questions (LOC-1/2) quietly concludes the app is half-finished, even though 85% is beautifully translated.
- **Analytics blindness compounds everything.** Every retention/economy/UX hypothesis above is untestable at launch without ANA-1. You'll be tuning a live economy by vibes.
- **Two `index.css` files** (root unused, `src` used): a latent foot-gun — an edit to the wrong one silently does nothing.

**The one-sentence version:** the game is *built* well but not yet *robust* — first make an honest game impossible to freeze (§4a), then add the connective product tissue it's missing: a reason to play alone at cold-start, a way to keep the group, a way to bring people back, a trustworthy economy, and instrumentation to see any of it working.

---

*End of audit. No code was modified. Awaiting approval of the Phase 0 decision and the Phase 1 plan before implementation.*
