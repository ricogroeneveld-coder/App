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
