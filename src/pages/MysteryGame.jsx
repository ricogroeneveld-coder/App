import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MysteryRoom, MysteryPlayer, MysteryQuestion, MysteryGuess } from '@/api/db';
import { Loader2, WifiOff } from 'lucide-react';
import LobbyPhase from '@/components/mystery/LobbyPhase';
import WordEntryPhase from '@/components/mystery/WordEntryPhase';
import PlayingPhase from '@/components/mystery/PlayingPhase';
import FinishedPhase from '@/components/mystery/FinishedPhase';
import { getGuestIdentity } from '@/lib/guestIdentity';
import GameBackground from '@/components/GameBackground';
import { useToast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/LanguageContext';

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

export default function MysteryGame() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
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
  // True while any of the four room-state channels has reported dropped
  // (CHANNEL_ERROR/TIMED_OUT/CLOSED) rather than SUBSCRIBED — without this,
  // a lost realtime connection just goes silently stale: chat, questions,
  // guesses, and the player list stop updating with no indication at all.
  const [connectionIssue, setConnectionIssue] = useState(false);
  const rejoiningRef = useRef(false);
  // Whether we've had a player row during THIS visit — distinguishes a kick
  // (row existed, then vanished) from a refresh (arrived with no row).
  const hadRowRef = useRef(false);
  // Mirrors `players` for the join/leave toast below, which needs the
  // pre-change roster (to detect an elimination transition) without
  // re-running the subscribe effect on every player-list update.
  const playersRef = useRef([]);
  useEffect(() => { playersRef.current = players; }, [players]);

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
    let retryTimer = null;

    const debouncedLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadAll(); }, 400);
    };

    // Any channel dropping means all four are likely dead together (same
    // socket) — flag it once and, since visibilitychange/online won't fire
    // for a connection that dies while the tab stays open and in the
    // foreground, self-heal with a short retry via the same sessionEpoch
    // bump the wake-up handler uses.
    const handleStatus = (status) => {
      if (status === 'SUBSCRIBED') { setConnectionIssue(false); return; }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnectionIssue(true);
        if (!retryTimer) {
          retryTimer = setTimeout(() => { setSessionEpoch(n => n + 1); }, 3000);
        }
      }
    };

    (async () => {
      try {
        const guest = getGuestIdentity();
        setMe({ id: guest.id, full_name: guest.name });
        await loadAll();
        setLoading(false);

        // A player stepping away to Chat/Settings has no other way to learn
        // someone joined or left — the roster just silently re-renders.
        // Skipped for our own row: we already know when we join or leave.
        const handlePlayerEvent = (event) => {
          debouncedLoad();
          if (event.data?.room_code !== roomCode || event.data?.user_id === guest.id) return;
          if (event.type === 'create') {
            toast({ title: t.playerJoined(event.data.display_name) });
          } else if (event.type === 'delete') {
            toast({ title: t.playerLeft(event.data.display_name) });
          } else if (event.type === 'update' && event.data?.is_eliminated) {
            const prev = playersRef.current.find(p => p.id === event.data.id);
            if (prev && !prev.is_eliminated) toast({ title: t.playerLeft(event.data.display_name) });
          }
        };

        unsubs.push(MysteryRoom.subscribe(debouncedLoad, handleStatus));
        unsubs.push(MysteryPlayer.subscribe(handlePlayerEvent, handleStatus));
        unsubs.push(MysteryQuestion.subscribe(debouncedLoad, handleStatus));
        unsubs.push(MysteryGuess.subscribe(debouncedLoad, handleStatus));
      } catch(e) {
        setLoading(false);
      }
    })();
    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      unsubs.forEach(u => u && u());
    };
  }, [roomCode, loadAll, sessionEpoch]);

  useEffect(() => {
    if (me && players.length) {
      const mine = players.find(p => p.user_id === me.id) || null;
      setMyPlayer(mine);
      if (mine) hadRowRef.current = true;
    }
  }, [me, players]);

  // Refresh self-healing: reloading the page runs the beforeunload cleanup
  // below, which deletes our player row — so a lobby member who refreshes
  // would land in a lobby they're no longer part of. Quietly rejoin.
  // Exception: if our row existed during this visit and then vanished, the
  // host removed us — leave instead of silently rejoining.
  useEffect(() => {
    if (loading || !room || !me) return;
    if (room.status !== 'lobby' && room.status !== 'word_entry') return;
    if (players.some(p => p.user_id === me.id)) return;
    if (hadRowRef.current) {
      toast({ title: t.removedByHost, variant: 'destructive' });
      navigate('/');
      return;
    }
    // Fresh visitors can auto-join during lobby AND word entry — the game
    // hasn't really begun until everyone locks a word in.
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
      <p className="text-xl font-extrabold tracking-tight mb-1">{t.roomNotFound}</p>
      <p className="text-slate-400 text-sm font-medium mb-6">{t.checkCodeTryAgain}</p>
      <button onClick={() => navigate('/')} className="violet-btn h-11 px-6 text-sm font-bold">{t.backToHome}</button>
    </div>
  );

  // Player left (eliminated but not word_revealed) during active game — can rejoin
  const isEliminated = myPlayer?.is_eliminated && !myPlayer?.word_revealed && room.status === 'playing';
  // Player was never in this game (joined via link after it truly started).
  // During word_entry the auto-join above handles fresh visitors... except a
  // full room, which falls through to here.
  const isNotInRoom = !myPlayer && !hadRowRef.current &&
    (room.status === 'playing' || (room.status === 'word_entry' && players.length >= 12));

  if (isNotInRoom) {
    return (
      <div className="h-dvh overflow-hidden text-white flex flex-col items-center justify-center p-4 relative">
        <GameBackground />
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-xl font-extrabold tracking-tight mb-1">{t.gameAlreadyStarted}</p>
        <p className="text-slate-400 text-sm font-medium mb-6 text-center">{t.gameInProgressJoinNext}</p>
        <button onClick={() => navigate('/')} className="violet-btn h-11 px-6 text-sm font-bold">{t.backToHome}</button>
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
        <p className="text-xl font-extrabold tracking-tight mb-1">{t.youLeftGame}</p>
        <p className="text-slate-400 text-sm font-medium mb-6">{t.stillGoingRejoin}</p>
        <button onClick={handleRejoin} className="gold-btn h-12 px-8 rounded-2xl mb-3 flex items-center justify-center">
          <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{t.rejoinGame}</span>
        </button>
        <button onClick={() => navigate('/')} className="text-slate-400 text-sm font-medium hover:text-white transition">{t.backToHome}</button>
      </div>
    );
  }

  const commonProps = { room, players, questions, guesses, me, myPlayer, roomCode, reload: loadAll };

  let phase = null;
  if (room.status === 'lobby') phase = <LobbyPhase {...commonProps} />;
  else if (room.status === 'word_entry') phase = <WordEntryPhase {...commonProps} />;
  else if (room.status === 'playing') phase = <PlayingPhase {...commonProps} />;
  else if (room.status === 'finished') phase = <FinishedPhase {...commonProps} />;

  return (
    <>
      {phase}
      {connectionIssue && (
        <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none px-4"
          style={{ top: 'max(calc(env(safe-area-inset-top) + 0.5rem), 1rem)' }}>
          <div role="status" aria-label={t.connectionLost}
            className="pointer-events-auto flex items-center gap-2 h-9 px-3.5 rounded-full bg-amber-500/15 ring-1 ring-amber-400/40 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="text-xs font-semibold text-amber-200">{t.reconnecting}</span>
          </div>
        </div>
      )}
    </>
  );
}