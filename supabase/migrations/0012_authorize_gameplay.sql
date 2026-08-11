-- 0012 — Authorize the server-side gameplay layer (pre-launch hardening #2).
--
-- Migration 0007 moved score/correctness/reveal/word-lock into SECURITY
-- DEFINER RPCs — which stops a client *forging* a result — but it shipped
-- those RPCs with no caller/rate checks and left mystery_rooms fully
-- client-writable. That secured the computation but not the authorization, so
-- a client could still: force status='finished' (the reveal trigger then
-- leaks every secret), self-guess or brute-force a win, plant a secret on an
-- opponent, reset/grief any room, or forge `correct` via UPDATE.
--
-- This migration closes those:
--   * mystery_rooms.status is revoked from clients; every legal transition now
--     goes through mystery_set_status(), which VALIDATES the transition — most
--     importantly it only finishes a room when the finish condition is really
--     met, so force-finish (and the secret leak it caused) is impossible even
--     via the RPC.  (SEC-2a / NEW-GAME-5)
--   * submit_mystery_guess: rejects a non-member / eliminated guesser, a room
--     not in play, a self-target, an already-revealed target, and enforces the
--     guess cooldown server-side — so self-guess and dictionary brute-force
--     stop being deterministic wins. It also records the target's user_id (not
--     the row uuid) so the client's guess/notebook readers work again.
--     (SEC-N1 / NEW-GAME-6 / NEW-GAME-4)
--   * submit_mystery_word: only during word_entry, and rejects an
--     empty/unguessable word — no mid-game secret planting, no unfinishable
--     rounds. (SEC-N3 / STUCK-3)
--   * play_again_mystery: only from 'finished' — no resetting a live game.
--     (SEC-N2)
--   * resolve_stalled_question: only a genuinely stale question, and it
--     refreshes the turn deadline. submit_mystery_answer refreshes the turn
--     deadline when the question completes — so the answer-timeout recovery
--     can't fire a stampede of auto-questions against a stale deadline and
--     hijack a present player's turn. (NEW-GAME-4)
--   * mystery_guesses UPDATE/DELETE revoked (INSERT was already) — `correct`
--     can't be flipped and opponents' guesses can't be deleted. (SEC-2b)
--   * mystery_secrets is now written ONLY by the definer RPCs. (SEC-N3)
--   * push_tokens DELETE locked so a griefer can't suppress a victim's
--     notifications. (SEC-N6)
--
-- Residual (inherent to the login-less guest model, documented not fixed): a
-- client can still write its OWN economy row, seize host_id / flip is_public
-- on a room it's in, and spoof another *member's* guest id within a room it
-- has joined. None of these are deterministic-win or secret-leak class.
--
-- Safe to re-run.

set search_path = public;

-- How long (seconds) each phase's shared deadline lasts — kept in sync with the
-- client constants (QUESTION_TIMER_SECONDS=30, WORD_ENTRY_TIMER_SECONDS=60).
-- Deadlines are minted server-side here so a skewed device clock can't shorten
-- them for everyone (GAME-N6).

-- ─────────────────────────────────────────────────────────────────────────
-- submit_mystery_answer — merge + status, AND refresh the turn deadline when
-- the question completes so the next asker gets a full timer (GAME-N4).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_mystery_answer(
  q_id uuid,
  answerer_id text,
  answer boolean
)
returns void
language plpgsql
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

  -- The question just finished: give the next asker a fresh 30s from NOW,
  -- rather than a deadline minted when this question was created and now long
  -- past (which would make every enforcer fire at once — GAME-N4).
  if pending = 0 then
    update public.mystery_rooms
    set question_deadline = now() + interval '30 seconds'
    where room_code = q.room_code and status = 'playing';
  end if;
end $$;

