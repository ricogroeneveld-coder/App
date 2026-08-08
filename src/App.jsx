import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { LanguageProvider } from '@/lib/LanguageContext';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { useEffect, useState } from 'react';
import { devUnlockAll, devResetProfile, ensureAuth } from '@/lib/playerProfile';
import { configurePurchases } from '@/lib/payments';
import { restoreIdentityFromCloud, startCloudBackup, watchForLateBackup } from '@/lib/cloudBackup';
import { isNativeApp } from '@/lib/platform';
// Add page imports here
import Home from '@/pages/Home';
import BrowseLobbies from '@/pages/BrowseLobbies';
import MysteryGame from '@/pages/MysteryGame';
import ProfileSettings from '@/pages/ProfileSettings';
import Profile from '@/pages/Profile';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

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
// also marks this device as a dev device, which reveals the test-mode
// toggle and sync diagnostics on the profile page (?dev=off hides them
// again). Regular players never see developer UI.
function useDevParam() {
  // Flag the device synchronously during render, before any child screens
  // read it — an effect would set it one render too late.
  const dev = new URLSearchParams(window.location.search).get('dev');
  try {
    if (dev === 'off') localStorage.removeItem('wmp_dev');
    else if (dev) localStorage.setItem('wmp_dev', '1');
  } catch { /* ignore */ }
  useEffect(() => {
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
  if (!booted) return null; // dark launch background shows through

  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AnimatedRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
