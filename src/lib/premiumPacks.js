// Local cache of unlocked packs. Real purchases go through Apple IAP via
// RevenueCat (src/lib/payments.js); this localStorage cache is just the fast,
// synchronous gate the Category Selector reads. On native it is RECONCILED to
// RevenueCat's entitlements at startup (reconcilePacks below), so it is a
// mirror of the authoritative server state, not a trust boundary — a
// hand-edited unlock is wiped on the next launch (SEC-4).
const UNLOCKED_KEY = 'mystery_unlocked_packs';

export function getUnlockedPacks() {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isPackUnlocked(packId) {
  return getUnlockedPacks().includes(packId);
}

export function unlockPack(packId) {
  const current = getUnlockedPacks();
  if (!current.includes(packId)) {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...current, packId]));
  }
}

// Set the local cache to EXACTLY the authoritative set (RevenueCat entitlements
// on native). Unlike unlockPack this also REMOVES packs that aren't entitled,
// so a hand-edited localStorage unlock can't grant paid content for free (SEC-4).
export function reconcilePacks(entitledPackIds) {
  try {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...new Set(entitledPackIds || [])]));
  } catch { /* ignore */ }
}
