// Server-time base (GAME-3). The turn/word-entry timers and the peer
// enforcement checks used to compare against each device's own clock, so a
// player whose clock was fast would auto-ask on everyone's behalf every turn,
// or delete not-yet-submitted players seconds early. We sync once against the
// database's now() and keep the offset, so serverNow() is stable across
// devices regardless of local clock skew. If the sync fails (offline), we fall
// back to the local clock — exactly the old behavior, no worse.
import { supabase } from './supabaseClient';

let offsetMs = 0; // serverNow - clientNow

export async function syncServerTime() {
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('server_now');
    const t1 = Date.now();
    if (error || !data) return;
    const serverMs = new Date(data).getTime();
    if (!Number.isFinite(serverMs)) return;
    // Assume a symmetric round-trip: the server timestamp corresponds roughly
    // to the midpoint of our request window.
    offsetMs = serverMs - (t0 + (t1 - t0) / 2);
  } catch {
    /* keep the last known offset (0 on first failure) */
  }
}

export function serverNow() {
  return Date.now() + offsetMs;
}
