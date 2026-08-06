import React, { useState, useEffect, useRef } from 'react';
import { MysteryChat } from '@/api/db';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/LanguageContext';

const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];

function extractEmote(text) {
  return EMOTES.find(e => text.includes(e)) || null;
}

export default function ChatPanel({ roomCode, me, myPlayer, onEmoteRain }) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pendingIdRef = useRef(0);

  useEffect(() => {
    MysteryChat.filter({ room_code: roomCode }, 'created_date', 60)
      .then(msgs => setMessages(msgs || []));

    const unsub = MysteryChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_code === roomCode) {
        setMessages(prev => [...prev, event.data]);
        const emote = extractEmote(event.data.message);
        if (emote) onEmoteRain(emote);
      }
    });
    return unsub;
  }, [roomCode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const emote = extractEmote(trimmed);
    // Optimistic update
    const tempId = `pending-${++pendingIdRef.current}`;
    const optimisticMsg = {
      id: tempId,
      room_code: roomCode,
      user_id: me?.id,
      display_name: myPlayer?.display_name || 'Player',
      color: myPlayer?.color || '#6366f1',
      message: trimmed,
      has_emote: !!emote,
      emote: emote || '',
      _pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setText('');
    try {
      await MysteryChat.create({
        room_code: roomCode,
        user_id: me?.id,
        display_name: myPlayer?.display_name || 'Player',
        color: myPlayer?.color || '#6366f1',
        message: trimmed,
        has_emote: !!emote,
        emote: emote || ''
      });
      // Remove optimistic msg — real one will arrive via subscription
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (e) {
      // Mark as failed
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1 min-h-0" style={{ overscrollBehaviorY: 'none' }}>
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">{t.chatEmpty}</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const isMe = msg.user_id === me?.id;
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: msg.color }}>
                  {(msg.display_name || '?')[0].toUpperCase()}
                </div>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm transition-opacity ${
                  msg._pending ? 'opacity-50' : msg._failed ? 'opacity-40 ring-1 ring-rose-500/50' : 'opacity-100'
                } ${isMe ? 'bg-gradient-to-b from-violet-500 to-violet-700 text-white rounded-br-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_-2px_rgba(0,0,0,0.4)]' : 'bg-white/10 text-white rounded-bl-sm ring-1 ring-white/5'}`}>
                  {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.display_name}</p>}
                  <p>{msg.message}</p>
                  {msg._failed && <p className="text-[10px] text-rose-400 mt-0.5">{t.chatFailed}</p>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Emote picker */}
      <div className="flex gap-2 py-2 overflow-x-auto">
        {EMOTES.map(e => (
          <button key={e} onClick={() => setText(prev => prev + e)}
            className="w-9 h-9 flex items-center justify-center text-xl hover:scale-125 active:scale-95 transition-transform shrink-0">{e}</button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={t.chatPlaceholder} enterKeyHint="send"
          className="inset-input flex-1 h-10 px-3 text-base md:text-sm"
        />
        <button onClick={send} disabled={!text.trim() || sending}
          className="violet-solid-btn w-10 h-10 flex items-center justify-center disabled:opacity-40 shrink-0">
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}