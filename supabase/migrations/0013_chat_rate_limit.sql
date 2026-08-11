-- 0013 — Server-side chat guardrails (CHAT-4 / CHAT-5).
--
-- The 600ms send cooldown and the 300-char cap live only in the React client,
-- so a crafted client (or a raw insert with the anon key) can flood a room and
-- trigger continuous full-screen emote rain for everyone, or push an oversized
-- message that blows out every client's layout. A BEFORE INSERT trigger backs
-- both server-side: at most N messages per user per room per window, and every
-- stored message is truncated to the same cap the UI assumes.
--
-- Safe to re-run.

set search_path = public;

create or replace function public.mystery_chat_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  -- Truncate to the client's MAX_MESSAGE_LENGTH so no client renders an
  -- oversized body (CHAT-5). Also clamp the display name.
  new.message := left(coalesce(new.message, ''), 300);
  new.display_name := left(coalesce(new.display_name, ''), 40);

  -- Per-user, per-room flood limit (CHAT-4). The client already throttles to
  -- ~1 send / 600ms, so this only bites crafted/abusive clients.
  select count(*) into recent
  from public.mystery_chats
  where room_code = new.room_code
    and user_id = new.user_id
    and created_date > now() - interval '10 seconds';
  if recent >= 8 then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_mystery_chat_guard on public.mystery_chats;
create trigger trg_mystery_chat_guard
  before insert on public.mystery_chats
  for each row execute function public.mystery_chat_guard();
