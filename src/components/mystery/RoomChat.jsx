import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryChat } from '@/api/db';
import { MessageCircle, X } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import ChatPanel from './ChatPanel';

/**
 * A floating chat button + slide-up panel for the phases that don't have a
 * tab bar of their own (Lobby, Word Entry, Finished). Playing keeps its own
 * tab-integrated chat — this only fills the gap everywhere else, so the
 * exact moments a party game most wants chat (waiting around, picking
 * words, celebrating after a round) aren't the moments it's unreachable.
 */
export default function RoomChat({ roomCode, me, myPlayer }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const unsub = MysteryChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_code === roomCode &&
          event.data.user_id !== me?.id && !openRef.current) {
        setUnread(u => u + 1);
      }
    });
    return unsub;
  }, [roomCode, me?.id]);

  const toggle = () => {
    setOpen(o => {
      if (!o) setUnread(0);
      return !o;
    });
  };

  return (
    <>
      <button onClick={toggle} aria-label={t.tabChat}
        className="fixed z-40 right-4 w-13 h-13 rounded-full bg-gradient-to-b from-violet-400 to-violet-700 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-violet-300/40 flex items-center justify-center active:scale-[0.96] transition-transform"
        style={{ bottom: 'max(calc(env(safe-area-inset-bottom) + 1rem), 1.5rem)', width: '3.25rem', height: '3.25rem' }}>
        <MessageCircle className="w-5 h-5 text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 text-[10px] font-extrabold text-white flex items-center justify-center leading-none shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-2 ring-[#0d0716]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={toggle}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="glass-card w-full max-w-md bg-slate-900/95 h-[70vh] flex flex-col p-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h3 className="text-base font-bold text-white">{t.tabChat}</h3>
                <button onClick={toggle} className="p-2 -m-1 rounded-xl hover:bg-white/10 text-slate-400" aria-label={t.close}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
