-- 0017 — Post a question + advance the turn atomically (closes the
-- double-auto-question race, GAME-4 family).
--
-- Posting a question was the last multi-step gameplay write still orchestrated
-- client-side: insert the question row, then update the room (round_number,
-- current_questioner_id, question_deadline) as two separate writes, guarded
-- only by a fresh-state re-check. Two clients that pass that re-check inside
-- the same ~200-400ms window — an enforcer racing the waking asker, or two
-- enforcers whose stagger collapsed after an answer-timeout — both insert a
-- question and both advance the turn: duplicate questions, a double-skipped
-- asker, and a deadline minted twice.
--
-- This RPC does the whole transition under a row lock on the room:
--   * the asker must be a non-eliminated member AND the current questioner
--     (legacy rooms with a null current_questioner_id skip the turn check);
--   * the caller passes the question count it based its decision on
--     (p_known_count) — if the count moved, someone else already posted and
--     the caller stands down with 'stale' instead of double-posting;
--   * the latest question must not still be collecting answers ("pending"
--     derived from the live roster, exactly like the client derives it);
--   * insert + round_number + next questioner + fresh 30s deadline commit
--     atomically.
--
-- Direct INSERT on mystery_questions stays granted: the already-shipped build
-- still posts questions directly (and hint rows are direct inserts by design),
-- so revoking it would break live clients. New clients call this RPC; the race
-- window is closed for them and shrinks to nothing as old builds age out.
--
-- Safe to re-run.

set search_path = public;

create or replace function public.post_mystery_question(
  p_room text,
  p_asker text,
  p_text text,
  p_is_ai boolean default false,
  p_known_count integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mystery_rooms%rowtype;
  asker_row public.mystery_players%rowtype;
  latest public.mystery_questions%rowtype;
  q_count integer;
  pending_left integer;
  asker_count integer;
  next_id text;
  clean_text text;
begin
  select * into r from public.mystery_rooms where room_code = p_room for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_room');
  end if;
  if r.status <> 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'not_playing');
  end if;

  select * into asker_row from public.mystery_players
  where room_code = p_room and user_id = p_asker and is_eliminated = false
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  -- The question must be for the CURRENT questioner. Enforcers post on the
  -- absent asker's behalf by passing that player's id, so this is a turn
  -- check, not an identity check (identity is unverifiable — see 0015).
  if r.current_questioner_id is not null and r.current_questioner_id <> p_asker then
    return jsonb_build_object('ok', false, 'reason', 'not_your_turn');
  end if;

  select count(*) into q_count from public.mystery_questions where room_code = p_room;
  if p_known_count is not null and q_count <> p_known_count then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  -- Latest NORMAL question still collecting answers from live active players?
  select q.* into latest
  from public.mystery_questions q
  where q.room_code = p_room and q.question_text not like '[HINT]%'
  order by q.created_date desc, q.id desc
  limit 1;
  if found and latest.status = 'answering' then
    select count(*) into pending_left
    from public.mystery_players p
    where p.room_code = p_room
      and p.is_eliminated = false
      and p.word_revealed = false
      and p.user_id <> latest.asker_id
      and not (coalesce(latest.answers, '{}'::jsonb) ? p.user_id);
    if pending_left > 0 then
      return jsonb_build_object('ok', false, 'reason', 'question_pending');
    end if;
  end if;

  clean_text := left(btrim(coalesce(p_text, '')), 200);
  if clean_text = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  insert into public.mystery_questions
    (room_code, round_number, question_text, asker_id, asker_name, is_ai, answers, status)
  values
    (p_room, r.round_number, clean_text, p_asker, asker_row.display_name,
     coalesce(p_is_ai, false), '{}'::jsonb, 'answering');

  -- Next asker by join order among non-eliminated players (same ordering the
  -- client uses: created_date, with id as a deterministic tiebreak).
  select p.user_id into next_id
  from public.mystery_players p
  where p.room_code = p_room and p.is_eliminated = false
    and (p.created_date, p.id) > (asker_row.created_date, asker_row.id)
  order by p.created_date, p.id
  limit 1;
  if next_id is null then
    select p.user_id into next_id
    from public.mystery_players p
    where p.room_code = p_room and p.is_eliminated = false
    order by p.created_date, p.id
    limit 1;
  end if;

  select count(*) into asker_count
  from public.mystery_players
  where room_code = p_room and is_eliminated = false;

  update public.mystery_rooms set
    round_number = r.round_number + 1,
    current_questioner_id = next_id,
    current_questioner_index = mod(r.current_questioner_index + 1, greatest(asker_count, 1)),
    question_deadline = now() + interval '30 seconds',
    updated_date = now()
  where id = r.id;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.post_mystery_question(text, text, text, boolean, integer)
  to anon, authenticated;
