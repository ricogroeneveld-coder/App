import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Settings, X, ChevronRight, Crown, Users, HelpCircle, Globe } from 'lucide-react';
import { getGuestIdentity, setGuestName, hasGuestName } from '@/lib/guestIdentity';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/LanguageContext';
import logoImage from '../../logo.webp';
import mascotRed from '../../mascot-red.webp';
import mascotBlue from '../../mascot-blue.webp';

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [nameSet, setNameSet] = useState(hasGuestName());
  const [isPublic] = useState(true);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    setNameSet(hasGuestName());
  }, []);

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
      className="h-screen text-white flex items-center justify-center p-4 overflow-hidden relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
      }}
    >
      <div className="fixed inset-0 -z-10 bg-[#07040f]" />
      {/* Soft light entering from above — sells a single overhead light source */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 120% 38% at 50% -8%, rgba(255,255,255,0.05), transparent 60%)' }} />
      {/* Focused spotlight directly behind the logo — tighter falloff, less wash */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 46% 26% at 50% 21%, rgba(160,100,255,0.42), transparent 68%)' }} />
      {/* Broad ambient wash, kept subtle */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 15%, rgba(140,90,220,0.22), transparent 70%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(70,32,140,0.18), transparent 62%)' }} />
      {/* Whisper of warm undertone low in frame — slight color variation so it never reads flat */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 55% 26% at 50% 96%, rgba(140,70,20,0.07), transparent 65%)' }} />
      <div className="fixed inset-0 -z-10 opacity-70" style={{
        backgroundImage: 'radial-gradient(1.5px 1.5px at 12% 12%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 28% 6%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 65% 5%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 80% 14%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 92% 8%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 6% 30%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 95% 28%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 4% 55%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 93% 50%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 15% 68%, rgba(255,255,255,0.35), transparent), radial-gradient(1.5px 1.5px at 88% 70%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 40% 78%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 70% 88%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 25% 92%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 55% 95%, rgba(255,255,255,0.35), transparent)',
        backgroundSize: '100% 100%',
        animation: 'twinkle 6s ease-in-out infinite alternate, driftSlow 50s ease-in-out infinite alternate',
        willChange: 'transform, opacity',
      }} />
      <div className="fixed inset-0 -z-10" style={{ boxShadow: 'inset 0 0 min(42vw,290px) rgba(0,0,0,0.92)' }} />

      {/* How to play button */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button
          onClick={() => setShowHowToPlay(true)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-b from-white/[0.07] to-black/20 backdrop-blur-sm ring-1 ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 hover:ring-violet-400/40 transition-all duration-150 active:scale-[0.98] select-none-interactive text-slate-200"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Profile settings link */}
      <div className="absolute right-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <Link
          to="/profile-settings"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-b from-white/[0.07] to-black/20 backdrop-blur-sm ring-1 ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 hover:ring-violet-400/40 transition-all duration-150 active:scale-[0.98] select-none-interactive"
        >
          <Settings className="w-5 h-5 text-slate-200" />
        </Link>
      </div>

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

      <div className="relative z-10 w-full max-w-md -mt-4">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-5">
          <div className="hero-shift">
            <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', duration:0.8 }}
              className="relative flex items-center justify-center pt-2 pb-1">
              <img src={mascotRed} alt="" className="absolute z-0 left-[9px] sm:left-[-15px] top-[28%] w-16 sm:w-24" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }} />
              <img src={mascotBlue} alt="" className="absolute z-0 right-[9px] sm:right-[-15px] top-[28%] w-16 sm:w-24" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }} />
              <motion.img src={logoImage} alt="What's my Pick!"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-[267px] sm:w-[305px]"
                style={{ filter: 'drop-shadow(0 0 18px rgba(168,109,255,0.35)) drop-shadow(0 10px 14px rgba(0,0,0,0.45))' }} />
            </motion.div>
            <p className="text-center text-[18px] font-semibold text-white/[0.78] tracking-wide mt-2 translate-y-3">
              {t.tagline}
            </p>
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
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
          <div className="space-y-5 cards-shift">
            {/* Profile card */}
            <div className="relative h-20 rounded-[28px] bg-gradient-to-b from-white/[0.08] to-black/[0.18] backdrop-blur-md ring-1 ring-[#6d28d9]/60 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_16px_-8px_rgba(0,0,0,0.55),0_20px_30px_-18px_rgba(0,0,0,0.5),0_0_12px_-6px_rgba(109,40,217,0.45),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.25)] px-4 flex items-center gap-3 overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative w-[52px] h-[52px] rounded-full bg-gradient-to-br from-[#9d5cff] to-[#3b0f8f] ring-2 ring-[#9d5cff]/50 shadow-[0_3px_6px_-1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                <span className="pointer-events-none absolute -top-2 -left-2 w-7 h-7 rounded-full bg-white/35 blur-[5px]" />
                <span className="relative">{getGuestIdentity().name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm text-slate-300 min-w-0 truncate">
                {t.playingAs} <span className="text-amber-400 font-bold">{getGuestIdentity().name}</span>{' '}
                <Crown className="inline w-3.5 h-3.5 text-amber-400 -mt-0.5" fill="currentColor" />
              </span>
              <button onClick={() => { localStorage.removeItem('mystery_guest_name'); setNameSet(false); setNameInput(''); }}
                className="ml-auto shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-b from-white/[0.06] to-black/10 ring-1 ring-violet-500/50 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-bold text-white hover:bg-violet-500/15 hover:ring-violet-400/70 transition-all duration-150 active:scale-[0.98] select-none">
                {t.change}
              </button>
            </div>

            {/* Create Game */}
            <button onClick={handleCreate} disabled={loading !== null}
              className="relative w-full h-20 rounded-[28px] bg-[linear-gradient(180deg,#fdeeb8_0%,#ffcb45_16%,#e08e05_40%,#a85800_66%,#5e2c00_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.4),0_10px_18px_-8px_rgba(0,0,0,0.55),0_20px_30px_-16px_rgba(0,0,0,0.4),0_0_8px_-8px_rgba(255,180,60,0.22),0_0_0_1px_rgba(255,214,120,0.45),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-8px_14px_-6px_rgba(110,45,0,0.42)] px-4 flex items-center gap-2.5 disabled:opacity-60 transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:brightness-[1.04] overflow-hidden">
              <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 60% at 50% -8%, rgba(255,255,255,0.55), transparent 70%)' }} />
              <span className="pointer-events-none absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmerSweep 13s ease-in-out infinite' }} />
              <span className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" fill="currentColor" />
              </span>
              <span className="relative text-left flex-1 min-w-0">
                <span className="block text-base font-extrabold tracking-tight text-[#2c1500] leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{loading === 'create' ? t.creating : t.createGame}</span>
                <span className="block text-xs font-medium text-[#4a2c0c] leading-tight">{t.createGameDesc}</span>
              </span>
              <span className="relative w-10 h-10 rounded-full bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-6 h-6 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </span>
            </button>

            {/* Join Game */}
            <div className="relative h-20 rounded-[28px] bg-gradient-to-b from-[#2a1150] via-[#1c0b3a] to-[#0d0620] shadow-[0_2px_3px_rgba(0,0,0,0.4),0_10px_18px_-8px_rgba(0,0,0,0.55),0_20px_30px_-16px_rgba(0,0,0,0.4),0_0_14px_-8px_rgba(56,189,248,0.4),0_0_0_1px_rgba(56,189,248,0.45),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-8px_14px_-6px_rgba(0,0,0,0.42)] px-4 flex items-center gap-2.5 transition-transform duration-150 hover:-translate-y-0.5 overflow-hidden">
              <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-t-[24px] bg-gradient-to-b from-white/[0.06] to-transparent" />
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0a2233] to-[#040d16] ring-1 ring-sky-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-sky-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </span>
              <span className="text-left min-w-0 shrink-0">
                <span className="block text-base font-extrabold tracking-tight text-white leading-tight">{t.joinGame}</span>
                <span className="hidden md:block text-xs font-medium text-slate-400 leading-tight">{t.joinGameDesc}</span>
              </span>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder={t.roomCodePlaceholder} maxLength={6}
                className="relative flex-1 min-w-0 h-10 rounded-xl bg-gradient-to-b from-[#1e0d42]/80 to-[#0a0518]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(183,148,255,0.3)] px-2 outline-none text-white text-sm tracking-wide uppercase placeholder:text-white/40 placeholder:tracking-normal placeholder:text-xs focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1.5px_rgba(56,189,248,0.7),0_0_10px_-2px_rgba(56,189,248,0.5)] transition-shadow" />
              <button onClick={handleJoin} disabled={loading !== null}
                className="relative h-10 px-2 shrink-0 rounded-xl bg-gradient-to-b from-sky-300 via-sky-400 to-sky-700 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_10px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 text-white font-bold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 overflow-hidden">
                <span className="pointer-events-none absolute inset-x-0.5 top-0.5 h-1/2 rounded-t-[10px] bg-gradient-to-b from-white/40 to-transparent" />
                <span className="relative">{t.join}</span>
              </button>
            </div>

            {/* Browse Games */}
            <Link to="/browse-lobbies"
              className="relative block h-20 rounded-[28px] bg-gradient-to-b from-[#1f7a4f] via-[#0d3624] to-[#03130b] shadow-[0_2px_3px_rgba(0,0,0,0.4),0_10px_18px_-8px_rgba(0,0,0,0.55),0_20px_30px_-16px_rgba(0,0,0,0.4),0_0_14px_-8px_rgba(74,222,128,0.35),0_0_0_1px_rgba(74,222,128,0.45),inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-8px_14px_-6px_rgba(0,0,0,0.42)] px-4 flex items-center gap-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:brightness-[1.05] active:scale-[0.98] overflow-hidden">
              <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-t-[24px] bg-gradient-to-b from-white/[0.12] to-transparent" />
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#062217] to-[#020c08] ring-1 ring-green-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </span>
              <span className="text-left flex-1 min-w-0">
                <span className="block text-base font-extrabold tracking-tight text-white leading-tight truncate">{t.openLobbies}</span>
                <span className="block text-xs font-medium text-slate-400 truncate">{t.openLobbiesDesc}</span>
              </span>
              <span className="w-10 h-10 rounded-full bg-gradient-to-b from-[#062217] to-[#020c08] ring-1 ring-green-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-6 h-6 text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </span>
            </Link>
          </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}