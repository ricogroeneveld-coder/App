import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { LanguageProvider } from '@/lib/LanguageContext';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { lazy, Suspense, useEffect, useState } from 'react';
import { devUnlockAll, devResetProfile, ensureAuth, grantBetaCosmetics } from '@/lib/playerProfile';
import { configurePurchases } from '@/lib/payments';
import { restoreIdentityFromCloud, startCloudBackup, watchForLateBackup, isTestFlightBuild } from '@/lib/cloudBackup';
import { isNativeApp, isDevToolsEnabled } from '@/lib/platform';
import { syncServerTime } from '@/lib/serverTime';
import { initAnalytics } from '@/lib/analytics';
// Core play path stays eager (Home + joining a game via link must never wait
// on a second network fetch); everything else code-splits out of the main
// chunk — it was one 950 kB bundle, which slows first paint on the web build.
import Home from '@/pages/Home';
import MysteryGame from '@/pages/MysteryGame';
const BrowseLobbies = lazy(() => import('@/pages/BrowseLobbies'));
const ProfileSettings = lazy(() => import('@/pages/ProfileSettings'));
const Profile = lazy(() => import('@/pages/Profile'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        style={{ minHeight: '100dvh' }}
      >
        {/* Sign-in is entirely optional — nothing below is gated behind it.
            Gameplay routes work the same whether or not you're signed in. */}
        <Suspense fallback={null /* dark launch background shows through */}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/browse-lobbies" element={<BrowseLobbies />} />
            <Route path="/mystery/:code" element={<MysteryGame />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile-settings" element={<ProfileSettings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

// The game is dark-only: force dark theme tokens everywhere so shared UI
// (toasts, dialogs, form controls) never renders light on light-mode devices.
function useForcedDarkTheme() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);
}

// Dev/test switch usable from ANY route — static hosts often 404 on deep
// links, so ?dev=unlock must also work from the root URL. Any ?dev= visit
// marks this device as a dev device, which reveals the test-mode toggle and
// sync diagnostics on the profile page (?dev=off hides them again).
//
// Gated behind isDevToolsEnabled() (VITE_ENABLE_DEV_TOOLS=1 at build time):
// a real production build — anything shipped to the App Store or the public
// web deployment — compiles with this permanently false, so ?dev= is inert
// no matter who visits the URL. Only an internal build built with that env
// var set can ever be flagged. ?dev=off still always works, so a device
// flagged before this fix shipped can still be cleared.
function useDevParam() {
  const dev = new URLSearchParams(window.location.search).get('dev');
  const toolsEnabled = isDevToolsEnabled();
  // Flag the device synchronously during render, before any child screens
  // read it — an effect would set it one render too late.
  try {
    if (dev === 'off') localStorage.removeItem('wmp_dev');
    else if (dev && toolsEnabled) localStorage.setItem('wmp_dev', '1');
  } catch { /* ignore */ }
  useEffect(() => {
    if (!toolsEnabled) return;
    if (dev === 'unlock') devUnlockAll();
    else if (dev === 'reset') devResetProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function App() {
  useForcedDarkTheme();
  useDevParam();
  useEffect(() => { configurePurchases(); }, []);

  // Fresh native install: check iCloud for a previous identity BEFORE any
  // screen mints a new one (getGuestIdentity creates an id on first read).
  // Existing installs and web skip straight through. Capped at 3s so a slow
  // iCloud never delays startup noticeably — worst case it's a fresh start,
  // exactly what happened before this feature existed.
  const [booted, setBooted] = useState(() => {
    try { return !isNativeApp() || !!localStorage.getItem('mystery_guest_id'); }
    catch { return true; }
  });
  useEffect(() => {
    startCloudBackup();
    // Clock-skew-proof time base for the game timers (GAME-3), and a first
    // analytics ping so the funnel has an app_open even for a bounce.
    syncServerTime();
    initAnalytics();
    // Establish the anonymous session eagerly on native — waiting for the
    // first profile write meant a quiet session (daily reward already
    // claimed, no round played) never signed in, never synced, and never
    // wrote an iCloud backup.
    if (isNativeApp()) ensureAuth();
    if (booted) return;
    let live = true;
    Promise.race([
      restoreIdentityFromCloud(),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]).finally(() => {
      if (live) setBooted(true);
      // iCloud may still be pulling the backup from Apple's servers — keep
      // watching while the player sits at the name gate; a late arrival
      // restores and reloads seamlessly.
      watchForLateBackup();
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // TestFlight builds gift the Beta Tester cosmetic set. Runs once boot
    // settles: immediately on existing installs (booted starts true — they
    // never enter the iCloud restore path above), after the restore race on
    // fresh installs so the grant lands on the restored profile. Idempotent.
    if (!booted) return;
    isTestFlightBuild().then(tf => { if (tf) grantBetaCosmetics(); });
  }, [booted]);
  if (!booted) return null; // dark launch background shows through

  return (
    // reducedMotion="user": every framer-motion animation collapses to a
    // crossfade when the OS-level Reduce Motion setting is on (iOS
    // Accessibility → Motion). CSS keyframes get the same treatment in
    // index.css.
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <AnimatedRoutes />
          </Router>
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </MotionConfig>
  )
}

export default App
