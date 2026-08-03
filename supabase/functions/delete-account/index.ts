// Deletes the calling user's own Supabase Auth account.
//
// This has to be a server-side function: deleting an auth user requires the
// service_role key, which must never be shipped to the browser. The client
// (see src/pages/ProfileSettings.jsx) calls this via
// `supabase.functions.invoke('delete-account')` while signed in — supabase-js
// automatically attaches the caller's access token as the Authorization
// header, which this function verifies before deleting *that* user's own
// account. It can never delete anyone else's.
//
// Deploy with: supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Verify the caller's token first, using the anon key + their own JWT —
    // this confirms who is actually asking, before we touch the admin API.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    // Only the service-role client can delete auth users, and only ever the
    // caller's own id — never anything derived from the request body.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
