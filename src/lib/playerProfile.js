// Player progression store — one profile per guest identity. Persists to the
// player_profiles Supabase table so OTHER players can see levels/cosmetics
// (lobby avatars, player cards); falls back transparently to localStorage if
// the table isn't migrated yet, so the app never breaks.
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';
import { serverNow } from './serverTime';
import {
  ECONOMY, levelFromXp, dailyChallenges, WEEKLY, SEASON, SEASON_ID,
  todayKey, weekKey, loginReward,
} from './progression';
import { STARTER_OWNED, DEFAULT_EQUIPPED, cosmeticById, levelUnlocks, ALL_COSMETICS, COLLECTIONS, collectionItems, isHiddenCosmetic } from './cosmetics';

const LS_KEY = 'wmp_profile_v1';
let cache = null;
// In-flight guard for match-reward granting (ECON-7): blocks a double-invoke
// (StrictMode / remount) from paying the same round twice before save() lands.
const grantingRounds = new Set();
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
  return () => { listeners.delete(fn); };
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

// Profile writes require an authenticated session since migration 0004 —
// an ANONYMOUS one is enough, created invisibly here (no account, no UI).
// The session persists in localStorage and auto-refreshes. If anonymous
// sign-ins are disabled or the device is offline, play continues local-only.
let authReady = null;
export function ensureAuth() {
  if (!authReady) {
    authReady = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return;
        const { error } = await supabase.auth.signInAnonymously();
        // A failed attempt (offline, toggle off) must retry on the NEXT
        // write instead of staying broken until the app restarts.
        if (error) authReady = null;
      } catch {
        authReady = null;
      }
    })();
  }
  return authReady;
}
// A web logout (optional email accounts) drops the session — arrange for a
// fresh anonymous one on the next write instead of writing unauthenticated.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') authReady = null;
});

