import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MysteryRoom, MysteryPlayer } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { Settings, X, ChevronRight, Crown, Users, HelpCircle, Globe, Lock, Bot } from 'lucide-react';
import { getGuestIdentity, setGuestName, hasGuestName, MAX_NAME_LENGTH } from '@/lib/guestIdentity';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import { Dialog } from '@/components/ui/dialog';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import { loadProfile, getProfile, subscribeProfile, ensureDailyLogin } from '@/lib/playerProfile';
import { ALL_COSMETICS, cosmeticById } from '@/lib/cosmetics';
import { isIOS } from '@/lib/platform';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { track } from '@/lib/analytics';
import { TERMS_URL, PRIVACY_URL } from '@/lib/links';
import heroImage from '../../home-hero.webp';

const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [nameSet, setNameSet] = useState(hasGuestName());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [pendingDailyReward, setPendingDailyReward] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [profile, setProfile] = useState(getProfile());
  // iOS kills backgrounded apps constantly — without this, a player whose
  // game is still running lands on Home with no trace of it and has to
  // remember and retype the code. One query on mount finds it.
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (hasGuestName()) {
      (async () => {
        try {
          const guest = getGuestIdentity();
          const myPlayers = await MysteryPlayer.filter({ user_id: guest.id });
          for (const p of myPlayers || []) {
            if (p.is_eliminated) continue;
            const rooms = await MysteryRoom.filter({ room_code: p.room_code });
            const room = rooms?.[0];
            if (room && room.status !== 'finished') {
              if (!cancelled) setActiveGame(room);
              return;
            }
          }
        } catch { /* offline — banner just doesn't show */ }
      })();
    }
    loadProfile().then(p => { if (!cancelled) setProfile(p); });
    if (hasGuestName()) {
      ensureDailyLogin().then(res => {
        if (res && !cancelled) {
          toast({ title: `🎁 ${t.dailyReward}: +${res.picks} Picks`, description: res.streak > 1 ? `🔥 ${res.streak} ${t.dayStreak}` : undefined });
        }
      });
    }
    const unsub = subscribeProfile(setProfile);
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    setNameSet(hasGuestName());
  }, []);

  // Name gate: keep the layout perfectly still while typing. By default the
  // iOS keyboard shrinks the webview, which re-centers this screen's
  // vertically-centered content (visible as the whole page jumping up).
  // While the name gate is showing, let the keyboard overlay instead —
  // the input sits in the top half, so nothing important is covered.
  useEffect(() => {
    if (!isIOS() || nameSet) return;
    Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
    return () => { Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {}); };
  }, [nameSet]);

  const confirmName = () => {
    if (!nameInput.trim()) { toast({ title: t.enterYourName, variant: 'destructive' }); return; }
    setGuestName(nameInput.trim());
    setNameSet(true);
    track('name_set', { via: 'home' });
    // A brand-new player has no reason to know the rules modal exists behind
    // the header icon — show it once, right after they've named themselves,
    // instead of leaving it to be discovered by accident. The day-1 reward
    // toast waits until they click it away (see closeHowToPlay) — firing it
    // underneath the modal meant it was gone before they ever saw it.
    setPendingDailyReward(true);
    setShowHowToPlay(true);
  };

  const closeHowToPlay = () => {
    setShowHowToPlay(false);
    if (pendingDailyReward) {
      setPendingDailyReward(false);
      // First session skips the mount-time daily check (no name yet) — grant
      // the day-1 login reward now so the economy says hello right away.
      ensureDailyLogin().then(res => {
        if (res) toast({ title: `🎁 ${t.dailyReward}: +${res.picks} Picks` });
      });
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreate = async (isPublic) => {
    setLoading('create');
    try {
      const guest = getGuestIdentity();
      // room_code is UNIQUE in the DB — on the (rare) collision with a live
      // room, retry with a fresh code instead of surfacing a cryptic error.
      let code;
      let room = null;
      for (let attempt = 0; attempt < 3 && !room; attempt++) {
        code = generateCode();
        try {
          room = await MysteryRoom.create({
            room_code: code,
            host_id: guest.id,
            host_name: guest.name,
            status: 'lobby',
            current_questioner_index: 0,
            round_number: 1,
            max_rounds: 10,
            is_public: isPublic,
            // The room's language for GENERATED question text, so a mixed
            // Dutch/English room doesn't fire auto-questions half of it can't
            // read (migration 0014).
            language: lang
          });
        } catch (err) {
          if (err?.code !== '23505' || attempt === 2) throw err;
        }
      }
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
      track('lobby_created', { public: isPublic });
      navigate(`/mystery/${code}`);
    } catch (e) {
      toast({ title: t.failedToCreate, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast({ title: t.enterRoomCode, variant: 'destructive' }); return; }
    setLoading('join');
    try {
      const guest = getGuestIdentity();
      const rooms = await MysteryRoom.filter({ room_code: code });
      if (!rooms?.length) { toast({ title: t.roomNotFound, variant: 'destructive' }); return; }
      const room = rooms[0];
      // Players who are still part of this game (left the app, lost
      // connection, phone died) can always come back in — only genuinely
      // new players are blocked once the game is underway.
      const existing = await MysteryPlayer.filter({ room_code: code, user_id: guest.id });
      if (existing?.length) { navigate(`/mystery/${code}`); return; }
      if (room.status !== 'lobby' && room.status !== 'word_entry') {
        toast({ title: t.gameAlreadyStarted, variant: 'destructive' }); return;
      }
      const players = await MysteryPlayer.filter({ room_code: code });
      if (players.length >= 12) { toast({ title: t.roomFull, variant: 'destructive' }); return; }
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
      track('lobby_joined', { via: 'code' });
      navigate(`/mystery/${code}`);
    } catch (e) {
      toast({ title: t.failedToJoin, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="h-dvh text-white flex items-center justify-center p-4 overflow-hidden relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
      }}
    >
      <GameBackground spotlight />

      {/* How to play button */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => setShowHowToPlay(true)} className="header-btn" aria-label={t.howToPlayShort}>
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Profile settings link */}
      <div className="absolute right-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <Link to="/profile-settings" className="header-btn" aria-label={t.settings}>
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      {/* How to play modal — accessible Dialog (focus trap, Escape, scroll lock) */}
      {showHowToPlay && (
        <Dialog onClose={closeHowToPlay} placement="bottom" titleId="howto-title"
          panelClassName="glass-card bg-slate-900/95 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 id="howto-title" className="text-lg font-bold text-white">{t.howToPlay}</h2>
              <button onClick={closeHowToPlay} className="w-11 h-11 -m-1 rounded-xl hover:bg-white/10 text-slate-400 flex items-center justify-center" aria-label={t.gotIt}>
                <X className="w-5 h-5" />
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
            <button onClick={closeHowToPlay}
              className="violet-solid-btn mt-6 w-full h-11 text-sm">
              {t.gotIt}
            </button>
        </Dialog>
      )}

      {/* Game visibility sheet — choosing an option creates the lobby */}
      {showCreateSheet && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => loading === null && setShowCreateSheet(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            className="glass-card w-full max-w-md bg-slate-900/95 p-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-extrabold tracking-tight text-white">{t.createGame}</h2>
              <button onClick={() => setShowCreateSheet(false)} disabled={loading !== null}
                className="p-2.5 -m-1 rounded-xl hover:bg-white/10 text-slate-400 disabled:opacity-40" aria-label={t.cancel}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="section-label mb-3">{t.gameVisibility}</p>
            <div className="space-y-2.5">
              <button onClick={() => handleCreate(true)} disabled={loading !== null}
                className="glass-panel w-full p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20 disabled:opacity-60">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#062217] to-[#020c08] ring-1 ring-green-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold text-white leading-tight">{loading === 'create' ? t.creating : t.publicLobby}</span>
                  <span className="block text-xs font-medium text-slate-400 leading-tight">{t.publicLobbyDesc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
              <button onClick={() => handleCreate(false)} disabled={loading !== null}
                className="glass-panel w-full p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20 disabled:opacity-60">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-violet-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold text-white leading-tight">{loading === 'create' ? t.creating : t.privateLobby}</span>
                  <span className="block text-xs font-medium text-slate-400 leading-tight">{t.privateLobbyDesc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
              {/* Play vs bots — local practice match, no room is created */}
              <button onClick={() => { setShowCreateSheet(false); navigate('/practice'); }} disabled={loading !== null}
                className="glass-panel w-full p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20 disabled:opacity-60">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#0a2233] to-[#040d16] ring-1 ring-sky-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-sky-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold text-white leading-tight">{t.practiceMode}</span>
                  <span className="block text-xs font-medium text-slate-400 leading-tight">{t.practiceModeDesc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md -mt-4">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-5">
          <div className="hero-shift">
            <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', duration:0.8 }}
              className="relative flex items-center justify-center pt-2 pb-1">
              {/* One combined logo+mascots asset — the composition stays
                  identical on every phone width. Idle life: a slow float and a
                  glow breath share the same 6s clock (phase-locked, the glow
                  peaks as the logo rises). */}
              <div className="hero-float relative z-10 w-full max-w-[400px]">
                <span aria-hidden className="hero-glow" />
                <img src={heroImage} alt="What's my Pick!" className="relative w-full"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(168,109,255,0.4)) drop-shadow(0 10px 14px rgba(0,0,0,0.45))' }} />
              </div>
            </motion.div>
            <p className="text-center text-[18px] font-semibold text-white/[0.78] tracking-wide mt-2 translate-y-3">
              {t.tagline}
            </p>
          </div>
        </motion.div>

        {!nameSet ? (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="space-y-3">
            <p className="text-center text-slate-300 font-semibold mb-2">{t.whatsYourName}</p>
            <input value={nameInput} onChange={e => setNameInput(e.target.value.slice(0, MAX_NAME_LENGTH))}
              onKeyDown={e => e.key === 'Enter' && confirmName()}
              placeholder={t.displayNamePlaceholder} enterKeyHint="go" autoComplete="nickname" autoCorrect="off"
              maxLength={MAX_NAME_LENGTH}
              className="inset-input w-full h-14 text-lg text-center rounded-2xl" />
            <button onClick={confirmName}
              className="gold-btn w-full h-14 rounded-2xl flex items-center justify-center">
              <span className="relative text-lg font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                {t.letsPlay}
              </span>
            </button>
            {/* UGC/App Store: surface Terms + Privacy at the entry point (LAUNCH-3). */}
            <p className="text-center text-[11px] text-slate-500 leading-relaxed px-4">
              {t.byPlayingAgree}{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener" className="underline hover:text-slate-300">{t.termsOfUse}</a>
              {' & '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener" className="underline hover:text-slate-300">{t.privacyPolicy}</a>.
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
          <div className="space-y-5 cards-shift">
            {/* Game-in-progress banner — the way back into a round after iOS
                killed the backgrounded app. Without it the player would have
                to remember and retype the room code. */}
            {activeGame && (
              <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/mystery/${activeGame.room_code}`)}
                className="w-full h-12 -mb-2 rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.35)] px-4 flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] hover:ring-violet-300/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ animation: 'livePulse 2s ease-in-out infinite' }} />
                <span className="flex-1 min-w-0 text-left text-sm font-bold text-violet-100 truncate">
                  {t.gameInProgress} <span className="font-mono tracking-[0.12em] text-white">{activeGame.room_code}</span>
                </span>
                <span className="shrink-0 text-xs font-extrabold text-violet-200">{t.rejoinGame}</span>
                <ChevronRight className="w-4 h-4 text-violet-300 shrink-0" />
              </motion.button>
            )}
            {/* Profile card — tap opens the full profile */}
            <div onClick={() => navigate('/profile')} role="button" tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/profile')}
              className="relative h-20 rounded-[28px] bg-gradient-to-b from-white/[0.08] to-black/[0.18] backdrop-blur-md ring-1 ring-[#6d28d9]/60 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_16px_-8px_rgba(0,0,0,0.55),0_20px_30px_-18px_rgba(0,0,0,0.5),0_0_12px_-6px_rgba(109,40,217,0.45),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.25)] px-4 flex items-center gap-3 overflow-hidden cursor-pointer transition-transform duration-150 active:scale-[0.98]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <PlayerAvatar profile={profile} name={getGuestIdentity().name} size={52} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-300 truncate leading-tight">
                  {t.playingAs}{' '}
                  <span className={`font-bold ${cosmeticById(profile?.equipped?.nameColor)?.cls || 'text-amber-400'}`}>
                    {getGuestIdentity().name}
                  </span>{' '}
                  <Crown className="inline w-3.5 h-3.5 text-amber-400 -mt-0.5" fill="currentColor" />
                </span>
                {/* UX-8: a real, focusable button (was a span with onClick, which
                    keyboard/SR users couldn't reach) for the Shop shortcut. */}
                <button type="button" onClick={e => { e.stopPropagation(); navigate('/profile?tab=shop'); }}
                  aria-label={t.shop}
                  className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 leading-tight">
                  <span className="text-amber-300 tabular-nums">{profile?.picks || 0} Picks</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-violet-300">✨ {t.shop}</span>
                  {ALL_COSMETICS.some(c => c.source.type === 'shop' && !profile?.owned?.includes(c.id) && (profile?.picks || 0) >= c.source.price) && (
                    <span className="px-1 py-px rounded bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-[8px] font-extrabold leading-tight"
                      style={{ animation: 'livePulse 2.4s ease-in-out infinite' }}>
                      {t.newBadge}
                    </span>
                  )}
                </button>
              </span>
              <span className="ml-auto w-10 h-10 rounded-full bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-6 h-6 text-violet-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </span>
            </div>

            {/* Create Game */}
            <div className="gold-breathe">
            <button onClick={() => setShowCreateSheet(true)} disabled={loading !== null}
              className="relative w-full h-20 rounded-[28px] bg-[linear-gradient(180deg,#fdeeb8_0%,#ffcb45_16%,#e08e05_40%,#a85800_66%,#5e2c00_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.4),0_10px_18px_-8px_rgba(0,0,0,0.55),0_20px_30px_-16px_rgba(0,0,0,0.4),0_0_8px_-8px_rgba(255,180,60,0.22),0_0_0_1px_rgba(255,214,120,0.45),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-8px_14px_-6px_rgba(110,45,0,0.42)] px-4 flex items-center gap-2.5 disabled:opacity-60 transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:brightness-[1.04] overflow-hidden">
              <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 60% at 50% -8%, rgba(255,255,255,0.55), transparent 70%)' }} />
              <span className="pointer-events-none absolute inset-y-0 left-[-45%] w-[45%]" style={{ background: 'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.45) 50%, transparent 85%)', animation: 'shimmerSweep 5s linear infinite', willChange: 'transform, opacity' }} />
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
            </div>

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
                placeholder={t.roomCodePlaceholder} maxLength={6} enterKeyHint="go" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false}
                className="relative flex-1 min-w-0 h-11 rounded-xl bg-gradient-to-b from-[#1e0d42]/80 to-[#0a0518]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(183,148,255,0.3)] px-2 outline-none text-white text-base tracking-wide uppercase placeholder:text-white/40 placeholder:tracking-normal placeholder:text-xs focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1.5px_rgba(56,189,248,0.7),0_0_10px_-2px_rgba(56,189,248,0.5)] transition-shadow" />
              <button onClick={handleJoin} disabled={loading !== null}
                className="relative h-11 px-3 shrink-0 rounded-xl bg-gradient-to-b from-sky-300 via-sky-400 to-sky-700 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_10px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 text-white font-bold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 overflow-hidden">
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