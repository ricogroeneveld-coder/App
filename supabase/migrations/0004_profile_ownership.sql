-- Ownership protection for player_profiles — closes the "anyone with the
-- anon key can edit any player's profile" hole. Every device now signs in
-- ANONYMOUSLY at startup (invisible — no account, no UI; see ensureAuth in
-- src/lib/playerProfile.js). A trigger stamps each profile row with that
-- session's auth.uid(), and afterwards only the owning session may update
-- the row. Reads stay open: lobbies show peers' cosmetics.
--
-- ⚠ REQUIRES a dashboard toggle BEFORE this helps rather than hurts:
--   Authentication → Sign In / Providers → "Allow anonymous sign-ins" → ON.
-- If that stays off, profile SYNC stops (gameplay and local progression
-- keep working; the app degrades gracefully) — but nothing is protected
-- either, because writes simply fail for everyone.
--
-- Existing rows (owner is null) are claimed by whichever session writes
-- them next — in practice the profile's own device on its next sync.

alter table public.player_profiles add column if not exists owner uuid;

create or replace function public.claim_profile_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Server-side stamp: the client can neither choose nor spoof the owner.
  new.owner := auth.uid();
  return new;
end $$;

drop trigger if exists trg_player_profiles_owner on public.player_profiles;
create trigger trg_player_profiles_owner
  before insert or update on public.player_profiles
  for each row execute function public.claim_profile_owner();

-- Swap the open write policies for owner-checked ones (select stays open).
drop policy if exists "player_profiles open insert" on public.player_profiles;
drop policy if exists "player_profiles open update" on public.player_profiles;

create policy "player_profiles auth insert" on public.player_profiles
  for insert to authenticated
  with check (auth.uid() is not null);

create policy "player_profiles owner update" on public.player_profiles
  for update to authenticated
  using (owner is null or owner = auth.uid())
  with check (owner = auth.uid());
