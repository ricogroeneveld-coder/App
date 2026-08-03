import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryQuestion, MysteryRoom, MysteryPlayer, MysteryChat } from '@/api/db';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Notebook from '@/components/mystery/Notebook';
import GuessModal from '@/components/mystery/GuessModal';
import ChatPanel from '@/components/mystery/ChatPanel';
import EmojiRain from '@/components/mystery/EmojiRain';
import { BookOpen, MessageCircleQuestion, HelpCircle, Trophy, Mic, Users, MessageCircle, Zap, Timer, Lightbulb, CheckCircle2, LogOut } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';
import { playAlert, playHint } from '@/lib/sounds';
import { getRandomQuestion } from '@/lib/questionBank';
import { useNavigate, useSearchParams } from 'react-router-dom';

const QUESTION_TIMER_SECONDS = 120;

export default function PlayingPhase({ room, players, questions, guesses, me, myPlayer, roomCode, reload }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'questions';
  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });
  const [showMyWord, setShowMyWord] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [submittingQ, setSubmittingQ] = useState(false);
  const [guessTarget, setGuessTarget] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [autoAsking, setAutoAsking] = useState(false);
  const timerRef = useRef(null);
  const [emojiRainEmote, setEmojiRainEmote] = useState(null);
  const [emojiRainTrigger, setEmojiRainTrigger] = useState(0);
  const [correctGuessAlert, setCorrectGuessAlert] = useState(null); // { guesserName, targetName, word }
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const prevGuessesRef = useRef(guesses);
  // Hint phase: every 5 rounds, track if hint submitted
  const [hintText, setHintText] = useState('');
  const [submittingHint, setSubmittingHint] = useState(false);

  const activePlayers = players.filter(p => !p.is_eliminated && !p.word_revealed);
  // Asking rotation includes word_revealed players (they can still ask and guess others)
  const askingPlayers = players.filter(p => !p.is_eliminated);
  const questioner = askingPlayers[room.current_questioner_index % Math.max(askingPlayers.length, 1)];

  const latestQuestion = questions[questions.length - 1];
  // Block asking until the current question is fully answered
  const currentQuestionPending = latestQuestion && latestQuestion.status === 'answering';
  const isMyTurnToAsk = questioner?.user_id === me?.id && !currentQuestionPending;

  // word_revealed players cannot answer questions (their word is known, irrelevant)
  const needsMyAnswer = latestQuestion &&
    latestQuestion.status === 'answering' &&
    latestQuestion.asker_id !== me?.id &&
    !(me?.id in (latestQuestion.answers || {})) &&
    !myPlayer?.is_eliminated &&
    !myPlayer?.word_revealed; // word_revealed players skip answering

  const isHost = room.host_id === me?.id;

  // Hint round: trigger after every 5 full rounds (each player asked once = askingPlayers.length questions per round)
  const normalQuestions = questions.filter(q => !q.question_text?.startsWith('[HINT]'));
  const lastNormalQ = normalQuestions[normalQuestions.length - 1];
  const lastQuestionComplete = !lastNormalQ || lastNormalQ.status === 'complete';
  const questionsPerRound = Math.max(askingPlayers.length, 1);
  const questionsPerHintCycle = questionsPerRound * 5; // hint after every 5 complete rounds
  const hintPhaseNumber = Math.floor(normalQuestions.length / questionsPerHintCycle);
  const isHintPhase = lastQuestionComplete && hintPhaseNumber > 0 && normalQuestions.length % questionsPerHintCycle === 0;
  // Check if current player already submitted hint for this phase
  const myHintSubmitted = questions.some(q =>
    q.question_text?.startsWith('[HINT]') &&
    q.asker_id === me?.id &&
    q.round_number === hintPhaseNumber
  );
  // All active players (non-eliminated, non-revealed) must submit hint before continuing
  const activePlayers2 = players.filter(p => !p.is_eliminated && !p.word_revealed);
  const allHintsSubmitted = isHintPhase && activePlayers2.every(p =>
    questions.some(q => q.question_text?.startsWith('[HINT]') && q.asker_id === p.user_id && q.round_number === hintPhaseNumber)
  );

  // Detect new correct guesses and show alert
  useEffect(() => {
    const prev = prevGuessesRef.current;
    const newCorrect = guesses.filter(g => g.correct && !prev.find(p => p.id === g.id));
    if (newCorrect.length > 0) {
      const g = newCorrect[0];
      const rawWord = players.find(p => p.user_id === g.target_player_id)?.secret_word || '?';
      setCorrectGuessAlert({ guesserName: g.guesser_name, targetName: g.target_player_name, word: toDisplayWord(rawWord, lang) });
      playAlert();
      setTimeout(() => setCorrectGuessAlert(null), 5000);
    }
    prevGuessesRef.current = guesses;
  }, [guesses]);

  // Question timer
  useEffect(() => {
    if (!isMyTurnToAsk) { setTimeLeft(null); return; }
    setTimeLeft(QUESTION_TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isMyTurnToAsk, room.current_questioner_index]);

  const handleAutoQuestion = async () => {
    if (autoAsking) return;
    setAutoAsking(true);
    try {
      const prevTexts = questions.slice(-8).map(q => q.question_text);
      // Picked locally from the static question bank — no server round-trip needed.
      const autoQ = getRandomQuestion(room.category, prevTexts) || 'Is it something you can hold in one hand?';
      await submitQuestionText(autoQ, true);
    } catch(e) {
      await submitQuestionText('Is it bigger than a cat?', true);
    } finally {
      setAutoAsking(false);
    }
  };

  const submitQuestionText = async (text, isAI = false) => {
    try {
      await MysteryQuestion.create({
        room_code: roomCode,
        round_number: room.round_number,
        question_text: text.trim(),
        asker_id: me.id,
        asker_name: myPlayer?.display_name,
        is_ai: isAI || false,
        answers: {},
        status: 'answering'
      });
      setQuestionText('');
      const nextIdx = (room.current_questioner_index + 1) % Math.max(askingPlayers.length, 1);
      await MysteryRoom.update(room.id, {
        round_number: room.round_number + 1,
        current_questioner_index: nextIdx
      });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const submitQuestion = async () => {
    if (!questionText.trim() || submittingQ) return;
    clearInterval(timerRef.current);
    setSubmittingQ(true);
    try {
      await submitQuestionText(questionText);
    } finally {
      setSubmittingQ(false);
    }
  };

  const skipToAutoQuestion = async () => {
    clearInterval(timerRef.current);
    setTimeLeft(0);
    await handleAutoQuestion();
  };

  const submitAnswer = async (qId, answer) => {
    setSubmittingAnswer(true);
    try {
      const q = questions.find(q => q.id === qId);
      const updated = { ...(q?.answers || {}), [me.id]: answer };
      const nonAskers = activePlayers.filter(p => p.user_id !== q?.asker_id);
      const allAnswered = nonAskers.every(p => updated[p.user_id] !== undefined);
      await MysteryQuestion.update(qId, {
        answers: updated,
        status: allAnswered ? 'complete' : 'answering'
      });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const submitHint = async () => {
    if (!hintText.trim() || submittingHint) return;
    setSubmittingHint(true);
    try {
      await MysteryQuestion.create({
        room_code: roomCode,
        round_number: hintPhaseNumber, // used to track which hint phase this belongs to
        question_text: `[HINT] ${hintText.trim()}`,
        asker_id: me.id,
        asker_name: myPlayer?.display_name,
        is_ai: false,
        answers: {},
        status: 'complete'
      });
      setHintText('');
      playHint();
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingHint(false);
    }
  };

  const leaveGame = async () => {
    try {
      if (myPlayer) {
        await MysteryPlayer.update(myPlayer.id, { is_eliminated: true });
        const remaining = players.filter(p => p.id !== myPlayer.id && !p.is_eliminated);
        if (remaining.length <= 1) {
          await MysteryRoom.update(room.id, { status: 'finished' });
        }
      }
      navigate('/');
    } catch(e) {
      navigate('/');
    }
  };

  const handleEmoteRain = (emote) => {
    setEmojiRainEmote(emote);
    setEmojiRainTrigger(t => t + 1);
  };

  useEffect(() => {
    const EMOTES = ['😂', '🔥', '👀', '💀', '🤔', '😱', '🎉', '👏', '😏', '🤯'];
    const unsub = MysteryChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_code === roomCode) {
        const emote = EMOTES.find(e => event.data.message?.includes(e));
        if (emote) handleEmoteRain(emote);
      }
    });
    return unsub;
  }, [roomCode]);

  const timerColor = timeLeft !== null && timeLeft <= 30 ? 'text-rose-400' : 'text-amber-400';

  // My previous guesses
  const myGuesses = guesses.filter(g => g.guesser_id === me?.id);

  // Guess cooldown — word_revealed players can also guess others
  const lastGuessAt = myPlayer?.last_guess_at_question_count || 0;
  const questionsNeeded = lastGuessAt + Math.max(activePlayers.length, 1);
  const canGuess = !myPlayer?.is_eliminated && !myPlayer?.word_revealed
    ? questions.length >= questionsNeeded
    : myPlayer?.word_revealed && !myPlayer?.is_eliminated && questions.length >= questionsNeeded;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <EmojiRain emote={emojiRainEmote} trigger={emojiRainTrigger} />

      {/* Correct guess alert */}
      <AnimatePresence>
        {correctGuessAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 max-w-xs w-[calc(100%-3rem)]"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              {t.correctGuessAlert(correctGuessAlert.guesserName, correctGuessAlert.targetName, correctGuessAlert.word)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/5">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="shrink-0 w-9 h-9 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-rose-500/15 hover:ring-rose-400/30 text-slate-400 hover:text-rose-400 transition flex items-center justify-center"
          title={t.leave}
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/5 ring-1 ring-white/10 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 leading-none">{t.categorie}</p>
          <p className="font-semibold text-violet-300 truncate text-sm leading-tight mt-0.5">{room.category}</p>
        </div>

        <button
          onClick={() => navigator.clipboard?.writeText(roomCode)}
          className="shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl bg-violet-500/10 ring-1 ring-violet-400/20 hover:bg-violet-500/20 transition"
          title={t.room}
        >
          <p className="text-[10px] uppercase tracking-wide text-violet-400/70 leading-none">{t.room}</p>
          <p className="font-bold font-mono tracking-[0.2em] text-violet-200 text-sm leading-tight mt-0.5">{roomCode}</p>
        </button>

        <button
          onClick={() => setShowMyWord(v => !v)}
          className="shrink-0 flex flex-col items-end px-3 py-1.5 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition min-w-[96px]"
          title={t.myWord}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500 leading-none">{t.myWord}</p>
          <p className="font-semibold text-violet-300 text-sm leading-tight mt-0.5 truncate max-w-[88px]">
            {showMyWord ? toDisplayWord(myPlayer?.secret_word, lang) : '••••••'}
          </p>
        </button>
      </div>

      {/* Leave confirmation */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-slate-900 ring-1 ring-white/10 rounded-2xl p-6 max-w-sm w-full">
              <p className="font-bold text-lg mb-2">Spel verlaten?</p>
              <p className="text-slate-400 text-sm mb-5">Je wordt als uitgeschakeld gemarkeerd.</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowLeaveConfirm(false)} variant="ghost" className="flex-1 border border-white/10">Annuleer</Button>
                <Button onClick={leaveGame} className="flex-1 bg-rose-500 hover:bg-rose-600 border-0">Verlaten</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}>
        {tab === 'questions' && (
          <div className="max-w-lg mx-auto space-y-4">

            {/* Dedicated hint round — blocks normal question UI until all hints submitted */}
            {isHintPhase && !allHintsSubmitted && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl bg-yellow-500/15 ring-2 ring-yellow-400/40 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  <p className="text-base font-bold text-yellow-300">{t.hintRound}</p>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{t.hintRoundSub}</p>
                {myHintSubmitted ? (
                  <div>
                    <p className="text-emerald-400 font-semibold text-sm mb-3">{t.hintSubmitted}</p>
                    <div className="space-y-1.5">
                      {activePlayers2.map(p => {
                        const submitted = questions.some(q => q.question_text?.startsWith('[HINT]') && q.asker_id === p.user_id && q.round_number === hintPhaseNumber);
                        return (
                          <div key={p.user_id} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            <span>{p.display_name}</span>
                            <span className="ml-auto">{submitted ? '✅' : '⏳'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : allHintsSubmitted ? (
                  <p className="text-emerald-400 font-semibold text-sm">{t.allHintsIn}</p>
                ) : myPlayer?.word_revealed && !myPlayer?.is_eliminated ? (
                  <p className="text-xs text-slate-400">{t.waitingForHints}</p>
                ) : !myPlayer?.is_eliminated ? (
                  <>
                    <p className="text-sm text-yellow-200 mb-3 font-medium">{t.giveHint}</p>
                    <div className="flex gap-2">
                      <input value={hintText} onChange={e => setHintText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitHint()}
                        placeholder={t.hintPlaceholder}
                        className="flex-1 h-10 px-3 rounded-xl bg-white/5 ring-1 ring-yellow-400/40 text-white placeholder:text-slate-500 text-base md:text-sm focus:outline-none focus:ring-yellow-400" />
                      <Button onClick={submitHint} disabled={submittingHint || !hintText.trim()}
                        className="h-10 px-4 bg-yellow-500 hover:bg-yellow-600 border-0 text-sm font-semibold">
                        {submittingHint ? '…' : t.share}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">{t.waitingForHints}</p>
                )}
              </motion.div>
            )}

            {/* All hints in — show nudge before resuming */}
            {isHintPhase && allHintsSubmitted && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/30 p-4 text-center">
                <p className="text-emerald-300 font-semibold text-sm">{t.allHintsSubmitted}</p>
              </motion.div>
            )}

            {/* Normal question UI — only shown when NOT in an active hint phase */}
            {(!isHintPhase || allHintsSubmitted) && (
              <>
                {/* Pending answer */}
                <AnimatePresence>
                  {needsMyAnswer && (
                    <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                      className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/30 p-4">
                      <p className="text-xs text-amber-400 font-medium mb-1">{t.answerThisQuestion}</p>
                      <p className="text-white font-semibold mb-3">"{latestQuestion.question_text}"</p>
                      <div className="flex gap-3">
                        <Button onClick={() => submitAnswer(latestQuestion.id, true)} disabled={submittingAnswer}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 border-0">{t.yes}</Button>
                        <Button onClick={() => submitAnswer(latestQuestion.id, false)} disabled={submittingAnswer}
                          className="flex-1 bg-rose-500 hover:bg-rose-600 border-0">{t.no}</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isMyTurnToAsk && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-violet-400" />
                        <p className="text-sm font-semibold text-violet-300">{t.yourTurnToAsk}</p>
                      </div>
                      {timeLeft !== null && timeLeft > 0 && (
                        <div className={`flex items-center gap-1 font-mono font-bold text-sm ${timerColor}`}>
                          <Timer className="w-3.5 h-3.5" />{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
                        </div>
                      )}
                      {timeLeft === 0 && <span className="text-xs text-rose-400 font-medium">{t.autoAsking}</span>}
                    </div>
                    <input value={questionText} onChange={e => setQuestionText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitQuestion()}
                      placeholder={t.askPlaceholder}
                      className="w-full h-10 px-3 rounded-xl bg-white/5 ring-1 ring-white/10 text-white placeholder:text-slate-500 text-base md:text-sm focus:outline-none focus:ring-violet-400 mb-3" />
                    <div className="flex gap-2">
                      <Button onClick={submitQuestion} disabled={submittingQ || !questionText.trim()}
                        className="flex-1 bg-violet-500 hover:bg-violet-600 border-0 text-sm h-9">
                        {t.askQuestion}
                      </Button>
                      <Button onClick={skipToAutoQuestion} disabled={autoAsking || submittingQ}
                        variant="ghost"
                        className="h-9 px-3 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs border border-white/10"
                        title={t.skipTitle}>
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {autoAsking ? '…' : t.skipToAI}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {!isMyTurnToAsk && !myPlayer?.is_eliminated && (
                  <div className="text-center text-sm text-slate-400 py-2">
                    {currentQuestionPending
                      ? `⏳ ${t.waitingForAnswers}`
                      : questioner ? t.isTurnToAsk(questioner.display_name) : ''}
                  </div>
                )}

                {/* Guess button — word_revealed players can still guess others */}
                {!myPlayer?.is_eliminated && !myPlayer?.word_revealed && (
                  <Button onClick={() => setGuessTarget('pick')} disabled={!canGuess}
                    className="w-full h-10 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/30 text-pink-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    {!canGuess ? t.guessIn(questionsNeeded - questions.length) : t.makeAGuess}
                  </Button>
                )}
                {myPlayer?.word_revealed && !myPlayer?.is_eliminated && (
                  <Button onClick={() => setGuessTarget('pick')} disabled={!canGuess}
                    className="w-full h-10 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/30 text-pink-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    {!canGuess ? t.guessIn(questionsNeeded - questions.length) : t.guessOthers}
                  </Button>
                )}
              </>
            )}

            <div className="space-y-3 mt-2">
              {[...questions].reverse().map(q => (
                <QuestionCard key={q.id} question={q} players={players} me={me} />
              ))}
            </div>
          </div>
        )}

        {tab === 'notebook' && (
          <Notebook players={players} questions={questions} guesses={guesses} me={me} myPlayer={myPlayer}
            onGuess={(p) => setGuessTarget(p)} roomCode={roomCode} reload={reload} />
        )}

        {tab === 'players' && (
          <div className="max-w-lg mx-auto space-y-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">{t.allPlayers}</p>
            {[...players].sort((a,b) => (b.score||0) - (a.score||0)).map((p, i) => {
              const isMe = p.user_id === me?.id;
              const isQuestioner = questioner?.user_id === p.user_id;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ring-1 transition
                  ${p.is_eliminated ? 'bg-white/3 ring-white/5 opacity-50' : isMe ? 'bg-violet-500/10 ring-violet-400/30' : 'bg-white/5 ring-white/5'}`}>
                  <span className="text-xs text-slate-500 w-4 text-center font-mono">{i+1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: p.color }}>{p.display_name[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.display_name}{isMe && <span className="ml-1 text-[10px] text-violet-400">({t.you.toLowerCase()})</span>}</p>
                    <p className="text-xs text-slate-500">
                      {p.word_revealed ? t.wordRevealed(toDisplayWord(p.secret_word, lang))
                        : p.is_eliminated ? t.eliminated
                        : isQuestioner ? t.askingNow
                        : t.active}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm font-bold text-amber-300">{p.score || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
            <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex bg-slate-950/95 backdrop-blur border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {[['questions', t.tabQuestions, MessageCircleQuestion],['notebook', t.tabNotebook, BookOpen],['players', t.tabPlayers, Users],['chat', t.tabChat, MessageCircle]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition ${tab === id ? 'text-violet-300' : 'text-slate-500'}`}>
            <Icon className={`w-5 h-5 ${tab === id ? 'text-violet-400' : ''}`} />
            {label}
          </button>
        ))}
      </div>



      {guessTarget && (
        <GuessModal
          target={guessTarget === 'pick' ? null : guessTarget}
          players={players}
          guesses={guesses}
          me={me}
          myPlayer={myPlayer}
          roomCode={roomCode}
          room={room}
          questions={questions}
          onClose={() => setGuessTarget(null)}
          reload={reload}
        />
      )}
    </div>
  );
}

function QuestionCard({ question, players, me }) {
  const { t } = useLang();
  const asker = players.find(p => p.user_id === question.asker_id);
  const totalAnswers = Object.keys(question.answers || {}).length;
  const nonAskerCount = players.filter(p => p.user_id !== question.asker_id && !p.is_eliminated && !p.word_revealed).length;

  // Hint card
  if (question.question_text?.startsWith('[HINT]')) {
    const hintContent = question.question_text.replace('[HINT] ', '');
    return (
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        className="rounded-xl bg-yellow-500/10 ring-1 ring-yellow-400/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-medium text-yellow-300">{t.theirHints.split(' ')[0]} {asker?.display_name || '?'}</span>
        </div>
        <p className="text-white text-sm font-medium">"{hintContent}"</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      className="rounded-xl bg-white/5 ring-1 ring-white/5 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-white">"{question.question_text}"</p>
          {question.is_ai && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30 font-medium">✨ Auto</span>
          )}
        </div>
        <div className="shrink-0">
          {question.status === 'complete'
            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{t.done}</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{totalAnswers}/{nonAskerCount}</span>}
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-3">{t.askedBy} {asker?.display_name || '?'}</p>
      {question.status === 'complete' && (
        <div className="flex flex-wrap gap-2">
          {players.filter(p => p.user_id !== question.asker_id).map(p => {
            const ans = question.answers?.[p.user_id];
            const isMe = p.user_id === me?.id;
            return (
              <div key={p.user_id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-xs">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className={isMe ? 'text-violet-300 font-medium' : 'text-slate-300'}>{isMe ? t.youShort : p.display_name}</span>
                <span>{ans === true ? '✅' : ans === false ? '❌' : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}