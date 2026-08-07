// Player reporting — the App Store's required UGC safety valve. Fire and
// forget: a failed insert never blocks the UI, the player always gets the
// "thanks" state.
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';

export async function reportPlayer({ userId, name, roomCode }) {
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
