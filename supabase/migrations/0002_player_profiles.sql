-- Player progression profiles — one row per guest identity.
-- Same trust model as the rest of the game: fully open RLS, the guest id in
-- localStorage IS the identity. Nothing here affects gameplay balance, it's
-- all cosmetics/progression, so open writes are acceptable for a party game.
create table if not exists public.player_profiles (
  user_id text primary key,
  display_name text not null default '',
  level int not null default 1,
  xp int not null default 0,
  picks int not null default 0,
  games_played int not null default 0,
  wins int not null default 0,
  correct_guesses int not null default 0,
  win_streak int not null default 0,
  category_counts jsonb not null default '{}'::jsonb,
  owned jsonb not null default '[]'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  challenges jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{}'::jsonb,
  granted jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "player_profiles open select" on public.player_profiles
  for select using (true);
create policy "player_profiles open insert" on public.player_profiles
  for insert with check (true);
create policy "player_profiles open update" on public.player_profiles
  for update using (true);

-- Realtime: let clients see profile changes live, so lobby rows update the
-- moment another player equips a new cosmetic (same pattern as 0001).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_profiles'
  ) then
    alter publication supabase_realtime add table public.player_profiles;
  end if;
end $$;
