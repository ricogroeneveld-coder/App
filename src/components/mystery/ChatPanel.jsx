import React, { useState, useEffect, useRef } from 'react';
import { MysteryChat } from '@/api/db';
import { Send, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/LanguageContext';
import { cleanText } from '@/lib/cleanText';
import { isMuted, subscribeMutes } from '@/lib/mutes';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import { subscribeRoomChat } from './useUnreadChat';

const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];
// Hard cap on one message — matches nothing in particular except sanity:
// long enough for any real sentence, short enough that one paste can't
// wreck the layout for the whole room. Mirrored by maxLength on the input.
const MAX_MESSAGE_LENGTH = 300;
const EMOTE_LABELS = { '😂': 'Laughing', '🔥': 'Fire', '👀': 'Eyes', '💀': 'Skull', '🤔': 'Thinking', '😱': 'Shocked', '🎉': 'Party', '👏': 'Clapping', '😏': 'Smirking', '🤯': 'Mind blown' };
// Near-bottom threshold (px) — within this, a new message still auto-scrolls;
// further up, the reader is treated as browsing history and left alone.
const AUTOSCROLL_THRESHOLD = 80;
// NET-8: cap the in-memory message list so a long/spammy room can't grow the
// array (and the DOM) without bound — keep only the most recent N.
const CHAT_HISTORY_CAP = 200;
// CHAT-6: ignore a send fired within this window of the previous one, a
// lightweight client-side rate limit against accidental/abusive spam.
const SEND_COOLDOWN_MS = 600;

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function extractEmote(text) {
  return EMOTES.find(e => text.includes(e)) || null;
}

function timeOf(msg) {
  // Optimistic bubbles have no created_date yet — treat them as "now" so they
  // sort to the end (newest) until the real, timestamped row replaces them.
  return msg?.created_date ? new Date(msg.created_date).getTime() : Infinity;
}

// NET-4 / CHAT-8: merge a row into the list — dedupe by id (realtime can
// redeliver, and a real row supersedes its optimistic twin), insert by
// created_date order (not pure arrival order), and cap the list (NET-8).
function mergeMessage(list, row) {
  if (!row?.id) return list;
  const next = list.filter(m =>
    m.id !== row.id &&
    // drop the optimistic bubble this real row replaces, so both never show
    !(m._pending && m.user_id === row.user_id && m.message === row.message));
  const ts = timeOf(row);
  let i = next.length;
  while (i > 0 && timeOf(next[i - 1]) > ts) i--;
  next.splice(i, 0, row);
  return next.length > CHAT_HISTORY_CAP ? next.slice(next.length - CHAT_HISTORY_CAP) : next;
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
  // Mirror of `messages` kept in sync inside the state updater, so the realtime
  // handler can tell a genuinely NEW message from a redelivery without waiting
  // a render (used for the "N new" pill — CHAT-8).
  const messagesRef = useRef([]);
  const lastSendRef = useRef(0);
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

  // History (re)fetch — also re-runs on wake so a suspended socket that missed
  // messages is reconciled. NEWEST 60, then restore chronological order —
  // ascending+limit returned the OLDEST 60, so busy rooms reopened chat onto
  // stale history.
  useEffect(() => {
    let live = true;
    MysteryChat.filter({ room_code: roomCode }, '-created_date', 60)
      .then(msgs => {
        if (!live) return;
        const ordered = (msgs || []).slice().reverse();
        messagesRef.current = ordered;
        setMessages(ordered);
      })
      .catch(() => { /* keep whatever we already have on a transient failure */ });
    return () => { live = false; };
  }, [roomCode, wakeEpoch]);

  // Realtime — shared, ref-counted per-room channel (NET-3). Reconnection is
  // owned by the shared subscriber, so this no longer depends on wakeEpoch.
  useEffect(() => {
    const unsub = subscribeRoomChat(roomCode, (event) => {
      const row = event.data;
      if (!row || row.room_code !== roomCode) return;

      // NET-4 / CHAT-8: remove moderated/deleted messages live (DELETE matches
      // the OLD row — see db.js subscribe).
      if (event.type === 'delete') {
        setMessages(prev => {
          const next = prev.filter(m => m.id !== row.id);
          messagesRef.current = next;
          return next;
        });
        return;
      }

      if (event.type !== 'create') return;

      // "N new" pill counts only GENUINELY new messages from OTHERS while the
      // reader is scrolled up — never my own optimistic add/remove churn, and
      // never a redelivery of a message already in the list (CHAT-8).
      const isNew = !messagesRef.current.some(m => m.id === row.id);
      setMessages(prev => {
        const next = mergeMessage(prev, row);
        messagesRef.current = next;
        return next;
      });
      if (isNew && row.user_id !== me?.id && !nearBottomRef.current) {
        setNewBelow(n => n + 1);
      }

      // Emote rain (kept for API parity — every current caller passes a no-op
      // and drives real rain through useUnreadChat instead).
      const emote = extractEmote(row.message || '');
      if (emote && !isMuted(row.user_id)) onEmoteRain(emote);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, me?.id]);

  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewBelow(0);
  };

  // Only follow new content while already near the bottom — a reader who's
  // scrolled up to read history shouldn't get yanked away on every arrival.
  // This covers my own sends and others' messages alike; the "N new" pill
  // (newBelow) is incremented separately in the realtime handler so it counts
  // only genuine new messages from others, not my optimistic churn (CHAT-8).
  useEffect(() => {
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    // CHAT-6: swallow sends fired within the cooldown of the last one. This is
    // distinct from CHAT-1's "never drop a legitimately-typed follow-up": a
    // human can't type + submit two real messages inside 600ms, so this only
    // eats key-repeat / rapid-fire spam, not real conversation.
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN_MS) return;
    lastSendRef.current = now;
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
            // CHAT-5: cleanText only ran on SEND, so a modified/hostile client
            // could push raw slurs straight to everyone. Filter again at RENDER
            // time (message body + display name) so received text is masked too.
            const safeName = cleanText(msg.display_name) || msg.display_name;
            const safeMessage = cleanText(msg.message);
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <PlayerAvatar profile={profiles[msg.user_id]} name={safeName} color={msg.color} size={24} />
                <div
                  onClick={clickable ? () => retry(msg) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e => (e.key === 'Enter' || e.key === ' ') && retry(msg)) : undefined}
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm transition-opacity ${clickable ? 'cursor-pointer' : ''} ${
                  msg._pending ? 'opacity-50' : msg._failed ? 'opacity-70 ring-1 ring-rose-500/50' : 'opacity-100'
                } ${isMe ? 'bg-gradient-to-b from-violet-500 to-violet-700 text-white rounded-br-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_-2px_rgba(0,0,0,0.4)]' : 'bg-white/10 text-white rounded-bl-sm ring-1 ring-white/5'}`}>
                  {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{safeName}</p>}
                  <p>{safeMessage}</p>
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