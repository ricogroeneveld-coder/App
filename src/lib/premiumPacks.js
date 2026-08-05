// Local-only pack ownership tracking. There is no real payment backend yet —
// "purchasing" a pack here just unlocks it in this browser. Swap this out
// for real IAP/Stripe once monetization is wired up; the Category Selector
// only depends on isPackUnlocked/unlockPack, so that's the one file to change.
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
