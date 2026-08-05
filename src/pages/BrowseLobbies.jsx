import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, RefreshCw, Users, LogIn, Globe } from 'lucide-react';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { useLang } from '@/lib/LanguageContext';

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

  useEffect(() => {
    fetchLobbies();
    const unsub = MysteryRoom.subscribe((event) => {
      if (event.data?.is_public) {
        fetchLobbies();
      }
    });
    return unsub;
  }, []);

  const joinLobby = async (room) => {
    const guest = getGuestIdentity();
    setLoading(room.room_code);
    try {
      const existing = await MysteryPlayer.filter({ room_code: room.room_code, user_id: guest.id });
      if (!existing?.length) {
        const players = await MysteryPlayer.filter({ room_code: room.room_code });
        if (players.length >= 12) { toast({ title: 'Room is full', variant: 'destructive' }); return; }
        await MysteryPlayer.create({
          room_code: room.room_code, user_id: guest.id, display_name: guest.name,
          score: 0, word_submitted: false, word_revealed: false, is_eliminated: false,
          color: PLAYER_COLORS[players.length % PLAYER_COLORS.length]
        });
      }
      navigate(`/mystery/${room.room_code}`);
    } catch (e) {
      toast({ title: 'Failed to join', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-screen text-white overflow-y-auto relative hide-scrollbar"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
        overscrollBehaviorY: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950" />

      {isPulling && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-center z-10 pointer-events-none transition-all"
          style={{ height: `${pullY}px` }}
        >
          <RefreshCw className={`w-5 h-5 text-lime-400 transition-transform ${pullY >= PULL_THRESHOLD ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${(pullY / PULL_THRESHOLD) * 360}deg)` }} />
        </div>
      )}

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="flex items-center gap-3 pt-3 pb-5">
          <Link to="/"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition shrink-0">
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">{t.openLobbies}</h1>
            <p className="text-xs text-slate-400 truncate">{t.openLobbiesDesc}</p>
          </div>
          <button
            onClick={fetchLobbies}
            disabled={lobbiesLoading}
            className="ml-auto w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${lobbiesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {lobbiesLoading ? (
          <p className="text-center text-slate-500 text-sm py-10">{t.loading}</p>
        ) : publicLobbies.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{t.noOpenLobbies}</p>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {publicLobbies.map(room => (
              <motion.button key={room.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => joinLobby(room)}
                disabled={loading !== null}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/40 ring-1 ring-lime-400/30 hover:ring-lime-400/60 transition text-left disabled:opacity-50">
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{room.host_name}'s lobby</p>
                  <p className="text-xs text-slate-400 font-mono">{room.room_code}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                  <Users className="w-3.5 h-3.5" />
                  <span className="mr-1">{t.waiting}</span>
                  <LogIn className="w-4 h-4 text-lime-400" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
