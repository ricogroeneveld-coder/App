// iCloud reinstall recovery (native iOS only; Android gets the same safety
// net for free from Google's Auto Backup, which includes WebView localStorage). The guest identity lives in
// localStorage, which dies with an app uninstall — this module mirrors it
// (plus the anonymous Supabase session tokens) into iCloud's key-value
// store via the tiny ICloudKV native plugin. A fresh install finds the
// backup, reclaims the auth session FIRST (without it the profile row is
// read-only under migration 0004's ownership policy), and only then adopts
// the old identity — so a stale token means a clean fresh start, never a
// profile that silently stops syncing. iCloud KV also syncs across the
// player's devices, so a new iPhone picks the profile up automatically.
import { registerPlugin } from '@capacitor/core';
import { supabase } from './supabaseClient';
import { isIOS } from './platform';

const ICloudKV = registerPlugin('ICloudKV');
const BACKUP_KEY = 'wmp_identity_backup_v1';

// TestFlight (and Xcode/dev) installs carry a sandbox App Store receipt;
// real App Store installs don't. Lives here because this module owns the
// ICloudKV plugin handle (Capacitor allows one registerPlugin per name).
// Web and plugin failures simply report false.
export async function isTestFlightBuild() {
  if (!isIOS()) return false;
  try {
    const { value } = await ICloudKV.isTestFlight();
    return value === true;
  } catch {
    return false;
  }
}
// Same storage keys as guestIdentity.js — referenced directly to keep this
// module import-cycle-free (guestIdentity dynamically imports us).
const KEY_ID = 'mystery_guest_id';
const KEY_NAME = 'mystery_guest_name';

// A restored identity may only replace the local one while the player is
// still PRISTINE: no display name set means they haven't passed the name
// gate, and nothing meaningful (daily rewards, games, purchases) can have
// happened yet — so adopting the iCloud profile loses nothing.
function isPristine() {
  return !localStorage.getItem(KEY_NAME);
}

async function tryRestore({ allowOverwrite = false } = {}) {
  const { value } = await ICloudKV.get({ key: BACKUP_KEY });
  if (!value) return false;
  const backup = JSON.parse(value);
  if (!backup?.guestId || !backup?.refreshToken || !backup?.accessToken) return false;
  if (localStorage.getItem(KEY_ID) && !(allowOverwrite && isPristine())) return false;
  const { error } = await supabase.auth.setSession({
    access_token: backup.accessToken,
    refresh_token: backup.refreshToken,
  });
  if (error) return false; // stale token → fresh start beats a read-only profile
  localStorage.setItem(KEY_ID, backup.guestId);
  if (backup.guestName) localStorage.setItem(KEY_NAME, backup.guestName);
  return true;
}

// Call BEFORE anything reads the guest identity (see App.jsx boot gate):
// getGuestIdentity() mints a fresh id on first read, which would orphan the
// backup for good.
export async function restoreIdentityFromCloud() {
  if (!isIOS()) return;
  try {
    if (localStorage.getItem(KEY_ID)) return; // existing install — nothing to do
    await tryRestore();
  } catch { /* no iCloud, plugin missing, bad JSON — normal fresh start */ }
}

// Second chance for slow iCloud: after a reinstall the KV store may still be
// pulling from Apple's servers when the boot-gate check runs. While the
// player is still pristine (sitting at the name gate), keep listening for
// the store's arrival plus a few timed re-checks; on success, reload — the
// app boots straight into the restored profile.
export function watchForLateBackup() {
  if (!isIOS() || !isPristine()) return;
  let done = false;
  const attempt = async () => {
    if (done || !isPristine()) return;
    try {
      if (await tryRestore({ allowOverwrite: true })) {
        done = true;
        window.location.reload();
      }
    } catch { /* keep waiting */ }
  };
  try { ICloudKV.addListener('changed', attempt); } catch { /* plugin missing */ }
  [5000, 15000, 45000].forEach(ms => setTimeout(attempt, ms));
}

export async function backupIdentityNow() {
  if (!isIOS()) return;
  try {
    const guestId = localStorage.getItem(KEY_ID);
    if (!guestId) return;
    const { data } = await supabase.auth.getSession();
    const s = data?.session;
    if (!s?.refresh_token) return; // nothing worth storing without ownership
    await ICloudKV.set({
      key: BACKUP_KEY,
      value: JSON.stringify({
        guestId,
        guestName: localStorage.getItem(KEY_NAME) || '',
        accessToken: s.access_token,
        refreshToken: s.refresh_token,
      }),
    });
  } catch { /* ignore — retried on the next auth event */ }
}

// "Delete my profile" must also forget the backup, or a reinstall would
// resurrect what the player explicitly deleted.
export async function clearCloudBackup() {
  if (!isIOS()) return;
  try { await ICloudKV.set({ key: BACKUP_KEY, value: '' }); } catch { /* ignore */ }
}

// Keep the backup current: refresh tokens ROTATE, and only the newest one
// survives — every auth event rewrites the backup with the live pair.
export function startCloudBackup() {
  if (!isIOS()) return;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      backupIdentityNow();
    }
  });
}

// Read-only status for the always-visible Settings row — unlike
// cloudBackupDiagnostics() below (which performs write/sign-in tests for
// the hidden dev panel), this never mutates anything, so it's safe to run
// on every normal player's Settings screen. Without this, a player whose
// iCloud is disabled (or whose backup silently never wrote) had no way to
// know a reinstall would wipe their progress until it actually happened.
export async function backupStatus() {
  // 'web' means "not applicable, hide the row". Android is included: there is
  // no iCloud there, and Google's Auto Backup already restores the WebView's
  // localStorage on reinstall without any UI or action from the player.
  if (!isIOS()) return 'web';
  try {
    const { value } = await ICloudKV.get({ key: BACKUP_KEY });
    return value ? 'ok' : 'none';
  } catch {
    return 'unavailable';
  }
}

// On-device truth for the hidden diagnostics panel (Profile Settings →
// 7 taps on the title): reports each link of the restore chain separately
// so a broken toggle, entitlement, or write is visible instead of guessed.
export async function cloudBackupDiagnostics() {
  const out = [];
  out.push(`ios native: ${isIOS() ? 'yes' : 'no'}`);
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      out.push(`auth session: ${data.session.user?.is_anonymous ? 'anonymous' : 'account'} (${(data.session.user?.id || '').slice(0, 8)}…)`);
    } else {
      out.push('auth session: none');
      const { error } = await supabase.auth.signInAnonymously();
      out.push(error ? `anon sign-in: FAILED — ${error.message}` : 'anon sign-in: ok (just created)');
    }
  } catch (e) {
    out.push(`auth: ERROR — ${e?.message || e}`);
  }
  try {
    const { value } = await ICloudKV.get({ key: BACKUP_KEY });
    out.push(value ? `icloud backup: present (${value.length} bytes)` : 'icloud backup: EMPTY');
  } catch (e) {
    out.push(`icloud plugin: ERROR — ${e?.message || e}`);
  }
  try {
    await backupIdentityNow();
    const { value } = await ICloudKV.get({ key: BACKUP_KEY });
    out.push(value ? 'write test: backup written ok' : 'write test: WRITE DID NOT STICK');
  } catch (e) {
    out.push(`write test: ERROR — ${e?.message || e}`);
  }
  return out;
}
