// Economy configuration — every reward value in one place. An average
// ~10-minute match pays ~35 Picks (a winner ~75); casual daily income
// (a few matches + dailies + login) is ~250 Picks. With the shop prices in
// cosmetics.js (Common 100 / Rare 300 / Epic 1000 / Legendary 3000 /
// Mythic 6500) that puts real pacing at roughly: Common ≈ 2–3 matches,
// Rare ≈ a day, Epic ≈ ~4 days, Legendary ≈ ~1.5 weeks, Mythic ≈ ~3–4 weeks
// — a genuine long-tail chase that pairs with the daily shop rotation. The
// top-tier prices are the tuning knob: raise them to stretch the chase.
// First hour of play reaches the first Common unlock plus 2–3 level-ups.

export const ECONOMY = {
  // Match rewards { picks, xp }
  complete:      { picks: 20, xp: 40 },   // finishing a match without leaving
  correctGuess:  { picks: 10, xp: 15 },   // per correct guess in the match
  winner:        { picks: 30, xp: 50 },   // highest score
  perfect:       { picks: 25, xp: 30 },   // won + guessed every opponent
  host:          { picks: 10, xp: 10 },   // hosted a completed game
  streakBonus:   [0, 0, 10, 20, 30],      // index = current win streak (capped)

  // Engagement
  loginBase: 15,        // day 1
  loginPerDay: 5,       // + per consecutive day
  loginMax: 45,         // cap (day 7+)
  levelUpPicks: 20,     // every level

  // XP curve: XP needed to go from level n to n+1
  xpPerLevel: (level) => 100 + (level - 1) * 25,
  maxLevel: 50,
};

export function xpToNext(level) {
  return ECONOMY.xpPerLevel(Math.min(level, ECONOMY.maxLevel));
}

// Convert total XP into { level, into, need, maxed }
export function levelFromXp(totalXp) {
  let level = 1;
  let rest = totalXp;
  while (level < ECONOMY.maxLevel && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  const need = xpToNext(level);
  const maxed = level >= ECONOMY.maxLevel;
  // At the cap, leftover XP kept accumulating in `rest`, so the progress bar
  // (into/need) overflowed past 100% and read e.g. "5000/1325" forever
  // (ECON-8). Clamp to a full bar at max level and expose a `maxed` flag so
  // the UI can show MAX instead of a broken ratio.
  return { level, into: maxed ? need : rest, need, maxed };
}

// ── Challenges ─────────────────────────────────────────────────────────────
// Progress counters are keyed by stat; targets/rewards configurable here.

const DAILY_POOL = [
  { id: 'd_win1',   stat: 'wins',    target: 1, picks: 30, name: 'Win a game' },
  { id: 'd_guess2', stat: 'guesses', target: 2, picks: 25, name: 'Guess 2 words correctly' },
  { id: 'd_play3',  stat: 'plays',   target: 3, picks: 25, name: 'Complete 3 games' },
  { id: 'd_host1',  stat: 'hosts',   target: 1, picks: 20, name: 'Host a game' },
  { id: 'd_big1',   stat: 'bigGames', target: 1, picks: 25, name: 'Play with 4+ players' },
];

export const WEEKLY = [
  { id: 'w_play10', stat: 'plays', target: 10, picks: 100, name: 'Complete 10 games' },
  { id: 'w_win5',   stat: 'wins',  target: 5,  picks: 120, name: 'Win 5 games' },
];

// Season 1 pays PICKS ONLY. The Founder collection (em_galaxy / t_founder /
// bd_champion) is stashed for a later release (col_founder is hidden), so
// those unlocks are intentionally NOT attached here — the season must never
// imply a cosmetic reward it can't actually grant (ECON-3). Re-attach the
// `unlock` fields when the Founder set is un-stashed.
export const SEASON = [
  { id: 's_play40',  stat: 'plays',   target: 40, picks: 300, name: 'Complete 40 games' },
  { id: 's_guess25', stat: 'guesses', target: 25, picks: 250, name: '25 correct guesses' },
  { id: 's_win15',   stat: 'wins',    target: 15, picks: 400, name: 'Win 15 games' },
];

export const SEASON_ID = 'S1';
export const SEASON_NAME = 'Season 1';

// LOCAL calendar day, not UTC: daily rewards, challenge resets, and the
// shop rotation should flip at the player's own midnight — toISOString
// meant a Dutch player's "new day" arrived at 1–2 AM and a US player's in
// the middle of the afternoon.
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Milliseconds until the next local midnight — drives the "new stock in…"
// countdown next to anything that rotates on todayKey().
export function msUntilNextDay(d = new Date()) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getTime() - d.getTime();
}

export function weekKey(d = new Date()) {
  // ISO week
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Three dailies rotate deterministically with the date
export function dailyChallenges(d = new Date()) {
  const seed = Number(todayKey(d).replaceAll('-', ''));
  const picks = [];
  for (let i = 0; picks.length < 3 && i < DAILY_POOL.length; i++) {
    const idx = (seed + i * 7) % DAILY_POOL.length;
    if (!picks.includes(DAILY_POOL[idx])) picks.push(DAILY_POOL[idx]);
  }
  return picks;
}

export function loginReward(streakDay) {
  return Math.min(ECONOMY.loginBase + (streakDay - 1) * ECONOMY.loginPerDay, ECONOMY.loginMax);
}
