// Push notifications (LAUNCH-4). Native-only re-engagement: register the
// device with APNs and store its token so the notify-turn Edge Function can
// send "it's your turn". Entirely no-op on web and inert until APNs is
// configured (see APPSTORE.md) — the plugin import is dynamic so the web
// bundle never pulls it in, and every failure degrades silently.
import { isNativeApp } from './platform';
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';

let registered = false;

export async function registerPush() {
  if (registered || !isNativeApp()) return;
  registered = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') { registered = false; return; }

    await PushNotifications.addListener('registration', async (token) => {
      try {
        await supabase.from('push_tokens').upsert(
          {
            user_id: getGuestIdentity().id,
            token: token.value,
            platform: 'ios',
            updated_date: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );
      } catch { /* best-effort */ }
    });
    await PushNotifications.addListener('registrationError', () => { registered = false; });
    await PushNotifications.register();
  } catch {
    registered = false; // plugin missing / permission flow failed — try again later
  }
}

// Ask the server to notify a user (e.g. it's now their turn). Best-effort:
// silently no-ops if the Edge Function or APNs credentials aren't configured.
export async function notifyUser(userId, kind, payload = {}) {
  if (!userId) return;
  try {
    await supabase.functions.invoke('notify-turn', { body: { user_id: userId, kind, payload } });
  } catch { /* not configured / offline */ }
}
