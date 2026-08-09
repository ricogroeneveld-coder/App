import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { leaveRoom } from '@/lib/roomLifecycle';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Check, Clock, Pencil, ArrowLeft, Palette, MessageCircle, Timer } from 'lucide-react';
import { WORD_LISTS, WORD_LISTS_NL, PREMIUM_WORD_LISTS, shortCategory } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import { cleanText } from '@/lib/cleanText';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import ChatPanel from './ChatPanel';
import RoomTabBar from './RoomTabBar';
import QuickEquip from './QuickEquip';
import EmojiRain from './EmojiRain';
import useUnreadChat from './useUnreadChat';

const WORD_ENTRY_TIMER_SECONDS = 60;
// Enforcement stagger for removing stalled players — see PlayingPhase's
// deadline enforcement for the pattern (grace, then per-player stagger).
const ENFORCE_GRACE_MS = 6000;
const ENFORCE_STAGGER_MS = 4000;
const MAX_CUSTOM_WORD_LENGTH = 30;

const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function WordEntryPhase({ room, players, me, myPlayer, roomCode }) {
  const { toast } = useToast();
  const { t, lang } = useLang();
  const profiles = usePeerProfiles(players);
  const [selected, setSelected] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [tab, setTab] = useState('word'); // 'word' | 'profile' | 'chat'
  const [wordTimeLeft, setWordTimeLeft] = useState(WORD_ENTRY_TIMER_SECONDS);
  const wordTimerRef = useRef(null);
  const timedOutRef = useRef(false);
  const isHost = room.host_id === me?.id;
  const submitted = myPlayer?.word_submitted;
  const allSubmitted = players.length > 0 && players.every(p => p.word_submitted);
  const isCustom = room.category === 'Custom';
  const [rain, setRain] = useState({ emote: null, trigger: 0 });
  const unreadChat = useUnreadChat(roomCode, me?.id, tab === 'chat',
    (emote) => setRain(r => ({ emote, trigger: r.trigger + 1 })));

  // A player who doesn't lock in a word before the shared deadline gets
  // removed — otherwise one distracted player can stall everyone else
  // indefinitely. With only 2 in the room, removing one leaves an unplayable
  // 1-player game, so the whole attempt cancels back to the lobby instead.
  //
  // The deadline is stored on the room (set when the host starts the game),
  // NOT a device-local countdown: iOS freezes the webview when the stalled
  // player backgrounds the app, so their own timer is exactly the one that
  // can't be trusted to fire. Their client self-removes when awake; everyone
  // who already submitted enforces it when it isn't (effect below).
  const deadlineMs = room.question_deadline ? new Date(room.question_deadline).getTime() : null;
  useEffect(() => {
    if (submitted) { clearInterval(wordTimerRef.current); setWordTimeLeft(null); return; }
    // Legacy room without a deadline: the host claims one so every client
    // counts down against the same clock.
    if (!deadlineMs) {
      if (isHost) {
        MysteryRoom.update(room.id, {
          question_deadline: new Date(Date.now() + WORD_ENTRY_TIMER_SECONDS * 1000).toISOString(),
        }).catch(() => {});
      }
      setWordTimeLeft(WORD_ENTRY_TIMER_SECONDS);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setWordTimeLeft(secs);
      if (secs <= 0) {
        clearInterval(wordTimerRef.current);
        handleWordTimeout();
      }
    };
    tick();
    wordTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(wordTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, deadlineMs]);

  // Deadline enforcement by players who already submitted: if a stalled
  // player's device is asleep, remove them on their behalf once the deadline
  // is comfortably past (staggered; re-checked against fresh state).
  const enforcedRef = useRef(false);
  useEffect(() => {
    if (!submitted || !deadlineMs) return;
    const iv = setInterval(async () => {
      const rank = players.filter(p => p.word_submitted).findIndex(p => p.user_id === me?.id);
      if (rank < 0) return;
      if (Date.now() < deadlineMs + ENFORCE_GRACE_MS + rank * ENFORCE_STAGGER_MS) return;
      if (enforcedRef.current) return;
      enforcedRef.current = true;
      try {
        const fresh = await MysteryPlayer.filter({ room_code: roomCode });
        const stalled = (fresh || []).filter(p => !p.word_submitted);
        if (!stalled.length) return;
        if ((fresh.length - stalled.length) < 2) {
          // Not enough locked-in players left for a game — reset everyone
          // back to the lobby (same rule as the self-timeout path).
          await Promise.all((fresh || []).map(p =>
            MysteryPlayer.update(p.id, { secret_word: '', word_submitted: false })
          ));
          await MysteryRoom.update(room.id, { status: 'lobby', question_deadline: null });
        } else {
          await Promise.all(stalled.map(p => MysteryPlayer.delete(p.id)));
        }
      } catch { /* another enforcer got it, or we're offline — theirs counts */ }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, deadlineMs, players, me?.id, roomCode]);

  const handleWordTimeout = async () => {
    if (timedOutRef.current || submitted) return;
    timedOutRef.current = true;
    if (players.length <= 2) {
      toast({ title: t.wordTimeoutLobby });
      try {
        // Reset everyone's word state too — a category change (or just a
        // fresh attempt) shouldn't carry the other player's already-locked
        // word into a restart where they never get asked to lock in again.
        await Promise.all(players.map(p =>
          MysteryPlayer.update(p.id, { secret_word: '', word_submitted: false })
        ));
        await MysteryRoom.update(room.id, { status: 'lobby', question_deadline: null });
      } catch (e) { /* ignore */ }
      return;
    }
    toast({ title: t.wordTimeoutKicked, variant: 'destructive' });
    try { await leaveRoom({ room, players, me, myPlayer, mode: 'delete' }); } catch (e) { /* ignore */ }
    navigate('/');
  };

  const wordListEn = WORD_LISTS[room.category] || PREMIUM_WORD_LISTS[room.category] || [];
  const wordListNl = lang === 'nl' ? (WORD_LISTS_NL[room.category] || wordListEn) : wordListEn;
  const wordList = wordListNl;
  // Map displayed (possibly Dutch) word back to English for storage
  const nlToEn = lang === 'nl' && WORD_LISTS_NL[room.category]
    ? Object.fromEntries((WORD_LISTS_NL[room.category] || []).map((w, i) => [w, wordListEn[i] || w]))
    : null;

  const submitWord = async () => {
    const displayWord = isCustom ? cleanText(customInput.trim()) : selected;
    if (!displayWord) { toast({ title: isCustom ? t.enterWordFirst : t.pickWordFirst, variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      // Always store the English word so AI/guessing logic works correctly
      const word = nlToEn ? (nlToEn[displayWord] || displayWord) : displayWord;
      await MysteryPlayer.update(myPlayer.id, {
        secret_word: word,
        word_submitted: true
      });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startPlaying = async () => {
    try {
      await MysteryRoom.update(room.id, {
        status: 'playing', current_questioner_index: 0, round_number: 1,
        // First asker's shared turn deadline (see PlayingPhase).
        question_deadline: new Date(Date.now() + 30 * 1000).toISOString(),
      });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    }
  };

  const navigate = useNavigate();
  const goBack = () => {
    // Host, before locking a word in, is just re-opening lobby setup — not
    // leaving the room, so no confirmation needed. Everyone else (or a host
    // who already submitted) is actually exiting the game.
    if (isHost && !submitted) {
      MysteryRoom.update(room.id, { status: 'lobby' })
        .catch(e => toast({ title: t.errorTitle, description: e.message, variant: 'destructive' }));
      return;
    }
    setShowLeaveConfirm(true);
  };

  const confirmLeave = async () => {
    try {
      await leaveRoom({ room, players, me, myPlayer, mode: 'delete' });
    } catch(e) {
      // fall through — still navigate home even if cleanup failed
    }
    navigate('/');
  };

  return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col items-center relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
      }}
    >
      <GameBackground />
      <EmojiRain emote={rain.emote} trigger={rain.trigger} />
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={goBack} className="header-btn" title={t.leave} aria-label={t.leave}>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card bg-slate-900/95 p-5 max-w-sm w-full">
              <p className="font-extrabold text-lg mb-1">{t.leaveQuestion}</p>
              <p className="text-slate-400 text-sm mb-4">{t.leaveBody}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold">{t.cancel}</button>
                <button onClick={confirmLeave}
                  className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 border-0 font-bold text-white">{t.leave}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {tab === 'word' && (
      <div
        className="w-full max-w-md relative flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pt-2 pb-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        {/* Compact header — every word must fit on ONE screen, so no big
            icon tile; the whole picker is designed to a 667px budget */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-2.5 pt-1">
          <h2 className="text-lg font-extrabold tracking-tight leading-tight">{t.chooseSecretWord}</h2>
          {/* The timer rides with the (much shorter) category line instead
              of the title — the title alone is already close to the width
              budget, and adding a badge there pushed it past the screen
              edge instead of wrapping. */}
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-xs font-semibold text-white/[0.7]">{t.category}: <span className="text-violet-300">{shortCategory(room.category)}</span></p>
            {!submitted && wordTimeLeft !== null && (
              <span className={`inline-flex items-center justify-center gap-1 h-5 px-2 rounded-full font-mono font-bold text-[11px] leading-none tabular-nums shrink-0 ${wordTimeLeft <= 10 ? 'bg-rose-500/15 text-rose-300' : 'bg-white/5 text-slate-300'}`}>
                <Timer className="w-3 h-3 shrink-0" />
                <span className="leading-none">{formatTimer(wordTimeLeft)}</span>
              </span>
            )}
          </div>
        </motion.div>

        {!submitted ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }} className="space-y-2.5">
            {isCustom ? (
              /* Custom word input */
              <div className="glass-card p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
                  <Pencil className="w-4 h-4" />
                  {t.typeAnyWord}
                </div>
                <input
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value.slice(0, MAX_CUSTOM_WORD_LENGTH))}
                  onKeyDown={e => e.key === 'Enter' && submitWord()}
                  placeholder={t.enterSecretWord} enterKeyHint="done" maxLength={MAX_CUSTOM_WORD_LENGTH}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-b from-[#1e0d42]/80 to-[#0a0518]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(251,191,36,0.3)] text-white placeholder:text-slate-500 text-base focus:outline-none focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1.5px_rgba(251,191,36,0.6)] transition-shadow"
                />
                <p className="text-xs text-slate-400">{t.keepItSecret}</p>
              </div>
            ) : (
              <div className="glass-card p-2.5">
                {/* Aligned 3-column word grid, every word visible at once.
                    Long words (the ones that wrap to 2 lines) are grouped
                    into the SAME rows — aligned to a full-row boundary — so
                    every row has a uniform height instead of one tall cell
                    stretching a row of short words. */}
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 ring-1 ring-white/5 p-1.5">
                  {(() => {
                    const shorts = wordList.filter(w => w.length <= 13);
                    const longs = wordList.filter(w => w.length > 13);
                    const keep = shorts.length - (shorts.length % 3);
                    return [...shorts.slice(0, keep), ...longs, ...shorts.slice(keep)];
                  })().map(w => (
                    <button key={w} onClick={() => setSelected(w)}
                      className={`px-1 py-1.5 rounded-lg text-[11px] font-semibold text-center leading-tight break-words transition active:scale-[0.96] ${selected === w
                        ? 'bg-gradient-to-b from-violet-400 to-violet-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_-2px_rgba(139,92,246,0.7)] ring-1 ring-violet-300/60'
                        : 'bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10'}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={submitWord} disabled={submitting || (!isCustom && !selected) || (isCustom && !customInput.trim())}
              className="gold-btn w-full h-12 rounded-[18px] flex items-center justify-center gap-2 px-4">
              <Lock className="relative w-4 h-4 shrink-0 text-[#2c1500]" />
              <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)] truncate">
                {submitting ? t.lockingIn : selected && !isCustom ? `${t.lockIn} · ${selected}` : t.lockIn}
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
            className="glass-card text-center py-6">
            <div className="w-12 h-12 mx-auto mb-2.5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-base font-extrabold">{t.wordLockedIn}</p>
            <p className="text-slate-400 text-xs font-medium mt-0.5">{t.waitingForOthers}</p>
          </motion.div>
        )}

        {/* Player readiness — one compact horizontal strip (32px avatars
            with a check/clock corner badge) so the word cloud above keeps
            the vertical space; full player showcase lives in the lobby */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
          className="glass-card mt-2.5 px-3 py-2 flex flex-wrap items-start justify-center gap-x-2.5 gap-y-1.5">
          {players.map(p => {
            const pProfile = profiles[p.user_id];
            return (
              <div key={p.id} className="flex flex-col items-center gap-0.5 w-12">
                <span className="relative">
                  <PlayerAvatar profile={pProfile} name={p.display_name} color={p.color} size={28} />
                  <span className={`absolute -bottom-0.5 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[#0d0716] ${p.word_submitted ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    {p.word_submitted
                      ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
                      : <Clock className="w-2.5 h-2.5 text-slate-300 animate-pulse" />}
                  </span>
                </span>
                <span className={`w-full text-center text-[9px] font-semibold truncate ${p.user_id === me?.id ? 'text-violet-300' : 'text-slate-400'}`}>{p.display_name}</span>
              </div>
            );
          })}
        </motion.div>

        {isHost && allSubmitted && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="mt-3">
            <button onClick={startPlaying}
              className="gold-btn w-full h-14 rounded-[20px] flex items-center justify-center gap-2">
              <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                {t.everyoneReady}
              </span>
            </button>
          </motion.div>
        )}
      </div>
      )}

      {/* Profile/Chat panes clear the fixed back button (top-left, 44px
          tall) with their own top padding — the 'word' tab doesn't need
          this because its centered header text never sits under it, but
          QuickEquip's left-aligned section labels and chat's message list
          both start flush left. */}
      {tab === 'profile' && (
        <div className="w-full max-w-md relative flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4"
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 3.5rem), 3.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}>
          <QuickEquip />
        </div>
      )}

      {tab === 'chat' && (
        <div className="w-full max-w-md relative flex-1 min-h-0 flex flex-col px-4"
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 3.5rem), 3.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}>
          <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
        </div>
      )}

      <RoomTabBar
        active={tab}
        onChange={setTab}
        items={[
          { id: 'word', label: t.tabWordEntry, icon: Pencil },
          { id: 'profile', label: t.tabProfile, icon: Palette },
          { id: 'chat', label: t.tabChat, icon: MessageCircle, badge: unreadChat },
        ]}
      />
    </div>
  );
}