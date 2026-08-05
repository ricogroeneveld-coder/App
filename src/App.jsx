import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { LanguageProvider } from '@/lib/LanguageContext';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { useEffect } from 'react';
// Add page imports here
import Home from '@/pages/Home';
import BrowseLobbies from '@/pages/BrowseLobbies';
import MysteryGame from '@/pages/MysteryGame';
import ProfileSettings from '@/pages/ProfileSettings';
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
        style={{ minHeight: '100vh' }}
      >
        {/* Sign-in is entirely optional — nothing below is gated behind it.
            Gameplay routes work the same whether or not you're signed in. */}
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/browse-lobbies" element={<BrowseLobbies />} />
          <Route path="/mystery/:code" element={<MysteryGame />} />
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

function useSystemTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark) => {
      if (dark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
}

function App() {
  useSystemTheme();

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
