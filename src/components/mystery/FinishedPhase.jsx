import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MysteryPlayer, MysteryQuestion, MysteryGuess, MysteryRoom } from '@/api/db';
import { Trophy, Home, RotateCcw } from 'lucide-react';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';
import GameBackground from '@/components/GameBackground';

export default function FinishedPhase({ players, guesses, room, me, roomCode }) {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(false);
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const topScore = sorted[0]?.score || 0;
  const winners = sorted.filter(p => (p.score || 0) === topScore);
  const isWinner = winners.some(p => p.user_id === me?.id);
  const isHost = room.host_id === me?.id;

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

  return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col items-center relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
      }}
    >
      <GameBackground />
      <div
        className="w-full max-w-md flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4 flex flex-col justify-center"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring' }}
          className="text-center mb-5">
          {isWinner ? (
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
          {winners.length === 1
            ? <p className="text-sm font-medium text-slate-300">{t.winsWithPoints(winners[0].display_name, topScore)}</p>
            : <p className="text-sm font-medium text-slate-300">{t.tiedFirst(winners.map(w => w.display_name).join(' & '), topScore)}</p>
          }
        </motion.div>

        <div className="glass-card p-3 space-y-1.5 mb-4">
          {sorted.map((p, i) => {
            const pScore = p.score || 0;
            const rank = sorted.filter(o => (o.score || 0) > pScore).length + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
            const isTop = pScore === topScore;
            return (
              <motion.div key={p.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07 }}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl ring-1 ${isTop
                  ? 'bg-gradient-to-b from-[#3a2400]/70 to-[#1a0f00]/70 ring-[#ffcf7a]/50 shadow-[inset_0_1px_1px_rgba(255,220,150,0.2)]'
                  : 'bg-white/5 ring-white/5'}`}>
                <span className={`font-bold w-7 text-center ${rank <= 3 ? 'text-xl' : 'text-sm text-slate-400'}`}>{medal}</span>
                <div className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] overflow-hidden"
                  style={{ backgroundColor: p.color }}>
                  <span className="pointer-events-none absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white/35 blur-[3px]" />
                  <span className="relative">{p.display_name[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate leading-tight ${isTop ? 'text-amber-200' : ''}`}>{p.display_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.secret}: <span className="text-slate-200 font-medium">{toDisplayWord(p.secret_word, lang) || '—'}</span></p>
                </div>
                <p className={`text-lg font-extrabold shrink-0 ${isTop ? 'text-amber-300' : ''}`}>{p.score || 0} <span className="text-[10px] font-bold text-slate-400">{t.pts}</span></p>
              </motion.div>
            );
          })}
        </div>

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

        <Button onClick={() => navigate('/')} variant="ghost"
          className="w-full h-11 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 font-semibold">
          <Home className="w-4 h-4 mr-2" /> {t.backToHome}
        </Button>
      </div>
    </div>
  );
}