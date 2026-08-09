// Player reporting — the App Store's required UGC safety valve. Fire and
// forget: a failed insert never blocks the UI, the player always gets the
// "thanks" state. A unique index (migration 0005) stops duplicate rows at
// the DB level; this local record is just so the UI itself remembers
// "already reported" if the same player's card is reopened, instead of
// silently offering the button again every time.
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';

const STORAGE_KEY = 'wmp_reported';
const reportKey = (roomCode, userId) => `${roomCode || ''}:${userId || ''}`;

function readReported() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []); }
  catch { return new Set(); }
}

export function hasReported(roomCode, userId) {
  return readReported().has(reportKey(roomCode, userId));
}

function rememberReported(roomCode, userId) {
  try {
    const set = readReported();
    set.add(reportKey(roomCode, userId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export async function reportPlayer({ userId, name, roomCode }) {
  rememberReported(roomCode, userId);
  try {
    await supabase.from('player_reports').insert({
      reporter_id: getGuestIdentity().id,
      reported_user_id: userId || '',
      reported_name: name || '',
      room_code: roomCode || '',
    });
  } catch { /* best-effort */ }
  return true;
}
