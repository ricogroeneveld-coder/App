import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/LanguageContext';

// Optional identity layer on top of the guest-only game. Gameplay never
// reads from this — MysteryGame.jsx and friends always use the localStorage
// guest identity (see src/lib/guestIdentity.js), signed in or not. This
// context exists only so ProfileSettings (and the Login/Register pages) can
// offer an account for people who want one, without gating any gameplay
// behind it — see the note in supabase/migrations/0001_init.sql and the
// README for why that matters for App Store review.
const AuthContext = createContext();

// The profile-sync layer signs every device in ANONYMOUSLY (see
// playerProfile.js ensureAuth) — that session is plumbing, not an account.
// Only a real (email/OAuth) user counts as signed in here, otherwise the
// Settings page would show "Registered Account"/"Sign Out" to every guest.
const accountUser = (session) =>
  session?.user && !session.user.is_anonymous ? session.user : null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { t } = useLang();
  const prevUserRef = useRef(null);
  // Set right before our own signOut() call, so the SIGNED_OUT event it
  // triggers isn't mistaken for a session that expired on its own.
  const loggingOutRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = accountUser(session);
      prevUserRef.current = u;
      setUser(u);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const next = accountUser(session);
      // A spontaneous sign-out (expired/invalid refresh token) while we
      // hadn't asked to sign out — otherwise "Registered Account" just
      // silently disappears from Settings with no explanation.
      if (event === 'SIGNED_OUT' && prevUserRef.current && !loggingOutRef.current) {
        toast({ title: t.sessionExpired });
      }
      loggingOutRef.current = false;
      prevUserRef.current = next;
      setUser(next);
    });

    return () => subscription.unsubscribe();
  }, [t]);

  const logout = async () => {
    loggingOutRef.current = true;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoadingAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
