// R16 kit — runs the REAL Edge sender (supabase/functions/send-notifications/worker.ts) once against the isolated
// notif_* database through its PostgREST, delivering through Expo's real push service (exp.host).
//
// Safety: refuses to run unless the database holds exactly one push token and it equals R16_TOKEN (the tester's own
// phone). No other recipient can be reached. Never point this at a hosted project.
//
//   NOTIF_REST_URL   isolated PostgREST (e.g. http://localhost:58422)
//   NOTIF_JWT_SECRET PGRST_JWT_SECRET of that PostgREST (JWKS JSON or plain secret); never printed
//   NOTIF_TEST_DB    disposable database name, notif_*
//   R16_TOKEN        the ExponentPushToken[...] the phone registered (read it from public.push_tokens)
//   EXPO_ACCESS_TOKEN optional, only if "enhanced push security" is enabled on the Expo project
//
//   node send.mjs            # one claim/send pass (also publishes due System notices first)
//   node send.mjs --receipts # same pass; Expo receipts are checked by the worker's own receipt step
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rest = process.env.NOTIF_REST_URL;
const secret = process.env.NOTIF_JWT_SECRET;
const database = process.env.NOTIF_TEST_DB;
const token = process.env.R16_TOKEN;
assert.ok(rest && secret && database && token, 'NOTIF_REST_URL, NOTIF_JWT_SECRET, NOTIF_TEST_DB and R16_TOKEN are required.');
assert.ok(/^notif_[a-z0-9_]+$/.test(database), 'NOTIF_TEST_DB must name a disposable notif_* database.');
assert.ok(/^ExponentPushToken\[[^\]]+\]$/.test(token), 'R16_TOKEN must be an ExponentPushToken[...] value.');
assert.ok(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(rest), 'NOTIF_REST_URL must be a local/LAN address.');

const container = process.env.NOTIF_DB_CONTAINER ?? 'supabase_db_barangayan';
const psql = (sql) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-q', '-At'], { input: sql, encoding: 'utf8', timeout: 30000 }).trim();

const tokens = psql('select expo_push_token from public.push_tokens;').split('\n').filter(Boolean);
assert.deepEqual(tokens, [token], `The database must hold exactly the tester's token; found ${tokens.length} token(s). Refusing to send.`);

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const hmacKey = (() => {
  try { const oct = JSON.parse(secret).keys?.find((key) => key.kty === 'oct'); if (oct) return Buffer.from(oct.k, 'base64url'); } catch { /* plain secret */ }
  return secret;
})();
const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 600 })}`;
const serviceJwt = `${head}.${crypto.createHmac('sha256', hmacKey).update(head).digest('base64url')}`;

const rpc = async (name, args = {}) => {
  const response = await fetch(`${rest}/rpc/${name}`, { method: 'POST', headers: { authorization: `Bearer ${serviceJwt}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const body = await response.json().catch(() => null);
  return response.ok ? { data: body, error: null } : { data: null, error: { message: String(body?.message ?? response.status) } };
};

const { runWorker } = await import(pathToFileURL(path.resolve(import.meta.dirname, '../../../../../supabase/functions/send-notifications/worker.ts')).href);
const send = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, json: () => response.json() };
};
const summary = await runWorker({ rpc, fetch: send, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });
console.log(JSON.stringify(summary, null, 2));
const outbox = psql("select state, count(*) from barangayan_private.notification_outbox where recipient_id in (select user_id from public.push_tokens) group by 1 order by 1;");
console.log('outbox for the tester:\n' + outbox);
