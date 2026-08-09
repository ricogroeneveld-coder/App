// Haptic feedback that actually works on the shipped platform. WKWebView
// (the Capacitor iOS build) does NOT implement navigator.vibrate — so on
// native this routes through the @capacitor/haptics plugin (Taptic Engine);
// the navigator.vibrate path remains as the web/Android fallback. Respects
// a user mute setting, same pattern as sounds.js.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

export function isHapticsEnabled() {
  try { return localStorage.getItem('haptics_enabled') !== 'false'; } catch { return true; }
}

export function setHapticsEnabled(v) {
  try { localStorage.setItem('haptics_enabled', String(v)); } catch { /* ignore */ }
}

// Generic tick — duration only matters for the web fallback; native maps
// short taps to a light impact and anything longer to a medium one.
export function vibrate(pattern = 35) {
  if (!isHapticsEnabled()) return;
  if (isNativeApp()) {
    const style = (Array.isArray(pattern) ? pattern[0] : pattern) <= 20 ? ImpactStyle.Light : ImpactStyle.Medium;
    Haptics.impact({ style }).catch(() => {});
    return;
  }
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// Semantic cues for game moments — distinct system patterns on iOS, simple
// vibration bursts elsewhere.
export function hapticSuccess() {
  if (!isHapticsEnabled()) return;
  if (isNativeApp()) { Haptics.notification({ type: NotificationType.Success }).catch(() => {}); return; }
  try { navigator.vibrate?.([30, 40, 30]); } catch { /* ignore */ }
}

export function hapticError() {
  if (!isHapticsEnabled()) return;
  if (isNativeApp()) { Haptics.notification({ type: NotificationType.Error }).catch(() => {}); return; }
  try { navigator.vibrate?.([60, 40, 60]); } catch { /* ignore */ }
}
