import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Check, Clock, Search, Pencil, ChevronsDown, ArrowLeft } from 'lucide-react';
import { WORD_LISTS, WORD_LISTS_NL, PREMIUM_WORD_LISTS, shortCategory } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';

export default function WordEntryPhase({ room, players, me, myPlayer, roomCode }) {
  const { toast } = useToast();
  const { t, lang } = useLang();
  const [selected, setSelected] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [search, setSearch] = useState('');
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
  const filtered = useMemo(() =>
    wordList.filter(w => w.toLowerCase().includes(search.toLowerCase())),
    [wordList, search]
  );

  const submitWord = async () => {
    const displayWord = isCustom ? customInput.trim() : selected;
    if (!displayWord) { toast({ title: isCustom ? 'Enter your word first' : 'Pick a word first', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      // Always store the English word so AI/guessing logic works correctly
      const word = nlToEn ? (nlToEn[displayWord] || displayWord) : displayWord;
      await MysteryPlayer.update(myPlayer.id, {
        secret_word: word,
        word_submitted: true
      });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startPlaying = async () => {
    try {
      await MysteryRoom.update(room.id, { status: 'playing', current_questioner_index: 0, round_number: 1 });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const navigate = useNavigate();
  const goBack = async () => {
    if (isHost && !submitted) {
      try { await MysteryRoom.update(room.id, { status: 'lobby' }); }
      catch(e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
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
        <button onClick={goBack} className="header-btn" title={t.leave}>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div
        className="w-full max-w-md relative flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-4 pt-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_5px_12px_-8px_rgba(0,0,0,0.45)] mb-3">
            <Lock className="w-7 h-7 text-violet-300" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mb-0.5">{t.chooseSecretWord}</h2>
          <p className="text-xs font-semibold text-white/[0.7]">{t.category}: <span className="text-violet-300">{shortCategory(room.category)}</span></p>
        </motion.div>

        {!submitted ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }} className="space-y-3">
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
                  placeholder={t.enterSecretWord}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-b from-[#1e0d42]/80 to-[#0a0518]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(251,191,36,0.3)] text-white placeholder:text-slate-500 text-base focus:outline-none focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1.5px_rgba(251,191,36,0.6)] transition-shadow"
                />
                <p className="text-xs text-slate-500">{t.keepItSecret}</p>
              </div>
            ) : (
              <div className="glass-card p-3 space-y-2.5">
                {/* Selected word display */}
                {selected && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-[#3a2400] to-[#1a0f00] ring-1 ring-[#ffcf7a]/60 shadow-[inset_0_1px_1px_rgba(255,220,150,0.25)]">
                    <span className="font-bold text-amber-200 text-sm">{selected}</span>
                    <button onClick={() => setSelected('')} className="text-amber-300/70 hover:text-amber-200 text-xs font-semibold">{t.change2}</button>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t.search(shortCategory(room.category))}
                    className="inset-input w-full h-10 pl-9 pr-4 text-base md:text-sm"
                  />
                </div>

                {/* Word grid */}
                <div className="max-h-52 overflow-y-auto rounded-xl bg-black/20 ring-1 ring-white/5 p-1.5 grid grid-cols-2 gap-1 word-grid-scroll" style={{ overscrollBehaviorY: 'none' }}>
                  {filtered.map(w => (
                    <button key={w} onClick={() => { setSelected(w); setSearch(''); }}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition ${selected === w ? 'bg-violet-500 text-white font-semibold shadow-[0_2px_6px_-2px_rgba(139,92,246,0.6)]' : 'text-slate-300 hover:bg-white/10 active:scale-[0.98]'}`}>
                      {w}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-2 text-center text-slate-500 text-sm py-4">{t.noResults}</p>
                  )}
                </div>
                {filtered.length > 8 && (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs">
                    <ChevronsDown className="w-3.5 h-3.5 animate-bounce" />
                    <span>{t.scrollForMore}</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={submitWord} disabled={submitting || (!isCustom && !selected) || (isCustom && !customInput.trim())}
              className="gold-btn w-full h-14 rounded-[20px] flex items-center justify-center gap-2">
              <Lock className="relative w-4 h-4 text-[#2c1500]" />
              <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                {submitting ? t.lockingIn : t.lockIn}
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

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }} className="glass-card mt-3 p-3 space-y-1.5">
          {players.map(p => (
            <div key={p.id} className="glass-tile flex items-center gap-2.5 h-9 px-2.5">
              <div className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] overflow-hidden"
                style={{ backgroundColor: p.color }}>
                <span className="pointer-events-none absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-white/35 blur-[3px]" />
                <span className="relative">{p.display_name[0].toUpperCase()}</span>
              </div>
              <span className="flex-1 min-w-0 text-xs font-semibold truncate">{p.display_name}</span>
              {p.user_id === me?.id && <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 ring-1 ring-violet-400/40 text-[9px] font-bold text-violet-200">{t.you}</span>}
              {p.word_submitted
                ? <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                : <Clock className="w-4 h-4 text-slate-500 animate-pulse shrink-0" />}
            </div>
          ))}
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