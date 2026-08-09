import { isNativeApp } from './platform';

/**
 * Share a room invite via the OS share sheet. Capacitor's WKWebView on iOS
 * supports the Web Share API natively (no extra Capacitor plugin needed),
 * so this works on native without any additional native-project changes.
 *
 * On the web build, the invite includes a real join link
 * (window.location.origin is a genuine https URL there). On native,
 * window.location.origin is the webview's internal origin, not a real
 * address — sharing that would hand out a broken link — so the native
 * share includes just the room code, which is enough to join from Home.
 *
 * Returns 'shared' | 'copied' | 'cancelled' | 'unsupported' so the caller
 * can decide what (if anything) to toast.
 */
export async function shareRoomInvite(roomCode, t) {
  const text = t.shareInviteText(roomCode);
  const url = isNativeApp() ? undefined : `${window.location.origin}/mystery/${roomCode}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "What's My Pick!", text, url });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to clipboard on any other failure
    }
  }

  try {
    await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}

/**
 * Share a finished-game result via the OS share sheet (clipboard fallback,
 * same contract as shareRoomInvite). `text` comes pre-localized from the
 * caller — this module stays free of UI strings beyond the app name.
 */
export async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "What's My Pick!", text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}
