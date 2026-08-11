-- 0008 — Lightweight first-party analytics (ANA-1).
--
-- The app shipped with zero product analytics, so a soft-launch would be
-- blind — no funnel, no drop-off, no retention. Rather than pull in a
-- third-party SDK (and a new privacy-policy entry / SDK weight), events go to
-- this one table. It's insert-only for clients and has NO select policy, so
-- the browser can write events but never read anyone's — you review them from
-- the Supabase dashboard / SQL. It is deliberately NOT in the Realtime
-- publication. No PII: identity is the pseudonymous guest id already used for
-- gameplay; display names / message text are never sent.
--
-- Safe to re-run.

create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  props      jsonb not null default '{}'::jsonb,
  user_id    text,
  session_id text,
  platform   text,
  ts         timestamptz not null default now()
);

create index if not exists idx_analytics_events_event_ts on public.analytics_events (event, ts);

alter table public.analytics_events enable row level security;

-- Insert-only for clients; no select policy (dashboard-only review).
drop policy if exists "analytics insert only" on public.analytics_events;
create policy "analytics insert only" on public.analytics_events
  for insert to anon, authenticated with check (true);
