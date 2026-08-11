-- 0009 — Device push tokens for turn/re-engagement notifications (LAUNCH-4).
--
-- The app had no push channel, so there was no way to pull a player back ("your
-- turn", "your daily reward"). Native devices register here; the notify-turn
-- Edge Function (which runs with the service_role key) reads these tokens and
-- sends via APNs. Clients can write their OWN token but cannot read the table
-- (no select policy) — only the server-side function reads it. Not in Realtime.
--
-- Inert until APNs is configured (see APPSTORE.md) — exactly like the
-- RevenueCat wiring: the code ships, the credentials are a dashboard step.
--
-- Safe to re-run.

create table if not exists public.push_tokens (
  user_id      text not null,
  token        text not null,
  platform     text not null default 'ios',
  updated_date timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens insert" on public.push_tokens;
create policy "push_tokens insert" on public.push_tokens
  for insert to anon, authenticated with check (true);
drop policy if exists "push_tokens update" on public.push_tokens;
create policy "push_tokens update" on public.push_tokens
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "push_tokens delete" on public.push_tokens;
create policy "push_tokens delete" on public.push_tokens
  for delete to anon, authenticated using (true);
-- (No select policy: only the service-role Edge Function reads tokens.)
