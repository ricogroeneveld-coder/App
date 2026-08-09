import { useEffect, useRef, useState } from 'react';
import { MysteryChat } from '@/api/db';

/**
 * Unread-chat counting shared by every phase's tab bar. Counts others'
 * messages while the chat tab isn't the active one; clears the moment it
 * becomes active. `isChatOpen` is read through a ref so the subscription
 * (set up once) always sees the CURRENT tab without resubscribing on every
 * tab switch — same pattern PlayingPhase's inline version used.
 */
export default function useUnreadChat(roomCode, myId, isChatOpen) {
  const [unread, setUnread] = useState(0);
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;

  useEffect(() => {
    if (isChatOpen) setUnread(0);
  }, [isChatOpen]);

  useEffect(() => {
    const unsub = MysteryChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_code === roomCode &&
          event.data.user_id !== myId && !isChatOpenRef.current) {
        setUnread(u => u + 1);
      }
    });
    return unsub;
  }, [roomCode, myId]);

  return unread;
}
