-- 0007 — Server-authoritative gameplay hardening (pre-launch audit fixes).
--
-- The game tables stay openly readable/writable by design (login-less guest
-- play), but three things must NOT be trusted to the client anymore:
--
--   SEC-1  Every opponent's secret word was shipped to every client (plain
--          column on mystery_players, broadcast over Realtime). In a
--          word-GUESSING game that hands a cheat to anyone who opens the
--          network tab. Secrets now live in a separate table (mystery_secrets)
--          that has NO select policy and is NOT in the Realtime publication,
--          so a raw secret never reaches any client. mystery_players.secret_word
--          is now only ever populated AT REVEAL (public by then), so
--          `select('*')` and Realtime stay safe.
--
--   SEC-2  Correctness/score/reveal were client-authored. Guess resolution now
--          runs in a SECURITY DEFINER RPC that judges the word server-side and
--          writes score/word_revealed itself; clients can no longer UPDATE the
--          score/word_revealed columns directly (column privilege revoked).
--
--   GAME-6 The finish condition + reveal now happen atomically in the RPC /
--          a finish trigger, so simultaneous guesses can't double-award or
--          miss the end.
--
-- Also: STUCK-1 (resolve_stalled_question so an absent answerer can't freeze a
-- room), GAME-3 (server_now for a clock-skew-proof time base), GAME-1
-- (current_questioner_id so turn order survives roster changes), GAME-8
-- (unique (room_code,user_id) + a user_id index).
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- Extensions & helpers
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent with schema extensions;

-- Mirror of the client's normalizeGuess(): lowercase, strip accents, drop
-- everything outside [a-z0-9]. Kept in sync with src/components/mystery/GuessModal.jsx.
create or replace function public.mystery_norm(w text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(w, ''))), '[^a-z0-9]', '', 'g');
$$;

-- Clock-skew-proof time base (GAME-3): clients read this once and keep an
-- offset, so every countdown/enforcement compares against server time, not a
-- possibly-wrong device clock.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

grant execute on function public.server_now() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Secret words — isolated table, never selectable, never in Realtime (SEC-1)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.mystery_secrets (
  room_code    text not null,
  user_id      text not null,
  word         text not null default '',
  updated_date timestamptz not null default now(),
  primary key (room_code, user_id)
);

alter table public.mystery_secrets enable row level security;

-- Players write their OWN secret (insert/update) and it can be deleted on
-- reset/leave — but NO ONE can SELECT it. There is deliberately no select
-- policy, so PostgREST reads are denied and the raw word only ever leaves the
-- database through the SECURITY DEFINER functions below.
drop policy if exists "mystery_secrets insert" on public.mystery_secrets;
create policy "mystery_secrets insert" on public.mystery_secrets
  for insert to anon, authenticated with check (true);
drop policy if exists "mystery_secrets update" on public.mystery_secrets;
create policy "mystery_secrets update" on public.mystery_secrets
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "mystery_secrets delete" on public.mystery_secrets;
create policy "mystery_secrets delete" on public.mystery_secrets
  for delete to anon, authenticated using (true);
-- (No select policy on purpose.)

