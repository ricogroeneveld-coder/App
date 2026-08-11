import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchProfilesFor, getProfile, subscribeProfile } from '@/lib/playerProfile';
import { getGuestIdentity } from '@/lib/guestIdentity';

// NET-3: how long to let the id-set settle before rebuilding the realtime
// channel. In chat, senders trickle in one message at a time, so keying the
// subscription directly on `ids` tore the channel down and re-created it on
// every new distinct sender. Debouncing coalesces a burst into one rebuild.
const IDSET_DEBOUNCE_MS = 500;

/**
 * Map of user_id → progression profile for everyone in `players` (any array of
 * objects with a user_id). Our own profile always comes from the local store
 * so equips show instantly; peers are fetched from Supabase and then kept
 * live — realtime changes apply the moment someone equips a new cosmetic,
 * with a wake-refresh and a slow poll as fallback for missed events.
 */
export default function usePeerProfiles(players) {
  const [profiles, setProfiles] = useState({});
  const ids = [...new Set((players || []).map(p => p.user_id).filter(Boolean))].sort().join(',');

  // NET-3: `stableIds` lags `ids` by a short debounce, and the heavy effect
  // (fetch + realtime channel) keys off `stableIds`, so a rapid trickle of
  // new senders no longer churns the channel on every arrival. The first
  // value is applied immediately (state initialized from `ids`).
  const [stableIds, setStableIds] = useState(ids);
  useEffect(() => {
    if (ids === stableIds) return;
    const timer = setTimeout(() => setStableIds(ids), IDSET_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ids, stableIds]);

  useEffect(() => {
    let live = true;
    const myId = getGuestIdentity().id;
    const idSet = new Set(stableIds ? stableIds.split(',') : []);
    setProfiles(prev => ({ ...prev, [myId]: getProfile() }));

    const refetch = () => {
      if (!idSet.size) return;
      fetchProfilesFor([...idSet]).then(map => {
        if (live) setProfiles(prev => ({ ...prev, ...map, [myId]: getProfile() }));
      });
    };
    refetch();

    const unsubscribe = subscribeProfile(p => {
      if (live && p) setProfiles(prev => ({ ...prev, [p.user_id]: p }));
    });

    // Peers' equip changes arrive live (needs player_profiles in the
    // supabase_realtime publication — migration 0002).
    const channel = supabase
      .channel(`peer-profiles-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_profiles',
        // Only this room's peers — without the filter every client received
        // every profile edit made anywhere in the app.
        ...(idSet.size ? { filter: `user_id=in.(${[...idSet].join(',')})` } : {}),
      }, (payload) => {
        const row = /** @type {any} */ (payload.new);
        if (live && row?.user_id && row.user_id !== myId && idSet.has(row.user_id)) {
          setProfiles(prev => ({ ...prev, [row.user_id]: row }));
        }
      })
      .subscribe();

    // Fallbacks: refresh when the tab wakes, and poll slowly in case
    // realtime events were missed (suspended socket, missing publication).
    const wake = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    const interval = setInterval(refetch, 30000);

    return () => {
      live = false;
      unsubscribe();
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
      clearInterval(interval);
    };
  }, [stableIds]);

  return profiles;
}
