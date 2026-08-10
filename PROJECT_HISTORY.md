# PROJECT HISTORY — What's My Pick!

**Base44 → GitHub Migration Summary & Changelog**

> Last updated: 2026-08-10 · Covers repository state through commit `3c994d1` (merge of PR #12).
>
> Every claim in this document is drawn from the repository itself: source code, Git history
> (including pre-rewrite commits recovered via the GitHub API), migration files, configuration,
> and in-repo documentation (`README.md`, `APPSTORE.md`, `AGENTS.md`, migration comments).
> Where evidence is indirect, statements are marked **"Inferred"**; where absent, **"Not confirmed."**

---

## 1. Project Overview

**What's My Pick!** is a real-time multiplayer party game in the *20 Questions* style:
every player secretly picks a word from a shared category, then players take turns asking
yes/no questions and deducing each other's words. Up to 12 players share a room joined by
a 6-character code, a public lobby browser, or an invite link. The game includes chat,
a clue notebook, hint rounds, and a full progression/cosmetics economy.

| | |
|---|---|
| **Original environment** | [Base44](https://base44.com) (app-builder platform: generated frontend, built-in entities SDK, built-in auth, backend functions, Stripe paywall) |
| **Current environment** | Standalone codebase on GitHub — React 18 + Vite 6 + Tailwind, Supabase (Postgres + Realtime + RLS + Edge Functions), Capacitor 8 iOS wrapper, GitHub Actions → TestFlight |
| **Current state** | Feature-complete and in final pre-launch polish for an iOS App Store release. Web build deployable (Vercel config present). Several one-time App Store Connect / RevenueCat / iCloud setup steps remain outside the repo (documented in `APPSTORE.md`). |

**Major architectural changes since Base44:** the entire backend was replaced by Supabase
(five realtime game tables + a profile table, wide-open RLS by design for game state,
ownership-protected profiles), question generation moved from a backend function into the
client, auth became a three-layer system (guest ID → invisible anonymous Supabase session →
optional real accounts), and the app gained a native iOS wrapper with a custom iCloud
key-value backup plugin and a cloud CI pipeline that signs and uploads TestFlight builds.

**Major feature changes since Base44:** a complete progression economy ("Picks" currency,
XP/levels to 50, daily rewards, streaks, challenges), a 102-item cosmetics catalog with
27 hand-illustrated emblems and 5 rarity tiers, a Shop/Collection system, six paid word
packs via Apple In-App Purchase (RevenueCat), a canvas-rendered share win card, a public
lobby browser, English/Dutch localization, and App Store compliance work (UGC reporting,
muting, profanity filtering, account deletion, optional sign-in).

---

## 2. Base44 → GitHub Migration

### What the Base44 version looked like (BEFORE)

The Base44 app itself is not in this repository, but its shape is documented by the
migration notes in `README.md` ("Notes on what changed from the original"), code comments
in `src/api/db.js` and `supabase/migrations/0001_init.sql`, and the structure of the first
GitHub commit:

- **Data layer:** Base44's built-in **entities SDK** (`filter` / `create` / `update` /
  `delete` / `subscribe`) against Base44-managed storage. Data access was "equally open"
  (per the comment in `0001_init.sql`).
- **Auth:** Base44's built-in sign-in (email/password + Google). Even then, gameplay was
  keyed by a guest ID — being signed in never changed gameplay (per `README.md`).
- **Server logic:** a backend function picked random auto-questions; a Base44
  "Cleanup Stale Lobbies" workflow removed abandoned rooms.
- **Payments:** a **Stripe-based paywall** for some word packs.
- **Dead code:** an unused, unreachable **Tic-Tac-Toe mini-game**.
- **Password reset:** Base44-flavored flow (referenced in a comment in `ResetPassword.jsx`).

### What the codebase looks like now (AFTER)

| Concern | Before (Base44) | After (GitHub) |
|---|---|---|
| Hosting of game state | Base44 entities | Supabase Postgres, 7 tables, migrations in-repo (`supabase/migrations/`) |
| Realtime sync | Base44 subscriptions | Supabase Realtime (`postgres_changes`), server-side filters per room |
| Data-layer API | Base44 entities SDK | `src/api/db.js` — a thin wrapper deliberately **shaped like the Base44 SDK** so the port only changed imports |
| Auth | Base44 auth (email + Google) | Supabase Auth: guest ID + invisible anonymous session + optional email/Google/Apple |
| Server logic | Backend function for auto-questions | Client-side `src/lib/questionBank.js` (static bank, no secrets — "one less moving part, and instant") |
| Lobby cleanup | Base44 workflow | `pg_cron` hourly job in the database (`cleanup_stale_mystery_lobbies()`) |
| Payments | Stripe paywall | **Initially removed entirely**, later rebuilt as Apple IAP via RevenueCat (see §3 Backend) |
| Account deletion | — | Supabase Edge Function `delete-account` (service-role key stays server-side) |
| Deployment | Base44 platform | Web: Vercel (SPA rewrites in `vercel.json`). iOS: Capacitor + GitHub Actions → TestFlight |
| Config | Platform-managed | `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_REVENUECAT_IOS_KEY`, `VITE_SENTRY_DSN`, `VITE_ENABLE_DEV_TOOLS`) |

