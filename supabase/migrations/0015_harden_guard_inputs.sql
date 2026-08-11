-- 0015 — Stop the guards from trusting client-writable state.
--
-- Migration 0012 moved the cheat-critical ACTIONS behind validated RPCs, but
-- every one of those guards reads state the caller can still write. A check is
-- only as trustworthy as its inputs, so the locks were bypassable:
--
--   * the guess cooldown reads mystery_players.last_guess_at_question_count —
--     client-writable, so set it to 0 and guess without limit, brute-forcing
--     the (bundled, therefore known) category word list;
--   * submit_mystery_word never checks WHO is calling, so during word entry a
--     caller can write a word into another player's slot and then simply guess
--     it;
--   * submit_mystery_answer never checks the answerer belongs to the question's
--     room, so anyone can answer on anyone's behalf and poison the clue table;
--   * DELETE is still open on rooms/players/questions/chats, so any caller can
--     wipe games they are not part of.
--
-- This migration closes what can be closed WITHOUT a client change (so it can
-- ship ahead of any binary): it revokes the columns no client writes any more,
-- adds the membership checks, and scopes DELETE.
--
-- STILL OPEN, deliberately, because the fix needs a matching client release:
--   * mystery_players.is_eliminated stays client-writable — leaving a game
--     mid-round legitimately writes it (roomLifecycle 'eliminate'). While it is
--     writable, marking every opponent eliminated satisfies the "<=1 active
--     player" test in mystery_set_status and force-finishes a live game, and the
--     reveal-on-finish trigger then publishes every secret word. Closing it
--     needs a leave_mystery_room() RPC plus the client calling it.
--   * display_name stays writable on any row (in-room impersonation).
-- Both are tracked in PRODUCTION_AUDIT.md.
--
-- The underlying limit is unchanged and worth stating plainly: guest identity is
-- an unauthenticated string, so none of this proves WHO is calling. These
-- changes remove the cheap, reliable attacks; they do not make the model sound.
--
-- Safe to re-run.

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Revoke the columns no client writes any more.
--
-- Verified against the app: secret_word / word_submitted are written only by
-- pre-0010 fallbacks that no longer execute, and last_guess_at_question_count
-- only by the dead play-again fallback. The SECURITY DEFINER functions
-- (submit_mystery_word, submit_mystery_guess, mystery_set_status,
-- play_again_mystery) bypass column grants, so real gameplay is unaffected.
-- ─────────────────────────────────────────────────────────────────────────
revoke update on public.mystery_players from anon, authenticated;
grant update (
  room_code, user_id, display_name, is_eliminated, color, created_date, updated_date
) on public.mystery_players to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. submit_mystery_word — first write wins.
--
-- Identity can't be verified, but a word that is already locked in must not be
-- silently replaced. This turns "overwrite the victim's word at any point in
-- word entry, then guess it" into "you must beat them to an empty slot, and
-- their own submit then fails loudly" — a visible failure instead of an
-- invisible, reliable cheat.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_mystery_word(
  p_room text,
  p_user text,
  p_word text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  already boolean;
begin
  if not exists (select 1 from public.mystery_rooms where room_code = p_room and status = 'word_entry') then
    return jsonb_build_object('ok', false, 'reason', 'not_word_entry');
  end if;
  if mystery_norm(coalesce(p_word, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  -- The player must be in this room...
  select word_submitted into already
  from public.mystery_players
  where room_code = p_room and user_id = p_user;
  if already is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  -- ...and must not already have a word locked in.
  if already then
    return jsonb_build_object('ok', false, 'reason', 'already_submitted');
  end if;

  insert into public.mystery_secrets (room_code, user_id, word, updated_date)
  values (p_room, p_user, p_word, now())
  on conflict (room_code, user_id)
  do update set word = excluded.word, updated_date = now();

  update public.mystery_players
  set word_submitted = true
  where room_code = p_room and user_id = p_user;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.submit_mystery_word(text, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. submit_mystery_answer — the answerer must be an active non-asker in the
-- question's own room. Stops non-members answering, and stops the asker
-- answering their own question to skew the clue table.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_mystery_answer(
  q_id uuid,
  answerer_id text,
  answer boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  merged jsonb;
  pending integer;
begin
  select * into q from public.mystery_questions where id = q_id for update;
  if q.id is null then
    return;
  end if;

  -- Membership check (0015).
  if q.asker_id = answerer_id then
    return;
  end if;
  if not exists (
    select 1 from public.mystery_players
    where room_code = q.room_code and user_id = answerer_id
      and not is_eliminated and not word_revealed
  ) then
    return;
  end if;

  merged := coalesce(q.answers, '{}'::jsonb) || jsonb_build_object(answerer_id, answer);

  select count(*) into pending
  from public.mystery_players p
  where p.room_code = q.room_code
    and p.user_id <> q.asker_id
    and not p.is_eliminated
    and not p.word_revealed
    and not merged ? p.user_id;

  update public.mystery_questions
  set answers = merged,
      status = case when pending = 0 then 'complete' else 'answering' end
  where id = q_id;

  -- Question finished: give the next asker a full timer from NOW (GAME-N4).
  if pending = 0 then
    update public.mystery_rooms
    set question_deadline = now() + interval '30 seconds'
    where room_code = q.room_code and status = 'playing';
  end if;
end $$;

grant execute on function public.submit_mystery_answer(uuid, text, boolean) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Scope DELETE.
--
-- Questions and chats: no client deletes these any more (the play-again reset
-- runs inside play_again_mystery, which is SECURITY DEFINER), so revoke
-- outright. Chat moderation runs with the service-role key, which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────
revoke delete on public.mystery_questions from anon, authenticated;
revoke delete on public.mystery_chats from anon, authenticated;

-- Players: legitimate deletes happen in the lobby, during word entry, and by
-- the last player leaving a finished room — never mid-round (leaving a live
-- game sets is_eliminated instead). Blocking DELETE while a room is 'playing'
-- therefore costs nothing and stops a caller removing active players from a
-- game in progress. RESTRICTIVE so it ANDs with the existing open policy.
drop policy if exists "mystery_players no delete during play" on public.mystery_players;
create policy "mystery_players no delete during play" on public.mystery_players
  as restrictive for delete to anon, authenticated
  using (
    not exists (
      select 1 from public.mystery_rooms r
      where r.room_code = mystery_players.room_code and r.status = 'playing'
    )
  );

-- Rooms: the only legitimate room delete is the last player on their way out
-- (the client removes its own player row first, or is the sole remaining one),
-- so allow it only for a room nobody is left in. A populated room can no longer
-- be wiped by a passer-by.
drop policy if exists "mystery_rooms delete only when empty" on public.mystery_rooms;
create policy "mystery_rooms delete only when empty" on public.mystery_rooms
  as restrictive for delete to anon, authenticated
  using (
    (select count(*) from public.mystery_players p where p.room_code = mystery_rooms.room_code) <= 1
  );
