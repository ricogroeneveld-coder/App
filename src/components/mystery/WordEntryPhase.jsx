import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MysteryPlayer, MysteryRoom, MysterySecret } from '@/api/db';
import { leaveRoom } from '@/lib/roomLifecycle';
import { normalizeWord } from '@/lib/normalizeWord';
import { serverNow } from '@/lib/serverTime';
import { track } from '@/lib/analytics';
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
import { Dialog } from '@/components/ui/dialog';
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
  const [starting, setStarting] = useState(false);
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
          question_deadline: new Date(serverNow() + WORD_ENTRY_TIMER_SECONDS * 1000).toISOString(),
        }).catch(() => {});
      }
      setWordTimeLeft(WORD_ENTRY_TIMER_SECONDS);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadlineMs - serverNow()) / 1000));
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

  // Hand the room off to a survivor whenever the current host is no longer in
  // the roster — idempotent and retryable, so a partially-failed enforcement
  // pass (deletes landed, host update didn't) can't permanently strand the
  // room on a dangling host_id (STUCK-2 / GAME-N7).
  const reassignHostIfMissing = async (roster) => {
    const list = roster || [];
    if (!list.length) return;
    if (list.some(p => p.user_id === room.host_id)) return;
    const heir = [...list].sort((a, b) =>
      new Date(a.created_date).getTime() - new Date(b.created_date).getTime())[0];
    await MysteryRoom.update(room.id, { host_id: heir.user_id, host_name: heir.display_name });
  };

  // Deadline enforcement by players who already submitted: if a stalled
  // player's device is asleep, remove them on their behalf once the deadline
  // is comfortably past (staggered; re-checked against fresh state).
  const enforcedRef = useRef(false);
  useEffect(() => {
    if (!submitted || !deadlineMs) return;
    const iv = setInterval(async () => {
      const rank = players.filter(p => p.word_submitted).findIndex(p => p.user_id === me?.id);
      if (rank < 0) return;
      if (serverNow() < deadlineMs + ENFORCE_GRACE_MS + rank * ENFORCE_STAGGER_MS) return;
      if (enforcedRef.current) return;
      enforcedRef.current = true;
      let enforced = false;
      try {
        const fresh = await MysteryPlayer.filter({ room_code: roomCode });
        const stalled = (fresh || []).filter(p => !p.word_submitted);
        if (!stalled.length) {
          // Nothing to enforce, but the host may have been removed by a prior
          // (partially-failed) pass — reassign if the room now lacks its host
          // so a dangling host_id can't strand the room (GAME-N7).
          await reassignHostIfMissing(fresh);
          enforced = true;
          return;
        }
        if ((fresh.length - stalled.length) < 2) {
          // Not enough locked-in players left for a game — reset everyone back
          // to the lobby (clears secrets + word_submitted server-side, 0012).
          await MysteryRoom.setStatus(roomCode, 'word_entry', 'lobby');
        } else {
          // Remove the stalled players, then hand the room off to a survivor if
          // the host is no longer present (STUCK-2 / crash-safe, GAME-N7).
          await Promise.all(stalled.map(p => MysteryPlayer.delete(p.id)));
          const survivors = (fresh || []).filter(p => p.word_submitted);
          await reassignHostIfMissing(survivors);
        }
        enforced = true;
      } catch { /* another enforcer got it, or we're offline — theirs counts */ }
      finally {
        // Only latch the one-shot after a SUCCESSFUL write, so a failed
        // attempt (offline blip) can retry next tick instead of this client
        // permanently disarming (GAME-5).
        if (!enforced) enforcedRef.current = false;
      }
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
        // Back to the lobby — the RPC clears secrets + word_submitted server-side
        // so a fresh attempt doesn't carry a stale locked-in word (0012).
        await MysteryRoom.setStatus(roomCode, 'word_entry', 'lobby');
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
    // A custom word that normalizes to empty (emoji, punctuation-only, a
    // non-Latin script, or one that got fully profanity-masked) can never be
    // guessed correct — which would make the round unfinishable (STUCK-3).
    // Reject it before locking in. List words are always valid.
    if (isCustom && !normalizeWord(displayWord)) {
      toast({ title: t.pickAnotherWord, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Always store the English word so AI/guessing logic works correctly
      const word = nlToEn ? (nlToEn[displayWord] || displayWord) : displayWord;
      // Write the secret (to the write-only mystery_secrets table, never sent
      // to other clients / Realtime — SEC-1) and mark ready, in one hardened
      // call that can't be blocked by an RLS misconfig (submit_mystery_word RPC).
      await MysterySecret.submit(roomCode, me.id, word);
      // Keep MY own word on THIS device so the in-game "My Word" reminder still
      // works — the secret is no longer stored on my player row (SEC-1), and a
      // player must still be able to see their own pick (survives reload).
      try { localStorage.setItem(`wmp_myword_${roomCode}`, word); } catch { /* ignore */ }
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Host drops a player who never locked a word in (usually one who
  // backgrounded during word entry). Without this the host had no way to
  // proceed and no indication why — the start button simply never appeared.
  const removeStalledPlayer = async (p) => {
    try {
      await MysteryPlayer.delete(p.id);
      toast({ title: t.playerRemoved(p.display_name) });
    } catch (e) {
      toast({ title: t.errorTitle, description: t.tryAgain, variant: 'destructive' });
    }
  };

  const startPlaying = async () => {
    // Single in-flight guard. Without it, a host whose screen hadn't switched
    // to the playing phase yet (backgrounded tab, slow realtime) would tap
    // Start again; the first call had already succeeded, so the second was
    // rejected as 'stale' and reported as "waiting for others" — an error for
    // a game that had in fact started.
    if (starting) return;
    setStarting(true);
    try {
      // Re-verify against LIVE state that everyone locked a word in — a player
      // can auto-join in the gap before the host taps, and starting with an
      // unsubmitted (empty-word) player makes them unguessable and the round
      // unfinishable (STUCK-3).
      const fresh = await MysteryPlayer.filter({ room_code: roomCode });
      const roster = fresh || [];
      if (roster.length < 2 || roster.some(p => !p.word_submitted)) {
        toast({ title: t.waitingForOthers, variant: 'destructive' });
        return;
      }
      // Turn order is keyed by user_id so it survives eliminations/joins
      // (GAME-1); the first asker is the earliest-joined player.
      const firstAsker = [...roster].sort((a, b) =>
        new Date(a.created_date).getTime() - new Date(b.created_date).getTime())[0];
      // The transition + deadline are minted + re-validated server-side (the RPC
      // re-checks all-submitted under a row lock, closing the auto-join TOCTOU —
      // NEW-GAME-9), and status can no longer be forced by a client (migration 0012).
      const res = await MysteryRoom.setStatus(roomCode, 'word_entry', 'playing', { questionerId: firstAsker?.user_id || null });
      if (res && res.ok === false) {
        // 'stale' means the room already moved on. If it moved to 'playing',
        // the start SUCCEEDED (this is a duplicate tap, or a peer started it)
        // — say nothing and let the phase switch. Only a genuine "someone
        // hasn't locked in" gets the waiting message.
        if (res.reason === 'stale' && res.status === 'playing') return;
        toast({
          title: res.reason === 'not_all_submitted' ? t.waitingForOthers : t.errorTitle,
          description: res.reason === 'not_all_submitted' ? undefined : t.tryAgain,
          variant: 'destructive',
        });
        return;
      }
      track('game_started', { players: roster.length, category: room.category });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  const navigate = useNavigate();
  const goBack = () => {
    // Host, before locking a word in, is just re-opening lobby setup — not
    // leaving the room, so no confirmation needed. Everyone else (or a host
    // who already submitted) is actually exiting the game.
    if (isHost && !submitted) {
      MysteryRoom.setStatus(roomCode, 'word_entry', 'lobby')
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
          <Dialog onClose={() => setShowLeaveConfirm(false)} titleId="word-leave-title"
            panelClassName="glass-card bg-slate-900/95 p-5 max-w-sm">
            <p id="word-leave-title" className="font-extrabold text-lg mb-1">{t.leaveQuestion}</p>
            <p className="text-slate-400 text-sm mb-4">{t.leaveBody}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold">{t.cancel}</button>
              <button onClick={confirmLeave}
                className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 border-0 font-bold text-white">{t.leave}</button>
            </div>
          </Dialog>
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

        {/* UX-9: an explicit, in-context warning that running out the clock
            means removal — a fleeting toast at the moment of the kick was too
            easy to miss. Only when a kick (not a lobby reset) would actually
            happen, i.e. 3+ players. */}
        {!submitted && wordTimeLeft !== null && wordTimeLeft <= 15 && players.length > 2 && (
          <div className="mb-2.5 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/40 px-3 py-2 text-center text-[12px] font-semibold text-rose-200">
            ⏳ {t.lockInOrRemoved}
          </div>
        )}

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
                <span className="relative flex">
                  <PlayerAvatar profile={pProfile} name={p.display_name} color={p.color} size={28} />
                  <span className={`absolute -bottom-0.5 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[#0d0716] ${p.word_submitted ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    {p.word_submitted
                      ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
                      : <Clock className="w-2.5 h-2.5 text-slate-300 animate-pulse" />}
                  </span>
                </span>
                <span className={`w-full text-center text-[9px] font-semibold truncate ${p.user_id === me?.id ? 'text-violet-300' : 'text-slate-400'}`}>{p.display_name}</span>
                {/* The host was previously stuck with no button and no
                    explanation when someone backgrounded before locking a word
                    in — "Everyone Ready" only renders once EVERY player has
                    submitted, so one absent player blocked the game until the
                    60s enforcement pass. Let the host drop a player who hasn't
                    locked in, so they can start straight away. */}
                {isHost && !p.word_submitted && p.user_id !== me?.id && (
                  <button onClick={() => removeStalledPlayer(p)}
                    className="mt-0.5 px-1.5 h-6 min-w-[2.75rem] rounded-md bg-rose-500/15 ring-1 ring-rose-400/30 text-rose-300 text-[9px] font-bold active:scale-95 transition"
                    aria-label={t.removePlayerLabel(p.display_name)}>
                    {t.remove}
                  </button>
                )}
              </div>
            );
          })}
        </motion.div>

        {isHost && allSubmitted && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="mt-3">
            <button onClick={startPlaying} disabled={starting}
              className="gold-btn w-full h-14 rounded-[20px] flex items-center justify-center gap-2 disabled:opacity-60">
              <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                {starting ? t.starting : t.everyoneReady}
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