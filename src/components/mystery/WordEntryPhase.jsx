import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Check, Clock, Search, Pencil, ChevronsDown, ArrowLeft } from 'lucide-react';
import { WORD_LISTS, WORD_LISTS_NL, PREMIUM_WORD_LISTS } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';

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
      className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white flex flex-col items-center p-4"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 2rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <div className="w-full max-w-md relative">
        <button onClick={goBack}
          className="absolute -top-1 left-0 w-9 h-9 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center justify-center"
          title={t.leave}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/20 mb-4">
            <Lock className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold mb-1">{t.chooseSecretWord}</h2>
          <p className="text-slate-400">{t.category}: <span className="text-violet-300 font-semibold">{room.category}</span></p>
        </motion.div>

        {!submitted ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }} className="space-y-3">
            {isCustom ? (
              /* Custom word input */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                  <Pencil className="w-4 h-4" />
                  {t.typeAnyWord}
                </div>
                <input
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitWord()}
                  placeholder={t.enterSecretWord}
                  className="w-full h-12 px-4 rounded-xl bg-white/5 ring-1 ring-amber-400/30 text-white placeholder:text-slate-500 text-base focus:outline-none focus:ring-amber-400"
                />
                <p className="text-xs text-slate-500">{t.keepItSecret}</p>
              </div>
            ) : (
              <>
                {/* Selected word display */}
                {selected && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-violet-500/20 ring-1 ring-violet-400/40">
                    <span className="font-semibold text-violet-200">{selected}</span>
                    <button onClick={() => setSelected('')} className="text-slate-400 hover:text-white text-xs">{t.change2}</button>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t.search(room.category)}
                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 ring-1 ring-white/10 text-white placeholder:text-slate-500 text-base md:text-sm focus:outline-none focus:ring-violet-400"
                  />
                </div>

                {/* Word grid */}
                <div className="max-h-56 overflow-y-auto rounded-xl bg-white/5 ring-1 ring-white/10 p-2 grid grid-cols-2 gap-1.5 word-grid-scroll" style={{ overscrollBehaviorY: 'none' }}>
                  {filtered.map(w => (
                    <button key={w} onClick={() => { setSelected(w); setSearch(''); }}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition ${selected === w ? 'bg-violet-500 text-white font-medium' : 'text-slate-300 hover:bg-white/10'}`}>
                      {w}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-2 text-center text-slate-500 text-sm py-4">{t.noResults}</p>
                  )}
                </div>
                {filtered.length > 8 && (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mt-1.5">
                    <ChevronsDown className="w-3.5 h-3.5 animate-bounce" />
                    <span>{t.scrollForMore}</span>
                  </div>
                )}
              </>
            )}

            <Button onClick={submitWord} disabled={submitting || (!isCustom && !selected) || (isCustom && !customInput.trim())}
              className="w-full h-12 bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 border-0 font-semibold">
              <Lock className="w-4 h-4 mr-2" />
              {submitting ? t.lockingIn : t.lockIn}
            </Button>
          </motion.div>
        ) : (
          <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
            className="text-center py-8 rounded-2xl bg-white/5 ring-1 ring-white/10">
            <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-lg font-semibold">{t.wordLockedIn}</p>
            <p className="text-slate-400 text-sm mt-1">{t.waitingForOthers}</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }} className="mt-6 space-y-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: p.color }}>{p.display_name[0].toUpperCase()}</div>
              <span className="flex-1 text-sm font-medium">{p.display_name}</span>
              {p.user_id === me?.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300">{t.you}</span>}
              {p.word_submitted
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Clock className="w-4 h-4 text-slate-500 animate-pulse" />}
            </div>
          ))}
        </motion.div>

        {isHost && allSubmitted && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="mt-6">
            <Button onClick={startPlaying}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0 font-semibold">
              {t.everyoneReady}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}