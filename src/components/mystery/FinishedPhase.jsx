import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { MysteryPlayer, MysteryQuestion, MysteryGuess, MysteryRoom } from '@/api/db';
import { leaveRoom } from '@/lib/roomLifecycle';
import { Trophy, Home, RotateCcw, Award, Palette, MessageCircle, Share } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';
import GameBackground from '@/components/GameBackground';
import { grantMatchRewards, getProfile } from '@/lib/playerProfile';
import { cosmeticById } from '@/lib/cosmetics';
import { categoryMeta, shortCategory } from '@/lib/wordLists';
import { hapticSuccess } from '@/lib/haptics';
import { useToast } from '@/components/ui/use-toast';
import ShareCardModal from './ShareCardModal';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import PlayerCardModal from '@/components/progression/PlayerCardModal';
import RewardSummary from '@/components/progression/RewardSummary';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import ChatPanel from './ChatPanel';
import RoomTabBar from './RoomTabBar';
import QuickEquip from './QuickEquip';
import EmojiRain from './EmojiRain';
import useUnreadChat from './useUnreadChat';

export default function FinishedPhase({ players, guesses, room, me, myPlayer, roomCode }) {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [cardPlayer, setCardPlayer] = useState(null);
  const [tab, setTab] = useState('results'); // 'results' | 'profile' | 'chat'
  const profiles = usePeerProfiles(players);
  const [rain, setRain] = useState({ emote: null, trigger: 0 });
  const unreadChat = useUnreadChat(roomCode, me?.id, tab === 'chat',
    (emote) => setRain(r => ({ emote, trigger: r.trigger + 1 })));

  useEffect(() => {
    let live = true;
    grantMatchRewards({ room, players, guesses, me }).then(b => { if (live && b) setBreakdown(b); });
    return () => { live = false; };
    // Grant exactly once per results screen — the store is idempotent per room anyway.
     
  }, [room?.id]);
  // p.score accumulates across "Play Again" rounds, but each round crowns its
  // OWN winner. playAgain wipes the room's guesses, so this round's points are
  // exactly the correct guesses currently in the table (+1 each, see
  // GuessModal). Cumulative score only breaks sorting ties and shows as
  // "Total" alongside.
  const roundScore = {};
  players.forEach(p => { roundScore[p.user_id] = 0; });
  guesses.forEach(g => { if (g.correct && g.guesser_id in roundScore) roundScore[g.guesser_id] += 1; });
  const sorted = [...players].sort((a, b) =>
    (roundScore[b.user_id] - roundScore[a.user_id]) || ((b.score || 0) - (a.score || 0)));
  const topScore = roundScore[sorted[0]?.user_id] || 0;
  // A round can end with zero correct guesses (everyone else left) — nobody
  // "wins" a walkover, so skip the trophy/tie copy and celebrations.
  const winners = topScore > 0 ? sorted.filter(p => roundScore[p.user_id] === topScore) : [];
  const isWinner = winners.some(p => p.user_id === me?.id);
  // Nobody guessed a single word this round — the only way that happens is
  // players leaving before the game really got going. Without this, a 0-0
  // tie reads as everyone "winning," which is exactly backwards, and
  // matches playerProfile.js's grantMatchRewards() voiding rewards for the
  // same 0-0 case.
  const noOneScored = topScore === 0;
  const multiRound = players.some(p => (p.score || 0) !== roundScore[p.user_id]);
  const isHost = room.host_id === me?.id;

  // Winner celebration: one confetti burst + a success haptic. Honors the
  // OS Reduce Motion setting (framer's MotionConfig can't reach a canvas).
  useEffect(() => {
    if (!isWinner || tab !== 'results') return;
    hapticSuccess();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.35 }, zIndex: 40 });
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, zIndex: 40 });
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, zIndex: 40 });
    }, 350);
    return () => clearTimeout(timer);
    // Once per results screen, not on every re-render/tab hop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWinner, room?.id]);

  // ── Share win card ────────────────────────────────────────────────
  // A dedicated social graphic (see src/lib/shareCard.js), never a
  // screenshot. Built from THIS round's real data; the newest emblem
  // unlocked this match outranks the equipped one as the focal piece.
  const [showShareCard, setShowShareCard] = useState(false);
  const myRank = sorted.findIndex(p => p.user_id === me?.id) + 1;
  const myCorrect = guesses.filter(g => g.guesser_id === me?.id && g.correct).length;
  const opponentsCount = Math.max(players.length - 1, 1);
  const isPerfect = isWinner && players.length > 1 && myCorrect >= players.length - 1;
  const shareCardData = (() => {
    const profile = getProfile();
    const unlocked = (breakdown?.unlocks || []).map(cosmeticById).filter(Boolean);
    const unlockedEmblem = unlocked.filter(c => c.type === 'emblem').pop();
    const newestUnlock = unlocked[unlocked.length - 1];
    const meta = room.category ? categoryMeta(room.category) : null;
    const chips = [];
    const streak = profile?.win_streak || 0;
    if (isWinner && streak >= 2) chips.push(t.scStreakChip(streak));
    return {
      key: `${room?.id}:${guesses.length}:${myCorrect}:${isWinner ? 'w' : myRank}`,
      variant: isPerfect ? 'perfect' : isWinner ? 'win' : 'place',
      headline: isPerfect ? t.scPerfect : isWinner ? t.scVictory : t.scPlace(myRank),
      scoreText: `${myCorrect}/${opponentsCount}`,
      scoreLabel: t.scWordsGuessed,
      name: myPlayer?.display_name || me?.full_name || '',
      emblem: unlockedEmblem || cosmeticById(profile?.equipped?.emblem),
      chips,
      unlockChip: newestUnlock ? { text: `✨ ${newestUnlock.name}`, rarity: newestUnlock.rarity } : undefined,
      categoryText: meta ? `${meta.emoji} ${shortCategory(room.category)}` : undefined,
    };
  })();

  const playAgain = async () => {
    setLoading(true);
    try {
      // Reset all players: clear elimination, word, submitted state — keep scores
      await Promise.all(players.map(p =>
        MysteryPlayer.update(p.id, {
          secret_word: '',
          word_submitted: false,
          word_revealed: false,
          is_eliminated: false,
          last_guess_at_question_count: 0
        })
      ));
      // Delete all questions and guesses for this room
      const [qs, gs] = await Promise.all([
        MysteryQuestion.filter({ room_code: roomCode }),
        MysteryGuess.filter({ room_code: roomCode })
      ]);
      await Promise.all([
        ...qs.map(q => MysteryQuestion.delete(q.id)),
        ...gs.map(g => MysteryGuess.delete(g.id))
      ]);
      // Reset room to lobby so host can pick category again
      await MysteryRoom.update(room.id, {
        status: 'lobby',
        round_number: 1,
        current_questioner_index: 0,
        category: '',
        question_deadline: null
      });
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const goHome = async () => {
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
      {tab === 'results' && (
      <div
        className="w-full max-w-md flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4 flex flex-col"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring' }}
          className="text-center mb-5">
          {noOneScored ? (
            <>
              <div className="text-5xl mb-3">🚪</div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-0.5">{t.gameEndedEarly}</h1>
            </>
          ) : isWinner ? (
            <>
              <div className="w-20 h-20 mx-auto mb-3 rounded-[24px] bg-gradient-to-b from-[#3a2400] to-[#1a0f00] ring-1 ring-[#ffcf7a]/60 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_8px_16px_-8px_rgba(0,0,0,0.5),0_0_20px_-6px_rgba(255,180,60,0.5),inset_0_1px_1px_rgba(255,220,150,0.25)] flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-0.5" style={{ textShadow: '0 0 24px rgba(255,180,60,0.4)' }}>{t.youWin}</h1>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">😔</div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-0.5">{t.gameOver}</h1>
            </>
          )}
          {noOneScored ? (
            <p className="text-sm font-medium text-slate-300">{t.noCorrectGuesses}</p>
          ) : winners.length === 1
            ? <p className="text-sm font-medium text-slate-300">{t.winsWithPoints(winners[0].display_name, topScore)}</p>
            : <p className="text-sm font-medium text-slate-300">{t.tiedFirst(winners.map(w => w.display_name).join(' & '), topScore)}</p>
          }
        </motion.div>

        <div className="glass-card p-3 space-y-1.5 mb-4">
          {sorted.map((p, i) => {
            const pScore = roundScore[p.user_id] || 0;
            const rank = sorted.filter(o => (roundScore[o.user_id] || 0) > pScore).length + 1;
            // No medals or gold rows on a 0-guess walkover — everyone "tied
            // at 0" reading as all-champions looked absurd.
            const medal = topScore === 0 ? '—' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
            const isTop = topScore > 0 && pScore === topScore;
            return (
              <motion.div key={p.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07 }}
                onClick={() => setCardPlayer(p)} role="button" tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setCardPlayer(p)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl ring-1 cursor-pointer transition-transform duration-150 active:scale-[0.98] ${isTop
                  ? 'bg-gradient-to-b from-[#3a2400]/70 to-[#1a0f00]/70 ring-[#ffcf7a]/50 shadow-[inset_0_1px_1px_rgba(255,220,150,0.2)]'
                  : 'bg-white/5 ring-white/5'}`}>
                <span className={`font-bold w-7 text-center ${rank <= 3 ? 'text-xl' : 'text-sm text-slate-400'}`}>{medal}</span>
                <PlayerAvatar profile={profiles[p.user_id]} name={p.display_name} color={p.color} size={32} />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate leading-tight ${isTop ? 'text-amber-200' : ''}`}>{p.display_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.secret}: <span className="text-slate-200 font-medium">{toDisplayWord(p.secret_word, lang) || '—'}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-extrabold ${isTop ? 'text-amber-300' : ''}`}>{pScore} <span className="text-[10px] font-bold text-slate-400">{t.pts}</span></p>
                  {multiRound && (
                    <p className="text-[10px] font-bold text-slate-400 leading-tight">{t.totalPts(p.score || 0)}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {breakdown && <RewardSummary breakdown={breakdown} />}

        <div className="flex-1 min-h-2" />

        {isHost && (
          <button onClick={playAgain} disabled={loading}
            className="gold-btn w-full h-14 mb-2.5 rounded-[20px] flex items-center justify-center gap-2">
            <RotateCcw className="relative w-4 h-4 text-[#2c1500]" />
            <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
              {loading ? t.settingUp : t.playAgain}
            </span>
          </button>
        )}
        {!isHost && (
          <p className="text-center text-slate-400 text-sm font-medium mb-2.5">{t.waitingForHostRound}</p>
        )}

        <div className="flex gap-2.5">
          <Button onClick={goHome} variant="ghost"
            className="flex-1 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 font-semibold">
            <Home className="w-4 h-4 mr-2" /> {t.backToHome}
          </Button>
          {/* Nothing worth showing off on a walkover round */}
          {!noOneScored && (
            <Button onClick={() => setShowShareCard(true)} variant="ghost"
              className={`h-11 px-4 rounded-xl font-semibold border ${isWinner
                ? 'text-amber-300 border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-200'
                : 'text-slate-400 border-white/10 hover:text-white hover:bg-white/5'}`}>
              <Share className="w-4 h-4 mr-2" /> {t.shareResult}
            </Button>
          )}
        </div>
      </div>
      )}

      {tab === 'profile' && (
        <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pb-4"
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 3.5rem), 3.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}>
          <QuickEquip />
        </div>
      )}

      {tab === 'chat' && (
        <div className="w-full max-w-md flex-1 min-h-0 flex flex-col px-4 pb-4"
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 3.5rem), 3.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}>
          <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
        </div>
      )}

      {cardPlayer && (
        <PlayerCardModal player={cardPlayer} profile={profiles[cardPlayer.user_id]} meId={me?.id} roomCode={roomCode} onClose={() => setCardPlayer(null)} />
      )}

      {showShareCard && (
        <ShareCardModal data={shareCardData}
          fallbackText={t.shareResultText(isWinner, myRank, players.length)}
          onClose={() => setShowShareCard(false)} />
      )}

      <RoomTabBar
        active={tab}
        onChange={setTab}
        items={[
          { id: 'results', label: t.tabResults, icon: Award },
          { id: 'profile', label: t.tabProfile, icon: Palette },
          { id: 'chat', label: t.tabChat, icon: MessageCircle, badge: unreadChat },
        ]}
      />
    </div>
  );
}