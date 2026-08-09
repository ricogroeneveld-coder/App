// Haptic feedback — a thin wrapper around navigator.vibrate() (Android;
// silently a no-op on iOS Safari/WKWebView, which doesn't expose it) that
// respects a user mute setting, same pattern as sounds.js.

export function isHapticsEnabled() {
  try { return localStorage.getItem('haptics_enabled') !== 'false'; } catch { return true; }
}

export function setHapticsEnabled(v) {
  try { localStorage.setItem('haptics_enabled', String(v)); } catch { /* ignore */ }
}

export function vibrate(pattern = 35) {
  if (!isHapticsEnabled()) return;
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}
