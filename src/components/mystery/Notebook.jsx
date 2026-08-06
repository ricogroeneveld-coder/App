import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trophy, Lightbulb } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';

export default function Notebook({ players, questions, guesses, me, myPlayer }) {
  const { t, lang } = useLang();
  const opponents = players.filter(p => p.user_id !== me?.id);
  const [pageIdx, setPageIdx] = useState(0);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) setPageIdx(i => Math.min(opponents.length - 1, i + 1));
      else setPageIdx(i => Math.max(0, i - 1));
    }
    touchStartX.current = null;
  };

  if (!opponents.length) return (
    <div className="text-center text-slate-400 py-12">{t.noOpponents}</div>
  );

  const target = opponents[pageIdx];
  const isEliminated = target?.is_eliminated || target?.word_revealed;
  const correctGuess = guesses.find(g => g.target_player_id === target?.user_id && g.correct);

  // Build clue table for this target (exclude hint questions and questions asked by the target)
  const completedQs = questions.filter(q =>
    q.status === 'complete' &&
    q.asker_id !== target?.user_id &&
    !q.question_text?.startsWith('[HINT]')
  );
  const targetAnswers = completedQs.map(q => ({
    question: q.question_text,
    answer: q.answers?.[target?.user_id]
  })).filter(c => c.answer !== undefined);

  // Hints submitted by this target player
  const targetHints = questions.filter(q =>
    q.question_text?.startsWith('[HINT]') && q.asker_id === target?.user_id
  ).map(q => q.question_text.replace('[HINT] ', ''));

  // My guesses against this target
  const myGuessesForTarget = guesses.filter(g => g.guesser_id === me?.id && g.target_player_id === target?.user_id);

  return (
    <div className="max-w-lg mx-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Player tabs */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setPageIdx(Math.max(0, pageIdx-1))} disabled={pageIdx === 0}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-b from-white/[0.07] to-black/20 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 disabled:opacity-30 transition active:scale-[0.98]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: target.color }}>
              {target.display_name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{target.display_name}</p>
              <p className="text-xs text-slate-400">{pageIdx+1} / {opponents.length}</p>
            </div>
            {isEliminated && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
          </div>
        </div>
        <button onClick={() => setPageIdx(Math.min(opponents.length-1, pageIdx+1))} disabled={pageIdx >= opponents.length-1}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-b from-white/[0.07] to-black/20 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 disabled:opacity-30 transition active:scale-[0.98]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mb-5">
        {opponents.map((_,i) => (
          <button key={i} onClick={() => setPageIdx(i)} className="p-1.5 -m-0.5 flex items-center justify-center">
            <span className={`w-2 h-2 rounded-full transition ${i === pageIdx ? 'bg-violet-400' : 'bg-white/20'}`} />
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={target.id} initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
          transition={{ duration: 0.2 }} className="space-y-4">

          {isEliminated && correctGuess && (
            <div className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/30 p-4 text-center">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="font-semibold text-emerald-300">{t.wordRevealedLabel}</p>
              <p className="text-2xl font-bold mt-1">{toDisplayWord(target.secret_word, lang)}</p>
              <p className="text-xs text-slate-400 mt-1">{t.guessedBy(correctGuess.guesser_name)}</p>
            </div>
          )}

          {/* Hints from this player */}
          {targetHints.length > 0 && (
            <div className="rounded-xl bg-yellow-500/10 ring-1 ring-yellow-400/20 p-3">
              <p className="text-[11px] text-yellow-400 font-extrabold uppercase tracking-[0.14em] mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> {t.theirHints}
              </p>
              <div className="space-y-1.5">
                {targetHints.map((hint, i) => (
                  <p key={i} className="text-sm text-yellow-100 italic">"{hint}"</p>
                ))}
              </div>
            </div>
          )}

          {/* My guesses for this player */}
          {myGuessesForTarget.length > 0 && (
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
              <p className="section-label mb-2">{t.myGuesses}</p>
              <div className="space-y-1.5">
                {myGuessesForTarget.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{g.correct ? '✅' : '❌'}</span>
                    <span className={g.correct ? 'text-emerald-400 font-semibold' : 'text-rose-400 line-through text-slate-400'}>{toDisplayWord(g.guessed_word, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clue table */}
          {targetAnswers.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">
              {t.noClues}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="section-label">{t.clues}</p>
              {targetAnswers.map((clue, i) => (
                <motion.div key={i} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.03 }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5">
                  <p className="text-sm text-slate-300 flex-1">{clue.question}</p>
                  <span className="text-sm font-semibold shrink-0">{clue.answer ? t.answerYes : t.answerNo}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}