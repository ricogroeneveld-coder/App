-- 0006 — two fixes from the pre-launch audit:
--
-- 1. submit_mystery_answer(): answering a question was a client-side
--    read-modify-write of the shared `answers` jsonb — two players answering
--    at the same moment overwrote each other, losing one answer (the loser's
--    "answer this question" prompt confusingly reappeared). This RPC merges
--    the answer and recomputes the question's status in one atomic,
--    row-locked statement. The client falls back to the old merge if this
--    function hasn't been deployed yet.
--
-- 2. player_profiles owner DELETE policy: migration 0004 locked updates to
--    the owning anonymous session but defined no delete policy at all, so
--    "Delete my profile" could never remove the row — contradicting the
--    privacy policy's "removes your data permanently". Same owner rule as
--    the update policy (rows never claimed by a session may also be deleted
--    by whoever holds the matching guest id, mirroring 0004's claim rule).

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

  -- Complete when every currently-active non-asker has an answer in the
  -- merged map — computed against the LIVE player list, so a player who
  -- left mid-question can never leave the question stuck in 'answering'.
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
end $$;

grant execute on function public.submit_mystery_answer(uuid, text, boolean) to anon, authenticated;

drop policy if exists "player_profiles owner delete" on public.player_profiles;
create policy "player_profiles owner delete" on public.player_profiles
  for delete to authenticated
  using (owner is null or owner = auth.uid());
