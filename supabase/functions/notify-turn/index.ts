// notify-turn — server-side push sender for "it's your turn" re-engagement
// (LAUNCH-4). Runs with the service_role key (auto-provided to Edge Functions)
// so it can read push_tokens (which clients cannot). Signs an APNs JWT with the
// project's APNs auth key and delivers to every registered device for the
// target user.
//
// INERT until these secrets are set (see APPSTORE.md) — mirrors the RevenueCat
// "code done, dashboard step pending" pattern. Configure with:
//   supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=com.whatsmypick.app \
//     APNS_HOST=api.push.apple.com APNS_PRIVATE_KEY="$(cat AuthKey_XXX.p8)"
// (use api.sandbox.push.apple.com for TestFlight/dev builds).
//
// Deploy: supabase functions deploy notify-turn
//
// Request body: { user_id: string, kind?: "turn" | "chat" | string, payload?: object }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// ── APNs JWT (ES256 over the .p8 key) ──────────────────────────────────────
function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { jwt: string; at: number } | null = null;

async function apnsJwt(keyId: string, teamId: string, privateKeyPem: string): Promise<string> {
  // APNs tokens are valid up to 60 min; refresh every ~50 min.
  if (cachedToken && Date.now() - cachedToken.at < 50 * 60 * 1000) return cachedToken.jwt;

  const header = { alg: 'ES256', kid: keyId };
  const claims = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  cachedToken = { jwt, at: Date.now() };
  return jwt;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY');
  const host = Deno.env.get('APNS_HOST') || 'api.push.apple.com';
  if (!keyId || !teamId || !bundleId || !privateKey) {
    // Not configured yet — succeed quietly so callers stay best-effort.
    return json({ ok: true, skipped: 'apns_not_configured' });
  }

  let body: { user_id?: string; kind?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const userId = body.user_id;
  if (!userId) return json({ ok: false, error: 'missing_user_id' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!tokens?.length) return json({ ok: true, sent: 0 });

  const title = "What's My Pick!";
  const bodyText =
    body.kind === 'chat' ? 'New message in your game'
    : body.kind === 'turn' ? "It's your turn to ask a question!"
    : 'Come back to your game';

  const jwt = await apnsJwt(keyId, teamId, privateKey);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    tokens.map(async ({ token }: { token: string }) => {
      const res = await fetch(`https://${host}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        body: JSON.stringify({
          aps: { alert: { title, body: bodyText }, sound: 'default' },
          ...(body.payload || {}),
        }),
      });
      if (res.ok) sent++;
      else if (res.status === 410) stale.push(token); // token no longer valid
    }),
  );

  // Prune tokens Apple reports as gone.
  if (stale.length) {
    await supabase.from('push_tokens').delete().in('token', stale);
  }

  return json({ ok: true, sent });
});
