// A player who joined from the plain web build (not the native app) never
// gets a player_profiles row — profile reads/writes are gated behind
// hasFullApp() (see platform.js and playerProfile.js's source-gated
// grants). That absence is itself a reliable, zero-schema-change signal:
// everyone else in the room can tell a browser guest apart from an app
// player just by noticing they have no progression profile at all.
//
// Rather than leaving them the plain letter-circle fallback, give them a
// fixed, non-earnable identity — a title and a 🌐 emblem — so that's
// visible instead of just "looks broken". This is purely a display
// convention: it's never stored anywhere, never ownable, and deliberately
// kept OUT of the real cosmetics catalog (ALL_COSMETICS in cosmetics.js)
// so it can never leak into the shop, collections, or level-unlock lists.
export const BROWSER_TITLE = { name: 'Web Wanderer', rarity: 'common' };
export const BROWSER_EMBLEM = {
  name: 'Web Wanderer', emoji: '🌐', rarity: 'common',
  tile: 'radial-gradient(130% 130% at 30% 20%, #bfe7ff 0%, #1f8fe0 52%, #0a2f52 100%)',
};

// True for a real room seat (a mystery_players row) that has no
// progression profile and isn't a practice bot (bots never have a profile
// either — see the `bot_` prefix convention in LobbyPhase's isAway — but
// they aren't browser players, they're the practice AI).
export function isBrowserPlayer(userId, profile) {
  return !profile && !!userId && !userId.startsWith('bot_');
}
