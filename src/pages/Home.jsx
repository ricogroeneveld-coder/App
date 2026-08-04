import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, LogIn, Users, Globe, Lock, Settings, RefreshCw, X, ChevronDown } from 'lucide-react';
import { getGuestIdentity, setGuestName, hasGuestName } from '@/lib/guestIdentity';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/LanguageContext';
import bgImage from '../../background.jpg';
import logoImage from '../../logo.png';
import mascotBlue from '../../mascot-blue.png';
import mascotRed from '../../mascot-red.png';
import badgePlayers from '../../badge-players.png';
import badgeGuessing from '../../badge-guessing.png';
import badgeRealtime from '../../badge-realtime.png';

const PULL_THRESHOLD = 70;

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [nameSet, setNameSet] = useState(hasGuestName());
  const [isPublic, setIsPublic] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [lobbiesLoading, setLobbiesLoading] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLobbies, setShowLobbies] = useState(false);
  const touchStartY = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    setNameSet(hasGuestName());
  }, []);

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
    if (!nameSet) return;
    fetchLobbies();
    const unsub = MysteryRoom.subscribe((event) => {
      if (event.data?.is_public) {
        fetchLobbies();
      }
    });
    return unsub;
  }, [nameSet]);

  const confirmName = () => {
    if (!nameInput.trim()) { toast({ title: 'Enter your name', variant: 'destructive' }); return; }
    setGuestName(nameInput.trim());
    setNameSet(true);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreate = async () => {
    setLoading('create');
    try {
      const guest = getGuestIdentity();
      const code = generateCode();
      await MysteryRoom.create({
        room_code: code,
        host_id: guest.id,
        host_name: guest.name,
        status: 'lobby',
        current_questioner_index: 0,
        round_number: 1,
        max_rounds: 10,
        is_public: isPublic
      });
      await MysteryPlayer.create({
        room_code: code,
        user_id: guest.id,
        display_name: guest.name,
        score: 0,
        word_submitted: false,
        word_revealed: false,
        is_eliminated: false,
        color: PLAYER_COLORS[0]
      });
      navigate(`/mystery/${code}`);
    } catch (e) {
      toast({ title: 'Failed to create game', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast({ title: 'Enter a room code', variant: 'destructive' }); return; }
    setLoading('join');
    try {
      const guest = getGuestIdentity();
      const rooms = await MysteryRoom.filter({ room_code: code });
      if (!rooms?.length) { toast({ title: 'Room not found', variant: 'destructive' }); return; }
      const room = rooms[0];
      if (room.status !== 'lobby') { toast({ title: 'Game already started', variant: 'destructive' }); return; }
      const existing = await MysteryPlayer.filter({ room_code: code, user_id: guest.id });
      if (!existing?.length) {
        const players = await MysteryPlayer.filter({ room_code: code });
        if (players.length >= 12) { toast({ title: 'Room is full (max 12)', variant: 'destructive' }); return; }
        await MysteryPlayer.create({
          room_code: code,
          user_id: guest.id,
          display_name: guest.name,
          score: 0,
          word_submitted: false,
          word_revealed: false,
          is_eliminated: false,
          color: PLAYER_COLORS[players.length % PLAYER_COLORS.length]
        });
      }
      navigate(`/mystery/${code}`);
    } catch (e) {
      toast({ title: 'Failed to join', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-screen text-white flex items-start justify-center p-4 overflow-y-auto relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
        overscrollBehaviorY: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-slate-950/85" />

      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-center z-10 pointer-events-none transition-all"
          style={{ height: `${pullY}px` }}
        >
          <RefreshCw className={`w-5 h-5 text-violet-400 transition-transform ${pullY >= PULL_THRESHOLD ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${(pullY / PULL_THRESHOLD) * 360}deg)` }} />
        </div>
      )}
      {/* How to play button */}
      <button
        onClick={() => setShowHowToPlay(true)}
        className="absolute left-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition select-none-interactive text-slate-400 font-bold text-lg"
        style={{ top: 'max(env(safe-area-inset-top), 1rem)' }}
      >?</button>

      {/* Profile settings link */}
      <Link
        to="/profile-settings"
        className="absolute right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition select-none-interactive"
        style={{ top: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        <Settings className="w-5 h-5 text-slate-400" />
      </Link>

      {/* How to play modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }}
            className="w-full max-w-md rounded-3xl bg-slate-900 ring-1 ring-white/10 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{t.howToPlay}</h2>
              <button onClick={() => setShowHowToPlay(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              {t.howToPlaySteps.map(({ title, body }, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 ring-1 ring-violet-400/30 flex items-center justify-center shrink-0 text-violet-300 font-bold text-xs mt-0.5">{idx+1}</div>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-slate-400 mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHowToPlay(false)}
              className="mt-6 w-full h-11 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm transition">
              {t.gotIt}
            </button>
          </motion.div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-4">
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', duration:0.8 }}
            className="flex items-end justify-center gap-1 pt-4 pb-2">
            <img src={mascotRed} alt="" className="w-16 sm:w-20 drop-shadow-2xl -mb-1 shrink-0" />
            <img src={logoImage} alt="What's my Pick!" className="w-56 sm:w-64 drop-shadow-2xl shrink-0" />
            <img src={mascotBlue} alt="" className="w-16 sm:w-20 drop-shadow-2xl -mb-1 shrink-0" />
          </motion.div>
          <p className="text-slate-200 text-base font-medium mb-1 drop-shadow">{t.tagline}</p>
          <p className="text-slate-300 text-sm drop-shadow">{t.subtitle}</p>
        </motion.div>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
          className="grid grid-cols-3 gap-3 mb-8 text-center">
          <div className="flex flex-col items-center">
            <img src={badgePlayers} alt="" className="w-full max-w-[110px] drop-shadow-lg" />
          </div>
          <div className="flex flex-col items-center">
            <img src={badgeGuessing} alt="" className="w-full max-w-[110px] drop-shadow-lg" />
          </div>
          <div className="flex flex-col items-center">
            <img src={badgeRealtime} alt="" className="w-full max-w-[110px] drop-shadow-lg" />
          </div>
        </motion.div>

        {!nameSet ? (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="space-y-3">
            <p className="text-center text-slate-300 font-medium mb-2">{t.whatsYourName}</p>
            <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmName()}
              placeholder={t.displayNamePlaceholder}
              className="h-14 text-lg text-center bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-400" />
            <Button onClick={confirmName}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 border-0">
              {t.letsPlay}
            </Button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="space-y-3">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-slate-400 text-sm">{t.playingAs} <span className="text-white font-semibold">{getGuestIdentity().name}</span></span>
              <button onClick={() => { localStorage.removeItem('mystery_guest_name'); setNameSet(false); setNameInput(''); }}
                className="text-xs text-slate-500 hover:text-slate-300 underline min-h-[44px] px-2 select-none">{t.change}</button>
            </div>
            <Button onClick={handleCreate} disabled={loading !== null}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 border-0 shadow-lg shadow-violet-500/25">
              <Plus className="w-5 h-5 mr-2" />
              {loading === 'create' ? t.creating : t.createGame}
            </Button>
            <button onClick={() => setIsPublic(v => !v)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ring-1 min-h-[44px] select-none ${isPublic ? 'bg-violet-500/20 ring-violet-400/40 text-violet-300' : 'bg-white/5 ring-white/10 text-slate-400 hover:text-slate-300'}`}>
              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isPublic ? t.publicLobby : t.privateLobby}
            </button>
            <div className="flex gap-2">
              <Input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder={t.roomCodePlaceholder} maxLength={6}
                className="h-14 text-lg font-mono tracking-widest text-center uppercase bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-400" />
              <Button onClick={handleJoin} disabled={loading !== null} variant="secondary"
                className="h-14 px-6 bg-white/10 hover:bg-white/15 border-white/10 text-white">
                <LogIn className="w-5 h-5" />
              </Button>
            </div>

            {/* Public lobbies */}
            <div className="pt-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                <button
                  onClick={() => setShowLobbies(v => !v)}
                  className="flex items-center gap-2 flex-1 min-h-[44px] text-left select-none"
                >
                  <Globe className="w-4 h-4 text-violet-400 shrink-0" />
                  <p className="text-sm font-medium text-slate-300 flex-1">{t.openLobbies}</p>
                  {publicLobbies.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30">
                      {publicLobbies.length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showLobbies ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={fetchLobbies}
                  disabled={lobbiesLoading}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center select-none shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${lobbiesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {showLobbies && (
                lobbiesLoading ? (
                  <p className="text-center text-slate-500 text-sm py-4">{t.loading}</p>
                ) : publicLobbies.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-4">{t.noOpenLobbies}</p>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 space-y-2 overflow-hidden">
                    {publicLobbies.map(room => (
                      <motion.button key={room.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={async () => {
                          setJoinCode(room.room_code);
                          const guest = getGuestIdentity();
                          setLoading('join');
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
                          } catch(e) {
                            toast({ title: 'Failed to join', description: e.message, variant: 'destructive' });
                          } finally {
                            setLoading(null);
                          }
                        }}
                        disabled={loading !== null}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-violet-400/40 transition text-left disabled:opacity-50">
                        <div>
                          <p className="font-semibold text-white text-sm">{room.host_name}'s lobby</p>
                          <p className="text-xs text-slate-400 font-mono">{room.room_code}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span className="mr-2">{t.waiting}</span>
                          <LogIn className="w-4 h-4 text-violet-400" />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}