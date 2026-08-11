import { useEffect, useRef, useState } from 'react';
import { MysteryChat } from '@/api/db';
import { isMuted } from '@/lib/mutes';

// Unread counts survive phase changes: each phase mounts its own copy of
// this hook, so a per-room module-level map keeps the count alive across
// lobby → word entry → playing → finished instead of resetting to 0 on
// every transition. Rooms are short-lived; the map dies with the session.
const counts = new Map();
// CHAT-2: newest message timestamp (ms) this session has accounted for, per
// room. Realtime doesn't replay rows missed while the socket was suspended, so
// on wake we query for anything newer than this and fold it into the badge.
const lastSeen = new Map();

// ── NET-3: one shared chat subscription per room ──────────────────────────
// The unread badge (this hook) and the open ChatPanel used to EACH open their
// own `mystery_chats` realtime channel for the same room, so every message
// arrived — and was processed — twice, and traffic doubled. This module-level,
// ref-counted subscriber opens exactly ONE channel per room and fans events
// out to all local consumers (badge + panel). It also OWNS reconnection so
// consumers no longer each re-subscribe on wake: it re-establishes the channel
// on tab wake / reconnect and self-heals a dead channel (CHANNEL_ERROR /
// TIMED_OUT). The channel is torn down when the last consumer for a room
// unsubscribes.
const roomSubs = new Map(); // roomCode → entry

function openRoomSub(roomCode) {
  const entry = {
    handlers: new Set(),
    refs: 0,
    unsub: null,
    retryTimer: null,
    disposed: false,
  };

  const fanout = (event) => {
    entry.handlers.forEach(fn => { try { fn(event); } catch { /* one bad consumer shouldn't break the rest */ } });
  };

  const handleStatus = (status) => {
    if (entry.disposed) return;
    // A dead channel that stays foregrounded won't fire a wake event —
    // self-heal by reopening once. Never react to CLOSED (it also fires during
    // our own teardown) to avoid a resubscribe loop.
    if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !entry.retryTimer) {
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = null;
        if (!entry.disposed) reopen();
      }, 3000);
    }
  };

  const open = () => {
    entry.unsub = MysteryChat.subscribe(fanout, handleStatus, `room_code=eq.${roomCode}`);
  };
  const reopen = () => {
    entry.unsub?.();
    if (!entry.disposed) open();
  };

  // Mobile browsers suspend the realtime socket in the background and it can
  // come back dead — reopen on wake/reconnect (CHAT-2, formerly handled by
  // each consumer individually).
  const wake = () => { if (document.visibilityState === 'visible') reopen(); };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('online', wake);
  entry.teardown = () => {
    entry.disposed = true;
    clearTimeout(entry.retryTimer);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('pageshow', wake);
    window.removeEventListener('online', wake);
    entry.unsub?.();
  };

  open();
  return entry;
}

/**
 * Subscribe to a room's chat stream through the shared, ref-counted channel.
 * @param {string} roomCode
 * @param {(event: {type:string, data:any}) => void} onEvent
 * @returns {() => void} unsubscribe
 */
export function subscribeRoomChat(roomCode, onEvent) {
  let entry = roomSubs.get(roomCode);
  if (!entry) {
    entry = openRoomSub(roomCode);
    roomSubs.set(roomCode, entry);
  }
  entry.handlers.add(onEvent);
  entry.refs += 1;
  return () => {
    entry.handlers.delete(onEvent);
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.teardown();
      roomSubs.delete(roomCode);
    }
  };
}

const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];
// CHAT-6: coalesce emote rain to at most one burst per this window, per hook
// instance, so spamming 🔥 can't cause continuous full-screen rain for the
// whole room.
const EMOTE_RAIN_THROTTLE_MS = 1500;

/**
 * Unread-chat counting + chat-driven emote rain, shared by every phase's
 * tab bar. Counts others' messages while the chat tab isn't the active one;
 * clears the moment it becomes active. Muted players' messages neither
 * count nor rain. `isChatOpen` is read through a ref so the subscription
 * always sees the CURRENT tab without resubscribing on every tab switch.
 *
 * @param {(emote: string) => void} [onEmote] - fired (throttled) for every
 *   incoming chat message containing an emote (own messages included — sender
 *   sees their own rain too, same as the old PlayingPhase behavior).
 */
export default function useUnreadChat(roomCode, myId, isChatOpen, onEmote) {
  const [unread, setUnread] = useState(() => counts.get(roomCode) || 0);
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;
  const onEmoteRef = useRef(onEmote);
  onEmoteRef.current = onEmote;
  const lastEmoteRef = useRef(0);

  const set = (roomKey, value) => {
    counts.set(roomKey, value);
    setUnread(value);
  };

  useEffect(() => {
    // Opening chat clears the badge AND marks everything up to now as seen, so
    // a later wake-reconcile doesn't recount messages the reader already saw.
    if (isChatOpen) { set(roomCode, 0); lastSeen.set(roomCode, Date.now()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatOpen, roomCode]);

  // CHAT-2: on wake, count messages that arrived while the socket was suspended
  // (the live handler never saw them). Bounded to a single query, not a
  // resubscribe (reconnection stays owned by the shared subscriber, NET-3).
  useEffect(() => {
    const reconcile = async () => {
      if (document.visibilityState !== 'visible') return;
      if (isChatOpenRef.current) { set(roomCode, 0); lastSeen.set(roomCode, Date.now()); return; }
      try {
        const since = lastSeen.get(roomCode) || 0;
        const rows = await MysteryChat.filter({ room_code: roomCode }, '-created_date', 60);
        const missed = (rows || []).filter(m =>
          new Date(m.created_date).getTime() > since && m.user_id !== myId && !isMuted(m.user_id));
        const newest = (rows || []).reduce((mx, m) => Math.max(mx, new Date(m.created_date).getTime()), since);
        lastSeen.set(roomCode, newest);
        if (missed.length) set(roomCode, (counts.get(roomCode) || 0) + missed.length);
      } catch { /* transient — try again on the next wake */ }
    };
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('online', reconcile);
    return () => {
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('pageshow', reconcile);
      window.removeEventListener('online', reconcile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myId]);

  useEffect(() => {
    setUnread(counts.get(roomCode) || 0);
    if (!lastSeen.has(roomCode)) lastSeen.set(roomCode, Date.now());
    // Reconnection/wake is owned by the shared subscriber (NET-3); this hook
    // just registers a handler.
    const unsub = subscribeRoomChat(roomCode, (event) => {
      if (event.type !== 'create' || event.data?.room_code !== roomCode) return;
      if (isMuted(event.data.user_id)) return;
      // Advance the seen-watermark for every live message so the wake-reconcile
      // never double-counts one we already processed here.
      const ts = event.data.created_date ? new Date(event.data.created_date).getTime() : Date.now();
      if (ts > (lastSeen.get(roomCode) || 0)) lastSeen.set(roomCode, ts);
      if (onEmoteRef.current) {
        const emote = EMOTES.find(e => event.data.message?.includes(e));
        if (emote) {
          const now = Date.now();
          if (now - lastEmoteRef.current >= EMOTE_RAIN_THROTTLE_MS) { // CHAT-6
            lastEmoteRef.current = now;
            onEmoteRef.current(emote);
          }
        }
      }
      if (event.data.user_id !== myId && !isChatOpenRef.current) {
        set(roomCode, (counts.get(roomCode) || 0) + 1);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myId]);

  return unread;
}
