-- 0016 — Reveal secrets only when the game is won, never when it is merely
-- declared over.
--
-- The last reported bypass: mystery_players.is_eliminated is client-writable,
-- so marking every opponent eliminated satisfies the "<=1 active player" test
-- in mystery_set_status, force-finishes a live game, and the
-- reveal-on-finish TRIGGER then publishes every player's secret word into the
-- openly-readable mystery_players.secret_word. That is the exact disclosure the
-- whole SEC-1 effort exists to prevent, reachable in two API calls.
--
-- The obvious fix — put elimination behind a leave_mystery_room() RPC and
-- revoke the column — does NOT actually work. Guest identity is an
-- unauthenticated string, so such an RPC still has to take the target user as a
-- parameter and cannot verify the caller is that user. Eliminating an opponent
-- through the RPC would be exactly as forgeable as the direct UPDATE is today.
-- It would move the hole, not close it, at the cost of a client release.
--
-- So decouple the two instead. Forgeable elimination is a GRIEF (you can end
-- someone's game); it becomes a LEAK only because a status change to 'finished'
-- publishes the words. Reveal is therefore moved out of the status trigger and
-- into submit_mystery_guess — the one path that reaches a finish only after the
-- server itself has judged a guess correct, which no client can fake.
--
-- After this:
--   * a game won by guessing reveals every word on the results screen, as before;
--   * a game that merely ends (everyone left, or a forced finish) reveals
--     nothing — remaining words render as "—", which the results screen already
--     handles;
--   * forcing a finish still griefs a room, but discloses nothing.
--
-- No client change: SQL only, safe against an already-shipped build.
-- Safe to re-run.

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────
-- Retire the blanket reveal-on-finish trigger. ANY transition to 'finished'
-- fired it, which is what turned a forged finish into a full disclosure.
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_reveal_words_on_finish on public.mystery_rooms;
drop function if exists public.reveal_words_on_finish();

-- ─────────────────────────────────────────────────────────────────────────
-- submit_mystery_guess — unchanged except that the end-of-game reveal now
-- happens HERE, inside the verified path, instead of in the trigger.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_mystery_guess(
  p_room             text,
  p_guesser_id       text,
  p_guesser_name     text,
  p_target_player_id uuid,
  p_guessed          text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  guesser       record;
  target        record;
  target_secret text;
  is_correct    boolean;
  q_count       integer;
  active_count  integer;
  active_left   integer;
  did_finish    boolean := false;
begin
  if not exists (select 1 from public.mystery_rooms where room_code = p_room and status = 'playing') then
    return jsonb_build_object('ok', false, 'reason', 'not_playing');
  end if;

  select * into guesser
  from public.mystery_players
  where room_code = p_room and user_id = p_guesser_id and not is_eliminated;
  if guesser.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  select * into target
  from public.mystery_players
  where id = p_target_player_id and room_code = p_room
  for update;
  if target.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_target');
  end if;
  if target.user_id = p_guesser_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  if target.is_eliminated or target.word_revealed then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  select count(*) into q_count from public.mystery_questions where room_code = p_room;
  select count(*) into active_count
  from public.mystery_players
  where room_code = p_room and not is_eliminated and not word_revealed;
  if q_count < coalesce(guesser.last_guess_at_question_count, 0) + greatest(active_count, 1) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown');
  end if;

  select word into target_secret
  from public.mystery_secrets
  where room_code = p_room and user_id = target.user_id;

  is_correct := mystery_norm(p_guessed) <> ''
                and mystery_norm(p_guessed) = mystery_norm(coalesce(target_secret, ''));

  insert into public.mystery_guesses (
    room_code, guesser_id, guesser_name, target_player_id,
    target_player_name, guessed_word, correct
  ) values (
    p_room, p_guesser_id, p_guesser_name, target.user_id,
    target.display_name, p_guessed, is_correct
  );

  update public.mystery_players
  set last_guess_at_question_count = q_count
  where room_code = p_room and user_id = p_guesser_id;

  if is_correct then
    -- This player's word is public now: it was correctly guessed.
    update public.mystery_players
    set word_revealed = true, secret_word = coalesce(target_secret, '')
    where id = p_target_player_id;

    update public.mystery_players
    set score = coalesce(score, 0) + 1
    where room_code = p_room and user_id = p_guesser_id;

    select count(*) into active_left
    from public.mystery_players
    where room_code = p_room and not is_eliminated and not word_revealed;

    if active_left <= 1 then
      update public.mystery_rooms set status = 'finished' where room_code = p_room;

      -- THE ONLY REVEAL PATH (0016). Reached only after the server judged a
      -- guess correct and that guess ended the game, so it cannot be triggered
      -- by forging state. Publishes the remaining words for the results screen.
      update public.mystery_players p
      set secret_word = s.word
      from public.mystery_secrets s
      where s.room_code = p_room and s.user_id = p.user_id and p.room_code = p_room;

      did_finish := true;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'correct', is_correct,
    'finished', did_finish,
    'revealed_word', case when is_correct then target_secret else null end
  );
end $$;

grant execute on function public.submit_mystery_guess(text, text, text, uuid, text) to anon, authenticated;
