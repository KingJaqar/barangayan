// Ticket 14 — self-service account deletion (Data Privacy Act).
//
// Flow:
//   1. Verify the caller's own JWT (self-service only — no target-user param).
//   2. Best-effort delete their Storage objects (avatar, ID photos).
//   3. Anonymize their profiles row via request_own_account_deletion() (see
//      migration 0074 for why this isn't a hard DELETE).
//   4. Ban the auth user from signing in again (service-role Admin API —
//      this is the one step that genuinely requires service_role, since a
//      SQL RPC has no access to the GoTrue admin API).
//
// See supabase/migrations/0074_account_deletion.sql for the full rationale.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caller-scoped client — identifies who's asking, and is what runs the
    // self-service RPC (so auth.uid() inside it is the real caller, not the
    // service role).
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await callerClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client — only used for the two things that require it:
    // deleting Storage objects across buckets and banning the auth user.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Best-effort Storage cleanup. Failures here must not block the account
    // deletion itself — an orphaned photo is a much smaller problem than a
    // resident who asked to be deleted and wasn't.
    try {
      const { data: avatarFiles } = await adminClient.storage.from('profile-photos').list(user.id);
      if (avatarFiles?.length) {
        await adminClient.storage
          .from('profile-photos')
          .remove(avatarFiles.map((f) => `${user.id}/${f.name}`));
      }
    } catch {
      // non-fatal
    }
    try {
      const { data: idFiles } = await adminClient.storage.from('id-documents').list(user.id);
      if (idFiles?.length) {
        await adminClient.storage
          .from('id-documents')
          .remove(idFiles.map((f) => `${user.id}/${f.name}`));
      }
    } catch {
      // non-fatal
    }

    // Anonymize the profile row under the caller's own session (RPC is
    // self-scoped via auth.uid() internally — see migration 0074).
    //
    // Recovery case: if a *previous* call got this far, anonymized the
    // profile, and then failed on the ban step below (network blip, GoTrue
    // hiccup), the account is left in a broken half-state — deleted_at is
    // set, but the user can still log in. A retry of this whole function
    // would otherwise dead-end here: the RPC's `where deleted_at is null`
    // guard makes it correctly refuse to run twice, raising P0002 ("already
    // deleted"), and the old code treated that as a fatal error — so the
    // retry could never reach the ban call and self-heal. P0002 is instead
    // treated as "anonymization already done, proceed to (re-)ban" so a
    // retry converges instead of getting stuck.
    const { error: rpcErr } = await callerClient.rpc('request_own_account_deletion');
    if (rpcErr && rpcErr.code !== 'P0002') {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ban the auth user so the (now-anonymized) account can never sign in
    // again. ~100 years is GoTrue's idiomatic "effectively permanent" ban.
    // Idempotent — safe to re-run if a previous call reached this point.
    const { error: banErr } = await adminClient.auth.admin.updateUserById(user.id, {
      ban_duration: '876000h',
    });
    if (banErr) {
      return new Response(JSON.stringify({ error: banErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Account deletion failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
