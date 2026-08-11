# What's my pick?

A real-time multiplayer party game (20-questions style): everyone picks a
secret word in a shared category, then takes turns asking yes/no questions
to guess each other's word. Built with React + Vite + Supabase.

Gameplay never requires an account — every player is an anonymous "guest"
identified by a random ID kept in their browser's localStorage, and that's
true whether or not they're signed in. Rooms, players, questions, guesses,
and chat all sync in real time via Supabase Realtime. Signing in
(email/password, Google, or Apple) is available as a fully optional layer on
top, for anyone who wants an account — see "Optional sign-in" below for why
it's optional rather than required.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (the
   free tier is plenty for this app).
2. Once it's provisioned, open **Settings → API** and copy the **Project
   URL** and the **`anon` / `public` key**. You'll need both in step 3.

## 2. Set up the database

1. Open your project's **SQL Editor**.
2. Paste in the full contents of `supabase/migrations/0001_init.sql` and run
   it. This creates the five tables the game uses (`mystery_rooms`,
   `mystery_players`, `mystery_questions`, `mystery_guesses`,
   `mystery_chats`), sets up Row Level Security, turns on Realtime for all
   five tables, and schedules an hourly cleanup job for abandoned game
   rooms.
   - The cleanup job needs the `pg_cron` extension. The migration tries to
     enable it automatically; if that line errors for your project/plan,
     enable **pg_cron** manually under **Database → Extensions** and re-run
     just the `cron.schedule(...)` block at the bottom of the file.
3. **Security note:** every table's RLS policy is wide open
   (`using (true)`) — see the comment at the top of the migration file for
   why. There's no auth system, so any player needs to freely read/write
   the shared game state. Don't add anything sensitive to these tables.

## 3. Optional sign-in — providers and email template

The app works fully without this step (guests can create/join/play games
with no account at all — see "Why sign-in is optional" below). Skip to step
4 if you don't need accounts yet.

1. In your Supabase project, go to **Authentication → Providers**.
2. **Email** is on by default — that covers email/password sign-up.
3. **Google**: enable the Google provider and follow Supabase's prompt to
   create OAuth credentials in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   Add the callback URL Supabase shows you as an authorized redirect URI.
4. **Apple**: enable the Apple provider. This needs a paid Apple Developer
   Program membership — you'll create a Services ID, a Sign in with Apple
   key, and get your Team ID, then enter those into Supabase's Apple
   provider settings. See
   [Supabase's Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
   for the exact steps.
   - If you ship this through a native wrapper (Capacitor, etc.) for the iOS
     App Store, double check that wrapper's own Sign in with Apple
     requirements — some prefer the native `AuthenticationServices` button
     over a web redirect. This app uses Supabase's standard web OAuth
     redirect, which covers Guideline 4.8 (offering Apple alongside Google),
     but verify it renders well inside your specific wrapper.
5. Under **Authentication → URL Configuration**, set your **Site URL** (e.g.
   `http://localhost:5173` for local dev, your real domain in production)
   and add it to **Redirect URLs** — OAuth and password-reset links won't
   come back to the right place otherwise.
6. **Email template for sign-up codes**: this app shows a 6-digit code entry
   screen after registering (`src/pages/Register.jsx`), not a "click this
   link" email. Under **Authentication → Email Templates → Confirm signup**,
   make sure the template includes `{{ .Token }}` (the code) — Supabase's
   default template uses `{{ .ConfirmationURL }}` instead, which won't work
   with this flow unless you switch it.

## 4. Deploy the account-deletion function

Guideline 5.1.1(v) requires that apps supporting account creation also offer
account deletion in-app. Deleting an Auth user needs the `service_role` key,
which can never be shipped to the browser, so this runs as a server-side
Edge Function instead:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy delete-account
```

No extra secrets to configure — Supabase automatically provides
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to every
deployed Edge Function.

## 5. Configure the app

```bash
cp .env.example .env.local
```

Fill in the two values from step 1:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 6. Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Create a game on one device/tab and join it
with the room code from another to test the multiplayer flow.

## Project structure

- `src/pages/Home.jsx` — landing page: pick a name, create or join a room
- `src/pages/MysteryGame.jsx` — loads room state and renders the right phase
- `src/components/mystery/` — the four game phases (lobby, word entry,
  playing, finished) plus chat, the guess modal, and the notebook of clues
- `src/lib/wordLists.js` — the built-in word categories (static data)
- `src/lib/questionBank.js` — the "auto-ask" question bank used when a
  player's turn timer runs out (picked client-side, no backend call)
- `src/api/db.js` — the data layer: a small wrapper around `@supabase/supabase-js`
  exposing `filter` / `create` / `update` / `delete` / `subscribe` for each
  table
- `src/lib/supabaseClient.js` — the Supabase client
- `src/lib/AuthContext.jsx` — optional sign-in state (`useAuth()`); gameplay
  never reads from this, only `ProfileSettings` and the auth pages do
- `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`,
  `ResetPassword.jsx` — the optional sign-in flow (email/password, Google,
  Apple)
- `supabase/functions/delete-account/` — server-side account deletion
- `supabase/migrations/0001_init.sql` — the full database schema

## Why sign-in is optional, not required

It's tempting to assume the App Store requires a login screen — it
doesn't. [Apple's Guideline 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#5.1.1)
requires the *opposite*: apps must let people use features that aren't
inherently account-based without forcing registration first. Requiring
sign-in for a game that doesn't need one is itself a real rejection reason
Apple has cited in the wild. Guideline 4.8 (offer Sign in with Apple
alongside any other social login) is why Apple is included here now that
Google is — it only applies once you offer a third-party login at all.

So: gameplay stays guest-only end to end, exactly like before. Sign-in is
an extra, fully optional identity layer for anyone who wants an account —
offered from `ProfileSettings`, never required to create, join, or play a
game.

## Notes on what changed from the original

This was originally built on base44; this version is fully independent of
it. A few things were intentionally simplified along the way:

- **Payments are Apple IAP, not Stripe.** The original had a Stripe-based
  web paywall for some word packs. This version sells the premium category
  packs through Apple In-App Purchase via RevenueCat instead
  (`src/lib/payments.js`; see `APPSTORE.md §2`). The in-game "Picks" currency
  and all cosmetics are earned by playing only — never sold.
- **No Tic-Tac-Toe.** There was an unused, unreachable Tic-Tac-Toe mini-game
  left over in the original codebase (nothing in the UI ever created a
  match). It wasn't ported.
- **Question generation moved client-side.** The original called a backend
  function to pick a random question from a static bank. Since the bank has
  no secrets and needs no server logic, it's now called directly in the
  browser (`src/lib/questionBank.js`) — one less moving part, and instant
  instead of a network round-trip.
- **Sign-in is now Supabase Auth, not base44.** Same shape as the original
  (email/password + Google), with Apple added for App Store parity. Unlike
  the original, being signed in doesn't change gameplay at all — it never
  did, even in the base44 version (game state was always keyed by the
  guest id, signed in or not); this version just makes that intentional.

