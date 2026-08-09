// Friendly copy for the errors Supabase Auth methods return. Without this,
// two common cases leaked straight through as raw text: an unconfirmed
// email showed Supabase's internal wording, and a dropped connection
// showed a browser fetch error instead of something a player could act on.
//
// Plain English, matching the rest of this auth flow (Login/Register/
// ResetPassword) — it isn't run through the app's translation system,
// since the native build hides sign-in entirely (guest-only) and this is
// web-only.
export function friendlyAuthError(error, fallback) {
  if (!error) return fallback;
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('email not confirmed')) {
    return 'Check your inbox — confirm your email before logging in.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return "Can't reach the server — check your connection and try again.";
  }
  return error.message || fallback;
}
