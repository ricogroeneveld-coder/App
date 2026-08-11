// First-party analytics (ANA-1). Best-effort, never throws, never blocks
// gameplay. Writes pseudonymous funnel events to the analytics_events table
// (migration 0008) so a soft-launch can actually be measured — where players
// drop off, how many finish a game, replay, view/buy packs, etc. No PII:
// only the guest id already used for gameplay, plus small enum-ish props.
// If the table isn't migrated yet (or we're offline) it silently disables.
import { supabase } from './supabaseClient';
import { getGuestIdentity } from './guestIdentity';
import { isNativeApp } from './platform';

let enabled = true;
let sessionId = null;

function newSessionId() {
  // Not security-sensitive; just needs to group one app-open's events.
  return 's_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export function initAnalytics() {
  if (sessionId) return;
  sessionId = newSessionId();
  track('app_open');
}

// Fire-and-forget. Callers never await; failures disable future sends so a
// missing table / offline device can't spam errors.
export function track(event, props = {}) {
  if (!enabled || !event) return;
  try {
    let userId = '';
    try { userId = getGuestIdentity().id; } catch { /* pre-identity */ }
    const row = {
      event,
      props: props && typeof props === 'object' ? props : {},
      user_id: userId || null,
      session_id: sessionId,
      platform: isNativeApp() ? 'ios' : 'web',
    };
    // Deliberately not awaited.
    supabase.from('analytics_events').insert(row).then(({ error }) => {
      if (error && (String(error.message || '').includes('does not exist') || error.code === '42P01')) {
        enabled = false; // table not migrated — stop trying
      }
    }, () => { /* network — drop this event */ });
  } catch {
    /* never let analytics break a screen */
  }
}
