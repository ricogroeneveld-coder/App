import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, RefreshCw, LogIn, Globe, Loader2 } from 'lucide-react';
import { getGuestIdentity } from '@/lib/guestIdentity';
import { categoryMeta, shortCategory } from '@/lib/wordLists';
import { track } from '@/lib/analytics';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import usePeerProfiles from '@/components/progression/usePeerProfiles';

const PULL_THRESHOLD = 70;

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

// The room's language (migration 0014), set from the host's at creation. It
// decides which bank generated questions come from, and in practice it's the
// language the room is going to be played in — worth knowing BEFORE you join,
// which is the whole point of showing it here.
//
// Rooms created before 0014 have 'en' (the column default), so falling back to
// English matches what those rooms actually do.
const LOBBY_LANGS = {
  nl: { flag: '🇳🇱', label: 'NL' },
  en: { flag: '🇬🇧', label: 'EN' },
};
const lobbyLang = (code) => LOBBY_LANGS[String(code || 'en').toLowerCase()] || LOBBY_LANGS.en;

export default function BrowseLobbies() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const [loading, setLoading] = useState(null);
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [lobbiesLoading, setLobbiesLoading] = useState(true);
  // UX-3: distinguish a network failure from a genuinely empty list, so the
  // empty state ("No open lobbies") can't masquerade as an offline dead-end.
  const [loadError, setLoadError] = useState(false);
  const hasLoadedRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(null);
  const scrollRef = useRef(null);
  const profiles = usePeerProfiles(publicLobbies.map(r => ({ user_id: r.host_id })));

  // room_code → player count, so lobby rows can show "3/12" — players pick
  // a lobby by how full it is, and the list said nothing about that.
  const [lobbyCounts, setLobbyCounts] = useState({});
  // Latest room codes on screen, read by the periodic count refresh (NET-2)
  // without forcing that interval to restart on every list change.
  const codesRef = useRef([]);

  // NET-2: the "3/12" counts come from mystery_players, but this screen only
  // subscribes to mystery_rooms — so a player joining/leaving an already-listed
  // lobby never refreshed its count. Re-query JUST the counts (one cheap query,
  // no room refetch) rather than subscribing to mystery_players: that table has
  // no is_public filter, so such a subscription would wake this screen on every
  // player's every move across ALL rooms app-wide.
  const fetchCounts = async (codes) => {
    if (!codes.length) { setLobbyCounts({}); return; }
    try {
      const { data } = await supabase.from('mystery_players')
        .select('room_code').in('room_code', codes);
      const counts = {};
      (data || []).forEach(p => { counts[p.room_code] = (counts[p.room_code] || 0) + 1; });
      setLobbyCounts(counts);
    } catch (e) { /* keep last counts on a transient failure */ }
  };

  // UX-5: a background refetch (fired by the realtime subscription) must NOT
  // flip `lobbiesLoading` — doing so flashed the whole list to a centered
  // spinner and lost scroll position on every public-room event app-wide. Only
  // the initial load and an explicit pull-to-refresh show the spinner.
  const fetchLobbies = async (background = false) => {
    if (!background) setLobbiesLoading(true);
    try {
      const rooms = await MysteryRoom.filter({ status: 'lobby', is_public: true }, '-created_date', 20);
      setPublicLobbies(rooms || []);
      const codes = (rooms || []).map(r => r.room_code);
      codesRef.current = codes;
      await fetchCounts(codes);
      hasLoadedRef.current = true;
      setLoadError(false);
    } catch (e) {
      // Keep whatever we already have; surface a retry instead of a false
      // "no lobbies" (UX-3).
      setLoadError(true);
    } finally {
      if (!background) setLobbiesLoading(false);
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
    let disposed = false;
    let debounceTimer = null;
    // NET-1: the public-room subscription fired a full 2-query refetch on EVERY
    // public-room event app-wide, with no debounce — a burst (a busy lobby's
    // rapid updates) meant a storm of refetches. Coalesce bursts into one
    // refetch (~500ms, mirrors MysteryGame's pattern), and guard the callback
    // so a pending timer can't fire a refetch after unmount / wakeEpoch swap.
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { if (!disposed) fetchLobbies(true); }, 500);
    };
    fetchLobbies();
    // Server-side filter: only public rooms' events reach this screen.
    const unsub = MysteryRoom.subscribe(() => { if (!disposed) debouncedFetch(); },
      undefined, 'is_public=eq.true');
    return () => { disposed = true; clearTimeout(debounceTimer); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeEpoch]);

  // NET-2: periodic refresh of just the counts while mounted (see fetchCounts).
  useEffect(() => {
    const iv = setInterval(() => { fetchCounts(codesRef.current); }, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      track('lobby_joined', { via: 'browse' });
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
            onClick={() => fetchLobbies()}
            disabled={lobbiesLoading}
            className="header-btn ml-auto shrink-0 disabled:opacity-40"
            aria-label={t.refresh}
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
            ) : loadError && publicLobbies.length === 0 ? (
              // UX-3: a fetch failure is a connection problem with a retry, not
              // a genuinely empty list.
              <div className="min-h-full flex flex-col items-center justify-center text-center py-14 gap-3">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_5px_12px_-8px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  <Globe className="w-7 h-7 text-violet-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">{t.connectionProblem}</p>
                <button onClick={() => fetchLobbies()} className="violet-solid-btn h-10 px-5 text-sm">{t.retry}</button>
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
                      <p className="font-bold text-white text-[13px] truncate leading-tight">{t.hostLobby(room.host_name)}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        <span className="font-mono tracking-[0.12em]">{room.room_code}</span>
                        <span
                          className="ml-1.5 mr-0.5 inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full align-middle bg-white/[0.06] ring-1 ring-white/10"
                          title={lobbyLang(room.language).label}
                        >
                          <span className="text-[9px] leading-none">{lobbyLang(room.language).flag}</span>
                          <span className="text-[9px] font-extrabold tracking-wider text-slate-300 leading-none">
                            {lobbyLang(room.language).label}
                          </span>
                        </span>
                        {room.category && (
                          <span className="font-medium">· {categoryMeta(room.category)?.emoji} {shortCategory(room.category)}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'livePulse 2s ease-in-out infinite' }} />
                      <span className="text-[10px] font-bold text-emerald-300 tabular-nums">
                        {lobbyCounts[room.room_code] ? `${Math.min(lobbyCounts[room.room_code], 12)}/12` : t.waiting}
                      </span>
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
