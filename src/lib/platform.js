// Platform detection for the Capacitor native wrappers (iOS, Android) vs
// the plain web build.
//
// The native builds ship WITHOUT accounts: the sign-in flow was built for the
// web (OAuth redirects can't round-trip through capacitor://localhost, and
// Google blocks auth inside embedded webviews on both platforms), and
// gameplay/progression run entirely on the guest identity either way. Hiding
// the account UI on native also keeps App Review guideline 4.8 (Sign in with
// Apple) out of scope: it only applies to apps that offer third-party login.
export function isNativeApp() {
  return typeof window !== 'undefined' && !!(/** @type {any} */ (window).Capacitor?.isNativePlatform?.());
}

// Which native shell we're inside: 'ios' | 'android' | 'web'. Several
// features are one-platform-only (iCloud backup is iOS; RevenueCat uses a
// different API key per store), so those must key off THIS, not isNativeApp().
export function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  return /** @type {any} */ (window).Capacitor?.getPlatform?.() || 'web';
}
export function isIOS() { return getPlatform() === 'ios'; }
export function isAndroid() { return getPlatform() === 'android'; }

// Gates the ?dev= URL mechanism (test-mode unlock, profile reset, simulated
// web purchases) behind a build-time flag instead of trusting the URL
// alone. Any build compiled without VITE_ENABLE_DEV_TOOLS=1 — including
// every store/production build, per APPSTORE.md's pre-release checklist —
// can never be flagged via ?dev=, no matter who visits the link. Set the
// env var only for an internal QA build you're testing on a real device.
export function isDevToolsEnabled() {
  return import.meta.env.VITE_ENABLE_DEV_TOOLS === '1';
}
