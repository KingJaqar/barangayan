// Ticket 14 — self-service account deletion (Data Privacy Act).
//
// Flow:
//   1. Verify the caller's own JWT (self-service only — no target-user param).
//   2. Best-effort delete their Storage objects (avatar, versioned IDs, attachments).
//   3. Anonymize their profiles row via request_own_account_deletion() (see
//      migration 0074 for why this isn't a hard DELETE).
//   4. Ban the auth user from signing in again (service-role Admin API —
//      this is the one step that genuinely requires service_role, since a
//      SQL RPC has no access to the GoTrue admin API).
//
// See supabase/migrations/0074_account_deletion.sql for the full rationale.

import { createClient } from '@supabase/supabase-js';
import { type Fetcher, readAppleConfig, revokeAppleAuthorization } from './apple-revocation.ts';
import { DELETE_CONTRACT_VERSION, deleteAccountV2 } from './delete-v2.ts';
import { hasFreshAuthentication } from './fresh-authentication.ts';
import { removeOwnedStorageObjects } from './storage-cleanup.ts';

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

    // Contract v2 (resident iOS): Apple disconnection, the retain/de-identify/erase matrix, a recorded state and a truthful result.
    // A request without it keeps the v1 flow below, which the Android and web apps still use. Freshness is enforced inside the
    // database step, and only for the first request, so a retry after a partial failure can finish what the resident started.
    const body = await req.json().catch(() => null) as { contractVersion?: unknown; appleAuthorizationCode?: unknown } | null;
    if (body && body.contractVersion === DELETE_CONTRACT_VERSION) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const appleConfig = readAppleConfig((name) => Deno.env.get(name));
      const accessToken = authHeader.replace(/^Bearer\s+/i, '');
      const result = await deleteAccountV2({
        hasAppleIdentity: (user.identities ?? []).some((identity) => identity.provider === 'apple'),
        appleAuthorizationCode: typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode.length > 0 && body.appleAuthorizationCode.length <= 2048 ? body.appleAuthorizationCode : null,
        revokeApple: async (code) => appleConfig ? await revokeAppleAuthorization(appleConfig, code, Math.floor(Date.now() / 1000), fetch as unknown as Fetcher) : 'unavailable',
        erase: async () => {
          const { data, error } = await callerClient.rpc('erase_own_account_records');
          return error ? { ok: false, code: error.code ?? 'unknown', message: error.message } : { ok: true, state: String(data) };
        },
        setState: async (state, detail) => {
          const { error } = await adminClient.rpc('set_account_deletion_state', { p_user: user.id, p_state: state, p_error: detail ?? null });
          return !error;
        },
        cleanStorage: async () => {
          const failed: string[] = [];
          for (const bucket of ['profile-photos', 'id-documents', 'request-attachments', 'incident-photos']) {
            try { await removeOwnedStorageObjects(adminClient.storage.from(bucket), user.id); } catch { failed.push(bucket); }
          }
          return failed;
        },
        revokeAuth: async () => {
          const banned = await adminClient.auth.admin.updateUserById(user.id, { ban_duration: '876000h' });
          if (banned.error) return false;
          // Ending the sessions is repeated by the soft delete below, so a failure here is not fatal.
          await adminClient.auth.admin.signOut(accessToken, 'global').catch(() => undefined);
          // A soft delete removes the sign-in's email, password and linked identities and keeps the id that retained records point at.
          const removed = await adminClient.auth.admin.deleteUser(user.id, true);
          return !removed.error;
        },
      });
      return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Destructive and irreversible: require a recent Auth authentication proven by
    // the validated JWT itself, before any Storage object is touched. A stale or
    // merely refreshed session must re-authenticate first.
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!hasFreshAuthentication(accessToken, Math.floor(Date.now() / 1000))) {
      return new Response(JSON.stringify({ error: 'fresh_authentication_required' }), {
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
    for (const bucket of ['profile-photos', 'id-documents', 'request-attachments']) {
      try {
        await removeOwnedStorageObjects(adminClient.storage.from(bucket), user.id);
      } catch {
        // Keep the existing best-effort behavior; one bucket cannot block another.
      }
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
