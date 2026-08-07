import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MysteryGuess, MysteryPlayer, MysteryRoom } from '@/api/db';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { X, Check, XCircle } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';
import { playCorrect, playWrong } from '@/lib/sounds';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';

export default function GuessModal({ target, players, guesses, me, myPlayer, roomCode, room, questions, onClose, reload }) {
  const { toast } = useToast();
  const { t, lang } = useLang();
  const profiles = usePeerProfiles(players);
  const [selectedTarget, setSelectedTarget] = useState(target);
  const [guessWord, setGuessWord] = useState('');
  const [result, setResult] = useState(null); // 'correct' | 'wrong'
  const [submitting, setSubmitting] = useState(false);

  const guessableOpponents = players.filter(p => {
    if (p.user_id === me?.id) return false;
    if (p.is_eliminated || p.word_revealed) return false;
    const alreadyGuessedCorrectly = guesses.find(g => g.guesser_id === me?.id && g.target_player_id === p.user_id && g.correct);
    return !alreadyGuessedCorrectly;
  });

  const submitGuess = async () => {
    if (!selectedTarget || !guessWord.trim()) return;
    setSubmitting(true);
    try {
      const isCorrect = guessWord.trim().toLowerCase() === selectedTarget.secret_word?.toLowerCase();
      await MysteryGuess.create({
        room_code: roomCode,
        guesser_id: me.id,
        guesser_name: myPlayer?.display_name,
        target_player_id: selectedTarget.user_id,
        target_player_name: selectedTarget.display_name,
        guessed_word: guessWord.trim(),
        correct: isCorrect
      });

      // Consume the guess chance on submit (regardless of correct/wrong)
      if (myPlayer) await MysteryPlayer.update(myPlayer.id, { last_guess_at_question_count: questions.length });

      if (isCorrect) {
        await Promise.all([
          MysteryPlayer.update(selectedTarget.id, { word_revealed: true }),
          MysteryPlayer.update(myPlayer.id, { score: (myPlayer.score || 0) + 1 })
        ]);
        setResult('correct');
        playCorrect();

        const updatedPlayers = players.map(p => {
          if (p.id === selectedTarget.id) return { ...p, word_revealed: true };
          if (p.id === myPlayer.id) return { ...p, score: (p.score || 0) + 1 };
          return p;
        });
        const stillActive = updatedPlayers.filter(p => !p.is_eliminated && !p.word_revealed);
        if (stillActive.length <= 1) {
          const rooms = await MysteryRoom.filter({ room_code: roomCode });
          if (rooms?.[0]) await MysteryRoom.update(rooms[0].id, { status: 'finished' });
        }
      } else {
        setResult('wrong');
        playWrong();
      }
      await reload();
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Previous wrong guesses for selected target (by me)
  const myWrongGuesses = selectedTarget
    ? guesses.filter(g => g.guesser_id === me?.id && g.target_player_id === selectedTarget.user_id && !g.correct).map(g => g.guessed_word)
    : [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:40 }}
        className="glass-card w-full max-w-md bg-slate-900/95 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{t.makeAGuessTitle}</h3>
          <button onClick={onClose} className="p-2.5 -m-1 rounded-xl hover:bg-white/10" aria-label={t.close}><X className="w-5 h-5" /></button>
        </div>

        {result === 'correct' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-400">{t.correct}</p>
            <p className="text-slate-400 mt-1">{t.guessedWord(selectedTarget?.display_name)}</p>
            <p className="text-2xl font-bold mt-2">{toDisplayWord(selectedTarget?.secret_word, lang)}</p>
            <p className="text-sm text-amber-400 mt-3">{t.plusOnePoint}</p>
            <Button onClick={onClose} className="mt-5 w-full h-11 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 hover:brightness-110 border-0 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_-2px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all">{t.continueBtn}</Button>
          </div>
        ) : result === 'wrong' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-xl font-bold text-rose-400">{t.wrongGuess}</p>
            <p className="text-slate-400 mt-1">{t.notTheirWord(selectedTarget?.display_name)}</p>
            <Button onClick={onClose} className="mt-5 w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold active:scale-[0.98] transition-all">{t.close}</Button>
          </div>
        ) : (
          <>
            {!selectedTarget ? (
              <div className="space-y-2 mb-4">
                <p className="text-sm text-slate-400 mb-3">{t.whoToGuess}</p>
                {guessableOpponents.length === 0 ? (
                  <p className="text-center text-slate-400 py-4">{t.noOneLeft}</p>
                ) : guessableOpponents.map(p => (
                  <button key={p.id} onClick={() => setSelectedTarget(p)}
                    className="glass-tile w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition text-left active:scale-[0.98]">
                    <PlayerAvatar profile={profiles[p.user_id]} name={p.display_name} color={p.color} size={28} />
                    <span className="font-medium">{p.display_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="glass-tile flex items-center gap-2.5 px-3 py-2">
                  <PlayerAvatar profile={profiles[selectedTarget.user_id]} name={selectedTarget.display_name} color={selectedTarget.color} size={28} />
                  <div className="flex-1">
                    <p className="font-medium">{selectedTarget.display_name}</p>
                    <p className="text-xs text-slate-400">{t.categorie}: {room.category}</p>
                  </div>
                  <button onClick={() => { setSelectedTarget(null); setGuessWord(''); }} aria-label={t.close}
                    className="ml-auto p-2 -m-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Word selection from category + free type */}
                <WordSelector
                  category={room.category}
                  value={guessWord}
                  onChange={setGuessWord}
                  wrongGuesses={myWrongGuesses}
                />

                {myWrongGuesses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {myWrongGuesses.map(w => (
                      <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 ring-1 ring-rose-400/20 line-through">{w}</span>
                    ))}
                  </div>
                )}

                <Button onClick={submitGuess} disabled={submitting || !guessWord.trim()}
                  className="violet-solid-btn w-full h-11 border-0 bg-transparent hover:bg-transparent font-bold">
                  {submitting ? t.submitting : t.submitGuess}
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

// Word selector: shows a searchable list from the category word list + free type
import { WORD_LISTS, WORD_LISTS_NL, PREMIUM_WORD_LISTS } from '@/lib/wordLists';
import { Search } from 'lucide-react';
import { useMemo } from 'react';

function WordSelector({ category, value, onChange, wrongGuesses }) {
  const { t, lang } = useLang();
  const [search, setSearch] = React.useState('');
  const wordListEn = WORD_LISTS[category] || PREMIUM_WORD_LISTS[category] || [];
  const wordListNl = lang === 'nl' ? (WORD_LISTS_NL[category] || wordListEn) : wordListEn;
  const wordList = wordListNl;
  // Map Dutch display word → English stored word
  const nlToEn = lang === 'nl' && WORD_LISTS_NL[category]
    ? Object.fromEntries((WORD_LISTS_NL[category] || []).map((w, i) => [w, wordListEn[i] || w]))
    : null;

  const toStored = (w) => (nlToEn ? (nlToEn[w] || w) : w);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return wordList.filter(w => !wrongGuesses.includes(toStored(w)) && w.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordList, search, wrongGuesses]);

  const showList = wordList.length > 0;

  return (
    <div className="space-y-2">
      {showList && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => {
              const q = e.target.value;
              setSearch(q);
              // Typing only FILTERS the list — it never becomes the guess
              // itself. The guess is set by tapping a word below (or typing
              // one out exactly), so a half-typed search can never be
              // submitted as a guaranteed-wrong guess.
              const exact = wordList.find(w => !wrongGuesses.includes(toStored(w)) && w.toLowerCase() === q.trim().toLowerCase());
              onChange(exact ? toStored(exact) : '');
            }}
            placeholder={t.searchOrType} enterKeyHint="done"
            className="inset-input w-full h-10 pl-9 pr-4 text-base md:text-sm"
          />
        </div>
      )}
      {!showList && (
        <input value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
          placeholder={t.whatIsTheirWord} enterKeyHint="done"
          className="inset-input w-full h-12 px-4 text-base md:text-sm" />
      )}
      {showList && filtered.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl bg-white/5 ring-1 ring-white/10 p-2 grid grid-cols-2 gap-1">
          {filtered.map(w => (
            <button key={w} onClick={() => { onChange(toStored(w)); setSearch(w); }}
              className={`text-left px-2.5 py-2 rounded-lg text-sm transition ${value === toStored(w) ? 'bg-violet-500 text-white font-medium' : 'text-slate-300 hover:bg-white/10'}`}>
              {w}
            </button>
          ))}
        </div>
      )}
      {showList && !value && filtered.length > 0 && (
        <p className="text-xs text-slate-500 text-center">{t.tapWordToGuess}</p>
      )}
      {showList && search && filtered.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">{t.noMatch(search)}</p>
      )}
    </div>
  );
}