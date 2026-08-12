-- 0019 — Complete guest-data deletion (privacy-policy parity).
--
-- "Delete my data" (ProfileSettings) removes the profile row, player rows,
-- and chat messages — but analytics_events, push_tokens, and the reports the
-- user FILED are insert-only for clients (no DELETE policy), so they survived
-- every deletion path while the privacy policy promises full removal.
--
-- This definer RPC deletes those rows for a guest id. Called from wipeMyData
-- (both the guest-profile and account deletion flows run through it).
--
-- It also deletes the user's chat messages: wipeMyData used to do that with a
-- direct DELETE, which 0015 revoked (chat deletes were scoped to the
-- service-role for moderation) — silently breaking the wipe flow's chat
-- cleanup. This restores it through the definer path.
--
-- Trust note (same model as everything else — guest ids are unauthenticated):
-- anyone can call this for any guest id. What that enables:
--   * analytics_events: deleting someone's funnel rows — mild metrics grief,
--     no data exposure;
--   * push_tokens: notification suppression — already possible via the open
--     UPDATE policy (0009), so this adds no new capability; tokens re-register
--     on the victim's next launch;
--   * player_reports: only rows the id FILED are deletable. Reports ABOUT a
--     user are deliberately kept — they're the moderation record, and letting
--     an abuser self-clean it would defeat the report system.
--
-- Safe to re-run.

set search_path = public;

create or replace function public.wipe_guest_data(p_user text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or btrim(p_user) = '' then
    return;
  end if;
  delete from public.analytics_events where user_id = p_user;
  delete from public.push_tokens      where user_id = p_user;
  delete from public.player_reports   where reporter_id = p_user;
  delete from public.mystery_chats    where user_id = p_user;
end $$;

grant execute on function public.wipe_guest_data(text) to anon, authenticated;
