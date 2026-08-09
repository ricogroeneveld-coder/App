import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Check, Clock, Pencil, ArrowLeft } from 'lucide-react';
import { WORD_LISTS, WORD_LISTS_NL, PREMIUM_WORD_LISTS, shortCategory } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import { cleanText } from '@/lib/cleanText';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';

export default function WordEntryPhase({ room, players, me, myPlayer, roomCode }) {
  const { toast } = useToast();
  const { t, lang } = useLang();
  const profiles = usePeerProfiles(players);
  const [selected, setSelected] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isHost = room.host_id === me?.id;
  const submitted = myPlayer?.word_submitted;
  const allSubmitted = players.length > 0 && players.every(p => p.word_submitted);
  const isCustom = room.category === 'Custom';

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
      await MysteryRoom.update(room.id, { status: 'playing', current_questioner_index: 0, round_number: 1 });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    }
  };

  const navigate = useNavigate();
  const goBack = async () => {
    if (isHost && !submitted) {
      try { await MysteryRoom.update(room.id, { status: 'lobby' }); }
      catch(e) { toast({ title: t.errorTitle, description: e.message, variant: 'destructive' }); }
    } else {
      navigate('/');
    }
  };

  return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col items-center relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
      }}
    >
      <GameBackground />
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={goBack} className="header-btn" title={t.leave} aria-label={t.leave}>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div
        className="w-full max-w-md relative flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pt-2 pb-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        {/* Compact header — every word must fit on ONE screen, so no big
            icon tile; the whole picker is designed to a 667px budget */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-2.5 pt-1">
          <h2 className="text-lg font-extrabold tracking-tight leading-tight">{t.chooseSecretWord}</h2>
          <p className="text-xs font-semibold text-white/[0.7]">{t.category}: <span className="text-violet-300">{shortCategory(room.category)}</span></p>
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
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitWord()}
                  placeholder={t.enterSecretWord} enterKeyHint="done"
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
    </div>
  );
}