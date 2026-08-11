import React, { useState, useEffect, useRef } from 'react';
import { MysteryChat } from '@/api/db';
import { Send, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/LanguageContext';
import { cleanText } from '@/lib/cleanText';
import { isMuted, subscribeMutes } from '@/lib/mutes';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';

const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];
// Hard cap on one message — matches nothing in particular except sanity:
// long enough for any real sentence, short enough that one paste can't
// wreck the layout for the whole room. Mirrored by maxLength on the input.
const MAX_MESSAGE_LENGTH = 300;
const EMOTE_LABELS = { '😂': 'Laughing', '🔥': 'Fire', '👀': 'Eyes', '💀': 'Skull', '🤔': 'Thinking', '😱': 'Shocked', '🎉': 'Party', '👏': 'Clapping', '😏': 'Smirking', '🤯': 'Mind blown' };
// Near-bottom threshold (px) — within this, a new message still auto-scrolls;
// further up, the reader is treated as browsing history and left alone.
const AUTOSCROLL_THRESHOLD = 80;

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function extractEmote(text) {
  return EMOTES.find(e => text.includes(e)) || null;
}

export default function ChatPanel({ roomCode, me, myPlayer, onEmoteRain }) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [wakeEpoch, setWakeEpoch] = useState(0);
  const [newBelow, setNewBelow] = useState(0);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const pendingIdRef = useRef(0);
  const nearBottomRef = useRef(true);
  const profiles = usePeerProfiles(messages);

  // Re-fetch + re-subscribe when the tab wakes — the background-suspended
  // realtime socket misses messages and can come back dead.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') setWakeEpoch(n => n + 1);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, []);

  // Re-render when a player is muted/unmuted so their bubbles hide live.
  const [, setMuteEpoch] = useState(0);
  useEffect(() => subscribeMutes(() => setMuteEpoch(n => n + 1)), []);

  useEffect(() => {
    // NEWEST 60, then restore chronological order — ascending+limit returned
    // the OLDEST 60, so busy rooms reopened chat onto stale history.
    MysteryChat.filter({ room_code: roomCode }, '-created_date', 60)
      .then(msgs => setMessages((msgs || []).reverse()));

    const unsub = MysteryChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_code === roomCode) {
        setMessages(prev => [...prev, event.data]);
        const emote = extractEmote(event.data.message);
        if (emote && !isMuted(event.data.user_id)) onEmoteRain(emote);
      }
    }, undefined, `room_code=eq.${roomCode}`);
    return unsub;
  }, [roomCode, wakeEpoch]);

  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewBelow(0);
  };

  // Only follow new messages while already near the bottom — a reader who's
  // scrolled up to read history shouldn't get yanked away on every arrival.
  useEffect(() => {
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setNewBelow(n => n + 1);
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanceFromBottom < AUTOSCROLL_THRESHOLD;
    if (nearBottomRef.current) setNewBelow(0);
  };

  // Each send is independent (its own optimistic bubble id), so concurrent
  // sends are fine — we deliberately do NOT gate on an in-flight flag, which
  // used to silently DROP a second message typed while the first was still in
  // flight on a slow network (CHAT-1). `sending` now only briefly disables the
  // button; it never aborts a send.
  const sendText = async (trimmed, retryId) => {
    if (!trimmed) return;
    setSending(true);
    const emote = extractEmote(trimmed);
    // Optimistic update — a retry reuses the same bubble id instead of
    // adding a duplicate.
    const tempId = retryId || `pending-${++pendingIdRef.current}`;
    const optimisticMsg = {
      id: tempId,
      room_code: roomCode,
      user_id: me?.id,
      display_name: myPlayer?.display_name || me?.full_name || t.playerFallback,
      color: myPlayer?.color || '#6366f1',
      message: trimmed,
      has_emote: !!emote,
      emote: emote || '',
      _pending: true,
    };
    setMessages(prev => retryId
      ? prev.map(m => m.id === retryId ? optimisticMsg : m)
      : [...prev, optimisticMsg]);
    try {
      await MysteryChat.create({
        room_code: roomCode,
        user_id: me?.id,
        display_name: myPlayer?.display_name || me?.full_name || t.playerFallback,
        color: myPlayer?.color || '#6366f1',
        message: trimmed,
        has_emote: !!emote,
        emote: emote || ''
      });
      // Remove optimistic msg — real one will arrive via subscription
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (e) {
      // Mark as failed — tapping the bubble (see render) retries it
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const send = () => {
    const trimmed = cleanText(text.trim()).slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;
    setText('');
    // Fire-and-forget so a rapid follow-up isn't blocked/dropped (CHAT-1).
    sendText(trimmed);
  };

  const retry = (msg) => sendText(msg.message, msg.id);

  return (
    <div className="flex flex-col h-full relative">
      <div ref={scrollRef} onScroll={handleScroll}
        role="log" aria-live="polite" aria-relevant="additions"
        className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1 min-h-0" style={{ overscrollBehaviorY: 'none' }}>
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">{t.chatEmpty}</p>
        )}
        <AnimatePresence initial={false}>
          {messages.filter(msg => !isMuted(msg.user_id)).map(msg => {
            const isMe = msg.user_id === me?.id;
            const clickable = msg._failed;
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <PlayerAvatar profile={profiles[msg.user_id]} name={msg.display_name} color={msg.color} size={24} />
                <div
                  onClick={clickable ? () => retry(msg) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e => (e.key === 'Enter' || e.key === ' ') && retry(msg)) : undefined}
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm transition-opacity ${clickable ? 'cursor-pointer' : ''} ${
                  msg._pending ? 'opacity-50' : msg._failed ? 'opacity-70 ring-1 ring-rose-500/50' : 'opacity-100'
                } ${isMe ? 'bg-gradient-to-b from-violet-500 to-violet-700 text-white rounded-br-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_-2px_rgba(0,0,0,0.4)]' : 'bg-white/10 text-white rounded-bl-sm ring-1 ring-white/5'}`}>
                  {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.display_name}</p>}
                  <p>{msg.message}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {msg._failed
                      ? <p className="text-[10px] text-rose-400">{t.chatFailed}</p>
                      : !msg._pending && msg.created_date && (
                        <p className="text-[9px] opacity-50">{formatTime(msg.created_date)}</p>
                      )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-latest — only appears once the reader has scrolled up
          and new messages have arrived below; auto-scroll never fires while
          this is up, so it never yanks someone away from history. */}
      <AnimatePresence>
        {newBelow > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 h-7 pl-2.5 pr-3 rounded-full bg-violet-600 text-white text-[11px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-[0.96] transition-transform">
            <ChevronDown className="w-3.5 h-3.5" />
            {t.newMessages(newBelow)}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Emote picker */}
      <div className="flex gap-2 py-2 overflow-x-auto">
        {EMOTES.map(e => (
          <button key={e} onClick={() => setText(prev => prev + e)} aria-label={EMOTE_LABELS[e] || e}
            className="w-9 h-9 flex items-center justify-center text-xl hover:scale-125 active:scale-95 transition-transform shrink-0">{e}</button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <input
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={t.chatPlaceholder} enterKeyHint="send" maxLength={MAX_MESSAGE_LENGTH}
          className="inset-input flex-1 h-10 px-3 text-base md:text-sm"
        />
        <button onClick={send} disabled={!text.trim() || sending} aria-label="Send"
          className="violet-solid-btn w-10 h-10 flex items-center justify-center disabled:opacity-40 shrink-0">
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}