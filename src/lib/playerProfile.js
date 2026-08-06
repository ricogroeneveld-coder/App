// Player progression store — one profile per guest identity. Persists to the
// player_profiles Supabase table so OTHER players can see levels/cosmetics
// (lobby avatars, player cards); falls back transparently to localStorage if
// the table isn't migrated yet, so the app never breaks.
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';
import {
  ECONOMY, levelFromXp, dailyChallenges, WEEKLY, SEASON, SEASON_ID,
  todayKey, weekKey, loginReward,
} from './progression';
import { STARTER_OWNED, DEFAULT_EQUIPPED, cosmeticById, levelUnlocks, ALL_COSMETICS } from './cosmetics';

const LS_KEY = 'wmp_profile_v1';
let cache = null;
let remoteOk = true; // flips false once the table proves missing
let remoteState = 'unknown'; // 'unknown' | 'ok' | 'missing'
const listeners = new Set();

// Sync health for the UI: 'ok' means profiles reach Supabase and other
// players can see this player's cosmetics; 'missing' means the
// player_profiles table doesn't exist (migration 0002 not run yet).
export function remoteStatus() { return remoteState; }

function markRemoteError(e) {
  if (String(e?.message || '').includes('does not exist') || e?.code === '42P01') {
    remoteOk = false;
    remoteState = 'missing';
  }
}

export function subscribeProfile(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  // Fresh snapshot per emit — cache is mutated in place, and React setState
  // bails out on an identical reference, silently skipping re-renders.
  const snap = { ...cache };
  listeners.forEach(fn => { try { fn(snap); } catch {} });
}

function blankProfile() {
  const guest = getGuestIdentity();
  return {
    user_id: guest.id,
    display_name: guest.name || '',
    level: 1, xp: 0, picks: 0,
    games_played: 0, wins: 0, correct_guesses: 0, win_streak: 0,
    category_counts: {},
    owned: [...STARTER_OWNED],
    equipped: { ...DEFAULT_EQUIPPED },
    challenges: {},
    daily: {},
    granted: {},
    created_date: new Date().toISOString(),
  };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.user_id === getGuestIdentity().id ? p : null;
  } catch { return null; }
}

