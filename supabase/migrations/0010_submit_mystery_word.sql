-- 0010 — submit_mystery_word RPC.
--
-- Locking in a secret word wrote directly to mystery_secrets, so it could be
-- blocked by an RLS/policy misconfiguration on that table (it was, in testing:
-- "new row violates row-level security policy"). This SECURITY DEFINER function
-- writes the secret AND marks the player ready in one call that bypasses RLS —
-- mirroring the server-authoritative pattern of submit_mystery_guess — so a
-- policy gap can never block gameplay. The client prefers this RPC and falls
-- back to the direct writes only if it isn't deployed.
--
-- Safe to re-run.

create or replace function public.submit_mystery_word(
  p_room text,
  p_user text,
  p_word text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mystery_secrets (room_code, user_id, word, updated_date)
  values (p_room, p_user, coalesce(p_word, ''), now())
  on conflict (room_code, user_id)
  do update set word = excluded.word, updated_date = now();

  update public.mystery_players
  set word_submitted = true
  where room_code = p_room and user_id = p_user;
end $$;

grant execute on function public.submit_mystery_word(text, text, text) to anon, authenticated;