**Deliberately dropped in the migration:** the Stripe paywall (everything was temporarily
free), the Tic-Tac-Toe leftover, and the Base44 dependency itself. Nothing in the current
codebase calls Base44; the only references left are explanatory comments.

**Key migration design decision:** keeping `db.js` API-compatible with the Base44 entities
SDK minimized rewrite risk — pages and components kept their data-access call sites.

---

## 3. Complete Feature Changelog

Consolidated from the current code, the 59 in-history commits (Aug 7–9, 2026),
recovered pre-rewrite commits (Aug 3–4), and merged PRs #1–#12.

### Gameplay
- **Room system:** 6-char codes (ambiguous characters excluded), 12-player cap,
  public/private rooms, host powers (category pick, start with cancelable 3-2-1 countdown,
  kick, Play Again), centralized host-migration/leave logic (`src/lib/roomLifecycle.js`).
- **Phases:** lobby → word entry (60s shared timer) → playing (rotating asker, 30s
  question timer) → finished. Hint rounds every 5 full rounds (`[HINT]` pseudo-questions).
- **Timer tuning (Aug 9):** question timer cut from 120s to 30s; word-entry timeout
  removes only the stalled player (or resets to lobby with ≤2 players); staggered
  client-side deadline enforcement so any device can heal a stalled room.
- **Guessing:** one guess per full round of questions; a guess must be a **selected** word
  (typing only filters — prevents half-typed submissions; commit `3a6b12b`); normalized
  comparison (case/accents/punctuation-insensitive); wrong guesses struck through.