async function remoteUpsert(p) {
  if (!remoteOk) return;
  try {
    await ensureAuth();
    const { error } = await supabase.from('player_profiles').upsert({
      // Carry the LOCAL write stamp (set in save()) — it's what the
      // newest-wins merge in doLoadProfile compares against.
      ...p, updated_date: p.updated_date || new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    remoteState = 'ok';
    // Belt and braces for the iCloud reinstall backup: auth events cover the
    // steady state, but refreshing it after every successful sync closes any
    // first-session ordering gap. No-ops on web.
    import('./cloudBackup').then(m => m.backupIdentityNow()).catch(() => {});
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
        // NEWEST wins, not remote-wins: blindly preferring remote meant an
        // equip made moments ago (saved locally, upsert still in flight or
        // failed) was clobbered back to the older server copy on the next
        // screen — cosmetics visibly "reset to basic". Remote only wins
        // when it's genuinely newer (another device played more recently).
        // Date-parse both sides: Postgres serializes '+00:00', the client
        // writes 'Z' — a plain string compare across those formats lies.
        const localTs = Date.parse(local.updated_date || '') || 0;
        const remoteTs = Date.parse(data.updated_date || '') || 0;
        const remoteNewer = !localTs || (remoteTs && remoteTs > localTs);
        if (remoteNewer) {
          cache = { ...local, ...data };
        } else {
          cache = local;
          // Local is ahead of the server — push it up so peers see it.
          remoteUpsert(local);
        }
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
  // Every local mutation stamps its own write time — the anchor for the
  // newest-wins merge in doLoadProfile.
  cache.updated_date = new Date().toISOString();
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

// Completing a collection grants its exclusive reward (never purchasable).
// Returns the newly granted collections for celebration UI.
function grantCollectionRewards(breakdown) {
  const completed = [];
  for (const col of COLLECTIONS) {
    if (col.hidden) continue; // stashed sets never complete or reward
    if (cache.owned.includes(col.reward)) continue;
    const items = collectionItems(col.id);
    if (items.length && items.every(i => cache.owned.includes(i.id))) {
      cache.owned.push(col.reward);
      completed.push(col);
      if (breakdown) breakdown.unlocks.push(col.reward);
    }
  }
  return completed;
}

// ── Beta tester gift ───────────────────────────────────────────────────────

// TestFlight builds auto-grant the Beta Tester set at startup (App.jsx
// checks the sandbox receipt via isTestFlightBuild). Granting the four set
// pieces completes col_beta, which awards its BETA TESTER title through the
// normal collection-reward flow. Idempotent — re-runs change nothing, and
// the items keep working on App Store builds afterwards (ownership lives in
// the profile, not the build).
const BETA_SET = ['em_wrench', 'bn_beta', 'bd_beta', 'nc_beta'];
export function grantBetaCosmetics() {
  getProfile();
  let changed = false;
  for (const id of BETA_SET) {
    if (!cache.owned.includes(id)) { cache.owned.push(id); changed = true; }
  }
  if (!changed) return false;
  grantCollectionRewards(null);
  save();
  return true;
}

// ── Daily login ────────────────────────────────────────────────────────────

export async function ensureDailyLogin() {
  await loadProfile();
  // Use SERVER time, not the device clock (ECON-5): winding the phone clock
  // forward a day used to re-trigger the login reward and bump the streak.
  // serverNow() is re-synced at startup, so an online player can't fast-forward
  // the daily reset. (Offline falls back to the local clock — same as before.)
  const today = todayKey(new Date(serverNow()));
  const d = cache.daily || {};
  if (d.last === today) return null;
  const yesterday = todayKey(new Date(serverNow() - 86400000));
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
        breakdown.challenges.push({ id: def.id, name: def.name, picks: def.picks });
        if (def.unlock && !isHiddenCosmetic(def.unlock) && !cache.owned.includes(def.unlock)) {
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
// Idempotent per ROUND: "Play Again" reuses the same room, so the key
// includes the round's last guess id (a game can only finish via a correct
// guess, so it uniquely fingerprints the round). Refreshing the results
// screen hits the same key and stays blocked; the next round has different
// guesses and grants normally.

export async function grantMatchRewards({ room, players, guesses, me }) {
  if (!room || !me?.id) return null;
  const roundKey = `${room.id}:${guesses[guesses.length - 1]?.id || 'r0'}`;
  // ECON-7: serialize concurrent calls for the same round so a double-invoke
  // can't both pass the persisted idempotency check and double-pay.
  if (grantingRounds.has(roundKey)) return null;
  grantingRounds.add(roundKey);
  try {
    return await grantMatchRewardsInner({ room, players, guesses, me, roundKey });
  } finally {
    grantingRounds.delete(roundKey);
  }
}

async function grantMatchRewardsInner({ room, players, guesses, me, roundKey }) {
  await loadProfile();
  const now = Date.now();
  const granted = cache.granted || (cache.granted = {});
  if (granted[roundKey] && now - granted[roundKey] < 30 * 60 * 1000) return null;

  // ── ECON-1 anti-farm ──────────────────────────────────────────────────
  // The economy could be minted with two browser tabs "Play Again"-ing a
  // 2-player room. Two guards:
  //  (1) The compounding bonuses — winner, perfect, and the win streak — plus
  //      the win STAT only pay out in genuinely competitive games (>=3 players).
  //      A 1v1 still earns completion + per-guess + host rewards and full XP;
  //      it just can't farm the winner/perfect/streak stack.
  //  (2) A per-room hourly cap: only so many rounds in the SAME room pay out
  //      within an hour, so replay-farming one room dries up fast. Legit
  //      groups rarely exceed this; farmers hit it immediately.
  const competitive = players.length >= 3;
  const REPLAY_CAP_PER_HOUR = 10;
  const hourAgo = now - 60 * 60 * 1000;
  const roomRoundsThisHour = Object.entries(granted)
    .filter(([k, ts]) => k.startsWith(`${room.id}:`) && ts > hourAgo).length;
  if (roomRoundsThisHour >= REPLAY_CAP_PER_HOUR) return null;

  const myPlayer = players.find(p => p.user_id === me.id);
  if (!myPlayer) return null;

  // Winner = best of THIS round only. p.score accumulates across "Play
  // Again" rounds, but playAgain wipes the guesses table, so counting the
  // correct guesses currently in it gives exactly this round's points
  // (mirrors FinishedPhase's winner logic).
  const roundScore = {};
  players.forEach(p => { roundScore[p.user_id] = 0; });
  guesses.forEach(g => { if (g.correct && g.guesser_id in roundScore) roundScore[g.guesser_id] += 1; });
  const topScore = Math.max(0, ...Object.values(roundScore));

  // Nobody guessed a single word correctly this round — the only way that
  // happens is players leaving before the game really got going (a normal
  // finish always has at least one correct guess, since that's what
  // reduces the room to a winner). Without this, every remaining player
  // ties at 0 and reads as "the winner," collecting the winner bonus,
  // streak bonus, and completion reward for a match that never happened.
  // Void it instead: no rewards, no stats, no streak change.
  if (topScore === 0) return null;

  // A "win" for reward/stat purposes requires a competitive (>=3 player) game
  // so a 2-tab self-farm can't mint the winner/perfect/streak stack (ECON-1).
  const isTopScorer = (roundScore[me.id] || 0) === topScore && players.length > 1;
  const isWinner = isTopScorer && competitive;
  const myCorrect = guesses.filter(g => g.guesser_id === me.id && g.correct).length;
  const isHost = room.host_id === me.id;
  const perfect = isWinner && myCorrect >= players.length - 1;

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

  grantCollectionRewards(breakdown);

  const after = levelFromXp(cache.xp);
  breakdown.after = { level: after.level, into: after.into, need: after.need };
  breakdown.picksBalance = cache.picks;

  // Cap the granted map
  granted[roundKey] = now;
  const keys = Object.keys(granted);
  if (keys.length > 20) for (const k of keys.slice(0, keys.length - 20)) delete granted[k];

  save();
  return breakdown;
}

// ── Cosmetics ──────────────────────────────────────────────────────────────

export function ownsCosmetic(id) { return getProfile().owned.includes(id); }

// Bailing on a live match forfeits the win streak (ECON-9) — otherwise a
// player could keep a streak alive by rage-quitting any match they're losing
// before it reaches the results screen (where the streak would normally reset).
export function breakStreakOnLeave() {
  getProfile();
  if (cache.win_streak) { cache.win_streak = 0; save(); }
}

export function purchaseCosmetic(id) {
  getProfile();
  const c = cosmeticById(id);
  if (!c || c.source.type !== 'shop') return { ok: false, reason: 'locked' };
  if (cache.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (cache.picks < c.source.price) return { ok: false, reason: 'picks' };
  cache.picks -= c.source.price;
  cache.owned.push(id);
  cache.equipped = { ...cache.equipped, [c.type]: id }; // auto-equip on unlock
  const completed = grantCollectionRewards(null);
  save();
  return { ok: true, completed };
}

export function equipCosmetic(id) {
  getProfile();
  const c = cosmeticById(id);
  if (!c || !cache.owned.includes(id)) return false;
  cache.equipped = { ...cache.equipped, [c.type]: id };
  save();
  return true;
}

// ── Deletion ───────────────────────────────────────────────────────────────

// "Delete my profile" must actually remove the data the privacy policy says
// it removes: the remote player_profiles row (name, stats, cosmetics) plus
// the local copy. Remote delete needs the owning anonymous session
// (migration 0006's owner delete policy) — best-effort, so deletion still
// completes offline. Callers clear the guest identity separately.
export async function deleteProfileData() {
  try {
    await ensureAuth();
    await supabase.from('player_profiles').delete().eq('user_id', getGuestIdentity().id);
  } catch { /* offline / policy — local wipe still proceeds */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  cache = null;
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
