import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at boot instead of every individual query failing with a
  // confusing network error — this almost always means .env.local is missing.
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings.'
  );
}

// Gameplay itself never requires an account — every player still gets a
// guest identity in localStorage (see src/lib/guestIdentity.js) and the game
// tables' RLS stays open to the anon role. Optional sign-in (email/password,
// Google, Apple) is layered on top via Supabase Auth, so session persistence
// and auto token refresh are on here — a signed-in user should stay signed
// in across reloads.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
