import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Trash2, AlertTriangle, Globe, DoorOpen, Volume2, Vibrate, LogOut, LogIn, RotateCcw, Shield, LifeBuoy, FileText } from 'lucide-react';
import { getGuestIdentity, clearGuestIdentity } from '@/lib/guestIdentity';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { isSoundEnabled, setSoundEnabled, playCorrect } from '@/lib/sounds';
import { isHapticsEnabled, setHapticsEnabled, vibrate } from '@/lib/haptics';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import BannerArt from '@/components/progression/BannerArt';
import { cosmeticById, RARITIES } from '@/lib/cosmetics';
import { getProfile, loadProfile, deleteProfileData } from '@/lib/playerProfile';
import { restorePurchases } from '@/lib/payments';
import { isNativeApp } from '@/lib/platform';

// Public site pages (privacy / support / terms) — single source of truth in
// src/lib/links.js so the in-app links and the App Store metadata URL can't
// drift (LAUNCH-1).
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/lib/links';

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
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());
  const [cosmeticProfile, setCosmeticProfile] = useState(getProfile());
  const [restoring, setRestoring] = useState(false);
  const [iCloudStatus, setICloudStatus] = useState(null); // 'web' | 'ok' | 'none' | 'unavailable'
  // Hidden diagnostics: 7 taps on the page title reveal the iCloud-backup
  // health readout (read-only — grants nothing, safe to ship).
  const [diagTaps, setDiagTaps] = useState(0);
  const [diagLines, setDiagLines] = useState(null);
  const titleTapped = () => {
    const n = diagTaps + 1;
    setDiagTaps(n);
    if (n >= 7 && !diagLines) {
      setDiagLines(['Running checks…']);
      import('@/lib/cloudBackup').then(m => m.cloudBackupDiagnostics()).then(setDiagLines)
        .catch(e => setDiagLines([`diagnostics failed: ${e?.message || e}`]));
    }
  };
  useEffect(() => { let live = true; loadProfile().then(p => { if (live) setCosmeticProfile(p); }); return () => { live = false; }; }, []);
  useEffect(() => {
    let live = true;
    import('@/lib/cloudBackup').then(m => m.backupStatus()).then(s => { if (live) setICloudStatus(s); });
    return () => { live = false; };
  }, []);
  const isRegistered = !!currentUser;

  // Apple requires a visible "restore purchases" for non-consumable IAP.
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await restorePurchases();
      if (res.ok) toast({ title: t.restoreDone(res.restored || 0) });
      else if (res.reason === 'error') toast({ title: t.restoreFailed, variant: 'destructive' });
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

  const toggleHaptics = (next) => {
    setHapticsOn(next);
    setHapticsEnabled(next);
    // Feel a sample tick so enabling has the same immediate feedback as sound.
    if (next) vibrate(35);
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

  // Everything the privacy policy's "removes your data permanently" covers:
  // game rows, chat messages, the remote progression profile, and the local
  // identity/progression. Purchased packs are deliberately NOT touched —
  // they belong to the Apple ID and restore via Restore Purchases.
  const wipeMyData = async () => {
    const players = await MysteryPlayer.filter({ user_id: guest.id });
    for (const p of players || []) {
      await MysteryPlayer.delete(p.id);
    }
    // Chat messages carry the display name — they're part of "my data".
    try { await supabase.from('mystery_chats').delete().eq('user_id', guest.id); } catch { /* best-effort */ }
    await deleteProfileData();
    try {
      localStorage.removeItem('wmp_reported');
      localStorage.removeItem('wmp_muted');
    } catch { /* ignore */ }
    clearGuestIdentity();
  };

  // Guest profile deletion — clears local + remote data and the guest identity itself.
  const handleDeleteGuestProfile = async () => {
    setDeleting(true);
    try {
      await wipeMyData();
      toast({ title: t.profileDeleted, description: t.profileDeletedDesc });
      navigate('/');
    } catch (e) {
      toast({ title: t.deleteFailed, description: e.message, variant: 'destructive' });
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
      // Wipe game/profile data FIRST — the remote profile delete needs the
      // still-authenticated session that deleting the auth account destroys.
      await wipeMyData();
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await logout();
      toast({ title: t.accountDeleted, description: t.accountDeletedDesc });
      navigate('/');
    } catch (e) {
      toast({ title: t.deleteFailed, description: e.message, variant: 'destructive' });
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
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setLeavingGame(false);
    }
  };

  const handleDelete = isRegistered ? handleDeleteAccount : handleDeleteGuestProfile;

  const displayName = isRegistered
    ? (currentUser.user_metadata?.full_name || currentUser.email)
    : (guest.name || t.playerFallback);
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
          aria-label={t.backLabel}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight select-none" onClick={titleTapped}>{t.profileSettings}</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pt-1 pb-6 max-w-md mx-auto w-full space-y-3">
        {/* Hidden iCloud-backup diagnostics — revealed by 7 taps on the title */}
        {diagLines && (
          <div className="glass-panel rounded-[20px] p-4">
            <p className="font-semibold text-white text-sm mb-2">Backup diagnostics</p>
            <div className="space-y-1">
              {diagLines.map((line, i) => (
                <p key={i} className={`text-[11px] font-mono break-all ${/FAILED|ERROR|EMPTY|NOT/.test(line) ? 'text-rose-400' : 'text-emerald-300'}`}>{line}</p>
              ))}
            </div>
          </div>
        )}
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[20px] overflow-hidden ring-1 ring-white/15 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]"
        >
          <BannerArt banner={cosmeticById(cosmeticProfile.equipped?.banner)} animated className="absolute inset-0" motifScale={0.7} />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/50" />
          <div className="relative p-4 flex items-center gap-3.5">
            <span className="flex" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }}>
              <PlayerAvatar profile={cosmeticProfile} name={displayName} size={52} />
            </span>
            <div className="min-w-0">
              <p className={`font-extrabold text-lg leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] ${cosmeticById(cosmeticProfile.equipped?.nameColor)?.cls || 'text-white'}`}>{displayName}</p>
              {cosmeticById(cosmeticProfile.equipped?.title) && (
                <span className={`inline-flex items-center max-w-full h-5 mt-0.5 px-2 rounded-full text-[10px] font-extrabold ${RARITIES[cosmeticById(cosmeticProfile.equipped?.title).rarity].chip}`}>
                  <span className="truncate">{cosmeticById(cosmeticProfile.equipped?.title).name}</span>
                </span>
              )}
              {isRegistered && (
                <p className="text-slate-300 text-xs font-mono truncate mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{displaySub}</p>
              )}
              {isRegistered && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300 font-medium">
                  {t.registeredAccount}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sign in prompt — guests only, web only. Purely optional: gameplay
            already works fully without an account. Hidden in the native app:
            v1 ships account-less there (see src/lib/platform.js). */}
        {!isRegistered && !isNativeApp() && (
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

        {/* Haptics toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel rounded-[20px] p-4 flex items-center gap-3"
        >
          <Vibrate className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">{t.haptics}</p>
            <p className="text-slate-400 text-sm">{t.hapticsDesc}</p>
          </div>
          <Switch
            checked={hapticsOn}
            onCheckedChange={toggleHaptics}
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

          {/* iCloud backup status — the only signal a normal player gets
              that a reinstall would (or wouldn't) bring their progress
              back, instead of finding out the hard way. */}
          {iCloudStatus && iCloudStatus !== 'web' && (
            <p className={`text-xs font-semibold pt-1 ${iCloudStatus === 'ok' ? 'text-emerald-400/80' : 'text-amber-400/90'}`}>
              {iCloudStatus === 'ok' ? `✓ ${t.icloudBackedUp}` : `⚠ ${t.icloudNotBackedUp}`}
            </p>
          )}
          <a href={PRIVACY_URL} target="_blank" rel="noopener"
            className="flex items-center gap-3 pt-3 border-t border-white/10 text-sm font-semibold text-slate-300 hover:text-white transition min-h-[44px]">
            <Shield className="w-5 h-5 text-violet-400 flex-shrink-0" />
            {t.privacyPolicy}
          </a>
          <a href={SUPPORT_URL} target="_blank" rel="noopener"
            className="flex items-center gap-3 pt-3 border-t border-white/10 text-sm font-semibold text-slate-300 hover:text-white transition min-h-[44px]">
            <LifeBuoy className="w-5 h-5 text-violet-400 flex-shrink-0" />
            {t.supportFaq}
          </a>
          <a href={TERMS_URL} target="_blank" rel="noopener"
            className="flex items-center gap-3 pt-3 border-t border-white/10 text-sm font-semibold text-slate-300 hover:text-white transition min-h-[44px]">
            <FileText className="w-5 h-5 text-violet-400 flex-shrink-0" />
            {/* TODO i18n: add a `termsOfUse` key to en+nl in LanguageContext (out of scope for this change set). */}
            Terms of Use
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
                <p className="font-semibold text-white">{t.gameInProgress}</p>
                <p className="text-slate-400 text-sm font-mono">{activeGame.room.room_code}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* Rejoin first — getting back in is the common case; leaving
                  is the escape hatch. */}
              <Button
                onClick={() => navigate(`/mystery/${activeGame.room.room_code}`)}
                className="flex-1 h-11 violet-solid-btn border-0 bg-transparent hover:bg-transparent font-bold select-none-interactive"
              >
                {t.rejoinGame}
              </Button>
              <Button
                onClick={handleLeaveGame}
                disabled={leavingGame}
                className="flex-1 h-11 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 hover:border-rose-400/50 font-semibold select-none-interactive"
                variant="ghost"
              >
                <DoorOpen className="w-4 h-4 mr-2" />
                {leavingGame ? '…' : t.leaveGame}
              </Button>
            </div>
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

      {/* Confirmation modal — reference migration to the accessible <Dialog>
          primitive. Keeps the exact look, the !deleting backdrop/Escape
          dismiss guard, and the bottom-sheet placement. */}
      <AnimatePresence>
        {showConfirm && (
          <Dialog
            onClose={() => !deleting && setShowConfirm(false)}
            titleId="delete-confirm-title"
            placement="bottom"
            panelClassName="glass-card w-full max-w-sm bg-slate-900/95 p-5 space-y-4"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p id="delete-confirm-title" className="font-semibold text-white">{t.areYouSure}</p>
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
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
