import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MysteryRoom, MysteryPlayer, MysteryQuestion, MysteryGuess } from '@/api/db';
import { Loader2 } from 'lucide-react';
import LobbyPhase from '@/components/mystery/LobbyPhase';
import WordEntryPhase from '@/components/mystery/WordEntryPhase';
import PlayingPhase from '@/components/mystery/PlayingPhase';
import FinishedPhase from '@/components/mystery/FinishedPhase';
import { getGuestIdentity } from '@/lib/guestIdentity';
import GameBackground from '@/components/GameBackground';
import { Button } from '@/components/ui/button';

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

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
  // Bumped when the tab wakes up — re-runs the subscribe effect so dead
  // realtime channels are replaced and state is re-fetched.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const rejoiningRef = useRef(false);

  const roomCode = code?.toUpperCase();

  // Mobile browsers suspend the realtime socket while the tab is in the
  // background, so events are silently missed and channels can come back
  // dead. When the tab becomes visible again (app switch, tab switch,
  // bfcache restore, network back), re-subscribe fresh and reload state.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') setSessionEpoch(n => n + 1);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('online', wake);
    };
  }, []);

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
  }, [roomCode, loadAll, sessionEpoch]);

  useEffect(() => {
    if (me && players.length) {
      setMyPlayer(players.find(p => p.user_id === me.id) || null);
    }
  }, [me, players]);

  // Refresh self-healing: reloading the page runs the beforeunload cleanup
  // below, which deletes our player row — so a lobby member who refreshes
  // would land in a lobby they're no longer part of. Quietly rejoin.
  useEffect(() => {
    if (loading || !room || room.status !== 'lobby' || !me) return;
    if (players.some(p => p.user_id === me.id)) return;
    if (players.length >= 12 || rejoiningRef.current) return;
    rejoiningRef.current = true;
    MysteryPlayer.create({
      room_code: roomCode,
      user_id: me.id,
      display_name: me.full_name,
      score: 0,
      word_submitted: false,
      word_revealed: false,
      is_eliminated: false,
      color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
    }).then(() => loadAll()).catch(() => {}).finally(() => { rejoiningRef.current = false; });
  }, [loading, room, players, me, roomCode, loadAll]);

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
      className="h-dvh overflow-hidden flex items-center justify-center relative"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <GameBackground />
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin drop-shadow-[0_0_8px_rgba(157,92,255,0.5)]" />
    </div>
  );

  if (!room) return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col items-center justify-center p-4 relative"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <GameBackground />
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-xl font-extrabold tracking-tight mb-1">Room not found</p>
      <p className="text-slate-400 text-sm font-medium mb-6">Check the code and try again.</p>
      <button onClick={() => navigate('/')} className="violet-btn h-11 px-6 text-sm font-bold">Back to Home</button>
    </div>
  );

  // Player left (eliminated but not word_revealed) during active game — can rejoin
  const isEliminated = myPlayer?.is_eliminated && !myPlayer?.word_revealed && room.status === 'playing';
  // Player was never in this game (joined via link after game started)
  const isNotInRoom = !myPlayer && (room.status === 'playing' || room.status === 'word_entry');

  if (isNotInRoom) {
    return (
      <div className="h-dvh overflow-hidden text-white flex flex-col items-center justify-center p-4 relative">
        <GameBackground />
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-xl font-extrabold tracking-tight mb-1">Game already started</p>
        <p className="text-slate-400 text-sm font-medium mb-6 text-center">This game is in progress. You can join the next round!</p>
        <button onClick={() => navigate('/')} className="violet-btn h-11 px-6 text-sm font-bold">Back to Home</button>
      </div>
    );
  }

  if (isEliminated) {
    const handleRejoin = async () => {
      await MysteryPlayer.update(myPlayer.id, { is_eliminated: false });
      await loadAll();
    };
    return (
      <div className="h-dvh overflow-hidden text-white flex flex-col items-center justify-center p-4 relative">
        <GameBackground />
        <p className="text-5xl mb-4">👋</p>
        <p className="text-xl font-extrabold tracking-tight mb-1">You left the game</p>
        <p className="text-slate-400 text-sm font-medium mb-6">The game is still going. Want to rejoin?</p>
        <button onClick={handleRejoin} className="gold-btn h-12 px-8 rounded-2xl mb-3 flex items-center justify-center">
          <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">Rejoin Game</span>
        </button>
        <button onClick={() => navigate('/')} className="text-slate-400 text-sm font-medium hover:text-white transition">Back to Home</button>
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