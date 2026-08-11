-- 0011 — play_again_mystery RPC.
--
-- "Play Again" resets every player (including word_revealed) and the room back
-- to the lobby. Since migration 0007 revoked client UPDATEs on the cheat-
-- sensitive columns word_revealed / score, the old client-side multi-row reset
-- now fails with "permission denied for table mystery_players". This
-- SECURITY DEFINER function performs the whole reset server-side (bypassing the
-- column revoke), consistent with submit_mystery_guess / submit_mystery_word.
-- Scores are intentionally KEPT (cumulative across Play Again rounds), matching
-- the previous behavior. The client prefers this RPC and falls back to the old
-- per-row reset only if it isn't deployed.
--
-- Safe to re-run.

create or replace function public.play_again_mystery(p_room text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reset player round-state (keep score — it accumulates across rounds).
  update public.mystery_players
  set secret_word = '',
      word_submitted = false,
      word_revealed = false,
      is_eliminated = false,
      last_guess_at_question_count = 0
  where room_code = p_room;

  -- Clear the previous round entirely.
  delete from public.mystery_questions where room_code = p_room;
  delete from public.mystery_guesses   where room_code = p_room;
  delete from public.mystery_secrets   where room_code = p_room;

  -- Back to the lobby so the host can pick a category again.
  update public.mystery_rooms
  set status = 'lobby',
      round_number = 1,
      current_questioner_index = 0,
      current_questioner_id = null,
      category = '',
      question_deadline = null
  where room_code = p_room;
end $$;

grant execute on function public.play_again_mystery(text) to anon, authenticated;
