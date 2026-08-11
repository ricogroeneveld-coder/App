import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Target, Bot, Search } from 'lucide-react';
import GameBackground from '@/components/GameBackground';
import { useLang } from '@/lib/LanguageContext';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { shortCategory, CATEGORY_EMOJIS } from '@/lib/wordLists';
import { playCorrect, playWrong, playPop } from '@/lib/sounds';
import { vibrate, hapticSuccess, hapticError } from '@/lib/haptics';
import {
  WORDS, QUESTIONS, PRACTICE_CATEGORY, displayWord, questionById,
  makeCommit, answerFor, filterCandidates, pickBotQuestion, maybeBotGuess,
  botForgets, randomBotName,
} from '@/lib/practice/householdBot';

const rand = (min, max) => min + Math.floor(Math.random() * (max - min));

// Local practice match vs a bot (prototype: Household Objects only).
// Fully offline — no Supabase room, no rewards, nothing leaves the device.
export default function PracticeGame() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const myName = getGuestIdentity().name || t.playerFallback;

  const [phase, setPhase] = useState('setup'); // setup | play | end
  const [difficulty, setDifficulty] = useState('normal');
  const [myWord, setMyWord] = useState(null);
  const [setupSearch, setSetupSearch] = useState('');
  const [botName, setBotName] = useState(randomBotName);
  const [botWord, setBotWord] = useState(null);
  // me: my turn (ask or guess) · botAnswering/botThinking/botGuessing: bot
  // delays for feel · answerBot: I owe a yes/no about my own word.
  const [turn, setTurn] = useState('me');
  const [log, setLog] = useState([]);
  const [askedByMe, setAskedByMe] = useState([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [guessMode, setGuessMode] = useState(false);
  const [guessSearch, setGuessSearch] = useState('');
  const [cooldown, setCooldown] = useState(0); // questions to ask before I may guess again
  const [showMyWord, setShowMyWord] = useState(false);
  const [result, setResult] = useState(null); // win | lose
  const [finalCandidates, setFinalCandidates] = useState(0);

  // The bot's brain lives in refs: timeout callbacks must always see the
  // current state, not the render they were scheduled in.
  const commitRef = useRef({});
  const candidatesRef = useRef(WORDS);
  const askedByBotRef = useRef([]);
  const pendingBotQ = useRef(null);
  const myWordRef = useRef(null);
  const botWordRef = useRef(null);
  const timeoutsRef = useRef([]);

  const after = (ms, fn) => { timeoutsRef.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, turn]);

  const startGame = () => {
    if (!myWord) return;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    setBotWord(word);
    botWordRef.current = word;
    commitRef.current = makeCommit(word);
    candidatesRef.current = WORDS;
    askedByBotRef.current = [];
    myWordRef.current = myWord;
    setLog([]);
    setAskedByMe([]);
    setCooldown(0);
    setResult(null);
    setTurn('me');
    setPhase('play');
  };

  const endGame = (res) => {
    setResult(res);
    setFinalCandidates(candidatesRef.current.length);
    setPhase('end');
  };

  const askQuestion = (question) => {
    if (turn !== 'me') return;
    setQuestionSearch('');
    setAskedByMe(ids => [...ids, question.id]);
    setCooldown(c => Math.max(0, c - 1));
    setLog(l => [...l, { kind: 'q', who: 'me', qid: question.id, answer: null }]);
    setTurn('botAnswering');
    after(rand(900, 1900), () => {
      const yes = answerFor(botWordRef.current, question.id, commitRef.current);
      playPop(); vibrate(20);
      setLog(l => l.map((e, i) => (i === l.length - 1 ? { ...e, answer: yes ? 'yes' : 'no' } : e)));
      after(rand(700, 1400), botTurn);
    });
  };

  const botTurn = () => {
    const guessWord = maybeBotGuess(candidatesRef.current, difficulty);
    if (guessWord) {
      setTurn('botGuessing');
      after(rand(1200, 2200), () => {
        const correct = guessWord === myWordRef.current;
        setLog(l => [...l, { kind: 'guess', who: 'bot', word: guessWord, correct }]);
        if (correct) {
          playWrong(); hapticError();
          after(1400, () => endGame('lose'));
        } else {
          candidatesRef.current = candidatesRef.current.filter(w => w !== guessWord);
          vibrate(20);
          after(rand(900, 1600), botAsk);
        }
      });
      return;
    }
    botAsk();
  };

  const botAsk = () => {
    const question = pickBotQuestion(candidatesRef.current, askedByBotRef.current, difficulty);
    if (!question) { setTurn('me'); return; } // bank exhausted — hand the turn back
    askedByBotRef.current = [...askedByBotRef.current, question.id];
    pendingBotQ.current = question;
    setTurn('botThinking');
    after(rand(900, 1800), () => {
      playPop();
      setLog(l => [...l, { kind: 'q', who: 'bot', qid: question.id, answer: null }]);
      setTurn('answerBot');
    });
  };

  const answerBot = (yes) => {
    if (turn !== 'answerBot' || !pendingBotQ.current) return;
    const question = pendingBotQ.current;
    pendingBotQ.current = null;
    setLog(l => l.map((e, i) => (i === l.length - 1 ? { ...e, answer: yes ? 'yes' : 'no' } : e)));
    if (!botForgets(difficulty)) {
      candidatesRef.current = filterCandidates(candidatesRef.current, question.id, yes);
    }
    setTurn('me');
  };

  const makeGuess = (word) => {
    setGuessMode(false);
    setGuessSearch('');
    const correct = word === botWordRef.current;
    setLog(l => [...l, { kind: 'guess', who: 'me', word, correct }]);
    if (correct) {
      playCorrect(); hapticSuccess();
      after(1200, () => endGame('win'));
    } else {
      playWrong(); hapticError();
      setCooldown(2);
      setTurn('botAnswering'); // my turn is spent
      after(rand(900, 1600), botTurn);
    }
  };

  const catLabel = `${CATEGORY_EMOJIS[PRACTICE_CATEGORY] || '🏠'} ${shortCategory(PRACTICE_CATEGORY)}`;

  // ── Setup ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const filtered = WORDS.filter(w =>
      displayWord(w, lang).toLowerCase().includes(setupSearch.trim().toLowerCase()));
    return (
      <div className="h-dvh text-white flex flex-col overflow-hidden relative"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
        <GameBackground />
        <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/')} className="header-btn" aria-label={t.practiceExit}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight leading-tight">🤖 {t.practiceMode}</h1>
              <p className="text-xs text-slate-400 leading-tight">{catLabel} · {t.practiceNoRewards}</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-3">{t.practiceSubtitle}</p>

          <p className="section-label mb-1.5">{t.practiceDifficulty}</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['easy', 'normal', 'hard'].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`h-11 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.97] ${
                  difficulty === d
                    ? 'bg-violet-500/30 ring-2 ring-violet-400/70 text-white'
                    : 'bg-white/5 ring-1 ring-white/15 text-slate-300 hover:ring-white/30'}`}>
                {d === 'easy' ? t.practiceEasy : d === 'normal' ? t.practiceNormal : t.practiceHard}
              </button>
            ))}
          </div>

          <p className="section-label mb-1.5">{t.practicePickWord}</p>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
            <input value={setupSearch} onChange={e => setSetupSearch(e.target.value)}
              placeholder={t.search(shortCategory(PRACTICE_CATEGORY))} aria-label={t.practicePickWord}
              autoCorrect="off" spellCheck={false}
              className="inset-input w-full h-11 rounded-xl pl-9 pr-3 text-base" />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
            <div className="grid grid-cols-3 gap-1.5 pb-2">
              {filtered.map(w => (
                <button key={w} onClick={() => setMyWord(w)}
                  className={`min-h-11 px-1.5 py-2 rounded-xl text-[12px] font-semibold leading-tight transition-all duration-100 active:scale-[0.97] ${
                    myWord === w
                      ? 'bg-amber-400/25 ring-2 ring-amber-300/80 text-amber-100'
                      : 'bg-white/5 ring-1 ring-white/12 text-slate-200 hover:ring-white/30'}`}>
                  {displayWord(w, lang)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} disabled={!myWord}
            className="gold-btn w-full h-14 rounded-2xl mt-3 flex items-center justify-center disabled:opacity-50">
            <span className="relative text-lg font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
              {myWord ? `${t.practiceStart} — ${displayWord(myWord, lang)}` : t.pickWordFirst}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── End ──────────────────────────────────────────────────────────────────
  if (phase === 'end') {
    return (
      <div className="h-dvh text-white flex items-center justify-center p-4 overflow-hidden relative"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
        <GameBackground spotlight />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 glass-card w-full max-w-sm bg-slate-900/95 p-6 text-center">
          <div className="text-5xl mb-2">{result === 'win' ? '🏆' : '🤖'}</div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">
            {result === 'win' ? t.youWin : t.practiceLose}
          </h1>
          <p className="text-sm text-slate-300 mb-1">{t.practiceBotWordWas(displayWord(botWord, lang))}</p>
          <p className="text-xs text-slate-400 mb-5">{t.practiceNarrowed(finalCandidates)}</p>
          <p className="text-[11px] text-slate-500 mb-4">{t.practiceNoRewards}</p>
          <button onClick={() => { setPhase('setup'); setMyWord(null); setBotName(randomBotName()); }}
            className="gold-btn w-full h-12 rounded-2xl flex items-center justify-center mb-2.5">
            <span className="relative font-extrabold text-[#2c1500]">{t.practiceAgain}</span>
          </button>
          <button onClick={() => navigate('/')} className="violet-solid-btn w-full h-11 text-sm">
            {t.practiceExit}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Play ─────────────────────────────────────────────────────────────────
  const openQuestions = QUESTIONS.filter(question => !askedByMe.includes(question.id));
  const visibleQuestions = openQuestions.filter(question =>
    question[lang === 'nl' ? 'nl' : 'en'].toLowerCase().includes(questionSearch.trim().toLowerCase()));
  const guessWords = WORDS.filter(w =>
    displayWord(w, lang).toLowerCase().includes(guessSearch.trim().toLowerCase()));
  const botBusy = turn === 'botAnswering' || turn === 'botThinking' || turn === 'botGuessing';

  return (
    <div className="h-dvh text-white flex flex-col overflow-hidden relative"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
      <GameBackground />
      <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-md mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <button onClick={() => navigate('/')} className="header-btn" aria-label={t.practiceExit}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/35 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-violet-300" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight truncate">{botName}</p>
            <p className="text-[11px] text-slate-400 leading-tight">{catLabel}</p>
          </div>
          <button onClick={() => setShowMyWord(v => !v)}
            className="h-11 px-3 rounded-xl bg-white/5 ring-1 ring-white/15 flex items-center gap-1.5 text-xs font-bold text-slate-200 active:scale-[0.97]"
            aria-label={t.myWord}>
            {showMyWord ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
            {showMyWord ? displayWord(myWord, lang) : t.myWord}
          </button>
        </div>

        {/* Q&A log */}
        <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 py-2" aria-live="polite">
          {log.length === 0 && (
            <p className="text-center text-sm text-slate-400 pt-8">{t.yourTurnToAsk}</p>
          )}
          {log.map((entry, i) => {
            const mine = entry.who === 'me';
            const name = mine ? myName : botName;
            if (entry.kind === 'guess') {
              return (
                <div key={i} className={`glass-tile p-2.5 text-sm ${entry.correct ? 'ring-1 ring-amber-300/60' : ''}`}>
                  <span className="font-bold">{name}</span>{' '}
                  <Target className="inline w-3.5 h-3.5 text-amber-300 -mt-0.5" aria-hidden />{' '}
                  {t.practiceGuessLine(displayWord(entry.word, lang))}{' '}
                  <span className={entry.correct ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                    {entry.correct ? t.practiceGuessRight : t.practiceGuessWrongShort}
                  </span>
                </div>
              );
            }
            const question = questionById(entry.qid);
            return (
              <div key={i} className="glass-tile p-2.5 text-sm">
                <p className="text-[11px] font-bold text-slate-400 mb-0.5">{mine ? myName : t.practiceBotAsks(botName)}</p>
                <p className="text-slate-100">{question[lang === 'nl' ? 'nl' : 'en']}</p>
                <p className="mt-0.5 font-bold">
                  {entry.answer === null
                    ? <span className="text-slate-500">…</span>
                    : entry.answer === 'yes' ? t.yes : t.no}
                </p>
              </div>
            );
          })}
          {turn === 'botThinking' && <p className="text-center text-xs text-slate-400">{t.practiceBotThinking(botName)}</p>}
          {turn === 'botGuessing' && <p className="text-center text-xs text-amber-300 font-bold">{t.practiceBotGuessIntro(botName)}</p>}
        </div>

        {/* Action area */}
        {turn === 'answerBot' && (
          <div className="pt-2">
            <p className="text-center text-xs font-bold text-slate-300 mb-2">{t.practiceAnswerHonestly}</p>
            <div className="grid grid-cols-2 gap-2.5 pb-1">
              <button onClick={() => answerBot(true)} className="h-14 rounded-2xl bg-emerald-500/20 ring-2 ring-emerald-400/60 text-lg font-extrabold active:scale-[0.97]">{t.yes}</button>
              <button onClick={() => answerBot(false)} className="h-14 rounded-2xl bg-rose-500/20 ring-2 ring-rose-400/60 text-lg font-extrabold active:scale-[0.97]">{t.no}</button>
            </div>
          </div>
        )}

        {turn === 'me' && !guessMode && (
          <div className="pt-1">
            <div className="relative mb-1.5">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
              <input value={questionSearch} onChange={e => setQuestionSearch(e.target.value)}
                placeholder={t.practiceSearchQuestions} aria-label={t.practiceSearchQuestions}
                autoCorrect="off" spellCheck={false}
                className="inset-input w-full h-11 rounded-xl pl-9 pr-3 text-base" />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 mb-2">
              {visibleQuestions.map(question => (
                <button key={question.id} onClick={() => askQuestion(question)}
                  className="w-full min-h-11 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/12 text-left text-sm text-slate-100 hover:ring-violet-400/50 active:scale-[0.99]">
                  {question[lang === 'nl' ? 'nl' : 'en']}
                </button>
              ))}
              {visibleQuestions.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-3">{t.noMatch(questionSearch)}</p>
              )}
            </div>
            <button onClick={() => setGuessMode(true)} disabled={cooldown > 0}
              className="gold-btn w-full h-12 rounded-2xl flex items-center justify-center disabled:opacity-50 mb-1">
              <span className="relative font-extrabold text-[#2c1500]">
                🎯 {cooldown > 0 ? t.guessIn(cooldown) : t.practiceMakeGuess}
              </span>
            </button>
          </div>
        )}

        {turn === 'me' && guessMode && (
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                <input value={guessSearch} onChange={e => setGuessSearch(e.target.value)} autoFocus
                  placeholder={t.search(shortCategory(PRACTICE_CATEGORY))} aria-label={t.practiceMakeGuess}
                  autoCorrect="off" spellCheck={false}
                  className="inset-input w-full h-11 rounded-xl pl-9 pr-3 text-base" />
              </div>
              <button onClick={() => { setGuessMode(false); setGuessSearch(''); }}
                className="h-11 px-3 rounded-xl bg-white/5 ring-1 ring-white/15 text-sm font-bold text-slate-300 active:scale-[0.97]">
                {t.cancel}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1.5 pb-1">
                {guessWords.map(w => (
                  <button key={w} onClick={() => makeGuess(w)}
                    className="min-h-11 px-1.5 py-2 rounded-xl bg-amber-400/10 ring-1 ring-amber-300/30 text-[12px] font-semibold leading-tight text-amber-100 hover:ring-amber-300/70 active:scale-[0.97]">
                    {displayWord(w, lang)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {botBusy && turn !== 'botGuessing' && turn !== 'botThinking' && (
          <p className="text-center text-xs text-slate-500 py-3">{t.practiceBotThinking(botName)}</p>
        )}
      </div>
    </div>
  );
}
