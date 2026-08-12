import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryQuestion, MysteryRoom, MysteryPlayer, gameRpc, rpcMissing } from '@/api/db';
import { serverNow } from '@/lib/serverTime';
import { track } from '@/lib/analytics';
import { notifyUser } from '@/lib/push';
import { breakStreakOnLeave } from '@/lib/playerProfile';
import { leaveRoom } from '@/lib/roomLifecycle';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Notebook from '@/components/mystery/Notebook';
import GuessModal from '@/components/mystery/GuessModal';
import ChatPanel from '@/components/mystery/ChatPanel';
import EmojiRain from '@/components/mystery/EmojiRain';
import RoomTabBar from '@/components/mystery/RoomTabBar';
import useUnreadChat from '@/components/mystery/useUnreadChat';
import { Dialog } from '@/components/ui/dialog';
import { BookOpen, MessageCircleQuestion, Trophy, Mic, Users, MessageCircle, Zap, Timer, Lightbulb, CheckCircle2, LogOut, Sparkles, X } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord, shortCategory } from '@/lib/wordLists';
import GameBackground from '@/components/GameBackground';
import { playAlert, playHint } from '@/lib/sounds';
import { vibrate } from '@/lib/haptics';
import { getRandomQuestion } from '@/lib/questionBank';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import PlayerCardModal from '@/components/progression/PlayerCardModal';
import BannerArt from '@/components/progression/BannerArt';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import { cosmeticById } from '@/lib/cosmetics';

const QUESTION_TIMER_SECONDS = 30;
// How long past the shared deadline other players wait before asking on the
// absent player's behalf, plus per-player stagger so at most one client
// usually fires (the create is double-checked against fresh room state too).
const ENFORCE_GRACE_MS = 6000;
const ENFORCE_STAGGER_MS = 4000;
const MAX_QUESTION_LENGTH = 200;
const MAX_HINT_LENGTH = 120;
// How long a question may wait on answers before any client force-completes it
// so an absent (backgrounded / dropped) answerer can't freeze the room (STUCK-1).
const ANSWER_TIMER_MS = 45000;
// How long the hint round waits before an awake client fills in placeholder
// hints for absent players, so one backgrounded player can't freeze the whole
// game during a hint break (GAME-N1) — the hint-phase analogue of ANSWER_TIMER_MS.
const HINT_TIMER_MS = 60000;

// If a turn's shared deadline is already this close to expiring when the asker
// first actually sees the turn (they were backgrounded / still loading when it
// started — most commonly on the very first turn, whose deadline is minted at
// game start), give them one fresh timer. Otherwise they return to 3 seconds
// left, or to an auto-question already posted in their name. Granted at most
// ONCE per turn, so it can't be farmed by backgrounding repeatedly.
const MIN_TURN_SECONDS = 12;

const nextDeadline = () => new Date(serverNow() + QUESTION_TIMER_SECONDS * 1000).toISOString();

