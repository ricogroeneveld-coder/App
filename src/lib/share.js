import { isNativeApp } from './platform';
import { APP_STORE_URL } from './links';

// The live web deployment's origin (e.g. https://whatsmypick.example.com),
// used to build a real join link for the native share sheet — see the
// comment on shareRoomInvite below for why native can't derive this from
// window.location.origin itself. Unset by default: until this is
// configured with the app's actual production domain, native share falls
// back to the old room-code-only behavior instead of handing out a broken
// link. Set at build time, same pattern as VITE_SITE_BASE in links.js.
const APP_URL = String(import.meta.env.VITE_APP_URL || '').replace(/\/+$/, '');

// Whether a real, working browser join link can currently be built at all
// (only matters on native — see shareRoomInvite). Lets the caller decide
// whether the "join in browser" invite option is worth offering.
export function hasBrowserJoinLink() { return isNativeApp() ? !!APP_URL : true; }

/**
 * Share a room invite via the OS share sheet. Capacitor's WKWebView on iOS
 * supports the Web Share API natively (no extra Capacitor plugin needed),
 * so this works on native without any additional native-project changes.
 *
 * `audience` lets the inviter say who they're inviting, since the two need
 * different content:
 *  - 'app'     — the recipient already has (or will get) the native app, so
 *                the room code is shared, with the App Store listing
 *                appended in the message text as a fallback for "or will
 *                get": someone who taps it without the app yet lands on the
 *                download page instead of a dead end.
 *  - 'browser' — the recipient should join straight from their phone's
 *                browser, no app involved (an Android friend when this
 *                share comes from the iOS app, or vice versa — MysteryGame.jsx's
 *                invite-link name gate handles the landing). Needs a real,
 *                public URL for the join link itself: on the web build
 *                window.location.origin already is one; on native it isn't
 *                (the Capacitor webview's origin is internal), so this falls
 *                back to VITE_APP_URL instead. If neither is available
 *                there's nothing valid to send, so this returns 'no_link'
 *                instead of handing out a broken one.
 *  - omitted   — the original auto behavior (matches the sender's own
 *                platform): a real link on web, room-code-only on native
 *                unless VITE_APP_URL is set. Used where there's no UI to
 *                ask the inviter, and on web where the distinction is moot.
 *                No App Store link here — this path isn't the native
 *                "who are you inviting" chooser, so it stays as before.
 *
 * 'app' and 'browser' build the ENTIRE message (every link included) as one
 * `text` string, with `url` left unset — deliberately, not an oversight.
 * Passing a link separately via `url` leaves its position in the final
 * message up to whichever share target renders it (some append it after
 * the text, past anything else already appended there), which is exactly
 * what silently pushed 'browser's join link to the very end, past the App
 * Store line, instead of appearing where it's meant to. Building one
 * complete string keeps the order exactly as written, identically for the
 * OS share sheet and the clipboard fallback below.
 *
 * Returns 'shared' | 'copied' | 'cancelled' | 'unsupported' | 'no_link' so
 * the caller can decide what (if anything) to toast.
 */
export async function shareRoomInvite(roomCode, t, audience) {
  let text, url;
  if (audience === 'app') {
    text = `${t.shareInviteText(roomCode)}\n\n${t.shareGetAppLabel}: ${APP_STORE_URL}`;
    url = undefined;
  } else if (audience === 'browser') {
    const base = isNativeApp() ? APP_URL : window.location.origin;
    if (!base) return 'no_link';
    const joinUrl = `${base}/mystery/${roomCode}`;
    text = `${t.shareInviteBrowserText(roomCode)}\n\n${joinUrl}\n\n${t.shareGetAppLabel}: ${APP_STORE_URL}`;
    url = undefined;
  } else {
    text = t.shareInviteText(roomCode);
    url = isNativeApp()
      ? (APP_URL ? `${APP_URL}/mystery/${roomCode}` : undefined)
      : `${window.location.origin}/mystery/${roomCode}`;
  }

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
 * Share a generated image (PNG Blob) through the native share sheet.
 *
 * Native iOS: WKWebView's navigator.share can't attach files, so the blob
 * is written to the app's cache directory and handed to the @capacitor/share
 * plugin (the real UIActivityViewController — Instagram, WhatsApp, iMessage,
 * Save to Photos, everything the user has installed).
 *
 * Web: Web Share API level 2 where available; otherwise a plain download.
 *
 * Returns 'shared' | 'saved' | 'cancelled' | 'error' so the caller can
 * toast (or stay silent) appropriately. A cancelled sheet is never an error.
 */
export async function shareImage(blob, filename, title) {
  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const { uri } = await Filesystem.writeFile({
        path: filename, data: base64, directory: Directory.Cache,
      });
      await Share.share({ title, files: [uri] });
      return 'shared';
    } catch (e) {
      // The plugin rejects when the user dismisses the sheet — that's a
      // cancel, not a failure.
      if (/cancel/i.test(e?.message || '')) return 'cancelled';
      return 'error';
    }
  }

  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to download on any other failure
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'saved';
  } catch {
    return 'error';
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
