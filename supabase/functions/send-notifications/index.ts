// Notification sender (Resident iOS Phase 17, P17-T02). Run on a schedule by the operations owner
// (for example every minute from pg_cron + pg_net, or an external scheduler).
//
// This is not a resident-callable function: it has no user JWT. Gateway JWT verification is off
// (any signed-in resident's token would pass it), and the caller must present the shared secret
// in `x-worker-secret`. Without NOTIFICATION_WORKER_SECRET configured the function refuses to run.
//
// Secrets (set by the operations owner, never committed):
//   NOTIFICATION_WORKER_SECRET  shared secret with the scheduler
//   EXPO_ACCESS_TOKEN           optional, when Expo "enhanced push security" is enabled
// The service-role key and URL are provided by the Edge runtime. Push tokens, ticket ids and
// message text are never logged or returned.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runWorker, type Fetcher, type Rpc } from './worker.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  // Constant-time comparison over the longer length; unequal lengths always fail.
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  if (!secret) return json({ error: 'not_configured' }, 503);
  if (!secretMatches(request.headers.get('x-worker-secret'), secret)) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 503);
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const rpc: Rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args ?? {});
    return { data, error: error ? { message: error.message } : null };
  };
  const send: Fetcher = (target, init) => fetch(target, init);
  const summary = await runWorker({ rpc, fetch: send, accessToken: Deno.env.get('EXPO_ACCESS_TOKEN') || undefined });
  return json(summary, summary.errors.length ? 207 : 200);
});
