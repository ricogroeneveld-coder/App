import { useEffect, useState } from 'react';
import { fetchProfilesFor, getProfile, subscribeProfile } from '@/lib/playerProfile';
import { getGuestIdentity } from '@/lib/guestIdentity';

/**
 * Map of user_id → progression profile for everyone in `players` (any array of
 * objects with a user_id). Our own profile always comes from the local store
 * so equips show instantly; peers are fetched best-effort from Supabase.
 */
export default function usePeerProfiles(players) {
  const [profiles, setProfiles] = useState({});
  const ids = [...new Set((players || []).map(p => p.user_id).filter(Boolean))].sort().join(',');

  useEffect(() => {
    let live = true;
    const myId = getGuestIdentity().id;
    setProfiles(prev => ({ ...prev, [myId]: getProfile() }));
    if (ids) {
      fetchProfilesFor(ids.split(',')).then(map => {
        if (live) setProfiles(prev => ({ ...prev, ...map, [myId]: getProfile() }));
      });
    }
    const unsubscribe = subscribeProfile(p => {
      if (live && p) setProfiles(prev => ({ ...prev, [p.user_id]: p }));
    });
    return () => { live = false; unsubscribe(); };
  }, [ids]);

  return profiles;
}