function writeLocal(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

async function remoteUpsert(p) {
  if (!remoteOk) return;
  try {
    const { error } = await supabase.from('player_profiles').upsert({
      ...p, updated_date: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    remoteState = 'ok';
  } catch (e) {
    // Table missing / offline — keep playing from localStorage.
    markRemoteError(e);
  }
}

export function getProfile() {
  if (!cache) cache = readLocal() || blankProfile();
  return cache;
}

// Single-flight: concurrent callers (page load + daily login + dev unlock)
// share one load instead of racing and clobbering each other's writes.
let loadPromise = null;
export function loadProfile() {
  if (!loadPromise) {
    loadPromise = doLoadProfile().finally(() => { loadPromise = null; });
  }
  return loadPromise;
}

async function doLoadProfile() {
  const local = readLocal() || blankProfile();
  cache = local;
  if (remoteOk) {
    try {
      const { data, error } = await supabase.from('player_profiles')
        .select('*').eq('user_id', getGuestIdentity().id).maybeSingle();
      if (error) throw error;
      remoteState = 'ok';
      if (data) {
        // Remote wins on progression numbers (another device may be newer),
        // merged with any local-only fields.
        cache = { ...local, ...data };
      } else {
        remoteUpsert(local);
      }
    } catch (e) {
      markRemoteError(e);
    }
  }
  // Keep the display name in sync with the guest identity
  const guestName = getGuestIdentity().name || '';
  if (guestName && cache.display_name !== guestName) cache.display_name = guestName;
  writeLocal(cache);
  emit();
  return cache;
}

function save() {
  writeLocal(cache);
  remoteUpsert(cache);
  emit();
}

// Fetch other players' profiles (for avatars/player cards). Best-effort:
// returns {} when the table isn't available.
export async function fetchProfilesFor(userIds) {
  if (!remoteOk || !userIds?.length) return {};
  try {
    const { data, error } = await supabase.from('player_profiles')
      .select('*').in('user_id', userIds);
    if (error) throw error;
    remoteState = 'ok';
    return Object.fromEntries((data || []).map(p => [p.user_id, p]));
  } catch (e) {
    markRemoteError(e);
    return {};
  }
}

// ── Picks / XP / levels ────────────────────────────────────────────────────

function addXp(amount, breakdown) {
  const before = levelFromXp(cache.xp);
  cache.xp += amount;
  const after = levelFromXp(cache.xp);
  cache.level = after.level;
  for (let l = before.level + 1; l <= after.level; l++) {
    cache.picks += ECONOMY.levelUpPicks;
    breakdown.levelUps.push({ level: l, picks: ECONOMY.levelUpPicks });
    for (const c of levelUnlocks(l)) {
      if (!cache.owned.includes(c.id)) {
        cache.owned.push(c.id);
        breakdown.unlocks.push(c.id);
      }
    }
  }
}

// ── Daily login ────────────────────────────────────────────────────────────

export async function ensureDailyLogin() {
  await loadProfile();
  const today = todayKey();
  const d = cache.daily || {};
  if (d.last === today) return null;
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  const streak = d.last === yesterday ? (d.streak || 0) + 1 : 1;
  const picks = loginReward(streak);
  cache.daily = { ...d, last: today, streak };
  cache.picks += picks;
  save();
  return { picks, streak };
}

// ── Challenges ─────────────────────────────────────────────────────────────

function challengeBucket(scope, key) {
  const ch = cache.challenges || (cache.challenges = {});
  if (!ch[scope] || ch[scope].key !== key) ch[scope] = { key, progress: {}, claimed: {} };
  return ch[scope];
}

function bumpChallenges(stats, breakdown) {
  const sets = [
    { scope: 'daily', key: todayKey(), defs: dailyChallenges() },
    { scope: 'weekly', key: weekKey(), defs: WEEKLY },
    { scope: 'season', key: SEASON_ID, defs: SEASON },
  ];
  for (const { scope, key, defs } of sets) {
    const bucket = challengeBucket(scope, key);
    for (const def of defs) {
      const gained = stats[def.stat] || 0;
      if (gained > 0) bucket.progress[def.id] = (bucket.progress[def.id] || 0) + gained;
      if (!bucket.claimed[def.id] && (bucket.progress[def.id] || 0) >= def.target) {
        bucket.claimed[def.id] = true;
        cache.picks += def.picks;
        breakdown.challenges.push({ name: def.name, picks: def.picks });
        if (def.unlock && !cache.owned.includes(def.unlock)) {
          cache.owned.push(def.unlock);
          breakdown.unlocks.push(def.unlock);
        }
      }
    }
  }
}

export function challengeState() {
  getProfile();
  return {
    daily: { defs: dailyChallenges(), bucket: challengeBucket('daily', todayKey()) },
    weekly: { defs: WEEKLY, bucket: challengeBucket('weekly', weekKey()) },
    season: { defs: SEASON, bucket: challengeBucket('season', SEASON_ID) },
  };
}

// ── Match rewards ──────────────────────────────────────────────────────────
// Idempotent per room within a 30-minute window (covers refreshes on the
// results screen; a genuine "Play Again" round later grants normally).

export async function grantMatchRewards({ room, players, guesses, me }) {
  if (!room || !me?.id) return null;
  await loadProfile();
  const now = Date.now();
  const granted = cache.granted || (cache.granted = {});
  if (granted[room.id] && now - granted[room.id] < 30 * 60 * 1000) return null;

  const myPlayer = players.find(p => p.user_id === me.id);
  if (!myPlayer) return null;

  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const topScore = sorted[0]?.score || 0;
  const isWinner = (myPlayer.score || 0) === topScore && players.length > 1;
  const myCorrect = guesses.filter(g => g.guesser_id === me.id && g.correct).length;
  const isHost = room.host_id === me.id;
  const perfect = isWinner && myCorrect >= players.length - 1 && players.length > 1;

  const breakdown = { rows: [], levelUps: [], unlocks: [], challenges: [], totalPicks: 0, totalXp: 0 };
  const before = levelFromXp(cache.xp);
  breakdown.before = { level: before.level, into: before.into, need: before.need };

  const add = (label, { picks, xp }) => {
    breakdown.rows.push({ label, picks, xp });
    breakdown.totalPicks += picks; breakdown.totalXp += xp;
    cache.picks += picks;
  };

  add('complete', ECONOMY.complete);
  if (myCorrect > 0) add('guesses', { picks: ECONOMY.correctGuess.picks * myCorrect, xp: ECONOMY.correctGuess.xp * myCorrect });
  if (isWinner) add('winner', ECONOMY.winner);
  if (perfect) add('perfect', ECONOMY.perfect);
  if (isHost) add('host', ECONOMY.host);

  cache.win_streak = isWinner ? (cache.win_streak || 0) + 1 : 0;
  const streakIdx = Math.min(cache.win_streak, ECONOMY.streakBonus.length - 1);
  if (isWinner && ECONOMY.streakBonus[streakIdx] > 0) {
    add('streak', { picks: ECONOMY.streakBonus[streakIdx], xp: 0 });
    breakdown.streak = cache.win_streak;
  }

  addXp(breakdown.totalXp, breakdown);

  // Stats
  cache.games_played += 1;
  if (isWinner) cache.wins += 1;
  cache.correct_guesses += myCorrect;
  if (room.category) {
    const cc = cache.category_counts || (cache.category_counts = {});
    cc[room.category] = (cc[room.category] || 0) + 1;
  }

  bumpChallenges({
    plays: 1, wins: isWinner ? 1 : 0, guesses: myCorrect,
    hosts: isHost ? 1 : 0, bigGames: players.length >= 4 ? 1 : 0,
  }, breakdown);
  for (const c of breakdown.challenges) { breakdown.totalPicks += c.picks; }

  const after = levelFromXp(cache.xp);
  breakdown.after = { level: after.level, into: after.into, need: after.need };
  breakdown.picksBalance = cache.picks;

  // Cap the granted map
  granted[room.id] = now;
  const keys = Object.keys(granted);
  if (keys.length > 20) for (const k of keys.slice(0, keys.length - 20)) delete granted[k];

  save();
  return breakdown;
}

// ── Cosmetics ──────────────────────────────────────────────────────────────

export function ownsCosmetic(id) { return getProfile().owned.includes(id); }

export function purchaseCosmetic(id) {
  getProfile();
  const c = cosmeticById(id);
  if (!c || c.source.type !== 'shop') return { ok: false, reason: 'locked' };
  if (cache.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (cache.picks < c.source.price) return { ok: false, reason: 'picks' };
  cache.picks -= c.source.price;
  cache.owned.push(id);
  cache.equipped = { ...cache.equipped, [c.type]: id }; // auto-equip on unlock
  save();
  return { ok: true };
}

export function equipCosmetic(id) {
  getProfile();
  const c = cosmeticById(id);
  if (!c || !cache.owned.includes(id)) return false;
  cache.equipped = { ...cache.equipped, [c.type]: id };
  save();
  return true;
}

// ── Dev/test helpers ───────────────────────────────────────────────────────
// Triggered from /profile?dev=unlock and /profile?dev=reset for testing.

export async function devUnlockAll() {
  await loadProfile();
  cache.owned = ALL_COSMETICS.map(c => c.id);
  cache.picks = 99999;
  save();
  return cache;
}

export async function devResetProfile() {
  cache = blankProfile();
  save();
  return cache;
}

export function favoriteCategory() {
  const cc = getProfile().category_counts || {};
  let best = ''; let n = 0;
  for (const [k, v] of Object.entries(cc)) if (v > n) { best = k; n = v; }
  return best;
}
