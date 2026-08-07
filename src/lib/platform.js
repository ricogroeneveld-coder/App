// Platform detection for the Capacitor iOS wrapper vs the plain web build.
//
// The native v1 ships WITHOUT accounts: the sign-in flow was built for the
// web (OAuth redirects can't round-trip through capacitor://localhost, and
// Google blocks auth inside embedded webviews), and gameplay/progression
// run entirely on the guest identity either way. Hiding the account UI on
// native also keeps App Review guideline 4.8 (Sign in with Apple) out of
// scope — it only applies to apps that offer third-party login.
export function isNativeApp() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}
