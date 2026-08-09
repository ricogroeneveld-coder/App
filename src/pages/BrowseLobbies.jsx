import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, RefreshCw, LogIn, Globe, Loader2 } from 'lucide-react';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { categoryMeta, shortCategory } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';

const PULL_THRESHOLD = 70;

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

export default function BrowseLobbies() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const [loading, setLoading] = useState(null);
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [lobbiesLoading, setLobbiesLoading] = useState(true);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(null);
  const scrollRef = useRef(null);
  const profiles = usePeerProfiles(publicLobbies.map(r => ({ user_id: r.host_id })));

  const fetchLobbies = async () => {
    setLobbiesLoading(true);
    try {
      const rooms = await MysteryRoom.filter({ status: 'lobby', is_public: true }, '-created_date', 20);
      setPublicLobbies(rooms || []);
    } catch (e) {
      setPublicLobbies([]);
    } finally {
      setLobbiesLoading(false);
    }
  };

  const handleTouchStart = (e) => {
    if (scrollRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && scrollRef.current?.scrollTop === 0) {
      setIsPulling(true);
      setPullY(Math.min(dy * 0.4, PULL_THRESHOLD));
    }
  };

  const handleTouchEnd = () => {
    if (pullY >= PULL_THRESHOLD && !lobbiesLoading) {
      fetchLobbies();
    }
    setPullY(0);
    setIsPulling(false);
    touchStartY.current = null;
  };

  const [wakeEpoch, setWakeEpoch] = useState(0);
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') setWakeEpoch(n => n + 1);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, []);

  useEffect(() => {
    fetchLobbies();
    const unsub = MysteryRoom.subscribe((event) => {
      if (event.data?.is_public) {
        fetchLobbies();
      }
    });
    return unsub;
  }, [wakeEpoch]);

  const joinLobby = async (room) => {
    const guest = getGuestIdentity();
    setLoading(room.room_code);
    try {
      // Re-check live status right before joining — the list snapshot can be
      // stale by the time it's tapped, and a lobby that started in the
      // meantime should never silently accept a new, ungated player.
      const fresh = await MysteryRoom.filter({ room_code: room.room_code });
      if (!fresh?.length) { toast({ title: t.roomNotFound, variant: 'destructive' }); fetchLobbies(); return; }
      if (fresh[0].status !== 'lobby') { toast({ title: t.gameAlreadyStarted, variant: 'destructive' }); fetchLobbies(); return; }

      const existing = await MysteryPlayer.filter({ room_code: room.room_code, user_id: guest.id });
      if (!existing?.length) {
        const players = await MysteryPlayer.filter({ room_code: room.room_code });
        if (players.length >= 12) { toast({ title: t.roomFull, variant: 'destructive' }); return; }
        await MysteryPlayer.create({
          room_code: room.room_code, user_id: guest.id, display_name: guest.name,
          score: 0, word_submitted: false, word_revealed: false, is_eliminated: false,
          color: PLAYER_COLORS[players.length % PLAYER_COLORS.length]
        });
      }
      navigate(`/mystery/${room.room_code}`);
    } catch (e) {
      toast({ title: t.failedToJoin, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="h-dvh text-white relative flex flex-col overflow-hidden"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <GameBackground />

      {/* Header — pinned, never scrolls */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 shrink-0">
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Link to="/" className="header-btn shrink-0" aria-label={t.backLabel}>
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">{t.openLobbies}</h1>
            <p className="text-xs font-medium text-slate-400 truncate">{t.openLobbiesDesc}</p>
          </div>
          <button
            onClick={fetchLobbies}
            disabled={lobbiesLoading}
            className="header-btn ml-auto shrink-0 disabled:opacity-40"
            aria-label={t.loading}
          >
            <RefreshCw className={`w-4 h-4 ${lobbiesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lobby list — framed like the in-game question history: a glass card
          that fills the remaining height, the list scrolls INSIDE it instead
          of the whole page scrolling. */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-md mx-auto px-4 flex flex-col">
        <div className="glass-card relative flex-1 min-h-0 p-2.5 flex flex-col overflow-hidden">
          {isPulling && (
            <div
              className="absolute top-0 left-0 right-0 flex justify-center items-center z-10 pointer-events-none transition-all"
              style={{ height: `${pullY}px` }}
            >
              <RefreshCw className={`w-5 h-5 text-violet-400 transition-transform ${pullY >= PULL_THRESHOLD ? 'animate-spin' : ''}`}
                style={{ transform: `rotate(${(pullY / PULL_THRESHOLD) * 360}deg)` }} />
            </div>
          )}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto hide-scrollbar"
            style={{ overscrollBehaviorY: 'contain' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {lobbiesLoading ? (
              <div className="min-h-full flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="w-7 h-7 text-violet-400 animate-spin drop-shadow-[0_0_8px_rgba(157,92,255,0.5)]" />
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{t.loading}</p>
              </div>
            ) : publicLobbies.length === 0 ? (
              <div className="min-h-full flex flex-col items-center justify-center text-center py-14">
                <div className="w-16 h-16 mb-4 rounded-[20px] bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_5px_12px_-8px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  <Globe className="w-7 h-7 text-violet-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">{t.noOpenLobbies}</p>
              </div>
            ) : (
              <div className="space-y-2 pb-1">
                {publicLobbies.map((room, i) => (
                  <motion.button key={room.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={() => joinLobby(room)}
                    disabled={loading !== null}
                    className="glass-panel w-full p-2.5 flex items-center gap-2.5 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20 disabled:opacity-50">
                    <PlayerAvatar profile={profiles[room.host_id]} name={room.host_name} color="#6d28d9" size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-[13px] truncate leading-tight">{room.host_name}'s lobby</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        <span className="font-mono tracking-[0.12em]">{room.room_code}</span>
                        {room.category && (
                          <span className="font-medium"> · {categoryMeta(room.category)?.emoji} {shortCategory(room.category)}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'livePulse 2s ease-in-out infinite' }} />
                      <span className="text-[10px] font-bold text-emerald-300">{t.waiting}</span>
                    </span>
                    <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-b from-white/[0.07] to-black/20 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center">
                      <LogIn className="w-3.5 h-3.5 text-violet-300" />
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
