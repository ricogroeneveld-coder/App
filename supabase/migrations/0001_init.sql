-- "What's my pick?" — Supabase schema
--
-- This app has no login system: every player is an anonymous guest with a
-- random ID stored in their browser's localStorage (see src/lib/guestIdentity.js).
-- The whole game — rooms, players, questions, guesses, chat — has to be
-- freely readable and writable by anyone holding the public anon key, or the
-- game itself can't work (any player needs to update room state, answer
-- questions, etc). That's why every RLS policy below is `using (true)`. This
-- mirrors the original base44 app's config, which was equally open. Don't
-- add anything sensitive to these tables.
--
-- Run this whole file once in the Supabase SQL editor (or via
-- `supabase db push` / `supabase migration up` if you're using the CLI).
-- It's written to be safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.mystery_rooms (
  id                        uuid primary key default gen_random_uuid(),
  room_code                 text not null unique,
  host_id                   text not null,
  host_name                 text,
  category                  text not null default '',
  status                    text not null default 'lobby'
                              check (status in ('lobby', 'word_entry', 'playing', 'finished')),
  current_questioner_index  integer not null default 0,
  question_deadline         timestamptz,
  round_number              integer not null default 1,
  max_rounds                integer not null default 10,
  is_public                 boolean not null default false,
  created_date              timestamptz not null default now(),
  updated_date              timestamptz not null default now()
);

create table if not exists public.mystery_players (
  id                            uuid primary key default gen_random_uuid(),
  room_code                     text not null,
  user_id                       text not null,
  display_name                  text not null default '',
  secret_word                   text not null default '',
  word_submitted                boolean not null default false,
  word_revealed                 boolean not null default false,
  score                         numeric not null default 0,
  is_eliminated                 boolean not null default false,
  color                         text not null default '#6366f1',
  last_guess_at_question_count  numeric not null default 0,
  created_date                  timestamptz not null default now(),
  updated_date                  timestamptz not null default now()
);

create table if not exists public.mystery_questions (
  id             uuid primary key default gen_random_uuid(),
  room_code      text not null,
  round_number   numeric,
  question_text  text not null,
  asker_id       text not null,
  asker_name     text,
  is_ai          boolean not null default false,
  answers        jsonb not null default '{}'::jsonb,
  status         text not null default 'pending'
                   check (status in ('pending', 'answering', 'complete')),
  created_date   timestamptz not null default now(),
  updated_date   timestamptz not null default now()
);

create table if not exists public.mystery_guesses (
  id                   uuid primary key default gen_random_uuid(),
  room_code            text not null,
  guesser_id           text not null,
  guesser_name         text,
  target_player_id     text not null,
  target_player_name   text,
  guessed_word         text not null,
  correct              boolean not null default false,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now()
);