- **Win/loss:** per-round winner computed from the guesses table (not cumulative score,
  which persists across Play Again); ties allowed; **walkover fix** (PR #7): a match ending
  with zero correct guesses grants no winner, no medals, and no rewards.
- **Auto-questions:** if the asker's timer lapses, a question is drawn from a static
  ~2,000-question bank (42 per-category banks + universal + 10% funny wildcards),
  excluding the last 8 asked; first occurrence shows an explanatory banner.
- **Play Again:** full state reset (words, reveals, questions, guesses) back to lobby with
  a fresh category pick; cumulative scores kept; rewards granted correctly on repeat
  matches (fixed in `7167e81`).
- **Reconnect/robustness (Aug 9 audits):** session-epoch resubscribe on backgrounding /
  channel errors, silent self-heal (banner deliberately removed in PR #12), rejoin
  banner after app kill, refresh-vs-kick distinction, ghost-player "away" flag via a
  lobby presence channel, answer merging moved into a `FOR UPDATE` RPC (migration 0006)
  so simultaneous answers can't overwrite each other or soft-lock a question.

### Words & Categories
- 6 free categories (~167 words) + 6 premium packs × 6 categories (~1,100 words).
- **Natural Wonders** category added in PR #12, replacing "European Countries" inside the
  paid World Pack because that category is already free ("a paid pack must not resell it").
- Custom-words category removed from the selector for launch (PR #12).
- Dutch word display for translatable categories; canonical stored words always English.
- Tailored auto-question banks added per premium subcategory (e.g. all 6 Food Pack
  subcategories in `9109a94`).

### Emblems / Collection
- **Cosmetics catalog (102 items):** 27 emblems, 24 banners, 18 avatar borders, 21 titles,
  12 name colors, across 5 rarities (common/rare/epic/legendary/mythic) with a fixed
  price ladder (100/300/800/2,000/5,000 Picks).
- **27 illustrated emblems (Aug 8):** commissioned-style kawaii chibi artwork replaced the
  original emoji tiles. Documented art brief (`docs/EMBLEM-ART-BRIEF.md`: 1024×1024
  transparent-background cutouts on the app's rarity rim). Iterated through: sheet-sliced
  art (removed), 17 → 24 → 27 artworks, framing normalization, **optical-area sizing**
  ("wide shapes stop looking small") and **bounding-box centering**.
- **8 collections** (Founder, Sakura, Dragon, Galaxy, Royal, Winter, Cyber, Inferno) —
  completing a set grants an exclusive reward cosmetic.
- **Shop/Collection split (`e83b00c`):** Collection became a pure locker of owned items;
  the Shop (with a date-seeded rotating "Today's Shop", featured item, and collection
  albums) became the only purchase surface.
- Equip-persistence fix (PR #12): profile merge changed from remote-wins to
  newest-wins-by-timestamp so fresh equips stop being clobbered by stale server copies.

### Chat / Social
- In-game chat with per-player colors, emote rains, immutable messages (no UPDATE policy).
- **Unread chat badge** (`d5d29b0`) via `useUnreadChat.js`; floating chat button fixes.
- Client-side **mute** system (`src/lib/mutes.js`, Apple guideline 1.2 "block abusive
  users") and **player reporting** to a write-only `player_reports` table with DB-level
  dedupe (migration 0005).
- Chat avatar border cleanup and iOS page-zoom-while-typing fix (PR #5).

### Profiles & Progression
- `player_profiles` table (migration 0002): level, XP, Picks, games/wins/correct-guesses,
  win streak, per-category counts, owned/equipped cosmetics, challenges, daily state.
- **Economy:** ~35 Picks per 10-minute match (~75 as winner); XP curve `100+(level−1)×25`,
  max level 50; win-streak bonuses; daily login reward 15→45 (7-day ramp); 3 daily +
  2 weekly + 3 season challenges; level/challenge/collection-exclusive cosmetics.
- Reward grants are idempotent (per-round keys, 30-minute window) and skipped entirely on
  walkover matches.
- Player card modal with equipped showcase, report/kick actions; peer profiles hydrate
  live in lobbies via Realtime.

### UI / UX
- Post-migration home screen: custom illustrated graphics replacing emoji/icons (PRs #1–#2,
  Aug 4), later the current hero/mascot art set.
- **Lobby redesign (Aug 8):** one showcase row per player, room code moved into the
  header, waiting status beside the player count, optical vertical centering.
- **Word picker redesign (Aug 9):** single-screen aligned 3-column grid, search removed,
  length-scaled fonts for single-line words, two-line words grouped into shared rows.
- **Accessibility pass (`e1a231a`):** Reduce Motion support, contrast bumps, emblem labels.
- Cosmetic-card and banner polish: edge vignettes, clipped-border fixes, glow cleanup
  (one attempt reverted the same day — `79efb8c`/`c70d843`).
- iOS keyboard handling: name screen no longer jumps when the keyboard opens
  (Keyboard plugin resize-mode switching, root commit `5bb196c`).
- Error UX: dependency-free `ErrorBoundary` with Reload/Home actions; friendly mapped
  auth errors (`authErrors.js`).

### Sharing
- **Share win card (PR #9, `26a32e8`):** a purpose-drawn 1080×1440 canvas graphic (not a
  screenshot) — deep-space background, gold/violet headline by result tier
  (perfect/win/place), a canvas re-implementation of the emblem medallion, streak and
  unlock chips, logo. Freshly-unlocked emblems outrank the equipped one as the focal art.
- Native share via `@capacitor/share` (file written to cache dir — WKWebView's
  `navigator.share` can't attach files); Web Share API / download fallback on web;
  text-share fallback so the button never dead-ends.
- Room-invite sharing: URL on web, room code only on native.

### Backend
- Schema evolution across 6 migrations: `0001` full game schema + RLS + Realtime +
  pg_cron cleanup → `0002` player profiles → `0003` player reports → `0004` **profile
  ownership** (anonymous-auth `owner` column stamped by trigger; closes "anyone with the
  anon key can edit any profile") → `0005` report dedupe → `0006` race-free answer RPC +
  the missing profile DELETE policy (required for "Delete my profile" to actually work).
- Anonymous Supabase sign-in at startup with retry; careful distinction between the
  invisible plumbing session and a real registered account (`b32f81e`).
- **iCloud key-value backup (Aug 8):** custom Swift Capacitor plugin
  (`ICloudKVPlugin.swift`) + `cloudBackup.js` back up guest identity, tokens, and
  progression pointers so progress survives reinstalls and device moves; late-restore
  watcher with staged retries; hidden 7-tap diagnostics panel.
- Optional **Sentry** error tracking (only bundled when `VITE_SENTRY_DSN` is set).

### Performance
- **Dependency purge (`061242e`):** ~35 unused packages removed (three.js, react-leaflet,
  react-quill, recharts, moment, lodash, jspdf, html2canvas, most Radix UI, embla, cmdk,
  vaul, zod, react-hook-form, date-fns…) along with ~40 unused shadcn/ui components —
  the untouched Base44 scaffold finally cleaned out.
- Route-level code splitting (same commit).
- Realtime subscriptions use server-side filters (`room_code=eq.X`) so traffic scales per
  room; 400ms debounced reloads.
- All marketing/game art converted to WebP; PNG originals removed from the repo root.

---

## 4. Important UI/UX Changes

| Change | Old behavior | New behavior | Why / user benefit |
|---|---|---|---|
| **Guess must be a selected word** (`3a6b12b`) | Typing in the guess box could submit free text | Typing only filters the word list; a guess requires selecting an entry (free text only for custom categories) | Prevents accidental half-typed guesses from consuming the player's one guess per round |
| **Shop/Collection split** (`e83b00c`) | Collection mixed owned and purchasable items | Collection = locker of owned items only; Shop = the only purchase surface, with daily rotating stock | Clearer mental model; daily rotation creates a reason to return |
| **Illustrated emblems** (Aug 8, 6 commits) | Emoji glyphs on colored enamel tiles | 27 commissioned-style artworks on a near-black disc inside rarity metal rims, optically sized and centered | Massive perceived-quality jump; consistent medallion presentation at every size (evidence: `docs/EMBLEM-ART-BRIEF.md` notes the disc treatment was A/B'd in live tests) |
| **Lobby redesign** (Aug 8, 4 commits) | Cramped 2-column player grid, in-body room code | Full-width showcase row per player (banner, emblem, title), room code in the header | Players' cosmetics are actually visible — makes progression socially meaningful |
| **Word picker one-screen grid** (Aug 9, 4 commits) | Scrollable list with a search bar | Single-screen 3-column grid, font auto-scaled to word length | Whole category visible at a glance during the 60s word-entry window |
| **Question timer 120s → 30s** (`89630dc`) | 2-minute turns with a 30s warning | 30-second turns; auto-question on lapse, with a first-time explainer banner | Radically faster rounds; idle players can't stall the room |
| **Silent reconnect** (PR #12) | "Reconnecting…" pill on channel drops | Same self-healing, no banner | Less alarming; recovery is fast enough that the banner was pure noise |
| **Keyboard-stable name screen** (`5bb196c`) | iOS keyboard resize visibly bounced the centered layout | Keyboard overlays instead of resizing while the name gate shows | Removes the single most-seen jank in first-run experience |
| **Accessibility pass** (`e1a231a`) | Animations always on, some low-contrast text, unlabeled emblems | Reduce Motion honored, contrast bumps, emblem labels | Compliance and comfort |

---

## 5. Architecture Changes

### Timeline of the architecture

1. **Base44 era (before Aug 3, 2026):** platform-managed app; entities SDK, built-in
   auth, backend functions, Stripe. *(Reconstructed from in-repo notes; the Base44 code
   itself is not in the repository.)*
2. **Standalone rewrite (before first push):** React + Vite + Supabase, with `db.js`
   mimicking the Base44 SDK shape. Where this rewrite happened is **not confirmed from
   repository history** — the first GitHub commit ("Eerste versie", Aug 3) already
   contains the finished port.
3. **Untracked growth window (Aug 4–7):** progression, cosmetics, premium packs,
   Capacitor iOS, CI, i18n expansion all appear between the Aug 3 tree and the Aug 7
   root commit. **The repository's history was rewritten on Aug 7, 2026** — the current
   root commit replaces everything earlier, so per-feature history for this window is
   lost (the old commits survive only as unreachable objects behind PRs #1–#2).
   Reason for the rewrite: **not confirmed from repository history.**
4. **Tracked sprint (Aug 7–9):** 59 commits + PRs #3–#12 — polish, audits, native
   hardening, launch prep.

### Current architecture

- **Folder structure:** `src/pages` (routes), `src/components/mystery` (game phases),
  `src/components/progression` (economy UI), `src/components/ui` (trimmed shadcn set),
  `src/lib` (domain logic: profile, economy, cosmetics, payments, share, backup, i18n),
  `src/api/db.js` (data layer), `supabase/` (schema + edge function), `ios/` (Capacitor).
- **State management:** no global store — React context for auth/language, localStorage
  for identity/profile cache/preferences, Supabase as the source of truth for shared
  game state with debounced full reloads on Realtime events.
- **Data flow:** components → `db.js` → supabase-js → Postgres; Realtime pushes trigger
  reloads; profile writes go through `playerProfile.js` (local-first, newest-wins merge,
  background upsert guarded by anonymous auth).
- **Auth layers:** ① guest ID in localStorage (the only gameplay identity) → ② invisible
  anonymous Supabase session (exists solely to satisfy migration 0004's ownership
  policy) → ③ optional real accounts (web only; native v1 hides sign-in entirely to keep
  Apple's guideline 4.8 out of scope — see `APPSTORE.md` §5).
- **Native layer:** Capacitor 8 (SPM, no CocoaPods), portrait-only, forced dark; custom
  `ICloudKVPlugin` for reinstall-surviving backups; Keyboard/Haptics/Share/Filesystem
  plugins.
- **Build/deploy:** Vite; web SPA rewrites for Vercel; `ios-testflight.yml` builds,
  signs (with two independent guards that the iCloud entitlement actually made it into
  the archive — added after backups "silently died" from a wildcard-entitlement signing
  bug), and uploads to TestFlight from a cloud Mac.

---

## 6. Dependencies & Technology

### Removed (the `061242e` purge — none of these were used by app code)

`@hello-pangea/dnd`, `three`, `react-leaflet`, `react-quill`, `recharts`, `moment`,
`date-fns`, `lodash`, `jspdf`, `html2canvas`, `react-markdown`, `embla-carousel-react`,
`cmdk`, `vaul`, `zod`, `react-hook-form`, `@hookform/resolvers`, `react-day-picker`,
`react-hot-toast`, `sonner`, `next-themes`, `react-resizable-panels`, and ~18 of 24
`@radix-ui/*` packages — leftover scaffold from the Base44/shadcn starter. The matching
~40 unused `src/components/ui/*` files were deleted too.

### Added since the first GitHub commit

| Dependency | Purpose |
|---|---|
| `@capacitor/core` + `ios` + `cli` (8.x) | Native iOS wrapper *(present by the Aug 7 root commit)* |
| `@capacitor/keyboard`, `haptics`, `share`, `filesystem` | Keyboard-stable name screen, purchase/celebration haptics, native share-with-image |
| `@revenuecat/purchases-capacitor` | Apple IAP for the six word packs |
| `@sentry/react` | Optional crash reporting (only initialized when a DSN is configured) |
| `canvas-confetti` | Celebrations |
| `playwright` (dev) | Browser automation available in dev *(no committed test suite)* |
| `eslint-plugin-unused-imports`, `typescript` (dev) | Lint/typecheck gates (`npm run lint`, `npm run typecheck`) |

### Retained core

React 18, React Router 6, Vite 6, Tailwind 3 (+ `tailwindcss-animate`), framer-motion 11,
`@supabase/supabase-js` 2, lucide-react, small Radix subset (label/slot/switch/toast),
`input-otp` (sign-up code entry).

### Services

Base44 (everything) → **Supabase** (DB/Realtime/Auth/Edge Functions), **RevenueCat +
Apple IAP** (replacing Stripe), **Vercel** (web), **GitHub Actions + App Store
Connect API** (iOS builds), **iCloud KV store** (backup), optional **Sentry**.

---

## 7. Git History Analysis

The visible history is short (59 commits, Aug 7–9, 2026) but unusually dense, and it is
**not the whole story**:

- **History rewrite:** the current root commit (`5bb196c`, Aug 7) replaced an earlier
  history. Recovered via the GitHub API: `f21b3050` "Eerste versie" (Aug 3, the original
  push by Rico) and four Aug 4 commits (two "Add files via upload", two homescreen
  graphics commits — PRs #1/#2).
- **Squash-merged audit branches:** PRs #3–#8 came from two `claude/mobile-app-prelaunch-audit-*`
  branches; PRs #9–#12 continued on the second. Individual commits carry detailed,
  well-written bodies — several document root-cause analyses (e.g. the equip-clobbering
  merge bug, the wildcard-entitlement signing bug).
- **One revert:** `c70d843` reverted a Title-card layout tweak within 2 minutes — quick
  visual iteration, nothing structural.
- **External-world evidence in commits:** `ef11576` renames the Animal pack product ID
  "after rejection, same pattern as popculture2" — i.e. the app has already been through
  at least one App Store review cycle that rejected/burned product IDs.
  *(Inferred from commit message.)*

### Consolidated milestones

| Date (2026) | Milestone | Commits/PRs |
|---|---|---|
| Aug 3 | First GitHub push of the finished Base44→Supabase port | `f21b3050` (recovered) |
| Aug 4 | Home screen illustrated graphics | PRs #1–#2 (recovered) |
| Aug 4–7 | Progression, cosmetics, packs/IAP, iOS wrapper, CI, i18n *(granular history lost in rewrite)* | pre-root snapshot |
| Aug 7 | History reset; UI polish sprint; support page; pack QA | `5bb196c`…`ef11576` |
| Aug 8 AM | Shop/Collection split; ownership migration 0004; **iCloud backup system**; anonymous auth | `e83b00c`…`b32f81e` |
| Aug 8 PM | Lobby redesign; **27 illustrated emblems** | `66b7be9`…`d6b70dc` |
| Aug 9 AM | Accessibility; word-picker redesign; unread chat badge | `48675c7`…`463ee2e` |
| Aug 9 PM | **Pre-launch audits** (P0 host deadlock, crash safety, dev backdoor, realtime drops, timing, walkover, dependency purge, Sentry, migrations 0005–0006) | PRs #3–#8 |
| Aug 9 eve | Share win card; CI entitlement guards; support page; final polish (silent reconnect, Natural Wonders, equip persistence) | PRs #9–#12 |

---

## 8. Milestone Timeline

### Phase 0 — Base44 Foundation *(before Aug 3, 2026; reconstructed)*
Core 20-questions gameplay, rooms, chat, guest identity, Base44 auth/entities/functions,
Stripe pack paywall.

### Phase 1 — Independence Rewrite *(before/at first push, Aug 3)*
Full port to React + Vite + Supabase; Base44-shaped `db.js`; client-side question bank;
pg_cron lobby cleanup; Supabase Auth (optional by design, per Apple 5.1.1(v)); payments
and Tic-Tac-Toe dropped.

### Phase 2 — Identity & Polish *(Aug 4)*
Custom illustrated home-screen graphics replace generic emoji/icons.

### Phase 3 — Product Expansion *(Aug 4–7, untracked window)*
Progression economy, 102-item cosmetics catalog, Profile/Shop, lobby browser, category
selector, six premium packs with RevenueCat IAP, Capacitor iOS project, TestFlight CI,
`APPSTORE.md` compliance playbook, EN/NL i18n, privacy page, UGC reporting.

### Phase 4 — Native Hardening *(Aug 7–8)*
Keyboard-stable UI, profile ownership (migration 0004), anonymous-auth plumbing,
**iCloud identity/progression backup** with diagnostics, App Store product-ID recovery.

### Phase 5 — Visual Identity *(Aug 8)*
Lobby showcase redesign; the 27-emblem illustrated art program (brief → batches →
optical sizing/centering).

### Phase 6 — Pre-launch Audit & Polish *(Aug 9)*
Three audit waves fixing P0–P2 findings: multiplayer race conditions (answer RPC),
host-deadlock and crash safety, dev-backdoor lockdown, timing overhaul, walkover
correctness, dependency purge + code splitting, optional Sentry, share win card,
CI signing guards, final categories/UX polish.

---

## 9. Current State

### Completed (implemented and appears functional)
- Full multiplayer loop (lobby → words → questions → guesses → results → Play Again)
  with reconnect/self-heal, host migration, kick, presence, walkover handling.
- Progression economy, daily rewards/streaks/challenges, 102 cosmetics, Shop rotation,
  collections, illustrated emblems, share win card.
- EN/NL localization; profanity filter; report + mute + host-kick moderation trio.
- Supabase schema through migration 0006, incl. ownership-protected profiles and
  race-free answer RPC.
- iOS wrapper, iCloud backup + restore + diagnostics, TestFlight CI with entitlement
  guards; optional Sentry; account deletion edge function; privacy/support pages.

### In progress / external setup remaining
- App Store Connect: 6 IAP products, RevenueCat products/entitlements/API key,
  App ID iCloud capability checkbox, sandbox testing (all step-by-step in `APPSTORE.md`).
- Production database must have migrations 0002–0006 applied and
  "Allow anonymous sign-ins" enabled (migration 0004's stated requirement) —
  whether this has been done is **not verifiable from the repository**.

### Incomplete
- **No automated tests** — no test script, no test files (Playwright is installed as a
  dev dependency but unused by any committed code).
- Custom-words category exists in code but was removed from the selector for launch.

### Unclear
- Whether the web (Vercel) deployment is live, and on what domain (privacy-policy URL in
  `APPSTORE.md` is still a `<your-domain>` placeholder).
- Season/challenge lifecycle beyond "S1" — season rotation is hardcoded, with no
  mechanism for a Season 2.

### Potential technical debt
- `README.md` **still says "No payments… everything is unlocked here"** — contradicted by
  the RevenueCat IAP layer added later. The setup instructions also don't mention
  migrations 0002–0006 (README predates them).
- `max_rounds` column written on room creation but never read anywhere.
- An unused duplicate `European Countries` key remains in `PREMIUM_WORD_LISTS` after
  PR #12 swapped the World Pack listing to Natural Wonders.
- Both `vercel.json` and a Netlify-style `public/_redirects` exist.
- Emblem art pipeline (center-of-mass script, WebP conversion) is referenced in the brief
  but not committed.
- The two audit branches were merged repeatedly (5 merge commits from one branch), which
  makes `main`'s graph noisy.

---

## 10. Remaining Work

### P0 — Must fix before launch
1. Apply migrations 0002–0006 + enable anonymous sign-ins on the production Supabase
   project (if not already done) — without 0006, simultaneous answers can still race on
   the client fallback path; without anonymous auth, profile sync silently stops.
2. Complete the `APPSTORE.md` checklist: IAP products (exact IDs — two are already
   "burned" and renamed), RevenueCat entitlements, `VITE_REVENUECAT_IOS_KEY` secret,
   App ID iCloud KV capability, sandbox purchase test.
3. Set the real privacy-policy/support URLs (placeholders remain in `APPSTORE.md`).

### P1 — Strongly recommended before launch
1. Update `README.md`: payments section is wrong, migration list is stale.
2. A minimal automated smoke test (two headless browsers playing a room through to
   `finished`) — the audit commits show how regression-prone the realtime flow is, and
   Playwright is already installed.
3. Verify the TestFlight pipeline end-to-end after the entitlement-guard changes
   (PRs #9–#10 were reactive fixes to real signing failures).

### P2 — Post-launch improvements
1. Server-authoritative rewards: all Picks/XP grants are computed client-side; a player
   can only cheat their **own** profile (0004 ownership), but leaderboard-style features
   would need a server path first.
2. Web deployment parity decision (keep or drop Vercel; remove the unused redirects file).
3. Remove dead schema/word-list leftovers (`max_rounds`, duplicate category key).

### P3 — Future ideas (grounded in existing code)
1. Season 2 mechanism (season challenges are hardcoded "S1" with exclusive rewards).
2. Re-enable the Custom category (code and profanity filtering already exist).
3. Account-linked progression on native (explicitly deferred in `APPSTORE.md` §5).
4. More languages (the i18n structure is a simple flat dictionary; currently EN/NL).

---

## 11. Known Risks

### Confirmed issues (visible in the code today)
- **README/product mismatch** on payments (see §9) — will mislead any new contributor.
- **Client-side economy:** rewards, streaks, and challenge completion are computed and
  written by the client. Bounded by profile ownership (own profile only), but a
  determined user can grant themselves any cosmetic. Accepted trade-off per migration
  0002's comment ("it's all cosmetics/progression… acceptable for a party game").
- **Wide-open game-table RLS (by design):** anyone with the public anon key can read or
  modify any room's state (documented and deliberate in `0001_init.sql`; mirrors Base44's
  posture). Griefing a known room code is technically possible.
- **Pack ownership is device-local** (`localStorage`) with RevenueCat entitlement
  auto-restore on native; on web there is no real purchase path at all (`unavailable`).
- **Daily systems use local-device midnight** (`todayKey()`), so clock changes can
  re-farm daily rewards/shop rotations. Low stakes, but real.

### Potential risks (plausible, not observed failing)
- **Anonymous-session dependency:** if Supabase anonymous sign-ins get disabled or
  rate-limited, profile sync and iCloud-restored sessions degrade (handled gracefully
  per 0004's comments, but silently).
- **pg_cron cleanup deletes rooms idle >2h** — a very long dinner-party lobby could
  vanish; no in-app warning exists.
- **Realtime full-reload pattern** (400ms debounced refetch of all four tables per event)
  is simple and robust but could strain at high player counts per room; fine at ≤12.
- **Lost history window (Aug 4–7):** future archaeology of the progression/IAP layer has
  no commit trail; this document is partial compensation.
- **Single-maintainer bus factor** and no CI on pull requests (the only workflow is the
  manual TestFlight build; lint/typecheck run locally only).

---

## 12. Before / After Summary

| Area | Before / Base44 | Current / GitHub |
|---|---|---|
| **Architecture** | Platform-managed app; entities SDK, backend functions, platform workflows | Self-contained React SPA + Supabase; logic client-side; SQL migrations in-repo; native iOS wrapper |
| **Frontend** | Base44-generated React with full shadcn/dependency scaffold | Trimmed, hand-maintained React 18 + Vite 6 + Tailwind; ~35 dead deps and ~40 dead UI files removed |
| **Backend** | Base44 entities + functions ("Cleanup Stale Lobbies" workflow, question picker) | Supabase Postgres/Realtime; pg_cron cleanup; one edge function (account deletion); question bank client-side |
| **Database** | Base44-managed, "equally open" access | 7 tables, RLS everywhere (game tables open by design; profiles ownership-protected), Realtime publication, 6 versioned migrations |
| **Authentication** | Base44 auth (email + Google); guest ID for gameplay | Guest ID + invisible anonymous Supabase session + optional email/Google/Apple (web only; native ships accountless) |
| **Gameplay** | Core 20-questions loop *(details not in repo)* | Same core, hardened: 30s turns, hint rounds, guess gating, walkover rules, reconnect self-heal, host migration, race-free answers |
| **UI/UX** | Emoji/icon-based visuals *(per PR #1 title)* | Illustrated art program (emblems, mascots, hero), lobby showcase, one-screen word picker, accessibility pass, EN/NL |
| **Emblems** | Not present *(no trace in Aug 3 tree)* | 27 illustrated emblems in a 102-item, 5-rarity cosmetics catalog with shop/collections |
| **Chat** | Present in original port | + unread badge, mutes, reporting, profanity filter, avatar/keyboard fixes |
| **Sharing** | Not present | Canvas-rendered 1080×1440 win card + native share with image |
| **Payments** | Stripe paywall | Apple IAP via RevenueCat, 6 non-consumable packs; cosmetics earnable-only |
| **Deployment** | Base44 hosting | Vercel-ready web build + GitHub Actions → signed TestFlight uploads |

---

## 13. Major Achievements

1. **Full platform independence** — zero Base44 runtime dependencies, achieved without a
   risky big-bang rewrite thanks to the SDK-shaped data layer.
2. **A real economy and identity layer** — progression, cosmetics, collections, and an
   illustrated 27-emblem set that turned a functional game into a product.
3. **App Store-grade native app** — Capacitor wrapper, IAP, UGC compliance, optional
   sign-in done the way Apple's guidelines actually require, account deletion, and an
   iCloud backup system (with a custom Swift plugin) so guests never lose progress.
4. **Ops maturity out of proportion to team size** — cloud CI that signs and uploads
   TestFlight builds, with guards encoding lessons from real signing failures; optional
   Sentry; versioned SQL migrations with unusually good comments.
5. **A disciplined pre-launch audit** — three waves of fixes addressing race conditions,
   deadlocks, crash safety, a dev backdoor, and reward-integrity bugs, each with
   root-cause write-ups in the commit history.

---

## 14. Final Executive Summary

**Where the project started.** A 20-questions party game built on the Base44 app-builder:
platform-managed data, auth, server functions, and a Stripe paywall.

**What changed in the Base44 → GitHub transition.** The app was ported wholesale to an
independent React + Vite + Supabase codebase (first pushed Aug 3, 2026 as "Eerste
versie"). The Base44 entities SDK was replaced by a same-shaped Supabase wrapper, server
question-picking moved into the client, cleanup became a pg_cron job, auth became
Supabase (and optional), and payments/dead mini-games were dropped. On Aug 7 the Git
history was reset; four days of intense, well-documented work followed.

**Biggest features added since.** The Picks/XP progression economy, a 102-item cosmetics
catalog crowned by 27 illustrated emblems, Shop/Collection with daily rotation, six paid
word packs via Apple IAP, a share win card, a public lobby browser, EN/NL localization,
and full App Store compliance (reporting, muting, deletion, optional sign-in).

**Biggest architectural improvements.** Ownership-protected profiles over anonymous
auth, a race-free answer RPC, iCloud identity/progression backup with a custom native
plugin, a signing-hardened TestFlight CI pipeline, and a dependency purge that removed
roughly a third of the installed packages.

**Current state.** Feature-complete and audited for launch. The code work is done;
what remains is almost entirely one-time console setup (App Store Connect IAP,
RevenueCat, iCloud capability, production DB migrations) plus documentation refresh.

**Biggest remaining problems.** No automated tests for a highly stateful realtime flow;
a stale README that contradicts the payment model; client-authoritative rewards and
open game-table RLS (both deliberate, both worth revisiting if the game grows); and the
lost Aug 4–7 history window, which this document now stands in for.

**Recommended next steps.** Finish the `APPSTORE.md` checklist and verify migrations on
production (P0), refresh the README and add a two-player Playwright smoke test (P1),
then ship — and revisit server-side reward validation only if leaderboards or
competitive features ever appear.
