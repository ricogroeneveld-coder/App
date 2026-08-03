import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MysteryRoom, MysteryPlayer, MysteryQuestion, MysteryGuess } from '@/api/db';
import { Loader2 } from 'lucide-react';
import LobbyPhase from '@/components/mystery/LobbyPhase';
import WordEntryPhase from '@/components/mystery/WordEntryPhase';
import PlayingPhase from '@/components/mystery/PlayingPhase';
import FinishedPhase from '@/components/mystery/FinishedPhase';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { Button } from '@/components/ui/button';

export default function MysteryGame() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [me, setMe] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  const roomCode = code?.toUpperCase();

  const loadAll = useCallback(async () => {
    const [rooms, ps, qs, gs] = await Promise.all([
      MysteryRoom.filter({ room_code: roomCode }),
      MysteryPlayer.filter({ room_code: roomCode }),
      MysteryQuestion.filter({ room_code: roomCode }),
      MysteryGuess.filter({ room_code: roomCode })
    ]);
    if (rooms?.length) setRoom(rooms[0]);
    if (ps) setPlayers(ps);
    if (qs) setQuestions(qs.sort((a,b) => a.round_number - b.round_number));
    if (gs) setGuesses(gs);
  }, [roomCode]);

  useEffect(() => {
    let unsubs = [];
    let debounceTimer = null;

    const debouncedLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadAll(); }, 400);
    };

    (async () => {
      try {
        const guest = getGuestIdentity();
        setMe({ id: guest.id, full_name: guest.name });
        await loadAll();
        setLoading(false);

        unsubs.push(MysteryRoom.subscribe(debouncedLoad));
        unsubs.push(MysteryPlayer.subscribe(debouncedLoad));
        unsubs.push(MysteryQuestion.subscribe(debouncedLoad));
        unsubs.push(MysteryGuess.subscribe(debouncedLoad));
      } catch(e) {
        setLoading(false);
      }
    })();
    return () => {
      clearTimeout(debounceTimer);
      unsubs.forEach(u => u && u());
    };
  }, [roomCode, loadAll]);

  useEffect(() => {
    if (me && players.length) {
      setMyPlayer(players.find(p => p.user_id === me.id) || null);
    }
  }, [me, players]);

  // Clean up lobby when tab/window closes
  useEffect(() => {
    if (!room || room.status !== 'lobby' || !me) return;

    const cleanup = () => {
      const myP = players.find(p => p.user_id === me.id);
      if (!myP) return;
      const remaining = players.filter(p => p.user_id !== me.id);
      // Use sendBeacon for reliable fire-and-forget on tab close
      // We can't await here, so just trigger the deletes best-effort
      if (remaining.length === 0) {
        // Delete room (player record will cascade or be orphaned briefly)
        MysteryRoom.delete(room.id);
        MysteryPlayer.delete(myP.id);
      } else {
        MysteryPlayer.delete(myP.id);
        if (room.host_id === me.id) {
          MysteryRoom.update(room.id, {
            host_id: remaining[0].user_id,
            host_name: remaining[0].display_name
          });
        }
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [room, me, players]);

  if (loading) return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );

  if (!room) return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <p className="text-xl mb-4">Room not found</p>
      <button onClick={() => navigate('/')} className="underline text-violet-400">Back to Home</button>
    </div>
  );

  // Player left (eliminated but not word_revealed) during active game — can rejoin
  const isEliminated = myPlayer?.is_eliminated && !myPlayer?.word_revealed && room.status === 'playing';
  // Player was never in this game (joined via link after game started)
  const isNotInRoom = !myPlayer && (room.status === 'playing' || room.status === 'word_entry');

  if (isNotInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white flex flex-col items-center justify-center p-4">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-2xl font-bold mb-2">Game already started</p>
        <p className="text-slate-400 mb-6 text-center">This game is in progress. You can join the next round!</p>
        <button onClick={() => navigate('/')} className="text-violet-400 text-sm underline">Back to Home</button>
      </div>
    );
  }

  if (isEliminated) {
    const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];
    const handleRejoin = async () => {
      await MysteryPlayer.update(myPlayer.id, { is_eliminated: false });
      await loadAll();
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white flex flex-col items-center justify-center p-4">
        <p className="text-2xl font-bold mb-2">You left the game</p>
        <p className="text-slate-400 mb-6">The game is still going. Want to rejoin?</p>
        <Button onClick={handleRejoin} className="bg-violet-500 hover:bg-violet-600 border-0 font-semibold h-12 px-8 mb-3">
          Rejoin Game
        </Button>
        <button onClick={() => navigate('/')} className="text-slate-400 text-sm underline">Back to Home</button>
      </div>
    );
  }

  const commonProps = { room, players, questions, guesses, me, myPlayer, roomCode, reload: loadAll };

  if (room.status === 'lobby') return <LobbyPhase {...commonProps} />;
  if (room.status === 'word_entry') return <WordEntryPhase {...commonProps} />;
  if (room.status === 'playing') return <PlayingPhase {...commonProps} />;
  if (room.status === 'finished') return <FinishedPhase {...commonProps} />;

  return null;
}