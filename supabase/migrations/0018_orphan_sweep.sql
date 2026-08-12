-- 0018 — Sweep orphaned game rows, not just stale rooms.
--
-- The hourly cleanup derives its work list from rows still present in
-- mystery_rooms — but the client deletes the room row itself when the last
-- player leaves (MysteryGame's beforeunload / roomLifecycle), and 0015 only
-- restricts deleting POPULATED rooms. Once the room row is gone, that room's
-- players / chats / questions / guesses / secrets become unreachable to the
-- sweep and leak forever — a permanent, monotonic leak on the five hottest
-- tables, including plaintext secret words in mystery_secrets.
--
-- Fix: after the stale-room pass, delete any child row whose room no longer
-- exists. The anti-joins are cheap — every child table has a room_code index
-- and mystery_rooms.room_code is unique.
--
-- Safe to re-run (and worth running once by hand to clear the backlog).

set search_path = public;

create or replace function public.cleanup_stale_mystery_lobbies()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_codes text[];
begin
  -- Pass 1: rooms idle for 2+ hours, exactly as before.
  select array_agg(room_code) into stale_codes
  from public.mystery_rooms
  where updated_date < now() - interval '2 hours';

  if stale_codes is not null and array_length(stale_codes, 1) is not null then
    delete from public.mystery_players   where room_code = any(stale_codes);
    delete from public.mystery_chats     where room_code = any(stale_codes);
    delete from public.mystery_questions where room_code = any(stale_codes);
    delete from public.mystery_guesses   where room_code = any(stale_codes);
    delete from public.mystery_secrets   where room_code = any(stale_codes);
    delete from public.mystery_rooms     where room_code = any(stale_codes);
  end if;

  -- Pass 2: children whose room row is already gone. There are no foreign
  -- keys in this schema, so this anti-join is the only thing standing between
  -- "room deleted" and "its rows live forever".
  delete from public.mystery_players p
    where not exists (select 1 from public.mystery_rooms r where r.room_code = p.room_code);
  delete from public.mystery_chats c
    where not exists (select 1 from public.mystery_rooms r where r.room_code = c.room_code);
  delete from public.mystery_questions q
    where not exists (select 1 from public.mystery_rooms r where r.room_code = q.room_code);
  delete from public.mystery_guesses g
    where not exists (select 1 from public.mystery_rooms r where r.room_code = g.room_code);
  delete from public.mystery_secrets s
    where not exists (select 1 from public.mystery_rooms r where r.room_code = s.room_code);
end $$;
