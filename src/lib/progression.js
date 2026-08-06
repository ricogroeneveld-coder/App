// Economy configuration — every reward value in one place. Balanced so an
// average ~10-minute match pays ~35 Picks (a winner ~75), which prices the
// rarities at: Common ≈ 3 matches, Rare ≈ a casual day, Epic ≈ a week,
// Legendary ≈ 3 weeks, Mythic ≈ a season. First hour of play reaches the
// first Common unlock plus 2–3 level-ups.

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

// Convert total XP into { level, into, need }
export function levelFromXp(totalXp) {
  let level = 1;
  let rest = totalXp;
  while (level < ECONOMY.maxLevel && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  return { level, into: rest, need: xpToNext(level) };
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

export const SEASON = [
  { id: 's_play40',  stat: 'plays',   target: 40, picks: 300, name: 'Complete 40 games',   unlock: 'em_galaxy' },
  { id: 's_guess25', stat: 'guesses', target: 25, picks: 250, name: '25 correct guesses',  unlock: 't_founder' },
  { id: 's_win15',   stat: 'wins',    target: 15, picks: 400, name: 'Win 15 games',        unlock: 'bd_champion' },
];

export const SEASON_ID = 'S1';
export const SEASON_NAME = 'Season 1';

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function weekKey(d = new Date()) {
  // ISO week
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
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
