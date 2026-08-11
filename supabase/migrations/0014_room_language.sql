-- 0014 — Per-ROOM language for generated question text.
--
-- Auto-questions (the ones fired when a turn times out) were picked from the
-- bank matching the GENERATING CLIENT's language and stored as plain text. In a
-- mixed room — a Dutch player and an English player together — that produced
-- questions half the room could not read, permanently, because the text is
-- stored not translated at render time.
--
-- Secret words avoid this by storing a canonical English value and translating
-- on display, but that isn't possible for questions: the EN and NL banks were
-- authored independently (only 3 of 18 shared categories even have matching
-- lengths, and the entries at a given index are not translations of each
-- other), so there is no index or key to map between them.
--
-- So the room picks ONE language, set from the host's at creation, and every
-- client generates auto-questions from that bank. Everyone in a room then reads
-- the same text. Player-written questions and hints are of course still
-- whatever language that player types in — nothing can fix that.
--
-- Additive and safe to re-run; clients treat a missing value as 'en'.

alter table public.mystery_rooms
  add column if not exists language text not null default 'en';

-- Writable by clients like the other room settings (status remains the only
-- column restricted to the validated transition RPC — see migration 0012).
grant update (language) on public.mystery_rooms to anon, authenticated;
