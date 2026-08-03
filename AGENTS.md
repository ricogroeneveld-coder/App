# AGENTS.md

## Project Context

React + Vite + Supabase app. No backend framework beyond Supabase itself
(Postgres + Realtime + RLS) — there's no separate API server. Treat this as
user-owned application code; keep changes focused on the request and
preserve existing conventions.

Start with `README.md` for setup (Supabase project, env vars, running
locally).

## Key Files

- `src/`: frontend application source.
- `src/api/db.js`: the data layer — wraps `@supabase/supabase-js` with a
  small `filter` / `create` / `update` / `delete` / `subscribe` interface
  used by every page/component that touches game state.
- `src/lib/supabaseClient.js`: the Supabase client singleton (reads
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from env).
- `src/lib/AuthContext.jsx`: optional sign-in state (`useAuth()`). Gameplay
  never reads from this — only `ProfileSettings.jsx` and the auth pages do.
- `supabase/functions/delete-account/`: server-side account deletion (needs
  the service_role key, so it can't run client-side).
- `supabase/migrations/0001_init.sql`: full schema, RLS policies, Realtime
  publication setup, and the stale-lobby cleanup cron job. This is the
  source of truth for the database — if you add or change a table, update
  this file (and re-run it against the project).
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Gameplay identity is always the random guest ID in localStorage
  (`src/lib/guestIdentity.js`), signed in or not. Sign-in
  (`AuthContext`/`Login`/`Register`) is a separate, optional layer — it's
  there because some users want an account, not because anything requires
  one. Don't gate game creation/joining/playing behind
  `useAuth().isAuthenticated`; that would reintroduce the exact "forces
  registration for non-account features" problem Apple's Guideline 5.1.1(v)
  flags apps for. See the README's "Why sign-in is optional" section before
  changing this.
- Every table's RLS policy is fully open (`using (true)`) by design — see
  the comment at the top of the migration file. Don't add sensitive data to
  these tables without revisiting that.
- Realtime subscriptions go through `db.js`'s `.subscribe()`, which wraps
  Supabase's `postgres_changes`. If you add a new table that needs realtime
  updates, add it to the `supabase_realtime` publication and set
  `REPLICA IDENTITY FULL` in the migration (see existing tables for the
  pattern) — otherwise UPDATE/DELETE payloads won't carry full row data.
- Run the relevant checks from `package.json` (`npm run lint`,
  `npm run typecheck`) before finishing code changes.
