import { useEffect, useRef, useState } from 'react';
import { MysteryChat } from '@/api/db';
import { isMuted } from '@/lib/mutes';

// Unread counts survive phase changes: each phase mounts its own copy of
// this hook, so a per-room module-level map keeps the count alive across
// lobby → word entry → playing → finished instead of resetting to 0 on
// every transition. Rooms are short-lived; the map dies with the session.
const counts = new Map();

/**
 * Unread-chat counting + chat-driven emote rain, shared by every phase's
 * tab bar. Counts others' messages while the chat tab isn't the active one;
 * clears the moment it becomes active. Muted players' messages neither
 * count nor rain. `isChatOpen` is read through a ref so the subscription
 * (set up once) always sees the CURRENT tab without resubscribing on every
 * tab switch.
 *
 * @param {(emote: string) => void} [onEmote] - fired for every incoming
 *   chat message containing an emote (own messages included — sender sees
 *   their own rain too, same as the old PlayingPhase behavior).
 */
export default function useUnreadChat(roomCode, myId, isChatOpen, onEmote) {
  const [unread, setUnread] = useState(() => counts.get(roomCode) || 0);
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;
  const onEmoteRef = useRef(onEmote);
  onEmoteRef.current = onEmote;

  const set = (roomKey, value) => {
    counts.set(roomKey, value);
    setUnread(value);
  };

  useEffect(() => {
    if (isChatOpen) set(roomCode, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatOpen, roomCode]);

  useEffect(() => {
    setUnread(counts.get(roomCode) || 0);
    const unsub = MysteryChat.subscribe((event) => {
      if (event.type !== 'create' || event.data?.room_code !== roomCode) return;
      if (isMuted(event.data.user_id)) return;
      if (onEmoteRef.current) {
        const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];
        const emote = EMOTES.find(e => event.data.message?.includes(e));
        if (emote) onEmoteRef.current(emote);
      }
      if (event.data.user_id !== myId && !isChatOpenRef.current) {
        set(roomCode, (counts.get(roomCode) || 0) + 1);
      }
    }, undefined, `room_code=eq.${roomCode}`);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myId]);

  return unread;
}
