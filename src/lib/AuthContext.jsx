import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(accountUser(session));
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(accountUser(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
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