grant execute on function public.submit_mystery_answer(uuid, text, boolean) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- resolve_stalled_question — force a stalled question complete, but only once
-- it is genuinely stale, and refresh the turn deadline on the way out.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_stalled_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
begin
  select * into q from public.mystery_questions where id = p_question_id for update;
  if q.id is null or q.status <> 'answering' then
    return;
  end if;
  -- Only a genuinely stale question (older than the client's answer window)
  -- may be force-completed — otherwise anyone could skip a fresh turn.
  if q.created_date > now() - interval '40 seconds' then
    return;
  end if;

  update public.mystery_questions set status = 'complete' where id = p_question_id;

  update public.mystery_rooms
  set question_deadline = now() + interval '30 seconds'
  where room_code = q.room_code and status = 'playing';
end $$;

grant execute on function public.resolve_stalled_question(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- submit_mystery_guess — now authorized + rate-limited + records user_id.
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
  -- The room must be in play.
  if not exists (select 1 from public.mystery_rooms where room_code = p_room and status = 'playing') then
    return jsonb_build_object('ok', false, 'reason', 'not_playing');
  end if;

  -- The guesser must be a real, still-in-play member of THIS room. (Can't
  -- fully bind identity in the guest model, but this stops non-members and
  -- eliminated players driving guesses / finishes in rooms they aren't in.)
  select * into guesser
  from public.mystery_players
  where room_code = p_room and user_id = p_guesser_id and not is_eliminated;
  if guesser.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  -- Lock the target row so concurrent guesses serialize.
  select * into target
  from public.mystery_players
  where id = p_target_player_id and room_code = p_room
  for update;
  if target.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_target');
  end if;
  if target.user_id = p_guesser_id then
    return jsonb_build_object('ok', false, 'reason', 'self');       -- no self-guess win
  end if;
  if target.is_eliminated or target.word_revealed then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  -- Server-side guess cooldown (mirrors the client's canGuess): a player may
  -- guess once per "active player count" questions, so the RPC can't be looped
  -- as an unlimited yes/no oracle over the bundled word list (SEC-N1).
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

  -- Record the guess with the SERVER's verdict, keyed by the target's user_id
  -- (not the row uuid) so the client's guess/notebook readers match (GAME-N4).
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
      did_finish := true; -- reveal-on-finish trigger exposes the rest
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

-- ─────────────────────────────────────────────────────────────────────────
-- submit_mystery_word — word_entry only, no empty/unguessable words.
-- ─────────────────────────────────────────────────────────────────────────
-- Return type changes void -> jsonb (it now reports why a lock-in was
-- refused). CREATE OR REPLACE cannot change a function's return type
-- ("cannot change return type of existing function"), so the old signature
-- must be dropped first. Dropping also drops its grants — re-granted below.
drop function if exists public.submit_mystery_word(text, text, text);

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
begin
  if not exists (select 1 from public.mystery_rooms where room_code = p_room and status = 'word_entry') then
    return jsonb_build_object('ok', false, 'reason', 'not_word_entry');
  end if;
  -- A word that normalizes to empty could never be guessed → unfinishable
  -- round (STUCK-3). Reject it server-side too, not just in the client.
  if mystery_norm(coalesce(p_word, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
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
-- play_again_mystery — only from a finished room (no mid-game reset grief).
-- ─────────────────────────────────────────────────────────────────────────
-- Same as above: void -> jsonb, so the old signature must be dropped first.
drop function if exists public.play_again_mystery(text);

create or replace function public.play_again_mystery(p_room text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.mystery_rooms where room_code = p_room and status = 'finished') then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;

  update public.mystery_players
  set secret_word = '',
      word_submitted = false,
      word_revealed = false,
      is_eliminated = false,
      last_guess_at_question_count = 0
  where room_code = p_room;

  delete from public.mystery_questions where room_code = p_room;
  delete from public.mystery_guesses   where room_code = p_room;
  delete from public.mystery_secrets   where room_code = p_room;

  update public.mystery_rooms
  set status = 'lobby',
      round_number = 1,
      current_questioner_index = 0,
      current_questioner_id = null,
      category = '',
      question_deadline = null
  where room_code = p_room;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.play_again_mystery(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- mystery_set_status — the ONLY way status changes now. Validates the
-- transition, so force-finish (→ secret leak) is impossible.
--   lobby      → word_entry   (>= 2 players; mints a 60s deadline)
--   word_entry → playing      (>= 2 players AND all submitted; mints 30s +
--                              first questioner)
--   word_entry → lobby        (reset: clears secrets + word_submitted)
--   playing    → finished      (ONLY when <= 1 active player remains)
-- p_from is an optimistic guard: the change applies only if the room is still
-- in that state.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.mystery_set_status(
  p_room          text,
  p_from          text,
  p_to            text,
  p_questioner_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r            record;
  player_count integer;
  unsubmitted  integer;
  active_left  integer;
begin
  select * into r from public.mystery_rooms where room_code = p_room for update;
  if r.room_code is null then
    return jsonb_build_object('ok', false, 'reason', 'no_room');
  end if;
  if r.status <> p_from then
    return jsonb_build_object('ok', false, 'reason', 'stale', 'status', r.status);
  end if;

  select count(*) into player_count from public.mystery_players where room_code = p_room;

  if p_from = 'lobby' and p_to = 'word_entry' then
    if player_count < 2 then
      return jsonb_build_object('ok', false, 'reason', 'need_players');
    end if;
    update public.mystery_rooms
    set status = 'word_entry',
        question_deadline = now() + interval '60 seconds'
    where room_code = p_room;

  elsif p_from = 'word_entry' and p_to = 'playing' then
    select count(*) into unsubmitted
    from public.mystery_players where room_code = p_room and not word_submitted;
    if player_count < 2 or unsubmitted > 0 then
      return jsonb_build_object('ok', false, 'reason', 'not_all_submitted');
    end if;
    update public.mystery_rooms
    set status = 'playing',
        current_questioner_id = p_questioner_id,
        current_questioner_index = 0,
        round_number = 1,
        question_deadline = now() + interval '30 seconds'
    where room_code = p_room;

  elsif p_to = 'lobby' and p_from in ('word_entry', 'finished') then
    delete from public.mystery_secrets where room_code = p_room;
    update public.mystery_players
    set word_submitted = false, secret_word = ''
    where room_code = p_room;
    update public.mystery_rooms
    set status = 'lobby', question_deadline = null
    where room_code = p_room;

  elsif p_from = 'playing' and p_to = 'finished' then
    -- Only a room that has actually reached its end may finish. This is what
    -- makes force-finish (and the secret leak via the reveal trigger)
    -- impossible: a griefer can't finish a room with players still in play.
    select count(*) into active_left
    from public.mystery_players
    where room_code = p_room and not is_eliminated and not word_revealed;
    if active_left > 1 then
      return jsonb_build_object('ok', false, 'reason', 'not_over');
    end if;
    update public.mystery_rooms set status = 'finished' where room_code = p_room;

  else
    return jsonb_build_object('ok', false, 'reason', 'bad_transition');
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.mystery_set_status(text, text, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Lock the status column: clients may write everything else on a room, but
-- status only ever changes through the validated RPC above.
-- ─────────────────────────────────────────────────────────────────────────
revoke update on public.mystery_rooms from anon, authenticated;
grant update (
  category, is_public, host_id, host_name,
  current_questioner_index, current_questioner_id,
  question_deadline, round_number, max_rounds, updated_date
) on public.mystery_rooms to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- mystery_guesses: INSERT was revoked in 0007; revoke UPDATE/DELETE too so a
-- client can't flip `correct` after the fact or delete opponents' guesses
-- (SEC-2b). SELECT stays open (history display); play_again deletes as definer.
-- ─────────────────────────────────────────────────────────────────────────
revoke update, delete on public.mystery_guesses from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- mystery_secrets: RPC-only. Drop the open write policies so no client can
-- plant/overwrite a secret directly — submit_mystery_word / the reset &
-- play_again RPCs (all SECURITY DEFINER) are the only writers now (SEC-N3).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "mystery_secrets insert" on public.mystery_secrets;
drop policy if exists "mystery_secrets update" on public.mystery_secrets;
drop policy if exists "mystery_secrets delete" on public.mystery_secrets;
-- (RLS stays enabled with no policies → all direct client DML denied. Definer
--  functions bypass RLS, so gameplay writes keep working.)

-- ─────────────────────────────────────────────────────────────────────────
-- push_tokens: stop a griefer deleting a victim's token to suppress their
-- notifications. Registration still upserts (insert/update stay open); the
-- service-role Edge Function can still prune server-side (SEC-N6).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "push_tokens delete" on public.push_tokens;
create policy "push_tokens delete" on public.push_tokens
  for delete to anon, authenticated using (false);
