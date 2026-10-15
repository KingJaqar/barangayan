// Real browser -> Server Actions -> isolated Auth/PostgREST/Storage -> isolated DB.
// No hosted mutations. Existing local database and account records are untouched.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const require = createRequire(path.join(app, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const browserFiles = path.join(root, 'dist/admin-table-phase1-browsers');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browserFiles)) process.env.PLAYWRIGHT_BROWSERS_PATH = browserFiles;
const { chromium, firefox } = require('playwright');
const browserName = process.env.PROFILE_TEST_BROWSER ?? 'chrome';
assert.ok(['chrome', 'firefox'].includes(browserName), 'Choose a supported profile test browser');
const localStaging = process.env.PROFILE_LOCAL_STAGING === 'true';
// RFC 6238 test authenticator; secrets stay in this isolated runner's memory.
function authenticatorCode(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replaceAll('=', '')].map(character => {
    const value = alphabet.indexOf(character); assert.ok(value >= 0); return value.toString(2).padStart(5, '0');
  }).join('');
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, index) => parseInt(bits.slice(index * 8, index * 8 + 8), 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest(); const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const database = `admin_profile_test_${suffix}`;
let testDbContainer = `admin-profile-db-${suffix}`;
const evidence = path.join(root, 'plans/evidence/admin-profile');
fs.mkdirSync(evidence, { recursive: true });
const report = { status: 'running', browser: browserName, database, containers: [], checks: [], consoleErrors: [], pageErrors: [], limitations: [
  'Dedicated local database cloned from the local 0117 schema; 0118 and 0119 are applied only to this test database.',
  'Hosted settings are inventoried separately; hosted SMTP delivery and admin callbacks remain unverified.',
  'Test containers are stopped on completion. The isolated database is preserved; no existing data is deleted.',
] };
const save = () => fs.writeFileSync(path.join(evidence, localStaging ? 'local-staging-results.json' : 'e2e-results.json'), JSON.stringify(report, null, 2) + '\n');
function docker(args, input, sensitive = false) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(sensitive ? 'Isolated service startup failed. Inspect its redacted logs.' : result.stderr || 'Local Docker command failed.');
  return result.stdout.trim();
}
const sql = statement => docker(['exec', '-i', testDbContainer, 'psql', '-X', '-q', '-A', '-t', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'], statement);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const environment = config => Object.fromEntries(config.Config.Env.map(entry => { const index = entry.indexOf('='); return [entry.slice(0, index), entry.slice(index + 1)]; }));
const baseline = Object.fromEntries(['auth', 'rest', 'storage', 'db', 'inbucket'].map(service => [service, inspect(`supabase_${service}_barangayan`)]));
const dbEnv = environment(baseline.db);
const network = Object.keys(baseline.db.NetworkSettings.Networks)[0];
if (!network || !dbEnv.POSTGRES_PASSWORD) throw new Error('Local test prerequisites are missing.');
const databaseUrl = new URL(`postgresql://supabase_admin@${testDbContainer}:5432/${database}`);
databaseUrl.password = randomUUID();
let gateway, next, legacyNext, browser, reviewBrowser, observedPage, observedPopup;
let nextLog = '';
const check = name => { report.checks.push(name); console.log(`Passed: ${name}`); save(); };
async function listen(server) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return server.address().port; }
async function waitFor(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { const response = await fetch(url); if (response.status < 500) return; } catch { /* Service is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Isolated service did not become ready within the bounded startup period.');
}
async function reloadSettled(target) {
  // The workspace keeps Edit disabled through its shell-refresh transition.
  // Wait for the actual UI readiness state, not a gap between network requests.
  await target.getByRole('button', { name: 'Edit profile', exact: true }).click({ trial: true });
  await target.reload();
}
function service(kind, env, internalPort) {
  const name = `admin-profile-${kind}-${suffix}`;
  docker(['run', '-d', '--name', name, '--network', network, '-p', `127.0.0.1::${internalPort}`, ...Object.entries(env).flatMap(([key, value]) => ['--env', `${key}=${value}`]), baseline[kind].Config.Image], undefined, true);
  report.containers.push(name);
  const port = inspect(name).NetworkSettings.Ports[`${internalPort}/tcp`]?.[0]?.HostPort;
  if (!port) throw new Error('Isolated service port was not assigned.');
  return Number(port);
}
try {
  // pg_cron is bound to database "postgres". Use a separate PostgreSQL
  // container rather than changing the existing engine's configuration.
  docker(['run', '-d', '--name', testDbContainer, '--network', network, '--env', `POSTGRES_PASSWORD=${databaseUrl.password}`,
    '--env', 'POSTGRES_DB=postgres', baseline.db.Config.Image, 'postgres', '-c', 'listen_addresses=*', '-c', 'shared_preload_libraries=pg_cron,pg_net,pg_stat_statements', '-c', `cron.database_name=${database}`], undefined, true);
  report.containers.push(testDbContainer);
  let dbReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = spawnSync('docker', ['exec', testDbContainer, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { encoding: 'utf8', windowsHide: true });
    if (ready.status === 0) { dbReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!dbReady) throw new Error('Isolated PostgreSQL did not start within the bounded startup period.');
  docker(['exec', testDbContainer, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `create database ${database}`]);
  docker(['exec', testDbContainer, 'psql', '-X', '-q', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `alter role supabase_admin password '${databaseUrl.password}'`], undefined, true);
  const roles = JSON.parse(docker(['exec', 'supabase_db_barangayan', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c', "select json_agg(json_build_object('name',rolname,'inherit',rolinherit,'login',rolcanlogin,'bypass',rolbypassrls)) from pg_roles where rolname<>'postgres' and rolname not like 'pg_%'"]));
  for (const role of roles) {
    const name = '"' + role.name.replaceAll('"', '""') + '"';
    sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='${role.name.replaceAll("'", "''")}') then create role ${name} ${role.inherit ? 'inherit' : 'noinherit'} ${role.login ? 'login' : 'nologin'} ${role.bypass ? 'bypassrls' : 'nobypassrls'}; end if; end $$;`);
  }
  const schema = docker(['exec', 'supabase_db_barangayan', 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--no-owner']);
  if (schema.includes('CREATE SCHEMA public;')) sql('alter schema public rename to profile_bootstrap_public');
  sql(schema);
  // Copy only service migration ledgers, never users, profiles or app records.
  const ledgers = ['auth.schema_migrations', 'storage.migrations', 'supabase_migrations.schema_migrations'].filter(table => schema.includes(`CREATE TABLE ${table} (`));
  if (ledgers.length) sql(docker(['exec', 'supabase_db_barangayan', 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--data-only', '--no-owner', ...ledgers.map(table => `--table=${table}`)]));
  const requestRegression = fs.readFileSync(path.join(root, 'supabase/tests/admin_request_row_workflows.test.sql'), 'utf8');
  const requestBaseline = sql(requestRegression);
  fs.writeFileSync(path.join(evidence, 'admin_request_row_workflows-baseline.log'), requestBaseline);
  const requestBaselineFailures = requestBaseline.split('\n').filter(line => line.startsWith('not ok '));
  report.preExistingFailures = requestBaselineFailures.map(failure => `admin_request_row_workflows: ${failure}`);
  assert.doesNotMatch(requestBaseline, /not ok|Looks like you failed/, 'Existing request/payment workflow baseline must pass');
  for (const migration of ['0118_resident_front_id_submission.sql', '0119_admin_profile_and_verified_association.sql']) sql(fs.readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8'));
  const profileSql = sql(`begin; ${fs.readFileSync(path.join(root, 'supabase/tests/admin_profile_and_association.test.sql'), 'utf8')} rollback;`);
  fs.writeFileSync(path.join(evidence, 'profile-database.log'), profileSql);
  assert.doesNotMatch(profileSql, /not ok|Looks like you failed/);
  check('Fresh empty-schema and representative-schema migration rehearsal with real caller roles');
  check('Expired/rate-limited proof, commit-time target retirement and atomic mandatory link/unlink audit failure');
  for (const name of ['resident_profile_conflict', 'resident_email_verification', 'resident_account_setup', 'admin_record_lifecycle', 'admin_incident_withdrawal', 'admin_request_row_workflows']) {
    const output = sql(fs.readFileSync(path.join(root, 'supabase/tests', `${name}.test.sql`), 'utf8'));
    fs.writeFileSync(path.join(evidence, `${name}.log`), output);
    if (name === 'admin_request_row_workflows') assert.equal(output, requestBaseline, 'Profile migrations must preserve the passing request/payment baseline');
    assert.doesNotMatch(output, /not ok|Looks like you failed/);
    check(`Existing ${name} database regression checks`);
  }
  const routes = {};
  let dropProfileResponse = false, dropCredentialResponse = false, dropAssociationResponse = false, corruptUploadResponse = false, rejectProfileWrite = false, rejectOptionalAudit = false, rejectGlobalLogout = false, rateLimitCredential = false, profileWriteCount = 0, credentialWriteCount = 0, associationWriteCount = 0;
  gateway = http.createServer((request, response) => {
    // This dedicated gateway replaces local Kong, including its browser CORS
    // handling. It permits only this test app's exact origin.
    response.setHeader('Access-Control-Allow-Origin', base);
    response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] ?? 'apikey,authorization,content-type,x-client-info');
    response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    const prefix = Object.keys(routes).find(prefix => request.url.startsWith(prefix));
    if (!prefix) { response.writeHead(404); response.end(); return; }
    const profileWrite = request.method === 'POST' && request.url === '/rest/v1/rpc/admin_update_own_profile';
    const credentialWrite = request.method === 'PUT' && request.url.split('?')[0] === '/auth/v1/user';
    const associationWrite = request.method === 'POST' && request.url === '/rest/v1/rpc/admin_finish_resident_association';
    if (associationWrite) associationWriteCount++;
    if (rejectGlobalLogout && request.method === 'POST' && request.url === '/auth/v1/logout?scope=global') {
      rejectGlobalLogout = false; request.resume(); response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Isolated session cleanup failure' })); return;
    }
    if (profileWrite) profileWriteCount++;
    if (credentialWrite) credentialWriteCount++;
    if (credentialWrite && rateLimitCredential) {
      rateLimitCredential = false; request.resume(); response.writeHead(429, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 'over_request_rate_limit', message: 'Isolated credential rate limit' })); return;
    }
    if ((profileWrite && rejectProfileWrite) || (request.method === 'POST' && request.url.startsWith('/rest/v1/admin_audit_log') && rejectOptionalAudit)) {
      const code = profileWrite ? 'PT409' : '42501'; rejectProfileWrite = false; rejectOptionalAudit = false;
      request.resume(); response.writeHead(profileWrite ? 409 : 403, { 'content-type': 'application/json' }); response.end(JSON.stringify({ code, message: 'Isolated failure injection' })); return;
    }
    const upstream = http.request({ host: '127.0.0.1', port: routes[prefix], path: request.url.slice(prefix.length) || '/', method: request.method, headers: { ...request.headers, host: `127.0.0.1:${routes[prefix]}` } }, received => {
      if (profileWrite && dropProfileResponse) { dropProfileResponse = false; received.resume(); received.on('end', () => response.destroy()); return; }
      if (credentialWrite && dropCredentialResponse) { dropCredentialResponse = false; received.resume(); received.on('end', () => response.destroy()); return; }
      if (associationWrite && dropAssociationResponse) { dropAssociationResponse = false; received.resume(); received.on('end', () => response.destroy()); return; }
      if (corruptUploadResponse && request.method === 'POST' && request.url.startsWith('/storage/v1/object/profile-photos/')) {
        corruptUploadResponse = false; received.resume(); received.on('end', () => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{'); }); return;
      }
      response.writeHead(received.statusCode, { ...received.headers, 'access-control-allow-origin': base }); received.pipe(response);
    });
    upstream.on('error', () => { response.writeHead(503); response.end('Local test service unavailable'); }); request.pipe(upstream);
  });
  // Existing realtime serves only the shell subscription transport in this test;
  // all feature account/profile reads and writes use the dedicated test DB.
  gateway.on('upgrade', (request, socket, head) => {
    const upstream = http.request({ host: '127.0.0.1', port: 54321, path: request.url, headers: request.headers });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      remote.on('error', () => socket.destroy());
      socket.on('error', () => remote.destroy());
      socket.write(`HTTP/1.1 ${response.statusCode} Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
      if (head.length) remote.write(head); if (remoteHead.length) socket.write(remoteHead); remote.pipe(socket); socket.pipe(remote);
    });
    upstream.on('error', () => socket.destroy()); upstream.end();
  });
  const apiPort = await listen(gateway);
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const reservation = http.createServer(); const webPort = await listen(reservation); await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${webPort}`;
  let mailPort = service('inbucket', environment(baseline.inbucket), 8025);
  assert.ok(mailPort);
  const singleConfirmation = process.env.PROFILE_TEST_CONFIRMATIONS === 'single';
  const authEnv = environment(baseline.auth);
  assert.equal(authEnv.GOTRUE_SMTP_HOST, 'supabase_inbucket_barangayan', 'Credential tests must send only to the local mail sink');
  // Hosted UI inspected on 15 October: min 6, all four character classes.
  // Auth v2.197 decodes colon-separated character sets, escaping literal colons.
  const requiredPasswordCharacters = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789',
    Array.from({ length: 94 }, (_, index) => String.fromCharCode(index + 33)).filter(character => !/[A-Za-z0-9]/.test(character)).join('').replaceAll(':', '\\:')].join(':');
  const passwordPolicy = { GOTRUE_PASSWORD_MIN_LENGTH: '6', GOTRUE_PASSWORD_REQUIRED_CHARACTERS: requiredPasswordCharacters,
    GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION: 'false', GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD: 'false' };
  routes['/auth/v1'] = service('auth', { ...authEnv, GOTRUE_DB_DATABASE_URL: databaseUrl.href, API_EXTERNAL_URL: apiUrl,
    GOTRUE_SMTP_HOST: `admin-profile-inbucket-${suffix}`,
    ...Object.fromEntries(Object.keys(authEnv).filter(key => key.startsWith('GOTRUE_MAILER_URLPATHS_')).map(key => [key, `${apiUrl}/auth/v1/verify`])),
    GOTRUE_MAILER_AUTOCONFIRM: singleConfirmation ? 'true' : 'false',
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: 'true', GOTRUE_MFA_TOTP_VERIFY_ENABLED: 'true',
    ...passwordPolicy,
    GOTRUE_JWT_ISSUER: `${apiUrl}/auth/v1`, GOTRUE_SITE_URL: base, GOTRUE_URI_ALLOW_LIST: `${base}/**`, GOTRUE_SMTP_MAX_FREQUENCY: '0' }, 9999);
  routes['/rest/v1'] = service('rest', { ...environment(baseline.rest), PGRST_DB_URI: databaseUrl.href }, 3000);
  const storageEnv = environment(baseline.storage);
  routes['/storage/v1'] = service('storage', { ...storageEnv, DATABASE_URL: databaseUrl.href, VECTOR_DATABASE_URL: databaseUrl.href, TENANT_ID: database, FILE_STORAGE_BACKEND_PATH: '/var/lib/storage' }, 5000);
  await waitFor(`${apiUrl}/auth/v1/health`);
  await waitFor(`${apiUrl}/rest/v1/`);
  const owner = createClient(apiUrl, storageEnv.SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let storageReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = await owner.storage.listBuckets();
    if (!ready.error) { storageReady = true; break; }
    if ([401, 403].includes(Number(ready.error.status))) throw new Error(`Isolated Storage authorization failed: ${ready.error.message}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!storageReady) throw new Error('Isolated Storage did not become ready within the bounded startup period.');
  const bucket = await owner.storage.createBucket('profile-photos', { public: true, fileSizeLimit: 2097152, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
  if (bucket.error) throw new Error(`Isolated avatar bucket could not be created: ${bucket.error.message}`);
  const accounts = {};
  for (const name of ['admin', 'resident', 'otherAdmin', 'inactive', 'foreign']) {
    const email = `profile-${name}-${suffix}@example.test`, password = `${randomUUID()}Aa1!`;
    const result = await owner.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw new Error('Isolated Auth fixture account creation failed.');
    accounts[name] = { id: result.data.user.id, email, password };
  }
  const tenant = randomUUID(), otherTenant = randomUUID();
  sql(`insert into public.barangays(id,name) values('${tenant}','Profile E2E Barangay'),('${otherTenant}','Foreign E2E Barangay');
    insert into public.profiles(id,barangay_id,role,full_name,home_address,email) values
    ${Object.entries(accounts).map(([name, account]) => `('${account.id}','${name === 'foreign' ? otherTenant : tenant}','${['resident', 'foreign'].includes(name) ? 'resident' : 'admin'}','Profile ${name}','Legacy ${name} address','contact-${name}@example.test')`).join(',')};
    update public.barangay_officials set is_active=false where profile_id='${accounts.inactive.id}';`);
  const localSettings = Object.fromEntries(Object.entries({ ...authEnv, ...passwordPolicy, GOTRUE_MAILER_AUTOCONFIRM: singleConfirmation ? 'true' : 'false', GOTRUE_MFA_TOTP_ENROLL_ENABLED: 'true', GOTRUE_MFA_TOTP_VERIFY_ENABLED: 'true' }).filter(([key]) => /SECURE_EMAIL_CHANGE_ENABLED|PASSWORD_MIN_LENGTH|PASSWORD_REQUIRED_CHARACTERS|REQUIRE_REAUTHENTICATION|REQUIRE_CURRENT_PASSWORD|MAILER_AUTOCONFIRM|JWT_EXP|MFA_TOTP/.test(key)));
  report.localAuthSettings = localSettings;
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: storageEnv.ANON_KEY,
    ADMIN_PROFILE_ENABLED: 'true', ADMIN_PROFILE_AUTH_VERIFIED: 'true', ADMIN_PROFILE_ORIGIN: base,
    BARANGAYAN_PREVIEW_DIST_DIR: `.next-admin-profile-${suffix}`, NEXT_TELEMETRY_DISABLED: '1' };
  // An absent variable would be reloaded from the user's .env.local by Next.
  // Explicitly blank it so feature tests cannot use a real privileged key.
  env.SUPABASE_SERVICE_ROLE_KEY = '';
  const nextBin = require.resolve('next/dist/bin/next');
  const compile = spawnSync(process.execPath, [nextBin, 'build', '--webpack'], { cwd: app, env, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, localStaging ? 'local-staging-build.log' : 'e2e-build.log'), compile.stdout + compile.stderr);
  if (compile.status !== 0) throw new Error('Isolated production build failed; see e2e-build.log.');
  next = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(webPort)], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  report.nextPid = next.pid;
  report.webOrigin = base;
  next.stdout.on('data', data => { nextLog += data; }); next.stderr.on('data', data => { nextLog += data; });
  await waitFor(`${base}/login`);
  browser = browserName === 'firefox' ? await firefox.launch({ headless: true }) : await chromium.launch({ headless: true, channel: 'chrome' });
  function monitorPage(target) {
    target.on('pageerror', error => report.pageErrors.push(error.message));
    target.on('console', message => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      let resource = ''; try { resource = new URL(message.location().url).pathname; } catch { /* Some browser messages have no resource URL. */ }
      report.consoleErrors.push(`${message.text()}${resource ? ` [${resource}]` : ''}`);
    });
  }
  async function context(account) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); let cookies = [];
    ctx.on('page', monitorPage);
    const db = createServerClient(apiUrl, storageEnv.ANON_KEY, { cookies: { getAll: () => [], setAll: values => { cookies = values; } } });
    const result = await db.auth.signInWithPassword({ email: account.email, password: account.password });
    if (result.error) throw new Error('Isolated fixture sign-in failed.');
    await ctx.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: base, sameSite: 'Lax' })));
    return ctx;
  }
  const concurrentAdmins = await Promise.all([accounts.admin, accounts.otherAdmin].map(async account => {
    const client = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await client.auth.signInWithPassword({ email: account.email, password: account.password })).error, null);
    return client;
  }));
  const expectedVersion = sql(`select updated_at from public.profiles where id='${accounts.admin.id}'`);
  const simultaneousSaves = await Promise.all(['09171111111', '09172222222'].map(mobile => concurrentAdmins[0].rpc('admin_update_own_profile', { p_patch: { mobile_number: mobile }, p_expected: expectedVersion })));
  assert.equal(simultaneousSaves.filter(result => !result.error).length, 1);
  assert.equal(simultaneousSaves.filter(result => result.error?.code === 'PT409').length, 1);
  const challenges = await Promise.all(concurrentAdmins.map(client => client.rpc('admin_begin_resident_association')));
  challenges.forEach(result => { assert.equal(result.error, null); assert.ok(result.data); });
  const residentProofs = await Promise.all(challenges.map(async challenge => {
    const client = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await client.auth.signInWithPassword({ email: accounts.resident.email, password: accounts.resident.password })).error, null);
    assert.equal((await client.rpc('resident_prove_admin_association', { p_challenge: challenge.data })).error, null);
    return client;
  }));
  const simultaneousLinks = await Promise.all(concurrentAdmins.map((client, index) => client.rpc('admin_finish_resident_association', { p_challenge: challenges[index].data })));
  assert.equal(simultaneousLinks.filter(result => !result.error).length, 1);
  assert.equal(simultaneousLinks.filter(result => result.error?.code === '23505').length, 1);
  const winner = simultaneousLinks.findIndex(result => !result.error);
  const linked = await concurrentAdmins[winner].from('admin_resident_associations').select('resident_id,linked_at').single();
  assert.equal(linked.error, null);
  const simultaneousUnlinks = await Promise.all([0, 1].map(() => concurrentAdmins[winner].rpc('admin_unlink_resident_association', { p_resident: linked.data.resident_id, p_expected: linked.data.linked_at })));
  assert.equal(simultaneousUnlinks.filter(result => !result.error).length, 1);
  assert.equal(simultaneousUnlinks.filter(result => result.error?.code === 'PT409').length, 1);
  for (const client of [...concurrentAdmins, ...residentProofs]) assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
  sql("update barangayan_private.admin_association_challenges set created_at=clock_timestamp()-interval '31 seconds'");
  check('Simultaneous conditional saves, competing verified links and duplicate unlinks commit exactly one winner');
  if (!localStaging) {
    const regressionContext = await context(accounts.admin);
    const regressionPage = await regressionContext.newPage(); observedPage = regressionPage;
    await regressionPage.goto(`${base}/staff`);
    await regressionPage.getByRole('heading', { name: 'Staff & Admin Accounts', exact: true }).waitFor();
    const selfRow = regressionPage.getByRole('row').filter({ hasText: 'Profile admin' });
    await selfRow.waitFor();
    assert.equal(await selfRow.getByRole('button', { name: 'Edit Name', exact: true }).count(), 0);
    assert.equal(await selfRow.getByRole('button', { name: 'Edit Role', exact: true }).count(), 0);
    assert.equal(await selfRow.getByRole('button', { name: 'Archive', exact: true }).isDisabled(), true);
    assert.equal(await selfRow.getByRole('button', { name: 'Delete', exact: true }).isDisabled(), true);
    // The existing invitation endpoint needs a privileged key. Only this
    // separate local server receives the isolated service's key; the profile
    // server continues to run with its privileged-key variable explicitly blank.
    const legacyReservation = http.createServer(); const legacyPort = await listen(legacyReservation);
    await new Promise(resolve => legacyReservation.close(resolve));
    const legacyBase = `http://127.0.0.1:${legacyPort}`;
    legacyNext = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(legacyPort)], {
      cwd: app, env: { ...env, SUPABASE_SERVICE_ROLE_KEY: storageEnv.SERVICE_KEY }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    legacyNext.stdout.on('data', data => { nextLog += data; }); legacyNext.stderr.on('data', data => { nextLog += data; });
    await waitFor(`${legacyBase}/login`);
    const inviteEmail = `profile-invited-${suffix}@example.test`;
    const invitation = { email: inviteEmail, full_name: 'Regression Invited Staff', official_role: 'staff' };
    const residentRegression = await context(accounts.resident);
    assert.equal((await residentRegression.request.post(`${legacyBase}/api/admin/staff/invite`, { data: invitation })).status(), 403);
    const unauthenticated = await browser.newContext();
    assert.equal((await unauthenticated.request.post(`${legacyBase}/api/admin/staff/invite`, { data: invitation })).status(), 401);
    await unauthenticated.close();
    assert.equal(sql(`select count(*) from auth.users where email='${inviteEmail}'`), '0');
    const invitedResponse = await regressionContext.request.post(`${legacyBase}/api/admin/staff/invite`, { data: invitation });
    assert.equal(invitedResponse.status(), 200);
    const invited = await invitedResponse.json(); assert.match(invited.id, /^[0-9a-f-]{36}$/);
    assert.equal(sql(`select role||':'||barangay_id from public.profiles where id='${invited.id}'`), `admin:${tenant}`);
    assert.equal(sql(`select official_role from public.barangay_officials where profile_id='${invited.id}'`), 'staff');
    let invitationDelivered = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const inbox = await fetch(`http://127.0.0.1:${mailPort}/api/v1/search?query=${encodeURIComponent(`to:${inviteEmail}`)}`).then(response => response.json());
      if (inbox.messages?.length) { invitationDelivered = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(invitationDelivered, true);
    legacyNext.kill(); await new Promise(resolve => legacyNext.once('exit', resolve)); legacyNext = undefined;
    await regressionPage.reload(); await regressionPage.getByRole('row').filter({ hasText: 'Regression Invited Staff' }).waitFor();
    check('Existing staff self-edit/archive/delete safeguards and caller-scoped invitation with isolated mail delivery');
    const residentPage = await residentRegression.newPage(); observedPage = residentPage;
    await residentPage.goto(`${base}/resident/profile`);
    await residentPage.getByRole('heading', { name: 'My Profile', exact: true }).waitFor();
    await residentPage.getByRole('heading', { name: 'Upload Valid ID', exact: true }).waitFor();
    await residentPage.getByText('Not Submitted', { exact: true }).waitFor();
    const adminBeforeResidentEdit = sql(`select row_to_json(p) from public.profiles p where id='${accounts.admin.id}'`);
    await residentPage.getByLabel('Mobile Number', { exact: true }).fill('09173334444');
    await residentPage.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await residentPage.getByText('Profile updated.', { exact: true }).waitFor();
    assert.equal(sql(`select mobile_number from public.profiles where id='${accounts.resident.id}'`), '09173334444');
    assert.equal(sql(`select full_name||':'||home_address from public.profiles where id='${accounts.resident.id}'`), 'Profile resident:Legacy resident address');
    assert.equal(sql(`select row_to_json(p) from public.profiles p where id='${accounts.admin.id}'`), adminBeforeResidentEdit);
    await residentPage.waitForLoadState('networkidle');
    await residentRegression.close();
    check('Existing resident self-profile save and verification view preserve legacy fields and the admin record');
    const householdClient = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await householdClient.auth.signInWithPassword({ email: accounts.admin.email, password: accounts.admin.password })).error, null);
    const household = await householdClient.rpc('admin_add_household_member', { p_profile_id: accounts.resident.id, p_name: 'Regression Household Member', p_relation: 'Sibling', p_role: 'member' });
    assert.equal(household.error, null); assert.match(household.data, /^[0-9a-f-]{36}$/);
    assert.equal(sql(`select profile_id from public.household_members where id='${household.data}'`), accounts.resident.id);
    assert.equal((await householdClient.auth.signOut({ scope: 'local' })).error, null);
    observedPage = regressionPage;
    for (const [route, heading] of [['dashboard', 'Dashboard'], ['residents', 'Resident Directory'], ['households-residents', 'Households & Residents'], ['requests', 'Requests'], ['transactions', 'Financial Transactions']]) {
      await regressionPage.goto(`${base}/${route}`);
      await regressionPage.getByRole('heading', { name: heading, exact: true }).waitFor();
      if (route === 'households-residents') await regressionPage.getByRole('row').filter({ hasText: 'Regression Household Member' }).waitFor();
      await regressionPage.waitForLoadState('networkidle');
    }
    await regressionPage.getByRole('button', { name: 'Notifications', exact: true }).click();
    await regressionPage.getByRole('region', { name: 'Notifications', exact: true }).waitFor();
    await regressionPage.keyboard.press('Escape');
    assert.equal(await regressionPage.getByRole('region', { name: 'Notifications', exact: true }).count(), 0);
    await regressionPage.waitForLoadState('networkidle');
    await regressionContext.close();
    check('Existing household creation, resident directory, dashboard, requests, payments and notification navigation');
  }
  const ctx = await context(accounts.admin); const page = await ctx.newPage(); observedPage = page;
  page.setDefaultTimeout(15000);
  await page.goto(`${base}/profile`); await page.getByRole('heading', { name: 'Profile admin', exact: true }).waitFor();
  const sidebar = page.getByRole('navigation', { name: 'Admin navigation' });
  const overview = await sidebar.locator('a').evaluateAll(links => links.slice(0, 3).map(link => link.getAttribute('href')));
  assert.deepEqual(overview, ['/dashboard', '/profile', '/theme']);
  assert.equal(await sidebar.getByRole('link', { name: 'Profile', exact: true }).getAttribute('aria-current'), 'page');
  check('Direct protected route, Dashboard -> Profile -> Theme order and active state');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Changed Admin');
  await sidebar.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Changed Admin');
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/profile');
  assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Changed Admin');
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('heading', { name: 'Changed Admin', exact: true }).waitFor();
  await page.getByRole('banner').getByText('Changed Admin', { exact: true }).waitFor();
  assert.equal(sql(`select full_name from public.profiles where id='${accounts.admin.id}'`), 'Changed Admin');
  assert.equal(sql(`select full_name from public.profiles where id='${accounts.resident.id}'`), 'Profile resident');
  assert.equal(sql(`select home_address from public.profiles where id='${accounts.admin.id}'`), 'Legacy admin address');
  check('Dirty navigation preserves drafts; real save affects only admin and preserves legacy address');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Changed Admin', exact: true }).waitFor();
  check('Dirty Cancel restores saved values through explicit confirmation');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Stale draft');
  const beforeConflict = sql(`select updated_at from public.profiles where id='${accounts.admin.id}'`);
  sql(`update public.profiles set full_name='Concurrent Admin' where id='${accounts.admin.id}'`);
  assert.notEqual(sql(`select updated_at from public.profiles where id='${accounts.admin.id}'`), beforeConflict);
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('button', { name: 'Discard draft and reload', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Stale draft');
  assert.equal(sql(`select full_name from public.profiles where id='${accounts.admin.id}'`), 'Concurrent Admin');
  await page.getByRole('button', { name: 'Discard draft and reload', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  check('Atomic stale-save rejection keeps draft and requires deliberate reload');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click({ trial: true });
  await sidebar.getByRole('link', { name: 'Theme', exact: true }).click();
  await page.waitForURL(/\/theme$/);
  await sidebar.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('History draft');
  await page.evaluate(() => window.history.back());
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/profile');
  assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'History draft');
  await page.evaluate(() => window.history.back());
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.waitForURL(/\/theme$/);
  await page.goForward();
  await page.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  check('Theme destination, dirty browser Back cancellation/discard and Forward restoration');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Admin photo', { exact: true }).setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(2097153) });
  await page.getByText('Choose a JPEG, PNG or WebP image up to 2 MiB.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save admin profile', exact: true }).isEnabled(), false);
  const image = fs.readFileSync(path.join(app, 'public/assets/logo/barangayan-logo-1024.png'));
  await page.getByLabel('Admin photo', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
  const photoUrl = sql(`select avatar_url from public.profiles where id='${accounts.admin.id}'`);
  assert.ok(photoUrl.startsWith(`${apiUrl}/storage/v1/object/public/profile-photos/${accounts.admin.id}/`));
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-photos' and name like '${accounts.admin.id}/%'`), '1');
  // Corrupt only the cleanup response, leaving the old object intact. The
  // installed Storage SDK treats invalid JSON as a handled StorageUnknownError.
  const cleanupEndpoint = `${apiUrl}/storage/v1/object/profile-photos`;
  await page.route(cleanupEndpoint, async route => {
    if (route.request().method() === 'DELETE') await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Admin photo', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: image });
  const writesBeforeCleanupFailure = profileWriteCount;
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByText('Profile saved. The previous photo could not be retired; do not repeat Save.', { exact: true }).waitFor();
  assert.equal(profileWriteCount - writesBeforeCleanupFailure, 1);
  assert.notEqual(sql(`select avatar_url from public.profiles where id='${accounts.admin.id}'`), photoUrl);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-photos' and name like '${accounts.admin.id}/%'`), '2');
  await page.unroute(cleanupEndpoint);
  const orphanPath = new URL(photoUrl).pathname.split('/profile-photos/')[1];
  assert.equal((await owner.storage.from('profile-photos').remove([orphanPath])).error, null);
  check('Committed replacement survives old-photo cleanup failure with one save and explicit partial-success feedback');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Remove current admin photo', { exact: true }).check();
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-photos' and name like '${accounts.admin.id}/%'`), '0');
  check('Oversized avatar rejected; real upload, reference commit and retirement pass');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Admin photo', { exact: true }).setInputFiles({ name: 'uncertain-upload.png', mimeType: 'image/png', buffer: image });
  const beforeUncertainUpload = profileWriteCount; corruptUploadResponse = true;
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByText('The photo upload could not be confirmed. Your saved photo was kept.', { exact: true }).waitFor();
  assert.equal(profileWriteCount, beforeUncertainUpload);
  assert.equal(sql(`select avatar_url is null from public.profiles where id='${accounts.admin.id}'`), 't');
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-photos' and name like '${accounts.admin.id}/%'`), '0');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  check('Uncertain upload response leaves the saved profile untouched and retires only its confirmed unreferenced object');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Admin photo', { exact: true }).setInputFiles({ name: 'failed-reference.png', mimeType: 'image/png', buffer: image });
  rejectProfileWrite = true;
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('button', { name: 'Discard draft and reload', exact: true }).waitFor();
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-photos' and name like '${accounts.admin.id}/%'`), '0');
  assert.equal(sql(`select avatar_url is null from public.profiles where id='${accounts.admin.id}'`), 't');
  await page.getByRole('button', { name: 'Discard draft and reload', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
  check('Avatar reference failure preserves saved state and removes only the new unreferenced object');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Mobile number', { exact: true }).fill('09171234567');
  const writesBeforeDrop = profileWriteCount; dropProfileResponse = true;
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
  assert.equal(sql(`select mobile_number from public.profiles where id='${accounts.admin.id}'`), '09171234567');
  assert.equal(profileWriteCount - writesBeforeDrop, 1);
  check('Lost commit response reconciled by fresh read with exactly one mutation');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Mobile number', { exact: true }).fill('09171234568'); rejectOptionalAudit = true;
  await page.getByRole('button', { name: 'Save admin profile', exact: true }).click();
  await page.getByText('The change completed, but its audit entry could not be recorded.', { exact: true }).waitFor();
  assert.equal(sql(`select mobile_number from public.profiles where id='${accounts.admin.id}'`), '09171234568');
  check('Optional audit failure reports partial success without repeating persistence');
  sql('revoke select on public.admin_resident_associations from authenticated');
  await reloadSettled(page);
  await page.getByText('Associated account details could not be loaded. Retry this section.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit profile', exact: true }).isEnabled(), true);
  sql('grant select on public.admin_resident_associations to authenticated');
  await page.getByRole('button', { name: 'Retry account details', exact: true }).click();
  await page.getByRole('button', { name: 'Link my resident account', exact: true }).waitFor();
  check('Resident read failure stays isolated and recovers through its own Retry');
  const abandonedEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Link my resident account', exact: true }).click();
  const abandoned = await abandonedEvent;
  await abandoned.getByRole('heading', { name: 'Verify resident account ownership', exact: true }).waitFor();
  await abandoned.close();
  await page.getByText('Sign-in was cancelled. No new account was linked.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Link my resident account', exact: true }).waitFor({ state: 'visible' });
  assert.equal(sql(`select consumed_at is not null from barangayan_private.admin_association_challenges where admin_id='${accounts.admin.id}'`), 't');
  assert.equal(sql(`select count(*) from public.admin_resident_associations where admin_id='${accounts.admin.id}'`), '0');
  sql(`update barangayan_private.admin_association_challenges set created_at=clock_timestamp()-interval '31 seconds' where admin_id='${accounts.admin.id}'`);
  const expiringContext = await context(accounts.admin); const expiringPage = await expiringContext.newPage();
  observedPage = expiringPage;
  await expiringPage.clock.install();
  await expiringPage.goto(`${base}/profile`);
  // This fresh page has no earlier interactions to wait for hydration. Wait
  // for its initial requests before exercising a click-only popup control.
  await expiringPage.waitForLoadState('networkidle');
  const [expiringPopup] = await Promise.all([
    expiringPage.waitForEvent('popup'),
    expiringPage.getByRole('button', { name: 'Link my resident account', exact: true }).click(),
  ]);
  observedPopup = expiringPopup;
  await expiringPopup.getByRole('button', { name: 'Verify ownership', exact: true }).waitFor();
  sql(`update barangayan_private.admin_association_challenges set expires_at=clock_timestamp()-interval '1 second' where admin_id='${accounts.admin.id}'`);
  await expiringPage.clock.fastForward(300001);
  await expiringPage.getByText('Sign-in proof expired. Start again.', { exact: true }).waitFor();
  await expiringPage.getByRole('button', { name: 'Link my resident account', exact: true }).waitFor();
  assert.equal(sql(`select count(*) from public.admin_resident_associations where admin_id='${accounts.admin.id}'`), '0');
  assert.equal(sql(`select consumed_at is not null from barangayan_private.admin_association_challenges where admin_id='${accounts.admin.id}'`), 't');
  assert.equal(await expiringPage.getByRole('button', { name: 'Edit profile', exact: true }).isEnabled(), true);
  await expiringContext.close();
  observedPage = page;
  sql(`update barangayan_private.admin_association_challenges set created_at=clock_timestamp()-interval '31 seconds' where admin_id='${accounts.admin.id}'`);
  check('Closed and expired ownership windows cancel challenges, create no link and restore usable admin controls');
  const residentSessionsBeforeLink = sql(`select count(*) from auth.sessions where user_id='${accounts.resident.id}'`);
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Link my resident account', exact: true }).click();
  const popup = await popupEvent; observedPopup = popup;
  await popup.getByLabel('Sign-in email', { exact: true }).fill(accounts.resident.email);
  await popup.getByLabel('Password', { exact: true }).fill(accounts.resident.password);
  const beforeUncertainLink = associationWriteCount; dropAssociationResponse = true;
  await popup.getByRole('button', { name: 'Verify ownership', exact: true }).click();
  await page.getByRole('heading', { name: 'Profile resident', exact: true }).waitFor();
  if (!popup.isClosed()) await popup.waitForEvent('close');
  assert.equal(sql(`select resident_id from public.admin_resident_associations where admin_id='${accounts.admin.id}'`), accounts.resident.id);
  assert.equal(associationWriteCount - beforeUncertainLink, 1);
  assert.equal(sql(`select count(*) from auth.sessions where user_id='${accounts.resident.id}'`), residentSessionsBeforeLink);
  await reloadSettled(page); await page.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  check('Both-account proof reconciles a lost link response once, preserves admin sign-in and retires temporary resident session');
  sql(`update auth.users set banned_until=now()+interval '1 hour' where id='${accounts.resident.id}'`);
  await reloadSettled(page);
  await page.getByText('The linked resident account is unavailable. Unlink it before establishing a new verified association.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Profile resident', exact: true }).count(), 0);
  sql(`update public.admin_resident_associations set linked_at=clock_timestamp() where admin_id='${accounts.admin.id}'`);
  await page.getByRole('button', { name: 'Unlink resident account', exact: true }).click();
  await page.getByRole('button', { name: 'Unlink accounts', exact: true }).click();
  await page.getByText('These details changed or the association conflicts. Reload and review before trying again.', { exact: true }).waitFor();
  assert.equal(sql(`select count(*) from public.admin_resident_associations where admin_id='${accounts.admin.id}'`), '1');
  check('Stale unavailable-account unlink rejects a newer association and presents recoverable conflict');
  sql(`update auth.users set banned_until=null where id='${accounts.resident.id}'`);
  await page.getByRole('button', { name: 'Retry account details', exact: true }).click();
  await page.getByRole('heading', { name: 'Profile resident', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await page.getByRole('heading', { name: 'Associated resident account', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, 'linked-resident-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  check('Banned resident details suppressed; restored account can be read at narrow width');
  if (localStaging || process.env.PROFILE_TEST_ATTENDED === 'true') {
    // A real desktop window permits browser-chrome zoom and screen-reader
    // review against synthetic local accounts, without exporting credentials.
    reviewBrowser = await chromium.launch({ headless: false, channel: 'chrome' });
    const reviewContext = await reviewBrowser.newContext({ viewport: null, storageState: await ctx.storageState() });
    reviewContext.on('page', monitorPage);
    const reviewPage = await reviewContext.newPage();
    await reviewPage.goto(`${base}/profile`);
    await reviewPage.getByRole('heading', { name: 'Profile resident', exact: true }).waitFor();
    const seconds = localStaging ? 7200 : 900;
    const ready = { origin: base, ...(localStaging ? { mailOrigin: `http://127.0.0.1:${mailPort}`, apiOrigin: apiUrl } : {}), releaseFile: localStaging ? `local-staging-${suffix}.stop` : `phase3-review-${suffix}.done`, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
    fs.writeFileSync(path.join(evidence, localStaging ? 'local-staging-ready.json' : 'phase3-review-ready.json'), JSON.stringify(ready, null, 2) + '\n');
    if (localStaging) {
      await waitFor(ready.mailOrigin);
      const delivery = await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithOtp({ email: accounts.resident.email, options: { shouldCreateUser: false, emailRedirectTo: `${base}/profile/security-callback` } });
      assert.equal(delivery.error, null, 'Synthetic staging email must be accepted by isolated Auth');
      let delivered = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const response = await fetch(`${ready.mailOrigin}/api/v1/search?query=${encodeURIComponent(`to:${accounts.resident.email}`)}`, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.ok, true);
        const messages = await response.json();
        if (messages.messages?.length > 0) { delivered = true; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      assert.equal(delivered, true, 'Synthetic email must reach the dedicated staging inbox');
      check('Dedicated local staging inbox receives real synthetic Auth mail');
      report.status = 'staging-ready'; report.staging = ready;
      save();
      await reviewPage.screenshot({ path: path.join(evidence, 'local-staging-ready.png'), fullPage: true });
      console.log(`Local staging ready: ${base}/profile; isolated inbox: ${ready.mailOrigin}. Close the review browser or run local-staging.mjs --stop. Two-hour limit. No credentials were exported.`);
    } else console.log('Isolated desktop review ready; bounded to fifteen minutes. No credentials were exported.');
    for (let attempt = 0; attempt < seconds && !fs.existsSync(path.join(evidence, ready.releaseFile)) && !reviewPage.isClosed(); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!reviewPage.isClosed()) await reviewPage.screenshot({ path: path.join(evidence, localStaging ? 'local-staging-final.png' : 'phase3-attended-final.png'), fullPage: true });
    await reviewBrowser.close(); reviewBrowser = undefined;
    // Manual inspection is evidence only when separately recorded; opening a
    // review window never marks zoom or screen-reader acceptance as passed.
  }
  if (localStaging) {
    report.status = 'staging-stopped';
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
  } else {
  await page.getByRole('button', { name: 'Unlink resident account', exact: true }).click();
  await page.getByRole('button', { name: 'Unlink accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Link my resident account', exact: true }).waitFor();
  assert.equal(sql(`select count(*) from public.profiles where id in ('${accounts.admin.id}','${accounts.resident.id}')`), '2');
  check('Unlink removes only the association and preserves both accounts');
  const mfaResident = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await mfaResident.auth.signInWithPassword({ email: accounts.resident.email, password: accounts.resident.password })).error, null);
  const enrolled = await mfaResident.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Profile test authenticator' });
  assert.equal(enrolled.error, null);
  assert.equal((await mfaResident.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: authenticatorCode(enrolled.data.totp.secret) })).error, null);
  assert.equal((await mfaResident.auth.signOut({ scope: 'local' })).error, null);
  const otpContext = await context(accounts.otherAdmin); const otpPage = await otpContext.newPage();
  await otpPage.goto(`${base}/profile`);
  const otpPopupEvent = otpPage.waitForEvent('popup');
  await otpPage.getByRole('button', { name: 'Link my resident account', exact: true }).click();
  const otpPopup = await otpPopupEvent; observedPopup = otpPopup;
  await otpPopup.getByRole('button', { name: 'Use email verification instead', exact: true }).click();
  await otpPopup.getByLabel('Sign-in email', { exact: true }).fill(accounts.resident.email);
  await otpPopup.getByRole('button', { name: 'Request code or link', exact: true }).click();
  await otpPopup.getByText('Check your sign-in inbox for a code or link. Open the link in this verification window. This operation does not create an account.', { exact: true }).waitFor();
  await otpPopup.goto(await confirmationLink(accounts.resident.email));
  await otpPopup.getByLabel('Authenticator code', { exact: true }).waitFor();
  // Use a new time step after verifying enrollment so the Auth server's
  // one-use/replay protection is exercised with a fresh authenticator code.
  await new Promise(resolve => setTimeout(resolve, 30000 - Date.now() % 30000 + 250));
  await otpPopup.getByLabel('Authenticator code', { exact: true }).fill(authenticatorCode(enrolled.data.totp.secret));
  await otpPopup.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
  await otpPage.getByRole('heading', { name: 'Profile resident', exact: true }).waitFor();
  if (!otpPopup.isClosed()) await otpPopup.waitForEvent('close');
  assert.equal(sql(`select count(*) from auth.sessions where user_id='${accounts.resident.id}'`), '0');
  await otpPage.getByRole('button', { name: 'Unlink resident account', exact: true }).click();
  await otpPage.getByRole('button', { name: 'Unlink accounts', exact: true }).click();
  await otpPage.getByRole('button', { name: 'Link my resident account', exact: true }).waitFor();
  sql(`update auth.users set encrypted_password='' where id='${accounts.otherAdmin.id}'`);
  await otpPage.getByRole('button', { name: 'Change password', exact: true }).click();
  await otpPage.getByRole('checkbox', { name: 'Verify through a separate account sign-in', exact: true }).check();
  const firstPassword = `${randomUUID()}Cc3!`;
  await otpPage.getByLabel('New password', { exact: true }).fill(firstPassword);
  await otpPage.getByLabel('Confirm new password', { exact: true }).fill(firstPassword);
  const firstPasswordPopup = otpPage.waitForEvent('popup');
  await otpPage.getByRole('button', { name: 'Change admin password', exact: true }).click();
  const adminProofPopup = await firstPasswordPopup; observedPopup = adminProofPopup;
  await adminProofPopup.getByRole('button', { name: 'Use email verification instead', exact: true }).click();
  await adminProofPopup.getByLabel('Sign-in email', { exact: true }).fill(accounts.otherAdmin.email);
  await adminProofPopup.getByRole('button', { name: 'Request code or link', exact: true }).click();
  await adminProofPopup.getByText('Check your sign-in inbox for a code or link. Open the link in this verification window. This operation does not create an account.', { exact: true }).waitFor();
  await adminProofPopup.goto(await confirmationLink(accounts.otherAdmin.email));
  await otpPage.waitForURL(/\/login$/);
  const firstPasswordLogin = await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: accounts.otherAdmin.email, password: firstPassword });
  assert.equal(firstPasswordLogin.error, null);
  accounts.otherAdmin.password = firstPassword;
  await reloadSettled(page); await page.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  check('Passwordless admin sets first password through isolated email proof; other account remains signed in');
  await otpContext.close();
  const mfaAdmin = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await mfaAdmin.auth.signInWithPassword({ email: accounts.otherAdmin.email, password: firstPassword })).error, null);
  const adminFactor = await mfaAdmin.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Profile admin authenticator' });
  assert.equal(adminFactor.error, null);
  assert.equal((await mfaAdmin.auth.mfa.challengeAndVerify({ factorId: adminFactor.data.id, code: authenticatorCode(adminFactor.data.totp.secret) })).error, null);
  assert.equal((await mfaAdmin.auth.signOut({ scope: 'local' })).error, null);
  const mfaContext = await context(accounts.otherAdmin); const mfaPage = await mfaContext.newPage();
  await mfaPage.goto(`${base}/profile`);
  await mfaPage.getByRole('heading', { name: 'Verify admin sign-in', exact: true }).waitFor();
  assert.equal(await mfaPage.getByRole('button', { name: 'Edit profile', exact: true }).count(), 0);
  await mfaPage.getByLabel('Authenticator code', { exact: true }).waitFor();
  await new Promise(resolve => setTimeout(resolve, 30000 - Date.now() % 30000 + 250));
  await mfaPage.getByLabel('Authenticator code', { exact: true }).fill(authenticatorCode(adminFactor.data.totp.secret));
  await mfaPage.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
  await mfaPage.getByRole('heading', { name: 'Profile otherAdmin', exact: true }).waitFor();
  await mfaPage.getByRole('button', { name: 'Change password', exact: true }).click();
  await mfaPage.getByLabel('Current admin password', { exact: true }).fill(firstPassword);
  const uncertainPassword = `${randomUUID()}Dd4!`;
  await mfaPage.getByLabel('New password', { exact: true }).fill(uncertainPassword);
  await mfaPage.getByLabel('Confirm new password', { exact: true }).fill(uncertainPassword);
  const credentialsBeforeDrop = credentialWriteCount; dropCredentialResponse = true;
  await mfaPage.getByRole('button', { name: 'Change admin password', exact: true }).click();
  await mfaPage.waitForURL(/\/login$/);
  await mfaPage.getByText('The password change outcome could not be confirmed. Admin session cleanup was attempted. Sign in with your current or new password to check before repeating a change.', { exact: true }).waitFor();
  assert.equal(credentialWriteCount - credentialsBeforeDrop, 1);
  assert.equal(sql(`select count(*) from auth.sessions where user_id='${accounts.otherAdmin.id}'`), '0');
  assert.equal((await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: accounts.otherAdmin.email, password: uncertainPassword })).error, null);
  accounts.otherAdmin.password = uncertainPassword;
  check('Ambiguous password commit pauses retry, attempts global cleanup and succeeds once with the new credential');
  await mfaContext.close();
  check('Low-assurance admin sees only MFA challenge; authenticator upgrades same session before profile access');
  // Global revocation is a separate service operation after password commit.
  // Its failure must report committed credentials, clear this browser session,
  // and avoid claiming that other sessions were successfully revoked.
  const failedCleanupContext = await context(accounts.otherAdmin); const failedCleanupPage = await failedCleanupContext.newPage();
  await failedCleanupPage.goto(`${base}/profile`);
  await failedCleanupPage.getByLabel('Authenticator code', { exact: true }).waitFor();
  await new Promise(resolve => setTimeout(resolve, 30000 - Date.now() % 30000 + 250));
  await failedCleanupPage.getByLabel('Authenticator code', { exact: true }).fill(authenticatorCode(adminFactor.data.totp.secret));
  await failedCleanupPage.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
  await failedCleanupPage.getByRole('button', { name: 'Change password', exact: true }).click();
  await failedCleanupPage.getByLabel('Current admin password', { exact: true }).fill(uncertainPassword);
  const cleanupFailurePassword = `${randomUUID()}Ee5!`;
  await failedCleanupPage.getByLabel('New password', { exact: true }).fill(cleanupFailurePassword);
  await failedCleanupPage.getByLabel('Confirm new password', { exact: true }).fill(cleanupFailurePassword);
  const writesBeforeSessionFailure = credentialWriteCount; rejectGlobalLogout = true;
  await failedCleanupPage.getByRole('button', { name: 'Change admin password', exact: true }).click();
  await failedCleanupPage.waitForURL(/\/login$/);
  await failedCleanupPage.getByText('Your admin password changed, but session cleanup is incomplete. Sign in with your new password and review active sessions; do not repeat the password change.', { exact: true }).waitFor();
  assert.equal(credentialWriteCount - writesBeforeSessionFailure, 1);
  const cleanupRecovery = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await cleanupRecovery.auth.signInWithPassword({ email: accounts.otherAdmin.email, password: cleanupFailurePassword })).error, null);
  accounts.otherAdmin.password = cleanupFailurePassword;
  assert.equal((await cleanupRecovery.auth.signOut({ scope: 'global' })).error, null);
  await failedCleanupContext.close();
  check('Confirmed password commit with failed global sign-out requires fresh login and reports incomplete session cleanup without retry');
  const usersBeforeUnknownProof = sql('select count(*) from auth.users');
  await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false } }).auth.signInWithOtp({ email: `unknown-proof-${suffix}@example.test`, options: { shouldCreateUser: false } });
  assert.equal(sql('select count(*) from auth.users'), usersBeforeUnknownProof);
  check('Real email-link plus authenticator ownership proof preserves main session, retires proof session and creates no unknown account');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
    assert.equal(await page.locator('main[data-admin-viewport]').evaluate(node => node.scrollWidth <= node.clientWidth + 2), true);
    await page.screenshot({ path: path.join(evidence, `profile-${width}.png`), fullPage: true });
  }
  check('Narrow/tablet/desktop layout screenshots with bounded profile content');
  if ((await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).getAttribute('aria-expanded')) === 'false') await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle color theme', exact: true }).click();
  assert.equal(await page.locator('html').evaluate(node => node.classList.contains('dark')), true);
  await page.screenshot({ path: path.join(evidence, 'profile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Toggle color theme', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(await page.locator('main[data-admin-viewport] section').evaluateAll(sections => sections.every(section => {
    const style = getComputedStyle(section); return style.animationName === 'none' && style.transitionDuration.split(',').every(duration => parseFloat(duration) === 0);
  })), true);
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  const passwordDialog = page.getByRole('dialog', { name: 'Change admin password', exact: true });
  await passwordDialog.waitFor();
  assert.equal(await passwordDialog.evaluate(node => getComputedStyle(node).animationName === 'none'), true);
  for (let step = 0; step < 18; step++) {
    await page.keyboard.press('Tab');
    assert.equal(await passwordDialog.evaluate(node => node.contains(document.activeElement)), true, `Password dialog contains keyboard focus at step ${step}`);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Change password', exact: true }).evaluate(node => node === document.activeElement), true, 'Password dialog restores focus after Escape');
  check('Theme toggle, reduced-motion rendering and modal keyboard focus containment, Escape and focus restoration');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const adminSession = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const residentSession = createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await adminSession.auth.signInWithPassword({ email: accounts.admin.email, password: accounts.admin.password })).error, null);
  assert.equal((await residentSession.auth.signInWithPassword({ email: accounts.resident.email, password: accounts.resident.password })).error, null);
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await page.getByLabel('Current admin password', { exact: true }).fill(accounts.admin.password);
  const beforeInvalidPassword = credentialWriteCount;
  await page.getByLabel('New password', { exact: true }).fill('UPPERCASE123!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('UPPERCASE123!');
  await page.getByRole('button', { name: 'Change admin password', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Include uppercase and lowercase letters, a number and a special character in your password.' }).waitFor();
  assert.equal(credentialWriteCount, beforeInvalidPassword);
  await page.getByLabel('Current admin password', { exact: true }).fill(accounts.admin.password);
  check('Admin password validation matches the inspected hosted character classes without an Auth mutation');
  const unchangedCredentials = sql(`select md5(encrypted_password) from auth.users where id='${accounts.admin.id}'`);
  const rejectedPassword = `${randomUUID()}Cc3!`;
  for (const [current, proposed, confirmation, message] of [
    [accounts.admin.password, rejectedPassword, `${rejectedPassword}different`, "Passwords don't match"],
    [accounts.admin.password, accounts.admin.password, accounts.admin.password, 'New password must be different from current password'],
    [`${randomUUID()}Wrong1!`, rejectedPassword, rejectedPassword, 'Current password could not be verified. Try provider verification if this account has no password.'],
  ]) {
    await page.getByLabel('Current admin password', { exact: true }).fill(current);
    await page.getByLabel('New password', { exact: true }).fill(proposed);
    await page.getByLabel('Confirm new password', { exact: true }).fill(confirmation);
    await page.getByRole('button', { name: 'Change admin password', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: message }).waitFor();
    assert.equal(credentialWriteCount, beforeInvalidPassword);
    assert.equal(sql(`select md5(encrypted_password) from auth.users where id='${accounts.admin.id}'`), unchangedCredentials);
  }
  check('Mismatched, reused and incorrect-current passwords are rejected without changing Auth credentials');
  await page.getByLabel('Current admin password', { exact: true }).fill(accounts.admin.password);
  const nextPassword = `${randomUUID()}Bb2!`;
  await page.getByLabel('New password', { exact: true }).fill(nextPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(nextPassword);
  await page.getByRole('button', { name: 'Change admin password', exact: true }).click();
  await page.waitForURL(/\/login$/);
  await page.getByText('Your admin password changed. Sign in again with your new password.', { exact: true }).waitFor();
  const oldPassword = await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: accounts.admin.email, password: accounts.admin.password });
  assert.ok(oldPassword.error);
  const newSignIn = await createClient(apiUrl, storageEnv.ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: accounts.admin.email, password: nextPassword });
  assert.equal(newSignIn.error, null);
  check('Real password change rejects old password, accepts new password and requires fresh admin login');
  assert.ok((await adminSession.auth.refreshSession()).error);
  assert.equal((await residentSession.auth.refreshSession()).error, null);
  check('Other admin sessions revoked; established resident session remains valid');
  const renewed = await context({ ...accounts.admin, password: nextPassword });
  const emailPage = await renewed.newPage(); observedPage = emailPage;
  await emailPage.goto(`${base}/profile`);
  const changedEmail = `profile-changed-${suffix}@example.test`;
  await emailPage.getByRole('button', { name: 'Change sign-in email', exact: true }).click();
  await emailPage.getByLabel('Current admin password', { exact: true }).fill(nextPassword);
  await emailPage.getByLabel('New sign-in email', { exact: true }).fill(changedEmail);
  docker(['stop', `admin-profile-inbucket-${suffix}`]);
  try {
    await emailPage.getByRole('button', { name: 'Request email change', exact: true }).click();
    await emailPage.getByRole('button', { name: 'Check current sign-in email', exact: true }).waitFor();
    assert.equal(await emailPage.getByRole('button', { name: 'Request email change', exact: true }).isDisabled(), true);
    await emailPage.getByRole('button', { name: 'Check current sign-in email', exact: true }).click();
    await emailPage.getByRole('alert').filter({ hasText: 'Current sign-in state checked. Review your address before retrying.' }).waitFor();
    assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
    assert.equal(sql(`select coalesce(email_change,'') from auth.users where id='${accounts.admin.id}'`), '');
    assert.equal(sql(`select email from auth.users where id='${accounts.resident.id}'`), accounts.resident.email);
    assert.equal(await emailPage.getByLabel('New sign-in email', { exact: true }).inputValue(), changedEmail);
  } finally {
    docker(['start', `admin-profile-inbucket-${suffix}`]);
    const restartedMailPort = inspect(`admin-profile-inbucket-${suffix}`).NetworkSettings.Ports['8025/tcp']?.[0]?.HostPort;
    assert.ok(restartedMailPort, 'Restarted isolated inbox must have a local port');
    mailPort = Number(restartedMailPort);
    await waitFor(`http://127.0.0.1:${mailPort}/api/v1/messages`);
  }
  await emailPage.getByLabel('Current admin password', { exact: true }).fill(nextPassword);
  check('Real local SMTP outage pauses email retries until status reconciliation and preserves both Auth users');
  if (singleConfirmation) {
    await emailPage.getByLabel('New sign-in email', { exact: true }).fill(accounts.resident.email);
    await emailPage.getByRole('button', { name: 'Request email change', exact: true }).click();
    await emailPage.getByRole('alert').filter({ hasText: 'Email change was not accepted. Check the address, availability and inbox access; wait before retrying if rate limited.' }).waitFor();
    assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
    assert.equal(sql(`select email from auth.users where id='${accounts.resident.id}'`), accounts.resident.email);
    await emailPage.getByLabel('New sign-in email', { exact: true }).fill(changedEmail);
    await emailPage.getByLabel('Current admin password', { exact: true }).fill(nextPassword);
    check('Occupied sign-in email is rejected by real Auth without changing either account');
    rateLimitCredential = true;
    await emailPage.getByRole('button', { name: 'Request email change', exact: true }).click();
    await emailPage.getByRole('alert').filter({ hasText: 'Too many attempts. Wait a few minutes before trying again.' }).waitFor();
    assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
    assert.equal(await emailPage.getByLabel('New sign-in email', { exact: true }).inputValue(), changedEmail);
    await emailPage.getByLabel('Current admin password', { exact: true }).fill(nextPassword);
    const beforeAmbiguousEmail = credentialWriteCount; dropCredentialResponse = true;
    await emailPage.getByRole('button', { name: 'Request email change', exact: true }).click();
    await emailPage.getByRole('button', { name: 'Check current sign-in email', exact: true }).waitFor();
    assert.equal(await emailPage.getByRole('button', { name: 'Request email change', exact: true }).isEnabled(), false);
    await emailPage.getByRole('button', { name: 'Check current sign-in email', exact: true }).click();
    await emailPage.getByText('Email confirmation is pending. Follow the inbox instructions; do not repeat the request.', { exact: true }).waitFor();
    assert.equal(credentialWriteCount - beforeAmbiguousEmail, 1);
    check('Credential rate limit preserves email draft; ambiguous email commit reconciles pending state without duplicate request');
  } else {
    await emailPage.getByRole('button', { name: 'Request email change', exact: true }).click();
  }
  await emailPage.getByText(changedEmail, { exact: true }).waitFor();
  assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
  async function confirmationLink(recipient) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const list = await (await fetch(`http://127.0.0.1:${mailPort}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`, { signal: AbortSignal.timeout(5000) })).json();
      const id = list.messages?.[0]?.ID;
      if (id) {
        const message = await (await fetch(`http://127.0.0.1:${mailPort}/api/v1/message/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) })).json();
        const links = `${message.HTML ?? ''} ${message.Text ?? ''}`.match(/https?:\/\/[^\s"<>]+/g) ?? [];
        const link = links.map(value => value.replaceAll('&amp;', '&')).find(value => value.startsWith(`${apiUrl}/auth/v1/verify?`));
        if (link) return link;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('The isolated confirmation email did not arrive within the bounded delivery period.');
  }
  const firstLink = await confirmationLink(accounts.admin.email);
  const secondLink = await confirmationLink(changedEmail);
  const emailSentAt = sql(`select email_change_sent_at from auth.users where id='${accounts.admin.id}'`);
  assert.ok(emailSentAt);
  sql(`update auth.users set email_change_sent_at=clock_timestamp()-interval '2 hours' where id='${accounts.admin.id}'`);
  try {
    const expired = await fetch(firstLink, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const expiredRedirect = expired.headers.get('location');
    assert.ok(expiredRedirect); assert.match(expiredRedirect, /otp_expired/);
    const expiredPage = await renewed.newPage(); observedPage = expiredPage;
    await expiredPage.goto(expiredRedirect);
    await expiredPage.getByText('This confirmation could not be completed. The link may have expired. Return to Profile to check the current sign-in email before retrying.', { exact: true }).waitFor();
    assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
    await expiredPage.waitForLoadState('networkidle');
    await expiredPage.close();
  } finally {
    sql(`update auth.users set email_change_sent_at='${emailSentAt}'::timestamptz where id='${accounts.admin.id}'`);
  }
  check('Real Auth rejects expired email confirmation without changing the address; callback presents safe recovery');
  const firstConfirm = await renewed.newPage(); await firstConfirm.goto(firstLink);
  let secondConfirm = firstConfirm;
  if (!singleConfirmation) {
    assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), accounts.admin.email);
    secondConfirm = await renewed.newPage(); await secondConfirm.goto(secondLink);
  }
  observedPage = secondConfirm;
  await secondConfirm.getByRole('heading', { name: 'Admin email confirmation', exact: true }).waitFor();
  await secondConfirm.getByText('Confirmation checked. Profile shows your current sign-in email; your contact email is unchanged.', { exact: true }).waitFor();
  assert.equal(sql(`select email from auth.users where id='${accounts.admin.id}'`), changedEmail);
  assert.equal(sql(`select email from public.profiles where id='${accounts.admin.id}'`), 'contact-admin@example.test');
  assert.equal(sql(`select email from auth.users where id='${accounts.resident.id}'`), accounts.resident.email);
  check(`Real old/new local mail delivery, ${singleConfirmation ? 'single confirmation with autoconfirm enabled' : 'two confirmations with autoconfirm disabled'} and PKCE callback; contact and resident email unchanged`);
  await secondConfirm.getByRole('link', { name: 'Return to Profile', exact: true }).click();
  await secondConfirm.getByRole('heading', { name: 'Concurrent Admin', exact: true }).waitFor();
  await secondConfirm.getByRole('button', { name: 'Logout', exact: true }).click();
  await secondConfirm.waitForURL(/\/login$/);
  assert.equal((await residentSession.auth.refreshSession()).error, null);
  check('Existing logout remains functional, dirty drafts can cancel logout and resident session remains separate');
  sql(`update public.profiles set deleted_at=now() where id='${accounts.otherAdmin.id}'`);
  for (const account of [accounts.resident, accounts.inactive, accounts.otherAdmin]) {
    const denied = await context(account); const rejected = await denied.newPage();
    await rejected.goto(`${base}/profile`); await rejected.waitForURL(/\/login$/); await denied.close();
  }
  const anonymous = await browser.newContext(); anonymous.on('page', monitorPage); const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(`${base}/profile`); await anonymousPage.waitForURL(/\/login$/); await anonymous.close();
  check('Anonymous, resident, inactive-admin and deleted-admin direct route access rejected');
  const accountsBeforeRollback = sql('select count(*) from public.profiles');
  sql(fs.readFileSync(path.join(root, 'supabase/rollback/0119_disable_admin_profile.sql'), 'utf8'));
  assert.equal(sql("select has_function_privilege('authenticated','public.admin_update_own_profile(jsonb,timestamptz)','EXECUTE')"), 'f');
  assert.equal(sql("select has_table_privilege('authenticated','public.admin_resident_associations','SELECT')"), 'f');
  assert.equal(sql('select count(*) from public.profiles'), accountsBeforeRollback);
  next.kill(); await new Promise(resolve => next.once('exit', resolve));
  next = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(webPort)], { cwd: app, env: { ...env, ADMIN_PROFILE_ENABLED: 'false', ADMIN_PROFILE_AUTH_VERIFIED: 'false' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  next.stdout.on('data', data => { nextLog += data; }); next.stderr.on('data', data => { nextLog += data; });
  await waitFor(`${base}/login`);
  const rolledBack = await context({ ...accounts.admin, email: changedEmail, password: nextPassword }); const disabledPage = await rolledBack.newPage();
  await disabledPage.goto(`${base}/profile`);
  await disabledPage.getByText('Profile access is awaiting database and account-security verification. Your existing admin tools remain available.', { exact: true }).waitFor();
  assert.equal(await disabledPage.getByRole('button', { name: 'Edit profile', exact: true }).count(), 0);
  check('Operational rollback blocks feature access and new database operations while preserving account records');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.doesNotMatch(nextLog, /⨯|(?:^|\n)(?:Error:|UnhandledPromiseRejection|unhandledRejection)/, 'Application server must not report unhandled errors');
  report.status = 'passed';
  }
} catch (error) {
  report.status = 'failed'; report.failure = error.message; console.error(error.message); process.exitCode = 1;
  if (observedPage && !observedPage.isClosed()) {
    report.visibleFailureState = await observedPage.locator('body').innerText();
    report.focusAtFailure = await observedPage.evaluate(() => ({ tag: document.activeElement?.tagName, dialog: document.activeElement?.closest('dialog')?.getAttribute('aria-label') }));
    await observedPage.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true });
  }
  if (observedPopup && !observedPopup.isClosed()) report.visibleProofFailureState = await observedPopup.locator('body').innerText();
}
finally {
  await reviewBrowser?.close();
  await browser?.close();
  next?.kill();
  legacyNext?.kill();
  gateway?.closeAllConnections(); gateway?.close();
  for (const container of [...report.containers].reverse()) docker(['stop', container]);
  fs.writeFileSync(path.join(evidence, localStaging ? 'local-staging-server.log' : 'e2e-server.log'), nextLog);
  save();
}