-- ─────────────────────────────────────────────────────────────────────────
-- Lock down the two cheat-critical columns on mystery_players (SEC-2)
-- score and word_revealed may now only be written by the definer RPCs below.
-- Everything else stays client-writable so ordinary gameplay writes keep
-- working; SELECT is untouched (secret_word is '' until reveal, so it's safe).
-- ─────────────────────────────────────────────────────────────────────────

revoke update on public.mystery_players from anon, authenticated;
grant update (
  room_code, user_id, display_name, secret_word, word_submitted,
  is_eliminated, color, last_guess_at_question_count, created_date, updated_date
) on public.mystery_players to anon, authenticated;

-- Guesses may only be created by submit_mystery_guess() — otherwise a client
-- could insert a row with correct=true directly and inflate the round winner /
-- rewards (which count mystery_guesses.correct). SELECT/DELETE stay open
-- (history display + playAgain cleanup); the definer RPC does the inserts.
revoke insert on public.mystery_guesses from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Turn identity that survives roster changes (GAME-1)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.mystery_rooms add column if not exists current_questioner_id text;

-- ─────────────────────────────────────────────────────────────────────────
-- Reveal-on-finish trigger (SEC-1 + GAME-6): whenever a room transitions to
-- 'finished', copy every player's real secret out of mystery_secrets into the
-- public mystery_players.secret_word so the results screen can show them. This
-- covers ALL finish paths (guess, leave, host action) uniformly.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.reveal_words_on_finish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished' and coalesce(old.status, '') <> 'finished' then
    update public.mystery_players p
    set secret_word = s.word
    from public.mystery_secrets s
    where s.room_code = new.room_code
      and s.user_id = p.user_id
      and p.room_code = new.room_code;
  end if;
  return new;
end $$;

drop trigger if exists trg_reveal_words_on_finish on public.mystery_rooms;
create trigger trg_reveal_words_on_finish
  after update on public.mystery_rooms
  for each row execute function public.reveal_words_on_finish();

-- ─────────────────────────────────────────────────────────────────────────
-- Server-authoritative guess resolution (SEC-1, SEC-2, GAME-6)
-- Judges the word server-side, writes correct/score/word_revealed atomically,
-- and recomputes the finish condition under a row lock. Returns what the
-- client needs to render the result — the real word ONLY when the guess is
-- correct (i.e. now public anyway).
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
  target        record;
  target_secret text;
  is_correct    boolean;
  q_count       integer;
  active_left   integer;
  did_finish    boolean := false;
begin
  -- Lock the target row for the duration so concurrent guesses serialize.
  select * into target
  from public.mystery_players
  where id = p_target_player_id and room_code = p_room
  for update;
  if target.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_target');
  end if;

  select word into target_secret
  from public.mystery_secrets
  where room_code = p_room and user_id = target.user_id;

  is_correct := mystery_norm(p_guessed) <> ''
                and mystery_norm(p_guessed) = mystery_norm(coalesce(target_secret, ''));

  -- Record the guess with the SERVER's verdict (client can't forge `correct`).
  insert into public.mystery_guesses (
    room_code, guesser_id, guesser_name, target_player_id,
    target_player_name, guessed_word, correct
  ) values (
    p_room, p_guesser_id, p_guesser_name, p_target_player_id,
    target.display_name, p_guessed, is_correct
  );

  -- Consume this guesser's cooldown (questions asked so far in the room).
  select count(*) into q_count from public.mystery_questions where room_code = p_room;
  update public.mystery_players
  set last_guess_at_question_count = q_count
  where room_code = p_room and user_id = p_guesser_id;

  if is_correct then
    -- Reveal the target (secret_word is public now) and award the point.
    update public.mystery_players
    set word_revealed = true, secret_word = coalesce(target_secret, '')
    where id = p_target_player_id;

    update public.mystery_players
    set score = coalesce(score, 0) + 1
    where room_code = p_room and user_id = p_guesser_id;

    -- Finish when ≤1 player is still active (not eliminated, not revealed).
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
-- Answer-freeze breaker (STUCK-1): force a stalled question complete so an
-- absent answerer can't lock the room forever. Missing answers simply don't
-- become clues (the notebook already ignores undefined answers).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.resolve_stalled_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mystery_questions
  set status = 'complete'
  where id = p_question_id and status = 'answering';
end $$;

grant execute on function public.resolve_stalled_question(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Integrity: one player row per (room, user) + a user_id index (GAME-8/NET-5).
-- De-dupe any existing rows first so the unique index can be created.
-- ─────────────────────────────────────────────────────────────────────────

delete from public.mystery_players a
using public.mystery_players b
where a.room_code = b.room_code
  and a.user_id = b.user_id
  and a.created_date > b.created_date;

create unique index if not exists mystery_players_room_user_uniq
  on public.mystery_players (room_code, user_id);

create index if not exists idx_mystery_players_user on public.mystery_players (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime / cleanup housekeeping: keep secrets OUT of Realtime, and make the
-- stale-lobby cleanup also drop orphaned secrets.
-- ─────────────────────────────────────────────────────────────────────────

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

  delete from public.mystery_players   where room_code = any(stale_codes);
  delete from public.mystery_chats     where room_code = any(stale_codes);
  delete from public.mystery_questions where room_code = any(stale_codes);
  delete from public.mystery_guesses   where room_code = any(stale_codes);
  delete from public.mystery_secrets   where room_code = any(stale_codes);
  delete from public.mystery_rooms     where room_code = any(stale_codes);
end $$;
