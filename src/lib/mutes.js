// Client-side player muting — the personal complement to reporting (which
// alerts the developer) and host-kick (which only the host can do). Apple's
// UGC guideline 1.2 expects users to be able to block abusive users
// themselves; muting hides a player's chat messages and emote rains on THIS
// device only, no server involvement. Keyed by guest user_id so it holds
// across rooms and sessions.
const STORAGE_KEY = 'wmp_muted';
const listeners = new Set();

function read() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []); }
  catch { return new Set(); }
}

function write(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
  listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

export function isMuted(userId) {
  return !!userId && read().has(userId);
}

export function setMuted(userId, muted) {
  if (!userId) return;
  const set = read();
  if (muted) set.add(userId); else set.delete(userId);
  write(set);
}

// Re-render hook for components that filter by mute state (chat, unread
// counts) — fires on every mute/unmute made anywhere in the app.
export function subscribeMutes(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
