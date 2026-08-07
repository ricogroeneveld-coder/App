-- Player reports — required App Store UGC safety mechanism (guideline 1.2).
-- Players can report others from the player card; rows are write-only for
-- clients (no select policy), reviewed by the developer in the dashboard.
create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null default '',
  reported_user_id text not null default '',
  reported_name text not null default '',
  room_code text not null default '',
  created_date timestamptz not null default now()
);

alter table public.player_reports enable row level security;

create policy "player_reports insert only" on public.player_reports
  for insert with check (true);