-- Chat messages are immutable (create/read/delete only — matches the
-- original app's rls config), so there's no updated_date/trigger here.
create table if not exists public.mystery_chats (
  id             uuid primary key default gen_random_uuid(),
  room_code      text not null,
  user_id        text not null,
  display_name   text,
  color          text,
  message        text not null,
  has_emote      boolean not null default false,
  emote          text not null default '',
  created_date   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Indexes — every table is queried by room_code constantly
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists idx_mystery_rooms_public_lobby on public.mystery_rooms (status, is_public);
create index if not exists idx_mystery_rooms_updated on public.mystery_rooms (updated_date);
create index if not exists idx_mystery_players_room on public.mystery_players (room_code);
create index if not exists idx_mystery_players_room_user on public.mystery_players (room_code, user_id);
create index if not exists idx_mystery_questions_room on public.mystery_questions (room_code);
create index if not exists idx_mystery_guesses_room on public.mystery_guesses (room_code);
create index if not exists idx_mystery_chats_room on public.mystery_chats (room_code);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_date trigger — keeps it current automatically on every UPDATE,
-- same as base44's built-in behavior. (mystery_chats has no updated_date —
-- it's never updated.)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

drop trigger if exists trg_mystery_rooms_updated on public.mystery_rooms;
create trigger trg_mystery_rooms_updated
  before update on public.mystery_rooms
  for each row execute function public.set_updated_date();

drop trigger if exists trg_mystery_players_updated on public.mystery_players;
create trigger trg_mystery_players_updated
  before update on public.mystery_players
  for each row execute function public.set_updated_date();

drop trigger if exists trg_mystery_questions_updated on public.mystery_questions;
create trigger trg_mystery_questions_updated
  before update on public.mystery_questions
  for each row execute function public.set_updated_date();

drop trigger if exists trg_mystery_guesses_updated on public.mystery_guesses;
create trigger trg_mystery_guesses_updated
  before update on public.mystery_guesses
  for each row execute function public.set_updated_date();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — fully open, see note at top of file
-- ─────────────────────────────────────────────────────────────────────────

alter table public.mystery_rooms enable row level security;
alter table public.mystery_players enable row level security;
alter table public.mystery_questions enable row level security;
alter table public.mystery_guesses enable row level security;
alter table public.mystery_chats enable row level security;

drop policy if exists "anyone can do anything" on public.mystery_rooms;
create policy "anyone can do anything" on public.mystery_rooms
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anyone can do anything" on public.mystery_players;
create policy "anyone can do anything" on public.mystery_players
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anyone can do anything" on public.mystery_questions;
create policy "anyone can do anything" on public.mystery_questions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anyone can do anything" on public.mystery_guesses;
create policy "anyone can do anything" on public.mystery_guesses
  for all to anon, authenticated using (true) with check (true);

-- Chat has no update policy (messages are immutable) — create/read/delete only.
drop policy if exists "anyone can read chat" on public.mystery_chats;
create policy "anyone can read chat" on public.mystery_chats
  for select to anon, authenticated using (true);
drop policy if exists "anyone can post chat" on public.mystery_chats;
create policy "anyone can post chat" on public.mystery_chats
  for insert to anon, authenticated with check (true);
drop policy if exists "anyone can delete chat" on public.mystery_chats;
create policy "anyone can delete chat" on public.mystery_chats
  for delete to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — the app subscribes to every INSERT/UPDATE/DELETE on these
-- tables. REPLICA IDENTITY FULL makes DELETE/UPDATE payloads include the
-- full old row (not just the id), which src/api/db.js's event.data relies
-- on (e.g. Home.jsx checks event.data.is_public on every event including
-- deletes).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.mystery_rooms replica identity full;
alter table public.mystery_players replica identity full;
alter table public.mystery_questions replica identity full;
alter table public.mystery_guesses replica identity full;
alter table public.mystery_chats replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mystery_rooms'
  ) then
    alter publication supabase_realtime add table public.mystery_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mystery_players'
  ) then
    alter publication supabase_realtime add table public.mystery_players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mystery_questions'
  ) then
    alter publication supabase_realtime add table public.mystery_questions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mystery_guesses'
  ) then
    alter publication supabase_realtime add table public.mystery_guesses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mystery_chats'
  ) then
    alter publication supabase_realtime add table public.mystery_chats;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Stale lobby cleanup — replaces the original "Cleanup Stale Lobbies"
-- scheduled workflow. Deletes any room (+ its players/chat/questions/
-- guesses) that hasn't been touched in 2+ hours, hourly.
--
-- Requires the pg_cron extension. On Supabase this is enabled per-project
-- under Database → Extensions → pg_cron (or the SQL below, if your project
-- role has permission). If pg_cron isn't available on your plan, you can
-- still call `select public.cleanup_stale_mystery_lobbies();` from anywhere
-- on a schedule (e.g. a GitHub Action or an external cron hitting a
-- Supabase Edge Function).
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_stale_mystery_lobbies()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_codes text[];
begin
  select array_agg(room_code) into stale_codes
  from public.mystery_rooms
  where updated_date < now() - interval '2 hours';

  if stale_codes is null or array_length(stale_codes, 1) is null then
    return;
  end if;

  delete from public.mystery_players where room_code = any(stale_codes);
  delete from public.mystery_chats where room_code = any(stale_codes);
  delete from public.mystery_questions where room_code = any(stale_codes);
  delete from public.mystery_guesses where room_code = any(stale_codes);
  delete from public.mystery_rooms where room_code = any(stale_codes);
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-stale-mystery-lobbies') then
    perform cron.unschedule('cleanup-stale-mystery-lobbies');
  end if;
end $$;

-- Runs on the hour, every hour, in UTC (pg_cron's default timezone — the
-- original workflow ran hourly in Europe/Berlin, but since it's a plain
-- "every hour" schedule with a 2-hour staleness window, the timezone
-- difference doesn't change behavior).
select cron.schedule(
  'cleanup-stale-mystery-lobbies',
  '0 * * * *',
  $$ select public.cleanup_stale_mystery_lobbies(); $$
);
