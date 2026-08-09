-- Prevent the same reporter from filing duplicate reports against the same
-- player in the same room. reportPlayer() (src/lib/reports.js) already
-- swallows any insert error as best-effort, so a unique-violation here just
-- silently dedupes — no client change needed to benefit from this.
create unique index if not exists player_reports_unique_per_room
  on public.player_reports (reporter_id, reported_user_id, room_code);