// The next asker's user_id after `fromId` in the given (join-ordered) asking
// roster — used to advance the turn by identity, not by a positional index
// into a changing array (GAME-1).
const nextAskerId = (fromId, askers) => {
  const sorted = [...askers].sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
  if (!sorted.length) return null;
  const i = sorted.findIndex(p => p.user_id === fromId);
  return sorted[(i + 1) % sorted.length]?.user_id || sorted[0].user_id;
};

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
  // Latches the one-per-turn fresh-timer grant (see MIN_TURN_SECONDS).
  const turnGraceRef = useRef('');
  // Single in-flight guard for posting a question (GAME-4): the manual "Ask"
  // path and the timer/auto path share it, so a tap landing on the same tick
  // the timer expires can't post two questions / double-advance the turn.
  const postingRef = useRef(false);
  const [emojiRainEmote, setEmojiRainEmote] = useState(null);
  const [emojiRainTrigger, setEmojiRainTrigger] = useState(0);
  const [correctGuessAlert, setCorrectGuessAlert] = useState(null); // { guesserName, targetName, word }
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // First-ever timer-driven auto-question: a dismissible banner, not a
  // toast — a toast fires and vanishes on its own timer, so a player who
  // wasn't staring at the screen right at that second never saw it at all.
  const [showAutoQuestionHint, setShowAutoQuestionHint] = useState(false);
  const prevGuessesRef = useRef(guesses);
  // Hint phase: every 5 rounds, track if hint submitted
  const [hintText, setHintText] = useState('');
  const [submittingHint, setSubmittingHint] = useState(false);
  const [cardPlayer, setCardPlayer] = useState(null);
  const profiles = usePeerProfiles(players);
  const activePlayers = players.filter(p => !p.is_eliminated && !p.word_revealed);
  // Asking rotation includes word_revealed players (they can still ask and guess
  // others). Ordered by join time and keyed by user_id — NOT by a positional
  // index into this shrinking array (GAME-1) — so an elimination or a join can't
  // silently hand someone else the current turn.
  const askingPlayers = [...players.filter(p => !p.is_eliminated)]
    .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
  const questioner = askingPlayers.find(p => p.user_id === room.current_questioner_id)
    // Fallback for legacy rooms created before current_questioner_id existed.
    || askingPlayers[room.current_questioner_index % Math.max(askingPlayers.length, 1)];

  const latestQuestion = questions[questions.length - 1];
  // "Pending" is derived from the LIVE roster, never trusted from the stored
  // status alone: if the last unanswered player leaves mid-question, the row
  // stays 'answering' forever and the stored flag would soft-lock the whole
  // game (nobody could ever ask again).
  const latestNonAskers = latestQuestion
    ? activePlayers.filter(p => p.user_id !== latestQuestion.asker_id)
    : [];
  const latestAllAnswered = !!latestQuestion &&
    latestNonAskers.every(p => (latestQuestion.answers || {})[p.user_id] !== undefined);
  const currentQuestionPending = latestQuestion && latestQuestion.status === 'answering' && !latestAllAnswered;
  const isMyTurnToAsk = questioner?.user_id === me?.id && !currentQuestionPending;

  // Heal the stored status too (idempotent — every client writes the same
  // value) so the question history and other derived checks agree.
  useEffect(() => {
    if (latestQuestion?.status === 'answering' && latestAllAnswered) {
      MysteryQuestion.update(latestQuestion.id, { status: 'complete' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuestion?.id, latestQuestion?.status, latestAllAnswered]);

  // word_revealed players cannot answer questions (their word is known, irrelevant)
  const needsMyAnswer = latestQuestion &&
    latestQuestion.status === 'answering' &&
    latestQuestion.asker_id !== me?.id &&
    !(me?.id in (latestQuestion.answers || {})) &&
    !myPlayer?.is_eliminated &&
    !myPlayer?.word_revealed; // word_revealed players skip answering


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
      vibrate(30);
      setTimeout(() => setCorrectGuessAlert(null), 5000);
    }
    prevGuessesRef.current = guesses;
  }, [guesses]);

  // Question timer — driven by the SHARED deadline stored on the room
  // (room.question_deadline), not a device-local countdown. The absent-player
  // problem: iOS freezes the webview the moment the current asker backgrounds
  // the app, so a local-only timer can never fire exactly when it's needed
  // most. With the deadline in the room row, this client counts down against
  // it, and every OTHER client can enforce it too (see the enforcement effect
  // below).
  const inHintBreak = isHintPhase && !allHintsSubmitted;
  useEffect(() => {
    if (!isMyTurnToAsk || inHintBreak) { setTimeLeft(null); return; }
    const deadlineMs = room.question_deadline ? new Date(room.question_deadline).getTime() : null;
    // Missing or stale deadline (older room, resume after a hint break where
    // nobody refreshed it): my turn, so my client claims a fresh one. The
    // room update re-runs this effect with the real value.
    //
    // Also claim one when barely any time is left: the deadline starts running
    // the moment the turn begins, whether or not the asker's app is awake, so a
    // player who was backgrounded (or was still loading into the playing screen
    // after word entry — the first turn's deadline is minted at game start)
    // would come back to a few seconds. One grant per turn, latched below.
    const turnKey = `${room.current_questioner_id || room.current_questioner_index}:${questions.length}`;
    const tooLittleLeft = deadlineMs && deadlineMs - serverNow() < MIN_TURN_SECONDS * 1000;
    if (!deadlineMs || deadlineMs <= serverNow() || (tooLittleLeft && turnGraceRef.current !== turnKey)) {
      if (tooLittleLeft) turnGraceRef.current = turnKey;
      MysteryRoom.update(room.id, { question_deadline: nextDeadline() }).catch(() => {});
      setTimeLeft(QUESTION_TIMER_SECONDS);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadlineMs - serverNow()) / 1000));
      setTimeLeft(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current);
        handleAutoQuestion(true);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurnToAsk, inHintBreak, room.current_questioner_id, room.current_questioner_index, room.question_deadline]);

  // Deadline enforcement by everyone else: if the asker's device is asleep,
  // the first awake client asks on their behalf once the deadline is
  // comfortably past. Staggered per player so at most one usually fires; the
  // fresh-state re-check before writing closes the rest of the race.
  const enforcedKeyRef = useRef('');
  useEffect(() => {
    if (room.status !== 'playing') return;
    const iv = setInterval(() => {
      if (!room.question_deadline || currentQuestionPending || inHintBreak) return;
      if (!questioner || !me?.id || questioner.user_id === me.id) return;
      const rank = askingPlayers.filter(p => p.user_id !== questioner.user_id)
        .findIndex(p => p.user_id === me.id);
      if (rank < 0) return;
      const fireAt = new Date(room.question_deadline).getTime() + ENFORCE_GRACE_MS + rank * ENFORCE_STAGGER_MS;
      if (serverNow() < fireAt) return;
      const key = `${room.current_questioner_id || room.current_questioner_index}:${questions.length}`;
      if (enforcedKeyRef.current === key) return;
      enforcedKeyRef.current = key;
      enforceStalledTurn(key);
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, questions, players, me?.id, currentQuestionPending, inHintBreak]);

  const enforceStalledTurn = async (key) => {
    let done = false;
    try {
      // Re-check against fresh state — the asker may have just submitted, or
      // another enforcer may have beaten us to it. Derive the questioner and
      // the next turn from the FRESH roster (GAME-1), not stale props.
      const [freshRooms, freshQs, freshPlayers] = await Promise.all([
        MysteryRoom.filter({ room_code: roomCode }),
        MysteryQuestion.filter({ room_code: roomCode }),
        MysteryPlayer.filter({ room_code: roomCode }),
      ]);
      const fr = freshRooms?.[0];
      if (!fr || fr.status !== 'playing') return;
      const freshAskers = (freshPlayers || []).filter(p => !p.is_eliminated);
      const currentId = fr.current_questioner_id
        || freshAskers[fr.current_questioner_index % Math.max(freshAskers.length, 1)]?.user_id;
      // Someone already advanced the turn, or a new question landed — stand down.
      if (currentId !== (room.current_questioner_id || questioner?.user_id)) return;
      if ((freshQs?.length || 0) > questions.length) return;
      const asker = freshAskers.find(p => p.user_id === currentId) || questioner;
      if (!asker) return;
      const prevTexts = (freshQs || []).slice(-8).map(q => q.question_text);
      // Room language, not this device's: in a mixed Dutch/English room an
      // auto-question generated in the asker's language is unreadable to half
      // the players, and it's stored as plain text so it never re-translates.
      const autoQ = getRandomQuestion(fr.category, prevTexts, fr.language || lang);
      // Atomic post + turn-advance under a server row lock (migration 0017):
      // two enforcers passing the fresh-state check in the same window can no
      // longer both insert — the second gets 'stale'/'not_your_turn' back.
      const { data, error } = await gameRpc('post_mystery_question', {
        p_room: roomCode, p_asker: asker.user_id, p_text: autoQ,
        p_is_ai: true, p_known_count: (freshQs || []).length,
      });
      if (error) {
        if (!rpcMissing(error)) throw error;
        // Pre-0017 fallback: the original two-step client write.
        await MysteryQuestion.create({
          room_code: roomCode,
          round_number: fr.round_number,
          question_text: autoQ,
          asker_id: asker.user_id,
          asker_name: asker.display_name,
          is_ai: true,
          answers: {},
          status: 'answering'
        });
        const nextId = nextAskerId(asker.user_id, freshAskers);
        await MysteryRoom.update(fr.id, {
          round_number: fr.round_number + 1,
          current_questioner_id: nextId,
          current_questioner_index: (fr.current_questioner_index + 1) % Math.max(freshAskers.length, 1),
          question_deadline: nextDeadline(),
        });
      }
      // ok:false (someone beat us to it) still counts as done — stand down.
      void data;
      done = true;
    } catch { /* fall through: release the latch so a later tick can retry */ }
    finally {
      // Only keep the one-shot latch if we actually advanced; a failed write
      // must be retryable instead of permanently disarming this client (GAME-5).
      if (!done && enforcedKeyRef.current === key) enforcedKeyRef.current = '';
    }
  };

  // Answer-freeze breaker (STUCK-1): the turn-deadline machinery above only
  // covers an absent ASKER. If a non-asker backgrounds their phone mid-question
  // it would otherwise wait on their answer forever. Once a question has been
  // waiting past ANSWER_TIMER_MS (+ the same staggered grace so only one client
  // usually fires), force it complete server-side; missing answers simply don't
  // become clues. currentQuestionPending then clears and the game proceeds.
  const answerEnforcedRef = useRef('');
  useEffect(() => {
    if (room.status !== 'playing' || inHintBreak) return;
    const iv = setInterval(() => {
      const q = questions[questions.length - 1];
      if (!q || q.status !== 'answering') return;
      if (!currentQuestionPending) return;
      if (!me?.id) return;
      // Stagger among the players who still need to answer (plus the asker),
      // so a whole room doesn't fire at once.
      const waiters = activePlayers.filter(p => p.user_id !== q.asker_id);
      const rank = waiters.findIndex(p => p.user_id === me.id);
      const myRank = rank < 0 ? waiters.length : rank;
      const startedAt = q.created_date ? new Date(q.created_date).getTime() : serverNow();
      const fireAt = startedAt + ANSWER_TIMER_MS + ENFORCE_GRACE_MS + myRank * ENFORCE_STAGGER_MS;
      if (serverNow() < fireAt) return;
      if (answerEnforcedRef.current === q.id) return;
      answerEnforcedRef.current = q.id;
      Promise.resolve(gameRpc('resolve_stalled_question', { p_question_id: q.id }))
        .then(({ error }) => { if (error) answerEnforcedRef.current = ''; })
        .catch(() => { answerEnforcedRef.current = ''; });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, inHintBreak, questions, activePlayers, currentQuestionPending, me?.id]);

  // Hint-freeze breaker (GAME-N1): the hint round blocks all play until every
  // active player submits a hint, and — unlike every other phase — had no
  // timeout. One backgrounded player there froze the whole room until the 2h
  // cron. Once the break has been open past HINT_TIMER_MS (+ staggered grace so
  // one client usually fires), an awake client fills placeholder hints for the
  // players who haven't submitted; the break then clears and asking resumes.
  const hintEnforcedRef = useRef('');
  useEffect(() => {
    if (room.status !== 'playing' || !inHintBreak || !me?.id) return;
    const breakStart = lastNormalQ?.updated_date ? new Date(lastNormalQ.updated_date).getTime()
      : lastNormalQ?.created_date ? new Date(lastNormalQ.created_date).getTime() : serverNow();
    const iv = setInterval(() => {
      const rank = activePlayers2.findIndex(p => p.user_id === me.id);
      const myRank = rank < 0 ? activePlayers2.length : rank;
      const fireAt = breakStart + HINT_TIMER_MS + ENFORCE_GRACE_MS + myRank * ENFORCE_STAGGER_MS;
      if (serverNow() < fireAt) return;
      const key = String(hintPhaseNumber);
      if (hintEnforcedRef.current === key) return;
      hintEnforcedRef.current = key;
      enforceStalledHints(key);
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, inHintBreak, hintPhaseNumber, lastNormalQ, activePlayers2, me?.id]);

  const enforceStalledHints = async (key) => {
    let done = false;
    try {
      const [freshQs, freshPlayers] = await Promise.all([
        MysteryQuestion.filter({ room_code: roomCode }),
        MysteryPlayer.filter({ room_code: roomCode }),
      ]);
      const active = (freshPlayers || []).filter(p => !p.is_eliminated && !p.word_revealed);
      // Fill only for OTHERS, never for myself. I'm demonstrably present (I'm
      // the one enforcing), so if I haven't submitted yet I'm probably still
      // typing — stubbing my own hint with "—" would throw away what I wrote
      // and leave me with two hint rows once I hit send. The break simply stays
      // open until I submit, which is correct: I can act, the absent player can't.
      const missing = active.filter(p => p.user_id !== me.id && !(freshQs || []).some(q =>
        q.question_text?.startsWith('[HINT]') && q.asker_id === p.user_id && Number(q.round_number) === hintPhaseNumber));
      if (!missing.length) { done = true; return; }
      await Promise.all(missing.map(p => MysteryQuestion.create({
        room_code: roomCode,
        round_number: hintPhaseNumber,
        question_text: '[HINT] —',
        asker_id: p.user_id,
        asker_name: p.display_name,
        is_ai: true,
        answers: {},
        status: 'complete',
      })));
      // Asking resumes now — give the next asker a fresh turn deadline.
      await MysteryRoom.update(room.id, { question_deadline: nextDeadline() }).catch(() => {});
      done = true;
    } catch { /* release the latch so a later tick can retry (GAME-5 pattern) */ }
    finally {
      if (!done && hintEnforcedRef.current === key) hintEnforcedRef.current = '';
    }
  };

  // Turn-holder left mid-turn (GAME-N3): current_questioner_id points at a player
  // who is no longer in the asking roster, so the positional fallback shows
  // *some* present player "your turn" — but submitQuestionText's fresh check
  // compares against the stale stored id and silently drops their question. The
  // derived fallback claims the turn for real by writing current_questioner_id,
  // so their Ask works instead of vanishing into a ~30–70s void.
  useEffect(() => {
    if (room.status !== 'playing' || inHintBreak) return;
    if (!room.current_questioner_id || !me?.id) return;
    if (askingPlayers.some(p => p.user_id === room.current_questioner_id)) return;
    if (!questioner || questioner.user_id !== me.id) return;
    MysteryRoom.update(room.id, {
      current_questioner_id: questioner.user_id,
      question_deadline: nextDeadline(),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.current_questioner_id, inHintBreak, askingPlayers, me?.id]);

  const handleAutoQuestion = async (isTimeout = false) => {
    if (autoAsking) return;
    setAutoAsking(true);
    // First time the timer (not a manual skip) auto-asks for a player, they
    // have no way to know why a question they didn't write just appeared —
    // explain it once, ever, with a banner that stays until dismissed
    // (a toast here would auto-dismiss before someone who stepped away
    // ever saw it).
    if (isTimeout) {
      try {
        if (!localStorage.getItem('wmp_seen_auto_question_hint')) {
          localStorage.setItem('wmp_seen_auto_question_hint', '1');
          setShowAutoQuestionHint(true);
        }
      } catch { /* ignore */ }
    }
    try {
      const prevTexts = questions.slice(-8).map(q => q.question_text);
      // Picked locally from the static question bank — no server round-trip
      // needed. `lang` selects the Dutch bank in NL games (LOC-2).
      const autoQ = getRandomQuestion(room.category, prevTexts, room.language || lang);
      await submitQuestionText(autoQ, true);
    } finally {
      setAutoAsking(false);
    }
  };

  const submitQuestionText = async (text, isAI = false) => {
    if (postingRef.current) return;
    postingRef.current = true;
    try {
      // Atomic post + turn-advance under a server row lock (migration 0017):
      // the RPC re-checks turn ownership, the pending question, and the
      // question count (p_known_count) so a device waking after the deadline
      // can't double-post or double-advance against a racing enforcer (GAME-4).
      const { data, error } = await gameRpc('post_mystery_question', {
        p_room: roomCode, p_asker: me.id,
        p_text: text.trim().slice(0, MAX_QUESTION_LENGTH),
        p_is_ai: isAI || false, p_known_count: questions.length,
      });
      if (error) {
        if (!rpcMissing(error)) throw error;
        // Pre-0017 fallback: fresh-state re-check + the two-step client write.
        const [freshRooms, freshQs] = await Promise.all([
          MysteryRoom.filter({ room_code: roomCode }),
          MysteryQuestion.filter({ room_code: roomCode }),
        ]);
        const fr = freshRooms?.[0];
        if (!fr || fr.status !== 'playing') return;
        const currentId = fr.current_questioner_id
          || askingPlayers[fr.current_questioner_index % Math.max(askingPlayers.length, 1)]?.user_id;
        if (currentId !== me.id) return;
        if ((freshQs?.length || 0) > questions.length) return;
        await MysteryQuestion.create({
          room_code: roomCode,
          round_number: fr.round_number,
          question_text: text.trim().slice(0, MAX_QUESTION_LENGTH),
          asker_id: me.id,
          asker_name: myPlayer?.display_name,
          is_ai: isAI || false,
          answers: {},
          status: 'answering'
        });
        const nextId = nextAskerId(me.id, askingPlayers);
        await MysteryRoom.update(fr.id, {
          round_number: fr.round_number + 1,
          // Advance by identity so eliminations/joins can't skip or repeat a turn.
          current_questioner_id: nextId,
          current_questioner_index: (fr.current_questioner_index + 1) % Math.max(askingPlayers.length, 1),
          // Next asker's shared deadline — see the timer/enforcement effects.
          question_deadline: nextDeadline()
        });
      } else if (data && data.ok === false) {
        // Turn already moved on / a newer question landed — same silent
        // stand-down as the old fresh-state bail.
        return;
      }
      setQuestionText('');
      // Nudge the next asker back into the app if they've stepped away (no-op
      // until APNs is configured, and never for ourselves).
      const nextId = nextAskerId(me.id, askingPlayers);
      if (nextId && nextId !== me.id) notifyUser(nextId, 'turn');
      track('question_asked', { auto: !!isAI });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      postingRef.current = false;
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
      // Atomic server-side merge (migration 0006): the old client-side
      // read-modify-write lost one of two simultaneous answers. Falls back
      // to the legacy merge if the RPC hasn't been deployed.
      const { error } = await gameRpc('submit_mystery_answer', {
        q_id: qId, answerer_id: me.id, answer,
      });
      if (error) {
        // Only fall back to the legacy client-side merge when the RPC genuinely
        // isn't deployed. On ANY other error (5xx/timeout — where the RPC may
        // even have succeeded) the old merge would overwrite the whole answers
        // map with stale local data and erase other players' answers, exactly
        // the lost-update bug migration 0006 fixed (GAME-2).
        const missing = error.code === 'PGRST202' || error.code === '42883'
          || /does not exist|could not find the function/i.test(error.message || '');
        if (!missing) throw error;
        const q = questions.find(q => q.id === qId);
        const updated = { ...(q?.answers || {}), [me.id]: answer };
        const nonAskers = activePlayers.filter(p => p.user_id !== q?.asker_id);
        const allAnswered = nonAskers.every(p => updated[p.user_id] !== undefined);
        await MysteryQuestion.update(qId, {
          answers: updated,
          status: allAnswered ? 'complete' : 'answering'
        });
      }
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const submitHint = async () => {
    if (!hintText.trim() || submittingHint) return;
    setSubmittingHint(true);
    try {
      // Am I the last hint outstanding? Then asking resumes right after this
      // submit — refresh the shared turn deadline so the next asker gets a
      // full timer instead of one that expired during the hint break.
      const lastOutstanding = activePlayers2.every(p =>
        p.user_id === me.id ||
        questions.some(q => q.question_text?.startsWith('[HINT]') && q.asker_id === p.user_id && q.round_number === hintPhaseNumber)
      );
      await MysteryQuestion.create({
        room_code: roomCode,
        round_number: hintPhaseNumber, // used to track which hint phase this belongs to
        question_text: `[HINT] ${hintText.trim().slice(0, MAX_HINT_LENGTH)}`,
        asker_id: me.id,
        asker_name: myPlayer?.display_name,
        is_ai: false,
        answers: {},
        status: 'complete'
      });
      if (lastOutstanding) {
        MysteryRoom.update(room.id, { question_deadline: nextDeadline() }).catch(() => {});
      }
      setHintText('');
      playHint();
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingHint(false);
    }
  };

  const leaveGame = async () => {
    // ECON-9: forfeit the win streak on a live-match rage quit — but not for
    // a practice match, which never counts toward the streak either way.
    if (!roomCode?.startsWith('BOT')) breakStreakOnLeave();
    try {
      if (myPlayer) {
        const remaining = players.filter(p => p.id !== myPlayer.id && !p.is_eliminated);
        await leaveRoom({ room, players, me, myPlayer, mode: 'eliminate' });
        if (remaining.length <= 1) {
          // The server re-checks the finish condition, so this can't force-finish
          // a room that still has players in play (migration 0012).
          await MysteryRoom.setStatus(roomCode, 'playing', 'finished');
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

  // Unread badge + chat-driven emote rain — the shared per-room hook, so the
  // count carries across phase transitions instead of resetting.
  const unreadChat = useUnreadChat(roomCode, me?.id, tab === 'chat', handleEmoteRain);

  // A tactile nudge when the game needs YOU — your turn to ask, or a
  // question waiting on your yes/no. Fires only on the false→true edge.
  useEffect(() => { if (isMyTurnToAsk) vibrate(30); }, [isMyTurnToAsk]);
  useEffect(() => { if (needsMyAnswer) vibrate(20); }, [needsMyAnswer]);

  // Was "<= 30" from when the full timer was 120s (a real last-third
  // warning); now that the timer itself is 30s, that threshold would make
  // it red from the very first tick — 10s keeps it a genuine final-stretch
  // warning instead.
  const timerColor = timeLeft !== null && timeLeft <= 10 ? 'text-rose-400' : 'text-amber-400';

  // My previous guesses

  // Guess cooldown — word_revealed players can also guess others
  const lastGuessAt = myPlayer?.last_guess_at_question_count || 0;
  const questionsNeeded = lastGuessAt + Math.max(activePlayers.length, 1);
  const canGuess = !myPlayer?.is_eliminated && !myPlayer?.word_revealed
    ? questions.length >= questionsNeeded
    : myPlayer?.word_revealed && !myPlayer?.is_eliminated && questions.length >= questionsNeeded;

  return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col relative"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <GameBackground />
      <EmojiRain emote={emojiRainEmote} trigger={emojiRainTrigger} />

      {/* Correct guess alert */}
      <AnimatePresence>
        {correctGuessAlert && (
          /* Centering lives on this wrapper — framer's inline transform on the
             card (scale animation) would overwrite a CSS translate centering */
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="pointer-events-auto bg-gradient-to-b from-emerald-400 to-emerald-700 text-white px-4 py-3 rounded-2xl ring-1 ring-emerald-300/50 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6),0_0_20px_-4px_rgba(52,211,153,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] flex items-center gap-2 max-w-xs w-full"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">
                {t.correctGuessAlert(correctGuessAlert.guesserName, correctGuessAlert.targetName, correctGuessAlert.word)}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header — width by importance: Category > My Word > Room (compact)
          > back (fixed). My Word never truncates by default: the type scales
          down with length and may wrap to two lines; ellipsis only kicks in
          past that. */}
      {(() => {
        // My own word lives in localStorage (SEC-1 keeps it off the player row
        // until reveal); fall back to the row's value once I've been revealed.
        let myOwnWord = myPlayer?.secret_word || '';
        if (!myOwnWord) { try { myOwnWord = localStorage.getItem(`wmp_myword_${roomCode}`) || ''; } catch { /* ignore */ } }
        const myWord = showMyWord ? (toDisplayWord(myOwnWord, lang) || '—') : '••••••';
        const myWordSize = !showMyWord || myWord.length <= 8 ? 'text-sm'
          : myWord.length <= 14 ? 'text-xs'
          : myWord.length <= 20 ? 'text-[11px]'
          : 'text-[10px]';
        // Hidden, the pill hugs its content (just the label and dots);
        // revealed, the word becomes the most important thing on screen and
        // takes the wider flexible share until it's hidden again.
        const catFlex = showMyWord ? 'flex-[4]' : 'flex-1';
        const wordFlex = showMyWord ? 'flex-[5] min-w-[92px]' : 'shrink-0';
        return (
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-b from-white/[0.07] to-black/20 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-rose-500/15 hover:ring-rose-400/30 text-slate-400 hover:text-rose-400 transition flex items-center justify-center active:scale-[0.98]"
          title={t.leave} aria-label={t.leave}
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className={`${catFlex} min-w-0 self-stretch flex flex-col justify-center px-3 py-1.5 rounded-xl bg-gradient-to-b from-white/[0.06] to-black/[0.12] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">{t.categorie}</p>
          <p className="font-bold text-violet-300 truncate text-sm leading-tight mt-0.5">{shortCategory(room.category)}</p>
        </div>

        <button
          onClick={() => { navigator.clipboard?.writeText(roomCode).then(() => toast({ title: t.linkCopied })).catch(() => {}); }}
          className="shrink-0 self-stretch flex flex-col items-center justify-center px-2 rounded-xl bg-violet-500/10 ring-1 ring-violet-400/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-violet-500/20 transition active:scale-[0.98]"
          title={t.room} aria-label={t.room}
        >
          <p className="text-[10px] uppercase tracking-wide text-violet-400/70 leading-none">{t.room}</p>
          <p className="font-bold font-mono tracking-[0.12em] text-violet-200 text-xs leading-tight mt-0.5">{roomCode}</p>
        </button>

        <button
          onClick={() => setShowMyWord(v => !v)}
          className={`${wordFlex} self-stretch flex flex-col items-end justify-center px-2.5 py-1 rounded-xl bg-gradient-to-b from-white/[0.06] to-black/[0.12] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 transition active:scale-[0.98]`}
          title={t.myWord} aria-label={t.myWord}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">{t.myWord}</p>
          <p className={`font-bold text-violet-300 ${myWordSize} leading-[1.15] mt-0.5 text-right w-full`}
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'break-word' }}>
            {myWord}
          </p>
        </button>
      </div>
        );
      })()}

      {/* Leave confirmation */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <Dialog onClose={() => setShowLeaveConfirm(false)} titleId="playing-leave-title"
            panelClassName="glass-card bg-slate-900/95 p-5 max-w-sm">
            <p id="playing-leave-title" className="font-extrabold text-lg mb-1">{t.leaveQuestion}</p>
            <p className="text-slate-400 text-sm mb-4">{t.leaveBody}</p>
            <div className="flex gap-2.5">
              <Button onClick={() => setShowLeaveConfirm(false)} variant="ghost" className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">{t.cancel}</Button>
              <Button onClick={leaveGame} className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 border-0 font-bold">{t.leave}</Button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <div
        className={`flex-1 min-h-0 p-4 ${tab === 'chat' || tab === 'questions' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto hide-scrollbar'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        {tab === 'questions' && (
          <div className="flex flex-col flex-1 min-h-0 w-full max-w-lg mx-auto">
            {/* Transient cards stack on top; the history frame below them
                fills the remaining height and scrolls internally */}
            <div className="flex-1 min-h-0 flex flex-col gap-3 pb-2">

            {/* First-ever auto-question explainer — stays until dismissed,
                not timed, so stepping away for a moment can't make it
                disappear unseen. */}
            {showAutoQuestionHint && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
                className="flex items-start gap-2.5 rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/30 p-3">
                <Sparkles className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                <p className="flex-1 text-xs font-medium text-violet-200">{t.autoQuestionExplainer}</p>
                <button onClick={() => setShowAutoQuestionHint(false)} aria-label={t.gotIt}
                  className="shrink-0 p-1 -m-1 rounded-lg text-violet-300/70 hover:text-white hover:bg-white/10 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Dedicated hint round — blocks normal question UI until all hints submitted */}
            {isHintPhase && !allHintsSubmitted && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl bg-yellow-500/15 ring-2 ring-yellow-400/40 p-5">
                <p className="text-base font-bold text-yellow-300 mb-1">{t.hintRound}</p>
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
                      <input value={hintText} onChange={e => setHintText(e.target.value.slice(0, MAX_HINT_LENGTH))}
                        onKeyDown={e => e.key === 'Enter' && submitHint()}
                        placeholder={t.hintPlaceholder} enterKeyHint="send" maxLength={MAX_HINT_LENGTH}
                        className="inset-input flex-1 h-10 px-3 text-base md:text-sm" />
                      <Button onClick={submitHint} disabled={submittingHint || !hintText.trim()}
                        className="h-10 px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 hover:brightness-110 border-0 text-sm font-bold text-[#2c1500] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_-2px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all">
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
                          className="flex-1 h-11 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 hover:brightness-110 border-0 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_-2px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all">{t.yes}</Button>
                        <Button onClick={() => submitAnswer(latestQuestion.id, false)} disabled={submittingAnswer}
                          className="flex-1 h-11 rounded-xl bg-gradient-to-b from-rose-400 to-rose-700 hover:brightness-110 border-0 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_-2px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all">{t.no}</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </>
            )}

            {/* Question history — its own frame, scrolls internally */}
            <div className="glass-card flex-1 min-h-0 p-2.5 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar space-y-2" style={{ overscrollBehaviorY: 'contain' }}>
                {/* Hints live in the notebook (per player), not in the
                    question history — mixing them in here read as clutter. */}
                {normalQuestions.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">{t.noQuestionsYet}</p>
                )}
                {[...normalQuestions].reverse().map(q => (
                  <QuestionCard key={q.id} question={q} players={players} me={me} />
                ))}
              </div>
            </div>
            </div>

            {/* Bottom action panel — pinned in the thumb zone above the tab
                bar. Read above, type/ask/guess here. */}
            {(!isHintPhase || allHintsSubmitted) && (
              <div className="shrink-0 pt-2 space-y-2">
                {isMyTurnToAsk && (
                  <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                    className="rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/30 p-3">
                    <div className="flex items-center justify-between mb-2">
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
                    <input value={questionText} onChange={e => setQuestionText(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                      onKeyDown={e => e.key === 'Enter' && submitQuestion()}
                      placeholder={t.askPlaceholder} enterKeyHint="send" maxLength={MAX_QUESTION_LENGTH}
                      className="inset-input w-full h-10 px-3 text-base md:text-sm mb-2" />
                    <div className="flex gap-2">
                      <Button onClick={submitQuestion} disabled={submittingQ || !questionText.trim()}
                        className="violet-solid-btn flex-1 h-10 border-0 bg-transparent hover:bg-transparent text-sm font-bold">
                        {t.askQuestion}
                      </Button>
                      <Button onClick={skipToAutoQuestion} disabled={autoAsking || submittingQ}
                        variant="ghost"
                        className="h-10 px-3 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs border border-white/10"
                        title={t.skipTitle}>
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {autoAsking ? '…' : t.skipToAI}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {!isMyTurnToAsk && !myPlayer?.is_eliminated && (
                  <div className="text-center text-xs text-slate-400 font-medium">
                    {currentQuestionPending
                      ? `⏳ ${t.waitingForAnswers}`
                      : questioner ? t.isTurnToAsk(questioner.display_name) : ''}
                  </div>
                )}

                {/* Guess — word_revealed players can still guess others */}
                {!myPlayer?.is_eliminated && (
                  <Button onClick={() => setGuessTarget('pick')} disabled={!canGuess}
                    className="w-full h-11 rounded-xl bg-gradient-to-b from-pink-500/25 to-pink-900/25 hover:from-pink-500/35 hover:to-pink-900/30 border border-pink-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_-2px_rgba(236,72,153,0.35)] text-pink-200 font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {!canGuess ? t.guessIn(questionsNeeded - questions.length)
                      : myPlayer?.word_revealed ? t.guessOthers : t.makeAGuess}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'notebook' && (
          <Notebook players={players} questions={questions} guesses={guesses} me={me} myPlayer={myPlayer} />
        )}

        {tab === 'players' && (
          <div className="max-w-lg mx-auto space-y-2">
            <p className="section-label mb-2.5">{t.allPlayers}</p>
            {[...players].sort((a,b) => (b.score||0) - (a.score||0)).map((p, i) => {
              const isMe = p.user_id === me?.id;
              const isQuestioner = questioner?.user_id === p.user_id;
              return (
                <div key={p.id} onClick={() => setCardPlayer(p)} role="button" tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setCardPlayer(p)}
                  className={`relative overflow-hidden flex items-center gap-2.5 px-3 py-2 rounded-xl ring-1 transition cursor-pointer active:scale-[0.98]
                  ${p.is_eliminated ? 'bg-white/3 ring-white/5 opacity-50' : isMe ? 'bg-violet-500/10 ring-violet-400/30' : 'bg-white/5 ring-white/5'}`}>
                  {!p.is_eliminated && profiles[p.user_id] && cosmeticById(profiles[p.user_id].equipped?.banner) && (
                    <>
                      <BannerArt banner={cosmeticById(profiles[p.user_id].equipped?.banner)} className="absolute inset-0" motifScale={0.65} />
                      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/50" />
                    </>
                  )}
                  <span className="relative text-xs text-slate-400 w-4 text-center font-mono">{i+1}</span>
                  <PlayerAvatar profile={profiles[p.user_id]} name={p.display_name} color={p.color} size={28} className="relative" />
                  <div className="relative flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${(profiles[p.user_id] && cosmeticById(profiles[p.user_id].equipped?.nameColor)?.cls) || ''}`}>{p.display_name}{isMe && <span className="ml-1 text-[10px] text-violet-400">({t.you.toLowerCase()})</span>}</p>
                    <p className="text-xs text-slate-400">
                      {p.word_revealed ? t.wordRevealed(toDisplayWord(p.secret_word, lang))
                        : p.is_eliminated ? t.eliminated
                        : isQuestioner ? t.askingNow
                        : t.active}
                    </p>
                  </div>
                  <div className="relative flex items-center gap-1 shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm font-bold text-amber-300">{p.score || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col flex-1 min-h-0 w-full max-w-lg mx-auto">
            <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
          </div>
        )}
      </div>

      {/* Bottom tab bar — the shared RoomTabBar, so all four phases render
          the identical bar (this file used to carry its own copy). */}
      <RoomTabBar
        active={tab}
        onChange={setTab}
        items={[
          { id: 'questions', label: t.tabQuestions, icon: MessageCircleQuestion },
          { id: 'notebook', label: t.tabNotebook, icon: BookOpen },
          { id: 'players', label: t.tabPlayers, icon: Users },
          { id: 'chat', label: t.tabChat, icon: MessageCircle, badge: unreadChat },
        ]}
      />


      {guessTarget && (
        <GuessModal
          target={guessTarget === 'pick' ? null : guessTarget}
          players={players}
          guesses={guesses}
          me={me}
          myPlayer={myPlayer}
          roomCode={roomCode}
          room={room}
          onClose={() => setGuessTarget(null)}
          reload={reload}
        />
      )}

      {cardPlayer && (
        <PlayerCardModal player={cardPlayer} profile={profiles[cardPlayer.user_id]} meId={me?.id} roomCode={roomCode} onClose={() => setCardPlayer(null)} />
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
        className="rounded-xl bg-yellow-500/10 ring-1 ring-yellow-400/20 p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[11px] font-medium text-yellow-300">{t.theirHints.split(' ')[0]} {asker?.display_name || '?'}</span>
        </div>
        <p className="text-white text-sm font-medium">"{hintContent}"</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      className="rounded-xl bg-white/5 ring-1 ring-white/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <p className="text-[11px] text-slate-500 truncate">
          {t.askedBy} {asker?.display_name || '?'}
          {question.is_ai && <span className="ml-1.5 text-violet-400">✨ Auto</span>}
        </p>
        <div className="shrink-0">
          {question.status === 'complete'
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{t.done}</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{totalAnswers}/{nonAskerCount}</span>}
        </div>
      </div>
      <p className="font-medium text-sm text-white">"{question.question_text}"</p>
      {question.status === 'complete' && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {players.filter(p => p.user_id !== question.asker_id).map(p => {
            const ans = question.answers?.[p.user_id];
            const isMe = p.user_id === me?.id;
            return (
              <div key={p.user_id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/5 text-[11px]">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className={isMe ? 'text-violet-300 font-medium' : 'text-slate-300'}>{isMe ? t.youShort : p.display_name}</span>
                <span aria-label={ans === true ? t.answerYes : ans === false ? t.answerNo : undefined}>{ans === true ? '✅' : ans === false ? '❌' : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}