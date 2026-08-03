import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MysteryPlayer, MysteryQuestion, MysteryGuess, MysteryRoom } from '@/api/db';
import { Trophy, Home, RotateCcw } from 'lucide-react';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { useLang } from '@/lib/LanguageContext';
import { toDisplayWord } from '@/lib/wordLists';

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
      className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white flex flex-col items-center justify-center p-4"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <div className="w-full max-w-md">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring' }}
          className="text-center mb-8">
          {isWinner ? (
            <>
              <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3" />
              <h1 className="text-3xl font-bold mb-1">{t.youWin}</h1>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">😔</div>
              <h1 className="text-3xl font-bold mb-1">{t.gameOver}</h1>
            </>
          )}
          {winners.length === 1
            ? <p className="text-slate-300">{t.winsWithPoints(winners[0].display_name, topScore)}</p>
            : <p className="text-slate-300">{t.tiedFirst(winners.map(w => w.display_name).join(' & '), topScore)}</p>
          }
        </motion.div>

        <div className="space-y-3 mb-8">
          {sorted.map((p, i) => {
            const pScore = p.score || 0;
            const rank = sorted.filter(o => (o.score || 0) > pScore).length + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
            const isTop = pScore === topScore;
            return (
              <motion.div key={p.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07 }}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl ring-1 ${isTop ? 'bg-amber-500/10 ring-amber-400/30' : 'bg-white/5 ring-white/5'}`}>
                <span className="text-2xl font-bold text-slate-400 w-8 text-center">{medal}</span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: p.color }}>{p.display_name[0].toUpperCase()}</div>
                <div className="flex-1">
                  <p className="font-semibold">{p.display_name}</p>
                  <p className="text-xs text-slate-400">{t.secret}: <span className="text-slate-200">{toDisplayWord(p.secret_word, lang) || '—'}</span></p>
                </div>
                <p className="text-xl font-bold">{p.score || 0} <span className="text-xs text-slate-400">{t.pts}</span></p>
              </motion.div>
            );
          })}
        </div>

        {isHost && (
          <Button onClick={playAgain} disabled={loading}
            className="w-full h-12 mb-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0 font-semibold">
            <RotateCcw className="w-4 h-4 mr-2" />
            {loading ? t.settingUp : t.playAgain}
          </Button>
        )}
        {!isHost && (
          <p className="text-center text-slate-400 text-sm mb-3">{t.waitingForHostRound}</p>
        )}

        <Button onClick={() => navigate('/')} variant="ghost"
          className="w-full h-12 text-slate-400 hover:text-white hover:bg-white/5 border-0 font-semibold">
          <Home className="w-4 h-4 mr-2" /> {t.backToHome}
        </Button>
      </div>
    </div>
  );
}