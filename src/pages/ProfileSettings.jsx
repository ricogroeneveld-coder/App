import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Trash2, AlertTriangle, Globe, DoorOpen, Volume2, LogOut, LogIn, RotateCcw, Shield } from 'lucide-react';
import { getGuestIdentity, clearGuestIdentity } from '@/lib/guestIdentity';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { isSoundEnabled, setSoundEnabled, playCorrect } from '@/lib/sounds';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import { getProfile, loadProfile } from '@/lib/playerProfile';
import { restorePurchases } from '@/lib/payments';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, logout } = useAuth();
  const { lang, switchLang, t } = useLang();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [leavingGame, setLeavingGame] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [cosmeticProfile, setCosmeticProfile] = useState(getProfile());
  const [restoring, setRestoring] = useState(false);
  useEffect(() => { let live = true; loadProfile().then(p => { if (live) setCosmeticProfile(p); }); return () => { live = false; }; }, []);
  const isRegistered = !!currentUser;

  // Apple requires a visible "restore purchases" for non-consumable IAP.
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await restorePurchases();
      if (res.ok) toast({ title: t.restoreDone });
      else toast({ title: t.purchaseUnavailable });
    } finally {
      setRestoring(false);
    }
  };

  const toggleSound = (next) => {
    setSoundOn(next);
    setSoundEnabled(next);
    // Play a sample so the user hears what enabling sounds like.
    if (next) playCorrect();
  };

  const guest = getGuestIdentity();

  // Gameplay always runs on the guest identity, signed in or not (see
  // src/lib/AuthContext.jsx), so this always checks the guest id.
  useEffect(() => {
    const checkActiveGame = async () => {
      try {
        const uid = guest?.id;
        if (!uid) return;
        const myPlayers = await MysteryPlayer.filter({ user_id: uid });
        for (const p of myPlayers || []) {
          const rooms = await MysteryRoom.filter({ room_code: p.room_code });
          const room = rooms?.[0];
          if (room && (room.status === 'playing' || room.status === 'word_entry')) {
            setActiveGame({ room, player: p });
            return;
          }
        }
      } catch (e) {}
    };
    checkActiveGame();
  }, []);

  // Guest profile deletion — clears local game records + the guest identity itself.
  const handleDeleteGuestProfile = async () => {
    setDeleting(true);
    try {
      const players = await MysteryPlayer.filter({ user_id: guest.id });
      for (const p of players || []) {
        await MysteryPlayer.delete(p.id);
      }
      clearGuestIdentity();
      toast({ title: 'Profile deleted', description: 'Your local profile and game data have been removed.' });
      navigate('/');
    } catch (e) {
      toast({ title: 'Failed to delete profile', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Registered account deletion — calls the delete-account edge function
  // (needs the service_role key, which never touches the browser) to
  // actually remove the Supabase Auth account, then clears local game data too.
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      const players = await MysteryPlayer.filter({ user_id: guest.id });
      for (const p of players || []) {
        await MysteryPlayer.delete(p.id);
      }
      clearGuestIdentity();
      await logout();
      toast({ title: 'Account deleted', description: 'Your account and game records have been removed.' });
      navigate('/');
    } catch (e) {
      toast({ title: 'Failed to delete account', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!activeGame) return;
    setLeavingGame(true);
    try {
      await MysteryPlayer.update(activeGame.player.id, { is_eliminated: true });
      setActiveGame(null);
      toast({ title: t.leaveGame, description: activeGame.room.room_code });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLeavingGame(false);
    }
  };

  const handleDelete = isRegistered ? handleDeleteAccount : handleDeleteGuestProfile;

  const displayName = isRegistered
    ? (currentUser.user_metadata?.full_name || currentUser.email)
    : (guest.name || 'Guest Player');
  const displaySub = isRegistered ? currentUser.email : `${guest.id?.slice(0, 12)}…`;

  return (
    <div
      className="h-dvh overflow-hidden text-white flex flex-col relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <GameBackground />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-4">
        <button
          onClick={() => navigate('/')}
          className="header-btn"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t.profileSettings}</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pb-6 max-w-md mx-auto w-full space-y-3">
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex items-center gap-3.5"
        >
          <PlayerAvatar profile={cosmeticProfile} name={displayName} size={52} />
          <div className="min-w-0">
            <p className="font-semibold text-white text-lg truncate">{displayName}</p>
            <p className="text-slate-400 text-sm font-mono truncate">{displaySub}</p>
            {isRegistered && (
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300 font-medium">
                {t.registeredAccount}
              </span>
            )}
          </div>
        </motion.div>

        {/* Sign in prompt — guests only. Purely optional: gameplay already
            works fully without an account, this is just for anyone who wants
            one (e.g. to sign in on another device). */}
        {!isRegistered && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <LogIn className="w-5 h-5 text-violet-400 flex-shrink-0" />
              <p className="font-semibold text-white">{t.signInTitle}</p>
            </div>
            <p className="text-slate-400 text-sm mb-3">{t.signInDesc}</p>
            <Link to="/login">
              <Button className="violet-solid-btn w-full h-11 border-0 bg-transparent hover:bg-transparent font-bold select-none-interactive">
                {t.signInCta}
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Language toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="glass-panel rounded-[20px] p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <p className="font-semibold text-white">{t.language}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => switchLang('en')}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold transition ring-1 select-none-interactive ${lang === 'en' ? 'bg-gradient-to-b from-violet-400 via-violet-500 to-violet-800 ring-violet-400/60 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_-2px_rgba(0,0,0,0.5)]' : 'bg-white/5 ring-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => switchLang('nl')}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold transition ring-1 select-none-interactive ${lang === 'nl' ? 'bg-gradient-to-b from-violet-400 via-violet-500 to-violet-800 ring-violet-400/60 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_-2px_rgba(0,0,0,0.5)]' : 'bg-white/5 ring-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              🇳🇱 Nederlands
            </button>
          </div>
        </motion.div>

        {/* Sound effects toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel rounded-[20px] p-4 flex items-center gap-3"
        >
          <Volume2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">{t.soundEffects}</p>
            <p className="text-slate-400 text-sm">{t.soundEffectsDesc}</p>
          </div>
          <Switch
            checked={soundOn}
            onCheckedChange={toggleSound}
            className="select-none-interactive"
          />
        </motion.div>

        {/* Purchases & privacy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel rounded-[20px] p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{t.restorePurchases}</p>
              <p className="text-slate-400 text-sm">{t.restorePurchasesDesc}</p>
            </div>
            <button onClick={handleRestore} disabled={restoring}
              className="shrink-0 h-11 px-4 rounded-xl bg-white/5 ring-1 ring-white/15 text-sm font-bold text-slate-200 hover:bg-white/10 transition-all duration-150 active:scale-[0.98]">
              {restoring ? '…' : t.restoreBtn}
            </button>
          </div>
          <a href="/privacy.html" target="_blank" rel="noopener"
            className="flex items-center gap-3 pt-3 border-t border-white/10 text-sm font-semibold text-slate-300 hover:text-white transition min-h-[44px]">
            <Shield className="w-5 h-5 text-violet-400 flex-shrink-0" />
            {t.privacyPolicy}
          </a>
        </motion.div>

        {/* Leave active game */}
        {activeGame && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.045 }}
            className="glass-panel rounded-[20px] p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <DoorOpen className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-white">{t.leaveGame}</p>
                <p className="text-slate-400 text-sm font-mono">{activeGame.room.room_code}</p>
              </div>
            </div>
            <Button
              onClick={handleLeaveGame}
              disabled={leavingGame}
              className="w-full h-11 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 hover:border-rose-400/50 font-semibold select-none-interactive"
              variant="ghost"
            >
              <DoorOpen className="w-4 h-4 mr-2" />
              {leavingGame ? '…' : t.leaveGame}
            </Button>
          </motion.div>
        )}

        {/* Sign out (registered users only) */}
        {isRegistered && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-panel rounded-[20px] p-4"
          >
            <Button
              onClick={() => logout()}
              variant="ghost"
              className="w-full h-11 bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 font-semibold select-none-interactive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t.signOut}
            </Button>
          </motion.div>
        )}

        {/* Delete section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-panel rounded-[20px] p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">
                {isRegistered ? t.deleteAccount : t.deleteProfile}
              </p>
              <p className="text-slate-400 text-sm mt-0.5">
                {isRegistered ? t.deleteAccountDesc : t.deleteProfileDesc}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowConfirm(true)}
            className="w-full h-11 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 hover:border-rose-400/50 font-semibold select-none-interactive"
            variant="ghost"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isRegistered ? t.deleteMyAccount : t.deleteMyProfile}
          </Button>
        </motion.div>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-sm bg-slate-900/95 p-5 space-y-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">{t.areYouSure}</p>
                  <p className="text-slate-400 text-sm">{t.cannotBeUndone}</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {isRegistered ? t.deleteAccountConfirm : t.deleteProfileConfirm}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                  variant="ghost"
                  className="flex-1 h-11 bg-white/5 hover:bg-white/10 text-white border-white/10 select-none-interactive"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-11 bg-rose-500 hover:bg-rose-600 border-0 text-white font-semibold select-none-interactive"
                >
                  {deleting ? t.deleting : t.yesDelete}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
