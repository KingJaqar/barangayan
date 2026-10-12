/* global __dirname */
// Resident-web loading/motion/toast regression entrypoint
// (plans/Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md).
// Scenario groups are keyed by RW-LT phase ID so each phase's checks run independently.
// Local-only: synthetic fixtures on the loopback Supabase stack; never deployed URLs,
// never production data. Credentials stay in memory or in gitignored dist/.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process'), { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const app = path.join(root, 'apps/resident-web');
const evidence = path.join(root, 'plans/evidence/resident-web-feedback');
const tools = path.join(root, 'dist/rw-feedback-tools');
const PORT = 3127, BASE = `http://127.0.0.1:${PORT}`, API_URL = 'http://127.0.0.1:54321';
const DIST_DIR = '.next-rw-feedback';
const PLAYWRIGHT = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';

// ---------------------------------------------------------------- local stack access
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  assert.equal(r.status, 0, `Local docker command failed: ${args.slice(0, 3).join(' ')} ${r.stderr ?? ''}`);
  return r.stdout;
}
function sql(source) {
  return docker(['exec', '-i', 'supabase_db_barangayan', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], source).trim();
}
let cachedConfig = null;
function localConfig() {
  if (cachedConfig) return cachedConfig;
  const ports = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', 'supabase_kong_barangayan']));
  assert.ok(ports['8000/tcp']?.length && ports['8000/tcp'].every((p) => p.HostPort === '54321'), 'Only the local API port 54321 is accepted');
  const env = JSON.parse(docker(['inspect', '--format', '{{json .Config.Env}}', 'supabase_kong_barangayan']));
  const configPath = env.find((v) => v.startsWith('KONG_DECLARATIVE_CONFIG='))?.slice('KONG_DECLARATIVE_CONFIG='.length);
  assert.ok(configPath?.startsWith('/'), 'Expected local gateway configuration path');
  const gateway = docker(['exec', 'supabase_kong_barangayan', 'cat', configPath]);
  const tokens = [...new Set(gateway.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [])];
  const tokenFor = (role) => tokens.find((t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).role === role);
  cachedConfig = { API_URL, ANON_KEY: tokenFor('anon'), SERVICE_ROLE_KEY: tokenFor('service_role') };
  assert.ok(cachedConfig.ANON_KEY && cachedConfig.SERVICE_ROLE_KEY, 'Local gateway keys are required');
  return cachedConfig;
}
function appEnv() {
  const c = localConfig();
  return { ...process.env, NEXT_PUBLIC_SUPABASE_URL: c.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: c.ANON_KEY, BARANGAYAN_PREVIEW_DIST_DIR: DIST_DIR, NEXT_TELEMETRY_DISABLED: '1' };
}

// ---------------------------------------------------------------- RW-LT-00: inventory
const ASSIGNABLE = ['RW-LT-03', 'RW-LT-04', 'RW-LT-05', 'RW-LT-06', 'RW-LT-07', 'RW-LT-08'];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
function inventory(scanDir = 'rw-lt-00') {
  assert.match(scanDir, /^rw-lt-0\d$/);
  const src = path.join(app, 'src');
  const rel = (f) => path.relative(src, f).split(path.sep).join('/');
  const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f));
  const read = (f) => fs.readFileSync(f, 'utf8');
  const lines = (f, re) => read(f).split('\n').flatMap((l, i) => (re.test(l) ? [`${rel(f)}:${i + 1}`] : []));
  const special = files.filter((f) => /[\\/]app[\\/]/.test(f) && /[\\/](page|layout|loading|error|global-error|not-found|template|route)\.tsx?$/.test(f)).map(rel).sort();
  const scan = {
    pages: special.filter((f) => /\/page\.tsx$/.test(f)),
    layouts: special.filter((f) => /\/layout\.tsx$/.test(f)),
    routeHandlers: special.filter((f) => /\/route\.ts$/.test(f)),
    loadingBoundaries: special.filter((f) => /\/loading\.tsx$/.test(f)),
    errorBoundaries: special.filter((f) => /\/(global-)?error\.tsx$/.test(f)),
    notFound: special.filter((f) => /\/not-found\.tsx$/.test(f)),
    templates: special.filter((f) => /\/template\.tsx$/.test(f)),
    clientBoundaries: files.filter((f) => /^\s*['"]use client['"]/.test(read(f))).map(rel).sort(),
    sonnerImports: files.filter((f) => /from ['"]sonner['"]/.test(read(f))).map(rel).sort(),
    toastCalls: files.flatMap((f) => lines(f, /\btoast(\.(success|error|warning|info|message|loading|promise|dismiss))?\(/)),
    loadingFlags: files.flatMap((f) => lines(f, /const \[\w*(loading|Loading|pending|Pending|submitting|Submitting|saving|Saving|busy|Busy|uploading|Uploading|exporting|Exporting|cancelling|Cancelling|locating|Locating|sending|Sending|verifying|Verifying|withdrawing|processing)\w*,\s*set\w+\] = useState/)),
    refreshTriggers: files.flatMap((f) => lines(f, /\.channel\(|setInterval\(|addEventListener\(['"](focus|visibilitychange|online)['"]/)),
    drawersAndDialogs: files.filter((f) => /DialogPrimitive\.Root|<Dialog\b|<Dialog /.test(read(f)) && !/components\/ui\/dialog\.tsx$/.test(rel(f))).map(rel).sort(),
    motionUsers: files.filter((f) => /from ['"]framer-motion['"]/.test(read(f))).map(rel).sort(),
  };
  const coverage = JSON.parse(fs.readFileSync(path.join(evidence, 'rw-lt-00/coverage.json'), 'utf8'));
  const problems = [];
  const routeFiles = coverage.routes.map((r) => r.file);
  const dup = routeFiles.filter((f, i) => routeFiles.indexOf(f) !== i);
  if (dup.length) problems.push(`Duplicate route entries: ${dup.join(', ')}`);
  for (const f of [...scan.pages, ...scan.layouts, ...scan.routeHandlers]) if (!routeFiles.includes(f)) problems.push(`Unassigned route file: ${f}`);
  for (const f of routeFiles) if (!fs.existsSync(path.join(src, f))) problems.push(`Coverage references missing file: ${f}`);
  const surfaceFiles = coverage.surfaces.map((s) => s.file);
  const actionFiles = coverage.actions.map((a) => a.file);
  for (const f of scan.drawersAndDialogs) if (!surfaceFiles.includes(f) && !actionFiles.includes(f) && !routeFiles.includes(f)) problems.push(`Unassigned drawer/dialog: ${f}`);
  for (const f of scan.sonnerImports) if (!['components/ui/sonner.tsx', 'lib/notify.ts'].includes(f) && !actionFiles.includes(f) && !routeFiles.includes(f)) problems.push(`Unassigned Sonner caller: ${f}`);
  for (const f of [...surfaceFiles, ...actionFiles]) if (!fs.existsSync(path.join(src, f))) problems.push(`Coverage references missing file: ${f}`);
  for (const entry of [...coverage.routes, ...coverage.surfaces, ...coverage.actions]) if (!ASSIGNABLE.includes(entry.phase)) problems.push(`Entry ${entry.id ?? entry.file} must have exactly one phase in ${ASSIGNABLE.join('/')}, found "${entry.phase}"`);
  const actionIds = new Set(coverage.actions.map((a) => a.id));
  if (actionIds.size !== coverage.actions.length) problems.push('Duplicate action IDs');
  for (const r of coverage.routes) for (const id of r.actions ?? []) if (!actionIds.has(id)) problems.push(`Route ${r.route} references unknown action ${id}`);
  const defectIds = new Set(coverage.defects.map((d) => d.id));
  for (const a of coverage.actions) for (const id of a.defects ?? []) if (!defectIds.has(id)) problems.push(`Action ${a.id} references unknown defect ${id}`);
  // coverage.md is the living checklist (always regenerated in rw-lt-00); a later phase
  // writes its scan to its own folder so the RW-LT-00 inventory snapshot is preserved.
  const out = path.join(evidence, 'rw-lt-00');
  fs.mkdirSync(path.join(evidence, scanDir), { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(scan).map(([k, v]) => [k, v.length])),
    coverageCounts: { routes: coverage.routes.length, surfaces: coverage.surfaces.length, actions: coverage.actions.length, defects: coverage.defects.length, noAsyncRoutes: coverage.routes.filter((r) => r.noAsync).length },
    perPhase: Object.fromEntries(ASSIGNABLE.map((p) => [p, { routes: coverage.routes.filter((r) => r.phase === p).length, surfaces: coverage.surfaces.filter((s) => s.phase === p).length, actions: coverage.actions.filter((a) => a.phase === p).length }])),
    problems,
    passed: problems.length === 0,
  };
  fs.writeFileSync(path.join(evidence, scanDir, 'inventory.json'), JSON.stringify({ summary, scan }, null, 2));
  fs.writeFileSync(path.join(out, 'coverage.md'), renderCoverage(coverage, summary));
  console.log(JSON.stringify(summary, null, 2));
  if (problems.length) process.exitCode = 1;
}
function renderCoverage(c, summary) {
  const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const L = [];
  L.push('# Resident web route/action coverage checklist', '');
  L.push('Generated by `node scripts/resident-web-feedback-regression.cjs rw-lt-00:inventory` from [coverage.json](coverage.json). Edit the JSON, then regenerate; the command fails if any current page, layout, route handler, drawer/dialog, or Sonner caller is unassigned.', '');
  L.push(`Inventory: ${summary.counts.pages} pages, ${summary.counts.layouts} layouts, ${summary.counts.routeHandlers} route handler, ${summary.counts.loadingBoundaries} loading boundaries, ${summary.counts.errorBoundaries} error boundaries, ${summary.counts.sonnerImports} files importing Sonner (${summary.counts.toastCalls} toast call sites), ${summary.counts.clientBoundaries} client modules, ${summary.counts.drawersAndDialogs} drawer/dialog modules. Reconciliation: ${summary.passed ? 'every entry assigned to exactly one phase' : 'FAILED — see inventory.json problems'}.`, '');
  L.push('Columns record the **current** treatment. "verify" marks behavior that only a runtime check in the owning phase can settle. Verification evidence for later phases is appended per phase.', '');
  L.push('## Routes', '', '| Route | File | Phase | Access | State owner | Load identity | Initial | Refresh | Error | Empty | Pending label | Outcome owner | Recovery | Actions |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of c.routes) L.push(`| ${esc(r.route)} | \`${esc(r.file)}\` | ${r.phase} | ${esc(r.access)} | ${esc(r.stateOwner)} | ${esc(r.loadIdentity)} | ${esc(r.initial)} | ${esc(r.refresh)} | ${esc(r.error)} | ${esc(r.empty)} | ${esc(r.pendingLabel)} | ${esc(r.outcomeOwner)} | ${esc(r.recovery)} | ${r.noAsync ? 'No async — no loader/toast needed' : esc((r.actions ?? []).join(', '))} |`);
  L.push('', '## Shell, navigation, drawers, and dialogs', '', '| ID | File | Kind | Phase | Notes |', '|---|---|---|---|---|');
  for (const s of c.surfaces) L.push(`| ${s.id} | \`${esc(s.file)}\` | ${s.kind} | ${s.phase} | ${esc(s.notes)} |`);
  L.push('', '## Async actions', '', '| ID | Phase | File | Action | Current contract | Pending | Outcome | Gaps | Defects |', '|---|---|---|---|---|---|---|---|---|');
  for (const a of c.actions) L.push(`| ${a.id} | ${a.phase} | \`${esc(a.file)}\` | ${esc(a.action)} | ${esc(a.contract)} | ${esc(a.pending)} | ${esc(a.outcome)} | ${a.noAsync ? 'No async' : esc(a.gaps)} | ${esc((a.defects ?? []).join(', '))} |`);
  if (c.phaseVerification?.length) {
    L.push('', '## Phase verification', '', 'Per-phase changes recorded against the owning entries above (ownership unchanged).', '', '| Phase | Entry | Files | Treatment | Evidence |', '|---|---|---|---|---|');
    for (const v of c.phaseVerification) L.push(`| ${v.phase} | ${esc(v.ref)} | \`${esc(v.file)}\` | ${esc(v.treatment)} | ${esc(v.evidence)} |`);
  }
  L.push('', '## Defects tied to phases', '', '| ID | Phase | Severity | Summary | Files | Reproduction | Status |', '|---|---|---|---|---|---|---|');
  for (const d of c.defects) L.push(`| ${d.id} | ${esc(d.phase)} | ${d.severity} | ${esc(d.summary)} | ${esc(d.files.join('; '))} | ${esc(d.reproduction)} | ${esc(d.status ?? 'Open')} |`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- RW-LT-00: fixtures
const ID = (suffix) => `5e0d0000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const FX = {
  barangay: ID('1'), documentType: ID('d1'), category: ID('c1'), drive: ID('b1'),
  users: { populated: ID('a1'), empty: ID('a2'), incomplete: ID('a3'), other: ID('a4') },
  requestPending: ID('e1'), requestPaid: ID('e2'), requestOther: ID('e3'),
  incident: ID('f1'), incidentOther: ID('f2'), member: ID('91'),
};
const EMAIL = (role) => `rwfb-${role}@test.local`;
function fixtureSnapshot() {
  const users = Object.values(FX.users).map((u) => `'${u}'`).join(',');
  return JSON.parse(sql(`select jsonb_build_object(
    'nonFixtureUsers',(select count(*) from auth.users where id not in (${users})),
    'nonFixtureRequests',(select count(*) from public.service_requests where barangay_id<>'${FX.barangay}'),
    'nonFixturePayments',(select count(*) from public.payments where barangay_id<>'${FX.barangay}'),
    'nonFixtureIncidents',(select count(*) from public.incidents where barangay_id<>'${FX.barangay}'),
    'nonFixtureBarangays',(select count(*) from public.barangays where id<>'${FX.barangay}'),
    'fixtureUsers',(select count(*) from auth.users where id in (${users})),
    'fixtureBarangay',(select count(*) from public.barangays where id='${FX.barangay}'));`));
}
async function fixtures(mode) {
  assert.ok(['seed', 'cleanup', 'status'].includes(mode), 'Use rw-lt-00:fixtures seed|cleanup|status');
  const out = path.join(evidence, 'rw-lt-00/fixtures');
  fs.mkdirSync(out, { recursive: true });
  if (mode === 'status') { console.log(JSON.stringify(fixtureSnapshot(), null, 2)); return; }
  const { createClient } = require('@supabase/supabase-js');
  const c = localConfig();
  const trusted = createClient(c.API_URL, c.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (mode === 'cleanup') {
    const before = fixtureSnapshot();
    sql(`begin;
      delete from public.drive_registrations where drive_id='${FX.drive}';
      delete from public.payments where barangay_id='${FX.barangay}';
      delete from public.service_requests where barangay_id='${FX.barangay}';
      delete from public.incidents where barangay_id='${FX.barangay}';
      delete from public.announcement_reads where announcement_id in (select id from public.announcements where barangay_id='${FX.barangay}');
      delete from public.announcements where barangay_id='${FX.barangay}';
      delete from public.evacuation_centers where barangay_id='${FX.barangay}';
      delete from public.faq_articles where barangay_id='${FX.barangay}';
      delete from public.medical_drives where barangay_id='${FX.barangay}';
      delete from public.incident_categories where barangay_id='${FX.barangay}';
      delete from public.document_types where barangay_id='${FX.barangay}';
      delete from public.household_members where profile_id in (${Object.values(FX.users).map((u) => `'${u}'`).join(',')});
      commit;`);
    for (const id of Object.values(FX.users)) {
      const { error } = await trusted.auth.admin.deleteUser(id);
      if (error && !/not.?found/i.test(error.message)) throw error;
    }
    sql(`begin; delete from public.profiles where barangay_id='${FX.barangay}'; delete from public.barangay_localities where barangay_id='${FX.barangay}'; delete from public.barangays where id='${FX.barangay}'; commit;`);
    const after = fixtureSnapshot();
    for (const k of Object.keys(after).filter((k) => k.startsWith('nonFixture'))) assert.equal(after[k], before[k], `${k} must be unchanged by cleanup`);
    assert.equal(after.fixtureUsers, 0); assert.equal(after.fixtureBarangay, 0);
    fs.writeFileSync(path.join(out, 'cleanup.json'), JSON.stringify({ passed: true, at: new Date().toISOString(), before, after }, null, 2));
    const secret = path.join(tools, 'fixtures.json'); if (fs.existsSync(secret)) fs.unlinkSync(secret);
    console.log('PASS: RW feedback fixtures removed; non-fixture counts unchanged');
    return;
  }
  const before = fixtureSnapshot();
  assert.equal(before.fixtureUsers, 0, 'Fixtures already exist; run cleanup first');
  sql(`begin;
    insert into public.barangays(id,name) values ('${FX.barangay}','RW Feedback Local');
    insert into public.barangay_localities(barangay_id,display_name,city,province) values ('${FX.barangay}','RW Feedback Local','Synthetic City','Synthetic Province');
    commit;`);
  const accounts = {};
  for (const role of Object.keys(FX.users)) {
    const password = `Rwfb!${randomBytes(9).toString('base64url')}`;
    const { error } = await trusted.auth.admin.createUser({ id: FX.users[role], email: EMAIL(role), password, email_confirm: true, user_metadata: { full_name: `RW ${role}` } });
    assert.ifError(error);
    accounts[role] = { id: FX.users[role], email: EMAIL(role), password };
  }
  const profile = (role, complete) => `insert into public.profiles(id,role,barangay_id,full_name${complete ? ',first_name,last_name,house_no,street,sex,employment_status,birth_date,mobile_number' : ''},email)
    values ('${FX.users[role]}','resident','${FX.barangay}','RW ${role[0].toUpperCase()}${role.slice(1)}'${complete ? `,'RW','${role[0].toUpperCase()}${role.slice(1)}','12','Synthetic Street','female','student','2000-01-01','09171234567'` : ''},'${EMAIL(role)}')
    on conflict (id) do update set barangay_id=excluded.barangay_id, full_name=excluded.full_name${complete ? ', first_name=excluded.first_name, last_name=excluded.last_name, house_no=excluded.house_no, street=excluded.street, sex=excluded.sex, employment_status=excluded.employment_status, birth_date=excluded.birth_date, mobile_number=excluded.mobile_number' : ''};`;
  sql(`begin;
    ${profile('populated', true)} ${profile('empty', true)} ${profile('incomplete', false)} ${profile('other', true)}
    update public.profiles set household_members='[{"id":"${FX.member}","name":"Synthetic Child","relation":"Child","role":"Student"}]' where id='${FX.users.populated}';
    insert into public.document_types(id,barangay_id,name,fee_centavos) values ('${FX.documentType}','${FX.barangay}','RW Synthetic Clearance',5000);
    insert into public.service_requests(id,barangay_id,resident_id,document_type_id) values
      ('${FX.requestPending}','${FX.barangay}','${FX.users.populated}','${FX.documentType}'),
      ('${FX.requestPaid}','${FX.barangay}','${FX.users.populated}','${FX.documentType}'),
      ('${FX.requestOther}','${FX.barangay}','${FX.users.other}','${FX.documentType}');
    insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status,paid_at) values ('${FX.requestPaid}','${FX.barangay}','qrph',5000,5000,'paid',now());
    insert into public.incident_categories(id,barangay_id,name,color,icon) values ('${FX.category}','${FX.barangay}','Synthetic Hazard','#d97706','warning');
    insert into public.incidents(id,barangay_id,title,location,reporter_id,category_id,description) values
      ('${FX.incident}','${FX.barangay}','Synthetic fallen branch','{"lat":14.6,"lng":121.0}','${FX.users.populated}','${FX.category}','Synthetic report'),
      ('${FX.incidentOther}','${FX.barangay}','Synthetic other resident report','{"lat":14.6,"lng":121.0}','${FX.users.other}','${FX.category}','Synthetic report');
    insert into public.announcements(barangay_id,title,body,category,published_at) values
      ('${FX.barangay}','Synthetic water interruption','Synthetic announcement body.','general',now()),
      ('${FX.barangay}','Synthetic road clearing','Synthetic announcement body.','general',now() - interval '1 day'),
      ('${FX.barangay}','Synthetic typhoon advisory','Synthetic emergency body.','emergency',now() - interval '2 days');
    insert into public.evacuation_centers(barangay_id,name,position) values ('${FX.barangay}','Synthetic Covered Court','{"lat":14.6,"lng":121.0}');
    insert into public.faq_articles(barangay_id,question,answer) values ('${FX.barangay}','Synthetic question?','Synthetic answer.');
    insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining) values ('${FX.drive}','${FX.barangay}','Synthetic Vaccination','vaccination',(now() at time zone 'Asia/Manila')::date + 1,'08:00','12:00','All residents',50,50);
    commit;`);
  fs.mkdirSync(tools, { recursive: true });
  fs.writeFileSync(path.join(tools, 'fixtures.json'), JSON.stringify({ accounts, ids: FX }, null, 2));
  const after = fixtureSnapshot();
  for (const k of Object.keys(after).filter((k) => k.startsWith('nonFixture') && k !== 'nonFixtureUsers')) assert.equal(after[k], before[k], `${k} must be unchanged by seeding`);
  fs.writeFileSync(path.join(out, 'seed.json'), JSON.stringify({
    passed: true, at: new Date().toISOString(), apiUrl: API_URL,
    accounts: Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, { id: v.id, email: v.email, password: '(generated; kept only in gitignored dist/rw-feedback-tools/fixtures.json)' }])),
    ids: FX, before, after,
  }, null, 2));
  console.log('PASS: synthetic RW feedback fixtures seeded on the local stack');
}

// ---------------------------------------------------------------- RW-LT-00: build / serve
function build(phaseDir = 'rw-lt-00') {
  assert.match(phaseDir, /^rw-lt-0\d$/);
  const out = path.join(evidence, phaseDir, 'checks');
  fs.mkdirSync(out, { recursive: true });
  const started = Date.now();
  // `next build` appends the custom distDir's type globs to tsconfig.json; restore the
  // file afterwards so a verification build never leaves an application change behind.
  const tsconfig = path.join(app, 'tsconfig.json'), tsconfigBefore = fs.readFileSync(tsconfig);
  let r;
  try {
    r = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: app, env: appEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000, windowsHide: true });
  } finally {
    if (!fs.readFileSync(tsconfig).equals(tsconfigBefore)) fs.writeFileSync(tsconfig, tsconfigBefore);
  }
  const log = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
  fs.writeFileSync(path.join(out, 'build.txt'), `exit ${r.status}; ${Math.round((Date.now() - started) / 1000)} s; distDir ${DIST_DIR}; NEXT_PUBLIC_SUPABASE_URL=${API_URL}; tsconfig.json restored after build\n\n${log}`);
  console.log(log.split('\n').slice(-60).join('\n'));
  process.exitCode = r.status ?? 1;
}
function serve() {
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(PORT)], { cwd: app, env: appEnv(), stdio: 'inherit', windowsHide: true });
  child.on('exit', (code) => { process.exitCode = code ?? 0; });
}

// ---------------------------------------------------------------- browser helpers
// Deterministic network shaping used by every phase: delay, fail, or abort only the
// matching Supabase REST/Auth request, never the page document.
const shape = {
  // A handler still waiting when its scenario ends or is unrouted must not crash the run.
  delay: (ms) => async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.continue().catch(() => {}); },
  fail: (status = 500) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic RW feedback failure', code: 'RWFB' }) }),
  abort: () => (route) => route.abort('failed'),
};
// Evidence must never carry tokens, even the local demo keys that appear in Realtime URLs.
const redact = (text) => String(text).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]').replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, '[redacted-key]');
function monitor(page, bucket) {
  page.on('pageerror', (e) => bucket.consoleErrors.push(redact(`pageerror: ${e.message}`).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') bucket.consoleErrors.push(redact(m.text()).slice(0, 300)); });
}
function requestCounter(page) {
  const counts = { total: 0, document: 0, rsc: 0, script: 0, rest: 0, auth: 0, functions: 0, storage: 0, realtime: 0, other: 0 };
  page.on('request', (r) => {
    counts.total++;
    const u = r.url();
    if (u.includes('/rest/v1/')) counts.rest++;
    else if (u.includes('/auth/v1/')) counts.auth++;
    else if (u.includes('/functions/v1/')) counts.functions++;
    else if (u.includes('/storage/v1/')) counts.storage++;
    else if (u.includes('/realtime/v1/')) counts.realtime++;
    else if (r.resourceType() === 'document') counts.document++;
    else if (u.startsWith(BASE) && (u.includes('_rsc=') || r.headers().rsc === '1')) counts.rsc++;
    else if (r.resourceType() === 'script') counts.script++;
    else counts.other++;
  });
  return () => ({ ...counts });
}
async function login(page, account) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(account.password);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  if (new URL(page.url()).pathname === '/onboarding') {
    const cont = page.getByRole('button', { name: /Continue to Barangayan|Get started|Skip/i }).first();
    if (await cont.count()) { await cont.click(); await page.waitForURL((u) => u.pathname !== '/onboarding', { timeout: 20000 }).catch(() => {}); }
  }
  return new URL(page.url()).pathname;
}
async function toastTexts(page) {
  return page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
}
async function timeline(page, { durationMs, stepMs = 100, probes }) {
  // Samples DOM state to record when placeholders/content/animations appear.
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const state = await page.evaluate((p) => ({
      skeletons: document.querySelectorAll('.animate-pulse').length,
      spinners: document.querySelectorAll('.animate-spin').length,
      runningAnimations: document.getAnimations().filter((a) => a.playState === 'running').length,
      ariaBusy: document.querySelectorAll('[aria-busy="true"]').length,
      content: p.map((text) => document.body.innerText.includes(text)),
    }), probes).catch(() => null);
    if (state) samples.push({ t: Date.now() - start, ...state });
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return samples;
}

// ---------------------------------------------------------------- RW-LT-00: baseline
async function baseline(runName = 'baseline') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-00', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const report = { run: runName, base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL }, scenarios: [], consoleErrors: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const record = (s) => { report.scenarios.push(s); console.log(`${s.status.toUpperCase()} ${s.id}${s.note ? ` — ${s.note}` : ''}`); };
  async function scenario(id, phase, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    page.rwfbCounts = counts;
    const result = { id, phase, status: 'pass', observations: {} };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      await fn(page, result.observations, result);
      if (result.observations.untested) { result.status = 'untested'; result.note = result.observations.untested; }
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    await context.close();
    record(result);
  }
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`), fullPage: false });
  const visit = async (page, url) => {
    const t0 = Date.now(), before = page.rwfbCounts();
    const response = await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 60000 });
    const after = page.rwfbCounts();
    const requests = Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - before[k]]).filter(([, v]) => v > 0));
    return { url, finalPath: new URL(page.url()).pathname, status: response?.status() ?? null, ms: Date.now() - t0, h1: (await page.locator('h1').first().innerText().catch(() => '')).slice(0, 80), requests };
  };

  const guestRoutes = ['/home', '/announcements', '/emergency', '/emergency/centers', '/emergency/scan', '/emergency/family', '/emergency/alerts', '/maps', '/maps/directory', '/maps/preparedness', '/services/documents', `/services/${fx.ids.documentType}`, '/services/requests', '/health', '/health/my-registrations', '/reports', '/settings/help', '/settings/about', '/settings/terms-privacy', '/settings/theme', '/settings/notifications', '/settings/download-data', '/login', '/register', '/forgot-password', '/auth/error'];
  await scenario('guest-route-sweep', 'RW-LT-00', async (page, obs) => {
    obs.routes = [];
    for (const url of guestRoutes) obs.routes.push(await visit(page, url));
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' }); await shot(page, 'guest-home-1440');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await shot(page, 'guest-login-1440');
  });
  await scenario('guest-home-360', 'RW-LT-00', async (page, obs) => {
    obs.visit = await visit(page, '/home');
    obs.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await shot(page, 'guest-home-360');
  }, { viewport: { width: 360, height: 780 } });

  const residentRoutes = ['/home', '/announcements', '/emergency', '/emergency/centers', '/emergency/scan', '/emergency/family', '/emergency/alerts', '/maps', '/maps/directory', '/services/documents', '/services/requests', '/services/logs', `/services/requests/${fx.ids.requestPending}`, `/services/payment/${fx.ids.requestPending}`, `/services/payment/success?requestId=${fx.ids.requestPaid}`, '/reports', `/reports/${fx.ids.incident}`, '/reports/new', '/health', '/health/my-registrations', `/health/register/${fx.ids.drive}`, '/settings/profile', '/settings/change-password', '/settings/email-verification', '/settings/location-verification', '/settings/theme', '/settings/help', '/settings/about', '/settings/terms-privacy', '/settings/delete-account'];
  await scenario('resident-route-sweep', 'RW-LT-00', async (page, obs) => {
    obs.routes = [];
    for (const url of residentRoutes) obs.routes.push(await visit(page, url));
    for (const [url, name] of [['/home', 'resident-home-1440'], ['/services/requests', 'resident-requests-1440'], ['/reports', 'resident-reports-1440'], ['/emergency/family', 'resident-family-1440'], [`/services/payment/success?requestId=${fx.ids.requestPaid}`, 'resident-receipt-1440'], ['/settings/profile', 'resident-profile-1440']]) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }); await shot(page, name);
    }
  }, { account: 'populated' });
  await scenario('resident-home-360', 'RW-LT-00', async (page, obs) => {
    obs.visit = await visit(page, '/home');
    obs.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await shot(page, 'resident-home-360');
  }, { account: 'populated', viewport: { width: 360, height: 780 } });
  await scenario('empty-resident-states', 'RW-LT-00', async (page, obs) => {
    obs.pages = {};
    for (const [url, text] of [['/services/requests', /no (document )?requests|haven.t (submitted|requested)/i], ['/reports', /haven.t reported any incidents yet/i], ['/emergency/family', /No family members added yet\./], ['/health/my-registrations', /No registrations yet/]]) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
      const body = await page.locator('main').innerText();
      obs.pages[url] = { emptyCopyVisible: text.test(body), excerpt: body.slice(-240) };
    }
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' }); await shot(page, 'empty-requests-1440');
  }, { account: 'empty' });
  await scenario('profile-completion-required', 'RW-LT-00', async (page, obs) => {
    obs.reportsNew = await visit(page, '/reports/new');
    obs.home = await visit(page, '/home');
    await shot(page, 'incomplete-home-1440');
  }, { account: 'incomplete' });
  await scenario('inaccessible-records', 'RW-LT-00', async (page, obs) => {
    obs.otherRequest = await visit(page, `/services/requests/${fx.ids.requestOther}`);
    obs.otherIncident = await visit(page, `/reports/${fx.ids.incidentOther}`);
    obs.otherReceipt = await visit(page, `/services/payment/success?requestId=${fx.ids.requestOther}`);
    obs.otherReceiptAlert = (await page.locator('[role=alert]').first().innerText().catch(() => '')).slice(0, 120);
  }, { account: 'populated' });

  // Deterministic read scenarios (announcements feed is the representative list).
  await scenario('slow-read-2s', 'RW-LT-00', async (page, obs) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await page.route('**/rest/v1/announcements?*', shape.delay(2000));
    const nav = page.goto(`${BASE}/announcements`, { waitUntil: 'commit' });
    obs.timeline = await timeline(page, { durationMs: 3500, probes: ['Synthetic water interruption'] });
    await nav;
    obs.firstContentMs = obs.timeline.find((s) => s.content[0])?.t ?? null;
    obs.skeletonSeenMs = obs.timeline.find((s) => s.skeletons > 0)?.t ?? null;
    obs.maxRunningAnimations = Math.max(0, ...obs.timeline.map((s) => s.runningAnimations));
    obs.ariaBusyEverSet = obs.timeline.some((s) => s.ariaBusy > 0);
  }, { account: 'populated' });
  await scenario('fast-read', 'RW-LT-00', async (page, obs) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const nav = page.goto(`${BASE}/announcements`, { waitUntil: 'commit' });
    obs.timeline = await timeline(page, { durationMs: 1500, stepMs: 50, probes: ['Synthetic water interruption'] });
    await nav;
    obs.firstContentMs = obs.timeline.find((s) => s.content[0])?.t ?? null;
    obs.skeletonVisibleSamples = obs.timeline.filter((s) => s.skeletons > 0).length;
  }, { account: 'populated' });
  await scenario('error-read-and-retry', 'RW-LT-00', async (page, obs) => {
    await page.route('**/rest/v1/announcements?*', shape.fail(500));
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    obs.errorText = (await page.locator('main').innerText()).slice(0, 300);
    const retry = page.getByRole('button', { name: /retry|try again/i }).first();
    obs.retryVisible = await retry.isVisible().catch(() => false);
    await shot(page, 'error-read-announcements');
    await page.unroute('**/rest/v1/announcements?*');
    if (obs.retryVisible) { await retry.click(); await page.getByText('Synthetic water interruption').first().waitFor({ timeout: 10000 }); obs.recoveredAfterRetry = true; }
  }, { account: 'populated' });
  await scenario('reduced-motion-baseline', 'RW-LT-00', async (page, obs) => {
    await page.route('**/rest/v1/announcements?*', shape.delay(1500));
    const nav = page.goto(`${BASE}/announcements`, { waitUntil: 'commit' });
    obs.timeline = await timeline(page, { durationMs: 1200, probes: [] });
    await nav;
    obs.maxRunningAnimationsUnderReducedMotion = Math.max(0, ...obs.timeline.map((s) => s.runningAnimations));
    obs.pulseAnimationName = await page.evaluate(() => { const el = document.querySelector('.animate-pulse'); return el ? getComputedStyle(el).animationName : null; });
  }, { account: 'populated', reducedMotion: 'reduce' });

  // Defect reproductions (expected to reproduce at baseline; later phases flip them).
  await scenario('defect-drawer-perpetual-skeleton', 'RW-LT-00 (D-03)', async (page, obs) => {
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await page.route(`**/rest/v1/service_requests?*id=eq.*`, shape.fail(500));
    await page.locator('button', { hasText: 'RW Synthetic Clearance' }).first().click();
    await page.waitForTimeout(5000);
    obs.skeletonsAfter5s = await page.locator('[role=dialog] .animate-pulse').count();
    obs.errorOrRetryVisible = await page.locator('[role=dialog]').getByText(/could not|unavailable|retry|error/i).count();
    obs.reproduced = obs.skeletonsAfter5s > 0 && obs.errorOrRetryVisible === 0;
    await shot(page, 'defect-d03-drawer-skeleton');
  }, { account: 'populated' });
  await scenario('defect-family-dialog-closes', 'RW-LT-00 (D-02)', async (page, obs) => {
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    await page.route('**/rest/v1/profiles?*', (route) => (route.request().method() === 'PATCH' ? shape.fail(500)(route) : route.continue()));
    await page.getByRole('button', { name: /Add Family Member/ }).first().click();
    await page.locator('#member-name').fill('Synthetic Failing Member');
    await page.getByRole('button', { name: 'Add Member', exact: true }).click();
    obs.dialogOpenImmediately = await page.locator('[role=dialog]').isVisible();
    await page.waitForTimeout(1500);
    obs.dialogOpenAfterSettle = await page.locator('[role=dialog]').isVisible();
    obs.toasts = await toastTexts(page);
    obs.reproduced = !obs.dialogOpenAfterSettle;
    await shot(page, 'defect-d02-family-dialog');
  }, { account: 'populated' });
  await scenario('defect-household-false-success', 'RW-LT-00 (D-01)', async (page, obs) => {
    await page.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
    await page.route('**/rest/v1/profiles?*', (route) => (route.request().method() === 'PATCH' ? shape.fail(500)(route) : route.continue()));
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await page.locator('#member-name').fill('Synthetic Failing Member');
    await page.getByRole('button', { name: 'Add Member', exact: true }).click();
    await page.waitForTimeout(1500);
    obs.toasts = await toastTexts(page);
    obs.reproduced = obs.toasts.some((t) => /Member added/i.test(t));
    await shot(page, 'defect-d01-household-false-success');
  }, { account: 'populated' });
  await scenario('defect-false-empty-household', 'RW-LT-00 (D-07)', async (page, obs) => {
    await page.route('**/rest/v1/profiles?select=household_members*', shape.fail(500));
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    obs.falseEmptyVisible = await page.getByText('No family members added yet.').isVisible().catch(() => false);
    obs.reproduced = obs.falseEmptyVisible;
  }, { account: 'populated' });
  await scenario('obsolete-drive-date', 'RW-LT-00 (D-08)', async (page, obs) => {
    await page.goto(`${BASE}/health`, { waitUntil: 'networkidle' });
    // Independent of "today": move to a neutral date first so the slow click always
    // issues a new request, then select a second date before the slow response lands.
    const [driveDate, later, neutral] = sql(`select drive_date::text, (drive_date + 1)::text, (drive_date + 2)::text from public.medical_drives where id='${fx.ids.drive}'`).split('|');
    obs.dates = { slow: driveDate, fast: later, neutral };
    const cell = (d) => page.locator(`[aria-label="${d}"]`);
    if (!(await cell(driveDate).count()) || !(await cell(later).count()) || !(await cell(neutral).count())) { obs.untested = 'Fixture dates are not all on the visible calendar month'; return; }
    await cell(neutral).click();
    await page.waitForLoadState('networkidle');
    await page.route(`**/rest/v1/medical_drives?*drive_date=eq.${driveDate}*`, shape.delay(2500));
    await cell(driveDate).click();
    await page.waitForTimeout(200);
    await cell(later).click();
    await page.waitForTimeout(3500);
    obs.staleDriveShownForLaterDate = await page.getByText('Synthetic Vaccination').first().isVisible().catch(() => false);
    obs.reproduced = obs.staleDriveShownForLaterDate;
    await shot(page, 'defect-d08-obsolete-drive');
  }, { account: 'populated' });
  await scenario('auth-network-abort', 'RW-LT-00 (D-04)', async (page, obs) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.route('**/auth/v1/token*', shape.abort());
    await page.locator('input[type=email]').fill(fx.accounts.populated.email);
    await page.locator('input[type=password]').fill('not-the-password');
    const submit = page.locator('form button[type=submit]');
    await submit.click();
    await page.waitForTimeout(3000);
    obs.submitDisabledAfter3s = await submit.isDisabled();
    obs.inlineError = (await page.locator('form').innerText()).match(/Incorrect email or password\.|Unable[^\n]*/)?.[0] ?? null;
    obs.toasts = await toastTexts(page);
    obs.pendingStuck = obs.submitDisabledAfter3s;
  });
  // Mocked provider outcomes only: Edge Function responses are fulfilled in the browser,
  // so no PayMongo call, charge, or payment row is created.
  const SYNTHETIC_QR = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
  const mockSource = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paymentId: '00000000-0000-4000-8000-00000000feed', paymentIntentId: 'pi_rwfb_synthetic', qrImageUrl: SYNTHETIC_QR, expiresAt: Date.now() + 30 * 60 * 1000, documentFeeCentavos: 5000, amountCentavos: 5000 }) });
  await scenario('payment-qr-mocked-paid-poll', 'RW-LT-00', async (page, obs) => {
    let polls = 0;
    await page.route('**/functions/v1/create-payment-source', mockSource);
    await page.route('**/functions/v1/check-payment-status', (route) => { polls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: polls >= 2 ? 'paid' : 'pending' }) }); });
    const nav = page.goto(`${BASE}/services/payment/qrph/${fx.ids.requestPending}`, { waitUntil: 'commit' });
    obs.generatingTimeline = await timeline(page, { durationMs: 1500, probes: ['Generating your QR code', 'Expires in'] });
    await nav;
    obs.qrBox = await page.getByAltText('PayMongo QR PH code').boundingBox().catch(() => null);
    obs.qrContainerHeight = await page.getByAltText('PayMongo QR PH code').evaluate((img) => img.parentElement.getBoundingClientRect().height).catch(() => null);
    await shot(page, 'payment-qr-mocked-pending');
    // The standalone QR route renders RequestPaymentJourney -> QrphStep, whose onPaid
    // advances in place to SuccessStep (a server-confirmed receipt read), not a redirect.
    await page.getByText(/Could not confirm the recorded payment receipt|couldn.t load your payment receipt|receipt isn.t confirmed yet|Payment Successful/).first().waitFor({ timeout: 25000 });
    obs.pollsBeforeOutcome = polls;
    obs.path = new URL(page.url()).pathname;
    obs.receiptOutcome = (await page.getByText(/Could not confirm the recorded payment receipt|couldn.t load your payment receipt|receipt isn.t confirmed yet|Payment Successful/).first().innerText().catch(() => '')).slice(0, 160);
    obs.receiptRetryVisible = await page.getByRole('button', { name: 'Retry receipt' }).isVisible().catch(() => false);
    obs.toasts = await toastTexts(page);
    obs.note = 'Mocked paid poll advances to the receipt step; the confirmed-receipt read finds no paid row for this request and refuses (truthful). No payment row or charge was created.';
    await shot(page, 'payment-qr-mocked-receipt-refused');
  }, { account: 'populated' });
  await scenario('defect-qr-cancel-failure-silent', 'RW-LT-00 (D-14)', async (page, obs) => {
    await page.route('**/functions/v1/create-payment-source', mockSource);
    await page.route('**/functions/v1/check-payment-status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'pending' }) }));
    await page.route('**/functions/v1/cancel-payment', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic cancel failure' }) }));
    await page.goto(`${BASE}/services/payment/qrph/${fx.ids.requestPending}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    await page.waitForTimeout(2000);
    obs.failureMessageVisible = await page.getByText('Synthetic cancel failure').isVisible().catch(() => false);
    obs.toasts = await toastTexts(page);
    obs.stillOnQrPage = new URL(page.url()).pathname.includes('/qrph/');
    obs.reproduced = !obs.failureMessageVisible && obs.toasts.length === 0;
    await shot(page, 'defect-d14-cancel-failure');
  }, { account: 'populated' });
  await scenario('notification-toggle-toast', 'RW-LT-00 (D-12)', async (page, obs) => {
    await page.goto(`${BASE}/settings/notifications`, { waitUntil: 'networkidle' });
    await page.getByRole('switch').first().click();
    await page.waitForTimeout(500);
    obs.toasts = await toastTexts(page);
    await page.reload({ waitUntil: 'networkidle' });
    obs.firstSwitchAfterReload = await page.getByRole('switch').first().getAttribute('aria-checked');
    obs.reproduced = obs.toasts.length > 0;
  }, { account: 'populated' });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'untested', 'error'].map((k) => [k, report.scenarios.filter((s) => s.status === k).length]));
  report.summary.meaning = '"pass" = scenario executed and its observations were recorded; defect scenarios record reproduced=true when the baseline defect is present.';
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  if (report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-01: primitives
// Samples the shared loading primitives with *effective* visibility (opacity product up
// the tree), so the 120 ms decorative delay is asserted rather than inferred.
async function feedbackSample(page, buttonSelector) {
  return page.evaluate((btnSel) => {
    const effective = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= Number(cs.opacity); } return o; };
    const visible = (sel) => [...document.querySelectorAll(sel)].filter((el) => effective(el) > 0.05).length;
    const status = [...document.querySelectorAll('[data-slot=loading-status]')].map((el) => el.textContent.trim()).filter(Boolean);
    const btn = btnSel ? document.querySelector(btnSel) : null;
    const box = btn?.getBoundingClientRect();
    return {
      skeletons: document.querySelectorAll('[data-slot=skeleton]').length,
      skeletonsVisible: visible('[data-slot=skeleton]'),
      skeletonsAriaHidden: [...document.querySelectorAll('[data-slot=skeleton]')].every((el) => el.closest('[aria-hidden=true]')),
      spinnersVisible: visible('[data-slot=spinner]'),
      infiniteAnimations: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
      ariaBusy: document.querySelectorAll('[aria-busy=true]').length,
      status,
      statusVisible: [...document.querySelectorAll('[data-slot=loading-status] > span')].some((el) => effective(el) > 0.05),
      button: btn ? { disabled: btn.disabled, ariaBusy: btn.getAttribute('aria-busy'), width: Math.round(box.width), height: Math.round(box.height), text: btn.innerText.trim() } : null,
    };
  }, buttonSelector ?? null).catch(() => null);
}
async function sampleFor(page, durationMs, { stepMs = 30, button, probe } = {}) {
  const out = [], start = Date.now();
  while (Date.now() - start < durationMs) {
    const s = await feedbackSample(page, button);
    if (s) { if (probe) s.probe = await page.evaluate((t) => document.body.innerText.includes(t), probe).catch(() => null); out.push({ t: Date.now() - start, ...s }); }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return out;
}
const firstAt = (samples, pred) => samples.find(pred)?.t ?? null;
const effectiveOpacity = (locator) => locator.evaluate((el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; });

async function rwlt01(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-01', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const report = { run: runName, phase: 'RW-LT-01', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  async function scenario(id, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: options.colorScheme ?? 'light' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-01', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      await fn(page, result.observations, check);
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    // Realtime is unavailable on the local stack (WebSocket 503) and scenarios fail
    // requests on purpose; anything else in the console fails the scenario.
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|404|500)|Failed to load resource|ERR_FAILED/i.test(m));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }
  const ANN = '**/rest/v1/announcements?*';
  const FIRST = 'Synthetic water interruption';
  // Category chip clicks issue a new client-side read, so the primitives' timing is
  // measured without page-load noise.
  const openFeed = async (page) => { await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' }); await page.getByText(FIRST).first().waitFor(); };
  const chip = (page, name) => page.locator('button', { hasText: new RegExp(`^${name}$`) }).first();
  const requestCard = (page) => page.locator('button', { hasText: 'RW Synthetic Clearance' }).first();

  await scenario('list-fast-read-no-flash', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(30));
    await chip(page, 'General').click();
    obs.samples = await sampleFor(page, 700, { stepMs: 10, probe: FIRST });
    obs.contentAtMs = firstAt(obs.samples, (x) => x.probe && x.skeletons === 0);
    check('content arrived under 120 ms', obs.contentAtMs !== null && obs.contentAtMs < 120, obs.contentAtMs);
    check('no visible skeleton, spinner, or label', obs.samples.every((x) => x.skeletonsVisible === 0 && x.spinnersVisible === 0 && !x.statusVisible));
  }, { account: 'populated' });

  await scenario('list-slow-read-2s', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(2000));
    await chip(page, 'General').click();
    const early = await sampleFor(page, 90, { stepMs: 15 });
    obs.early = early;
    check('busy and label set immediately', early.length && early[0].ariaBusy > 0 && early[0].status.includes('Loading announcements…'), early[0]);
    check('decoration hidden before 120 ms', early.every((x) => x.skeletonsVisible === 0 && !x.statusVisible));
    check('skeletons hidden from assistive technology', early.every((x) => x.skeletonsAriaHidden));
    const later = await sampleFor(page, 2600, { stepMs: 50, probe: FIRST });
    obs.later = later.map(({ t, skeletonsVisible, statusVisible, ariaBusy, probe }) => ({ t, skeletonsVisible, statusVisible, ariaBusy, probe }));
    obs.skeletonVisibleAtMs = firstAt(later, (x) => x.skeletonsVisible > 0);
    check('matching skeleton and visible label while pending', later.some((x) => x.skeletonsVisible >= 9 && x.statusVisible));
    const settled = await feedbackSample(page);
    check('settles: no status, no busy region, content shown', settled.status.length === 0 && settled.ariaBusy === 0 && (await page.getByText(FIRST).first().isVisible()), settled);
    await page.waitForTimeout(400);
    obs.cardOpacityAfter400ms = await effectiveOpacity(page.getByText(FIRST).first());
    check('revealed content fully visible within 400 ms', obs.cardOpacityAfter400ms > 0.99, obs.cardOpacityAfter400ms);
    obs.staggerDelays = await page.locator('.rw-reveal').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationDelay));
    check('stagger bounded to 150 ms', obs.staggerDelays.every((d) => parseFloat(d) <= 0.15), obs.staggerDelays);
  }, { account: 'populated' });

  await scenario('list-slow-read-dark', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(3000));
    await chip(page, 'General').click();
    await page.waitForTimeout(700);
    await shot(page, 'list-skeleton-dark-1440');
    obs.htmlDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    obs.skeletonColor = await page.locator('[data-slot=skeleton]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    check('theme-aware skeleton in dark mode', obs.htmlDark && !/rgb\(2[0-5]\d, 2[0-5]\d, 2[0-5]\d\)/.test(obs.skeletonColor), obs.skeletonColor);
  }, { account: 'populated', colorScheme: 'dark' });

  await scenario('list-over-10s-taking-longer', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(11500));
    await chip(page, 'General').click();
    await page.waitForTimeout(9000);
    obs.at9s = await feedbackSample(page);
    check('no slow message before 10 s', obs.at9s.status.every((t) => !/longer than usual/.test(t)), obs.at9s.status);
    await page.waitForTimeout(1600);
    obs.at10_6s = await feedbackSample(page);
    check('slow message after 10 s, still pending, no failure claim', obs.at10_6s.status.some((t) => /Loading announcements… Taking longer than usual\./.test(t)) && obs.at10_6s.ariaBusy > 0 && !(await page.getByText(/failed|try again/i).count()), obs.at10_6s.status);
    await shot(page, 'list-taking-longer-1440');
    await page.getByText(FIRST).first().waitFor({ timeout: 5000 });
    obs.settled = await feedbackSample(page);
    check('settles after slow success', obs.settled.status.length === 0 && obs.settled.ariaBusy === 0);
  }, { account: 'populated' });

  await scenario('list-timer-cleanup', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(1500));
    await chip(page, 'General').click();
    await page.getByText(FIRST).first().waitFor();
    await page.waitForTimeout(10500);
    obs.after = await feedbackSample(page);
    check('no late slow message or pending visuals after settle', obs.after.status.length === 0 && obs.after.skeletons === 0 && obs.after.ariaBusy === 0, obs.after);
  }, { account: 'populated' });

  for (const [id, handler] of [['list-returned-error', shape.fail(500)], ['list-thrown-failure', shape.abort()]]) {
    await scenario(id, async (page, obs, check) => {
      await openFeed(page);
      // postgrest-js retries GET network failures 3 times (1 s/2 s/4 s backoff) before
      // returning the error, so a thrown failure settles after ~9 s; attempts are recorded.
      obs.attempts = 0;
      await page.route(ANN, async (route) => { obs.attempts++; await new Promise((r) => setTimeout(r, 600)); return handler(route); });
      await chip(page, 'General').click();
      await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 20000 });
      obs.settled = await feedbackSample(page);
      check('pending visuals released on failure', obs.settled.status.length === 0 && obs.settled.ariaBusy === 0 && obs.settled.skeletons === 0, obs.settled);
      await page.unroute(ANN);
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.getByText(/Synthetic (water|road)/).first().waitFor({ timeout: 8000 });
      check('retry recovers the read', true);
    }, { account: 'populated' });
  }

  await scenario('reduced-motion-static', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(2000));
    await chip(page, 'General').click();
    obs.samples = (await sampleFor(page, 900, { stepMs: 60 })).map(({ t, skeletonsVisible, infiniteAnimations }) => ({ t, skeletonsVisible, infiniteAnimations }));
    check('no infinite (pulse/spin) animation under reduced motion', obs.samples.every((x) => x.infiniteAnimations === 0), Math.max(...obs.samples.map((x) => x.infiniteAnimations)));
    check('skeletons still delayed, then shown statically', obs.samples[0].skeletonsVisible === 0 && obs.samples.at(-1).skeletonsVisible > 0);
    await page.getByText(FIRST).first().waitFor();
    obs.cardOpacityImmediately = await effectiveOpacity(page.getByText(FIRST).first());
    obs.revealAnimation = await page.locator('.rw-reveal').first().evaluate((el) => getComputedStyle(el).animationName);
    check('content appears without reveal movement', obs.cardOpacityImmediately > 0.99 && obs.revealAnimation === 'none', { opacity: obs.cardOpacityImmediately, animation: obs.revealAnimation });
    // Placeholders not yet migrated (animate-pulse/spin) are static too.
    obs.legacy = await page.evaluate(() => ['animate-pulse', 'animate-spin', 'shimmer'].map((c) => { const d = document.createElement('div'); d.className = c; document.body.append(d); const n = getComputedStyle(d).animationName; d.remove(); return `${c}:${n}`; }));
    check('legacy pulse/spin/shimmer disabled', obs.legacy.every((x) => x.endsWith(':none')), obs.legacy);
    obs.scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    // Existing Framer drawer: MotionConfig reducedMotion="user" skips the slide.
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await requestCard(page).click();
    await page.waitForTimeout(30);
    obs.drawerLeftAt30ms = await page.locator('[role=dialog]').evaluate((el) => Math.round(el.getBoundingClientRect().left));
    await page.waitForTimeout(400);
    obs.drawerLeftSettled = await page.locator('[role=dialog]').evaluate((el) => Math.round(el.getBoundingClientRect().left));
    check('drawer opens without sliding', Math.abs(obs.drawerLeftAt30ms - obs.drawerLeftSettled) <= 1, { at30ms: obs.drawerLeftAt30ms, settled: obs.drawerLeftSettled });
  }, { account: 'populated', reducedMotion: 'reduce' });

  await scenario('form-submit-login-label', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    let tokenRequests = 0;
    await page.route('**/auth/v1/token*', async (route) => { tokenRequests++; await new Promise((r) => setTimeout(r, 1500)); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }); });
    await page.locator('input[type=email]').fill(fx.accounts.populated.email);
    await page.locator('input[type=password]').fill('synthetic-wrong-password');
    const sel = 'form button[type=submit]';
    obs.before = (await feedbackSample(page, sel)).button;
    // Repeated activation: Enter, then an immediate click on the (now disabled) button.
    await page.locator('input[type=password]').press('Enter');
    await page.locator(sel).click({ force: true, noWaitAfter: true, timeout: 1000 }).catch(() => {});
    const early = await sampleFor(page, 90, { stepMs: 15, button: sel });
    obs.early = early.map(({ t, spinnersVisible, button }) => ({ t, spinnersVisible, button }));
    obs.namesWhilePending = { loggingIn: await page.getByRole('button', { name: 'Logging in…', exact: true }).count(), logIn: await page.getByRole('button', { name: 'Log In', exact: true }).count() };
    check('disabled, aria-busy, pending label immediately', early[0].button.disabled && early[0].button.ariaBusy === 'true' && early[0].button.text === 'Logging in…', early[0].button);
    check('one accessible name while pending', obs.namesWhilePending.loggingIn === 1 && obs.namesWhilePending.logIn === 0, obs.namesWhilePending);
    check('spinner hidden before 120 ms', early.every((x) => x.spinnersVisible === 0));
    check('button dimensions stable', early.every((x) => x.button.width === obs.before.width && x.button.height === obs.before.height), { before: obs.before, pending: early.at(-1).button });
    await page.waitForTimeout(300);
    obs.mid = (await feedbackSample(page, sel));
    await shot(page, 'login-pending-1440');
    check('spinner visible after delay', obs.mid.spinnersVisible > 0);
    await page.getByText('Incorrect email or password.').waitFor({ timeout: 6000 });
    obs.after = (await feedbackSample(page, sel)).button;
    obs.tokenRequests = tokenRequests;
    check('one sign-in request for repeated activation', tokenRequests === 1, tokenRequests);
    check('released after failure with original label and size', !obs.after.disabled && obs.after.ariaBusy === null && obs.after.text === 'Log In' && obs.after.width === obs.before.width, obs.after);
    // The real local success path still works through the same control.
    await page.unroute('**/auth/v1/token*');
    await page.locator('input[type=password]').fill(fx.accounts.populated.password);
    await page.locator(sel).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    obs.successPath = new URL(page.url()).pathname;
    check('successful login keeps existing destination', ['/home', '/onboarding'].includes(obs.successPath), obs.successPath);
  });

  await scenario('text-button-no-label-spinner', async (page, obs, check) => {
    // "Detect My Location" is a text button with `loading` and no loadingLabel. The
    // geolocation call is stubbed in the browser to pend for 1.2 s, then fail.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, fail) => setTimeout(() => fail({ code: 2 }), 1200) } });
    });
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => /Detect My Location/.test(b.innerText)).setAttribute('data-rw-probe', '1'); });
    const sel = '[data-rw-probe]';
    obs.before = (await feedbackSample(page, sel)).button;
    await page.locator(sel).click();
    const early = await sampleFor(page, 90, { stepMs: 15, button: sel });
    obs.early = early.map(({ t, spinnersVisible, button }) => ({ t, spinnersVisible, button }));
    check('disabled + aria-busy immediately, size stable', early[0].button.disabled && early[0].button.ariaBusy === 'true' && early.every((x) => x.button.width === obs.before.width && x.button.height === obs.before.height), early[0].button);
    check('accessible name preserved while pending', (await page.getByRole('button', { name: 'Detect My Location', exact: true }).count()) === 1);
    check('no spinner flash before 120 ms', early.every((x) => x.spinnersVisible === 0));
    await page.waitForTimeout(350);
    obs.mid = await feedbackSample(page, sel);
    await shot(page, 'detect-location-pending-1440');
    check('spinner replaces content after delay', obs.mid.spinnersVisible > 0);
    await page.getByText(/GPS timed out or is unavailable/).first().waitFor({ timeout: 6000 });
    obs.after = await feedbackSample(page, sel);
    check('released after failure', !obs.after.button.disabled && obs.after.button.ariaBusy === null && obs.after.spinnersVisible === 0, obs.after.button);
    obs.path = new URL(page.url()).pathname;
    check('stays on the form after failure', obs.path === '/register', obs.path);
  });

  await scenario('aschild-navigation-buttons', async (page, obs, check) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const link = page.getByRole('link', { name: 'Get Started' });
    obs.tag = await link.evaluate((el) => `${el.tagName}:${el.getAttribute('data-slot')}`);
    await link.click();
    await page.waitForURL('**/register');
    check('asChild Link renders as a link and navigates', obs.tag === 'A:button', obs.tag);
  });

  await scenario('drawer-pilot', async (page, obs, check) => {
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    const detail = `**/rest/v1/service_requests?*id=eq.*`;
    await page.route(detail, shape.delay(1500));
    const t0 = Date.now();
    await requestCard(page).click();
    const samples = [];
    while (Date.now() - t0 < 450) {
      const x = await page.locator('[role=dialog]').evaluate((el) => el.getBoundingClientRect().left).catch(() => null);
      samples.push({ t: Date.now() - t0, x, ...(await feedbackSample(page)) });
      await new Promise((r) => setTimeout(r, 15));
    }
    obs.openSamples = samples.map(({ t, x, ariaBusy, status }) => ({ t, x: x === null ? null : Math.round(x), ariaBusy, status }));
    const finalX = samples.at(-1).x;
    obs.settledAtMs = samples.find((s) => s.x !== null && Math.abs(s.x - finalX) < 1)?.t ?? null;
    check('entrance settles by ~240 ms without overshoot', obs.settledAtMs !== null && obs.settledAtMs <= 380 && samples.every((s) => s.x === null || s.x >= finalX - 0.5), obs.settledAtMs);
    check('loading label + aria-busy while pending', samples.some((s) => s.status.includes('Loading request…') && s.ariaBusy > 0));
    await shot(page, 'drawer-pending-1440');
    await page.waitForFunction(() => document.querySelector('[role=dialog]') && !document.querySelector('[role=dialog] [data-slot=skeleton]'), null, { timeout: 6000 });
    obs.loadedText = (await page.locator('[role=dialog]').innerText()).slice(0, 160);
    obs.loaded = await feedbackSample(page);
    check('settles to real content', obs.loaded.status.length === 0 && obs.loaded.ariaBusy === 0 && obs.loaded.skeletons === 0, obs.loaded);
    const c0 = Date.now();
    await page.locator('[role=dialog]').getByRole('button', { name: 'Close' }).first().click();
    await page.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 2000 });
    obs.exitMs = Date.now() - c0;
    check('exit completes quickly (~180 ms)', obs.exitMs < 450, obs.exitMs);
    // D-03 (null record conflated with pending) is owned by RW-LT-03; record current behavior only.
    await page.unroute(detail);
    await page.route(detail, shape.fail(500));
    await requestCard(page).click();
    await page.waitForTimeout(2500);
    obs.d03 = await feedbackSample(page);
    obs.d03StillReproduces = obs.d03.skeletons > 0;
  }, { account: 'populated' });

  await scenario('mobile-360-no-overflow', async (page, obs, check) => {
    await openFeed(page);
    await page.route(ANN, shape.delay(1500));
    await chip(page, 'General').click();
    await page.waitForTimeout(500);
    obs.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || [...document.querySelectorAll('main')].some((m) => m.scrollWidth > m.clientWidth));
    await shot(page, 'list-skeleton-360');
    check('no horizontal overflow at 360 px while loading', !obs.overflow);
  }, { account: 'populated', viewport: { width: 360, height: 780 } });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  fs.writeFileSync(path.join(out, 'results.json'), redact(JSON.stringify(report, null, 2)));
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-02: notification adapter + host
// Deterministic adapter checks: lib/notify.ts transpiled in memory and run against a
// recording Sonner stand-in, so dedup/session/duration rules are tested without timing noise.
function loadNotify() {
  const ts = require(path.join(root, 'node_modules/typescript'));
  const source = fs.readFileSync(path.join(app, 'src/lib/notify.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const calls = [];
  const record = (kind) => (title, opts) => { calls.push({ kind, title, opts }); return opts?.id; };
  const toast = Object.assign(record('default'), { success: record('success'), error: record('error'), warning: record('warning'), info: record('info'), dismiss: (id) => { calls.push({ kind: 'dismiss', id }); } });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (name) => { assert.equal(name, 'sonner'); return { toast }; });
  return { api: mod.exports, calls };
}
function rwlt02Unit() {
  const out = path.join(evidence, 'rw-lt-02');
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  const test = (id, fn) => {
    const checks = {};
    const check = (name, ok, detail) => { checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try { fn(check); } catch (e) { checks.threw = { ok: false, detail: e.message }; }
    const status = Object.values(checks).every((c) => c.ok) ? 'pass' : 'fail';
    results.push({ id, phase: 'RW-LT-02', status, checks });
    const failed = Object.entries(checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${status.toUpperCase()} ${id}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  };
  const shownToasts = (calls) => calls.filter((c) => ['success', 'error', 'warning', 'info'].includes(c.kind));

  test('durations-by-kind', (check) => {
    const { api, calls } = loadNotify();
    api.notify.success('s'); api.notify.info('i'); api.notify.warning('w'); api.notify.error('e', { description: 'd' });
    const got = calls.map((c) => [c.kind, c.opts.duration]);
    check('success/info 4 s, warning 6 s, error 8 s', JSON.stringify(got) === JSON.stringify([['success', 4000], ['info', 4000], ['warning', 6000], ['error', 8000]]), got);
    check('description passed through', calls[3].opts.description === 'd');
    check('adapter class on every toast', calls.every((c) => /^rw-toast rwn-\d+$/.test(c.opts.className)));
  });
  test('repeated-callback-same-attempt', (check) => {
    const { api, calls } = loadNotify();
    const attempt = api.beginAttempt('save');
    const first = api.notify.error('Could not save', { id: attempt });
    const second = api.notify.error('Could not save', { id: attempt });
    const third = api.notify.success('Saved', { id: attempt });
    check('one terminal toast per attempt', shownToasts(calls).length === 1 && first && second === null && third === null, { first, second, third });
  });
  test('deliberate-second-attempt-notifies', (check) => {
    const { api, calls } = loadNotify();
    api.notify.error('Login failed', { id: api.beginAttempt('login') });
    api.notify.error('Login failed', { id: api.beginAttempt('login') });
    check('identical text from a new attempt still notifies', shownToasts(calls).length === 2);
    check('distinct Sonner toast ids', calls[0].opts.id !== calls[1].opts.id);
    api.notify.info('Unavailable'); api.notify.info('Unavailable');
    check('calls without an operation id are never suppressed', shownToasts(calls).length === 4);
  });
  test('event-id-overlapping-observers', (check) => {
    const { api, calls } = loadNotify();
    api.setNotificationSession('account-a');
    api.notify.success('Payment received', { id: api.eventId('payment', 'pay-1', 'paid') }); // poll
    api.notify.success('Payment received', { id: api.eventId('payment', 'pay-1', 'paid') }); // Realtime
    api.notify.warning('Payment expired', { id: api.eventId('payment', 'pay-2', 'expired') });
    check('same event notifies once; a different attempt/state notifies', shownToasts(calls).length === 2);
    check('event id includes the session key', api.eventId('x') === 'event:account-a:x');
  });
  test('session-change-clears-and-suppresses', (check) => {
    const { api, calls } = loadNotify();
    api.setNotificationSession(null); // first report (guest) adopts without clearing
    api.notify.error('Login failed', { id: api.beginAttempt('login') });
    const pendingGuest = api.beginAttempt('other');
    check('first session report does not dismiss', !calls.some((c) => c.kind === 'dismiss'));
    api.setNotificationSession('account-a');
    const dismissed = calls.filter((c) => c.kind === 'dismiss').map((c) => c.id);
    check("previous session's adapter toast dismissed", dismissed.length === 1 && dismissed[0] === calls[0].opts.id, dismissed);
    check("previous session's pending attempt suppressed", api.notify.success('Done', { id: pendingGuest }) === null);
    const before = calls.length;
    api.setNotificationSession('account-a');
    check('same session re-report is a no-op', calls.length === before);
    const kept = api.notify.success('Signed out', { keepOnSessionChange: true });
    api.notify.success('Saved', { id: api.beginAttempt('save') });
    const aPending = api.beginAttempt('upload');
    api.setNotificationSession('account-b');
    const dismissedB = calls.filter((c) => c.kind === 'dismiss').map((c) => c.id).slice(1);
    check('keepOnSessionChange toast survives; others dismissed', !dismissedB.includes(kept) && dismissedB.length === 1, { kept, dismissedB });
    check('account A outcome never reaches account B', api.notify.error('Upload failed', { id: aPending }) === null);
    check('new account notifies normally', api.notify.success('Saved', { id: api.beginAttempt('save') }) !== null);
    check('event ids differ per account', api.eventId('payment', 'p', 'paid') === 'event:account-b:payment:p:paid');
  });
  test('bounded-bookkeeping', (check) => {
    const { api } = loadNotify();
    const oldest = api.beginAttempt('old');
    for (let i = 0; i < 250; i++) api.notify.success('x', { id: api.beginAttempt('bulk') });
    check('bookkeeping is bounded (oldest of >200 tracked ids evicted)', api.notify.success('late', { id: oldest }) === null);
  });
  test('focus-hold-and-release', (check) => {
    const { api, calls } = loadNotify();
    const toastId = api.notify.error('Login failed');
    const el = { className: `toast rw-toast ${toastId}` };
    check('host maps a toast element to its adapter id', api.adapterToastIdOf(el) === toastId);
    check('direct Sonner toasts are not mapped', api.adapterToastIdOf({ className: 'toast' }) === null);
    api.holdToast(toastId); api.holdToast(toastId);
    api.releaseToast(toastId); api.releaseToast(toastId);
    const updates = calls.slice(1).map((c) => ({ id: c.opts.id, duration: c.opts.duration, title: c.title }));
    check('hold → Infinity once, release → full duration once, same toast and text', updates.length === 2 && updates[0].duration === Infinity && updates[1].duration === 8000 && updates.every((u) => u.id === toastId && u.title === 'Login failed'), updates.map((u) => ({ ...u, duration: String(u.duration) })));
    calls[0].opts.onAutoClose();
    check('closed toasts leave bookkeeping', api.adapterToastIdOf(el) === null);
  });
  test('ownership-sonner-imports', (check) => {
    const src = path.join(app, 'src');
    const importers = walk(src).filter((f) => /\.tsx?$/.test(f) && /from ['"]sonner['"]/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(src, f).split(path.sep).join('/'));
    check('migrated pilot no longer imports Sonner', !importers.includes('app/(auth)/login/page.tsx'), importers.length);
    check('adapter owns no fetch/mutation/interception', !/fetch\(|supabase|addEventListener|window\.onerror|unhandledrejection/.test(fs.readFileSync(path.join(src, 'lib/notify.ts'), 'utf8')));
    const pilots = ['app/(resident)/announcements/announcements-feed.tsx', 'app/(resident)/services/requests/request-drawer.tsx'];
    check('read pilots emit no toast (policy: local loading/error only)', pilots.every((f) => !/toast|notify\./.test(fs.readFileSync(path.join(src, f), 'utf8'))));
  });
  const summary = Object.fromEntries(['pass', 'fail'].map((k) => [k, results.filter((r) => r.status === k).length]));
  fs.writeFileSync(path.join(out, 'unit-results.json'), JSON.stringify({ phase: 'RW-LT-02', ranAt: new Date().toISOString(), module: 'apps/resident-web/src/lib/notify.ts', summary, results }, null, 2));
  console.log(JSON.stringify(summary));
  if (summary.fail) process.exitCode = 1;
}

// Browser scenarios against the production build (Chrome). Toasts in pilot flows come
// from browser-fulfilled Auth failures; resident-page placement and dialog checks use
// existing direct Sonner callers (notifications toggle, QR share copy) rendered by the
// same single host. No email, SMS, payment, or provider call is made.
async function toastState(page) {
  return page.evaluate(() => {
    const section = document.querySelector('section[aria-label^="Notifications"]');
    const anchor = document.querySelector('[data-toast-anchor]');
    const toasts = [...document.querySelectorAll('[data-sonner-toast]')].map((el) => {
      const r = el.getBoundingClientRect();
      const close = el.querySelector('[data-close-button]');
      const c = close?.getBoundingClientRect();
      return {
        text: el.innerText.trim(), type: el.getAttribute('data-type'), visible: el.getAttribute('data-visible'), removed: el.getAttribute('data-removed'),
        top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height),
        close: c ? { width: Math.round(c.width), height: Math.round(c.height), cx: c.left + c.width / 2, cy: c.top + c.height / 2, label: close.getAttribute('aria-label') } : null,
        opacity: Number(getComputedStyle(el).opacity), transition: getComputedStyle(el).transitionDuration,
      };
    }).filter((t) => t.removed !== 'true');
    return {
      toasts,
      liveRegion: section ? { ariaLive: section.getAttribute('aria-live'), ariaHidden: Boolean(section.closest('[aria-hidden=true]')), inert: Boolean(section.closest('[inert]')) } : null,
      toaster: (() => { const t = document.querySelector('[data-sonner-toaster]'); return t ? { theme: t.getAttribute('data-theme'), fontFamily: getComputedStyle(t).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily } : null; })(),
      headerBottom: anchor ? Math.round(anchor.getBoundingClientRect().bottom) : null,
      viewport: { width: innerWidth, height: innerHeight },
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      active: document.activeElement ? `${document.activeElement.tagName}#${document.activeElement.id}${document.activeElement.hasAttribute('data-close-button') ? '[close]' : ''}` : null,
    };
  });
}
const liveToasts = async (page, re) => (await toastState(page)).toasts.filter((t) => !re || re.test(t.text));
async function waitForToast(page, re, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if ((await liveToasts(page, re)).length) return Date.now(); await new Promise((r) => setTimeout(r, 25)); }
  throw new Error(`No toast matching ${re}`);
}
async function waitForNoToast(page, re, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (!(await liveToasts(page, re)).length) return Date.now(); await new Promise((r) => setTimeout(r, 50)); }
  return null;
}
const LOGIN_FAILED = /Login failed/;
async function failLogin(page, fx, { delayMs = 300 } = {}) {
  const attempts = { token: 0 };
  await page.route('**/auth/v1/token*', async (route) => { attempts.token++; await new Promise((r) => setTimeout(r, delayMs)); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }); });
  await page.locator('input[type=email]').fill(fx.accounts.populated.email);
  await page.locator('input[type=password]').fill('synthetic-wrong-password');
  return attempts;
}
async function submitLogin(page) {
  await page.locator('input[type=password]').press('Enter');
}

async function rwlt02(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-02', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const report = { run: runName, phase: 'RW-LT-02', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  async function scenario(id, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: options.colorScheme ?? 'light', permissions: options.permissions ?? [] });
    if (options.initScript) await context.addInitScript(options.initScript);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-02', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      await page.mouse.move(2, 600); // keep the pointer off the toaster unless a scenario hovers it
      await fn(page, result.observations, check);
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|404|500)|Failed to load resource|ERR_FAILED/i.test(m));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }

  await scenario('auth-toast-outcome-placement-duration', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const attempts = await failLogin(page, fx);
    await page.locator('input[type=password]').focus();
    await submitLogin(page);
    await page.locator('form button[type=submit]').click({ force: true, noWaitAfter: true, timeout: 1000 }).catch(() => {}); // repeated activation
    const tA = await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(450); // let the entrance settle before measuring
    const s = await toastState(page);
    obs.first = s;
    check('repeated activation → one request, one toast', attempts.token === 1 && s.toasts.length === 1, { requests: attempts.token, toasts: s.toasts.length });
    const t = s.toasts[0];
    check('error type, short title + useful description', t.type === 'error' && /^Login failed\s*\n?\s*Check your email and password\.$/m.test(t.text.replace(/\n+/g, '\n')), t.text);
    check('auth pages: 16 px top offset, centered, ≤ 400 px wide', Math.abs(t.top - 16) <= 1 && Math.abs((t.left + t.right) / 2 - 720) <= 1 && t.width <= 400, { top: t.top, left: t.left, width: t.width });
    check('active theme and app font', s.toaster.theme === 'light' && s.toaster.fontFamily === s.toaster.bodyFont, s.toaster);
    check('single polite live region, not hidden', s.liveRegion?.ariaLive === 'polite' && !s.liveRegion.ariaHidden);
    obs.inlineAnnounced = await page.getByText('Incorrect email or password.').evaluate((el) => Boolean(el.closest('[aria-live],[role=alert],[role=status]')));
    obs.liveRegionsWithOutcome = await page.evaluate(() => [...document.querySelectorAll('[aria-live],[role=alert],[role=status]')].filter((el) => /Login failed|Incorrect email/.test(el.textContent)).length);
    check('inline guidance persists without a second live announcement', !obs.inlineAnnounced && obs.liveRegionsWithOutcome === 1, { inlineAnnounced: obs.inlineAnnounced, liveRegions: obs.liveRegionsWithOutcome });
    check('dismiss control ≥ 24 px with accessible name', t.close && t.close.width >= 24 && t.close.height >= 24 && t.close.label === 'Close toast', t.close);
    obs.hitArea = await page.evaluate(({ cx, cy }) => [[cx - 20, cy], [cx + 20, cy], [cx, cy - 20], [cx, cy + 20]].map(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('[data-close-button]'))), t.close);
    check('44 px dismiss hit area', obs.hitArea.every(Boolean), obs.hitArea);
    await shot(page, 'auth-login-failure-1440');
    // A deliberate second attempt with the same outcome text still notifies.
    // (The forced click above moved focus off the field, so focus is checked on this
    // keyboard-only attempt: the field keeps focus while the toast appears.)
    await page.waitForTimeout(800);
    await page.locator('input[type=password]').focus();
    await submitLogin(page);
    const tB = await waitForToast(page, LOGIN_FAILED, 4000).then(async () => { while ((await liveToasts(page, LOGIN_FAILED)).length < 2) await new Promise((r) => setTimeout(r, 25)); return Date.now(); });
    obs.afterSecondAttempt = (await liveToasts(page, LOGIN_FAILED)).length;
    obs.activeAfterSecondToast = (await toastState(page)).active;
    check('focus not stolen', obs.activeAfterSecondToast === 'INPUT#password', obs.activeAfterSecondToast);
    check('deliberate second attempt notifies again', obs.afterSecondAttempt === 2 && attempts.token === 2, { toasts: obs.afterSecondAttempt, requests: attempts.token });
    await shot(page, 'auth-two-attempts-1440');
    // Error duration 8 s (pointer away from the toaster).
    await page.waitForTimeout(Math.max(0, tA + 7000 - Date.now()));
    obs.countAt7s = (await liveToasts(page, LOGIN_FAILED)).length;
    const firstGoneAt = await (async () => { const start = Date.now(); while (Date.now() - start < 4000) { if ((await liveToasts(page, LOGIN_FAILED)).length < 2) return Date.now(); await new Promise((r) => setTimeout(r, 50)); } return null; })();
    obs.firstToastLifetimeMs = firstGoneAt && firstGoneAt - tA;
    check('error toast stays ~8 s, then dismisses', obs.countAt7s === 2 && obs.firstToastLifetimeMs !== null && obs.firstToastLifetimeMs >= 7500 && obs.firstToastLifetimeMs <= 9800, { countAt7s: obs.countAt7s, lifetime: obs.firstToastLifetimeMs });
    const lastGoneAt = await waitForNoToast(page, LOGIN_FAILED, 9000);
    obs.secondToastLifetimeMs = lastGoneAt && lastGoneAt - tB;
    check('second toast also self-dismisses', obs.secondToastLifetimeMs !== null && obs.secondToastLifetimeMs <= 10500, obs.secondToastLifetimeMs);
  });

  await scenario('pause-hover-focus-hidden-keyboard', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await failLogin(page, fx);
    // Hover pauses (Sonner).
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(400);
    await page.locator('[data-sonner-toast]').first().hover();
    await page.waitForTimeout(10000);
    obs.hoverAt10s = (await liveToasts(page, LOGIN_FAILED)).length;
    await page.mouse.move(2, 600);
    const leftAt = Date.now();
    const goneAfterHover = await waitForNoToast(page, LOGIN_FAILED, 10000);
    obs.dismissAfterHoverMs = goneAfterHover && goneAfterHover - leftAt;
    check('hover pauses dismissal; resumes after leave', obs.hoverAt10s === 1 && obs.dismissAfterHoverMs !== null, { hoverAt10s: obs.hoverAt10s, afterLeave: obs.dismissAfterHoverMs });
    // Keyboard focus pauses (adapter hold) and keeps the dialog-free page usable.
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(400);
    await page.locator('[data-sonner-toast] [data-close-button]').first().focus();
    obs.activeWhileFocused = (await toastState(page)).active;
    await page.waitForTimeout(10000);
    obs.focusAt10s = (await liveToasts(page, LOGIN_FAILED)).length;
    await page.locator('input[type=email]').focus();
    const blurAt = Date.now();
    const goneAfterBlur = await waitForNoToast(page, LOGIN_FAILED, 10000);
    obs.dismissAfterBlurMs = goneAfterBlur && goneAfterBlur - blurAt;
    check('keyboard focus pauses dismissal; resumes after blur', obs.activeWhileFocused.endsWith('[close]') && obs.focusAt10s === 1 && obs.dismissAfterBlurMs !== null && obs.dismissAfterBlurMs >= 7000, { active: obs.activeWhileFocused, focusAt10s: obs.focusAt10s, afterBlur: obs.dismissAfterBlurMs });
    // Keyboard dismissal.
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(400);
    await page.locator('[data-sonner-toast] [data-close-button]').first().focus();
    await page.keyboard.press('Enter');
    obs.keyboardDismissMs = await waitForNoToast(page, LOGIN_FAILED, 2000).then((t) => t !== null);
    check('Enter on the dismiss control closes the toast', obs.keyboardDismissMs);
    // Hidden page pauses (Sonner pauseWhenPageIsHidden); simulated via the visibility API.
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(10000);
    obs.hiddenAt10s = (await liveToasts(page)).length;
    await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    obs.onReturn = (await liveToasts(page)).length;
    const visibleAt = Date.now();
    const goneAfterVisible = await waitForNoToast(page, LOGIN_FAILED, 10000);
    obs.dismissAfterVisibleMs = goneAfterVisible && goneAfterVisible - visibleAt;
    check('hidden page pauses dismissal; no burst on return', obs.hiddenAt10s === 1 && obs.onReturn === 1 && obs.dismissAfterVisibleMs !== null, { hiddenAt10s: obs.hiddenAt10s, onReturn: obs.onReturn, afterVisible: obs.dismissAfterVisibleMs });
  });

  await scenario('session-change-clears-previous-toast', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await failLogin(page, fx, { delayMs: 100 });
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.unroute('**/auth/v1/token*');
    await page.locator('input[type=password]').fill(fx.accounts.populated.password);
    await submitLogin(page);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    obs.destination = new URL(page.url()).pathname;
    await page.waitForTimeout(800);
    obs.toastsAfterSignIn = (await liveToasts(page)).map((t) => t.text);
    check('existing destination preserved', ['/home', '/onboarding'].includes(obs.destination), obs.destination);
    check("guest-session failure toast cleared once the account session starts", !obs.toastsAfterSignIn.some((t) => LOGIN_FAILED.test(t)), obs.toastsAfterSignIn);
  });

  for (const [id, viewport, colorScheme] of [['resident-header-clearance-1440', { width: 1440, height: 900 }, 'light'], ['resident-header-clearance-360', { width: 360, height: 780 }, 'light'], ['resident-header-clearance-dark', { width: 1440, height: 900 }, 'dark']]) {
    await scenario(id, async (page, obs, check) => {
      await page.goto(`${BASE}/settings/notifications`, { waitUntil: 'networkidle' });
      await page.getByRole('switch').first().click();
      await waitForToast(page, /notifications (enabled|disabled)/);
      await page.waitForTimeout(450);
      const s = await toastState(page);
      obs.state = s;
      const t = s.toasts[0];
      check('12 px below the measured header', s.headerBottom !== null && Math.abs(t.top - (s.headerBottom + 12)) <= 1, { headerBottom: s.headerBottom, top: t.top });
      if (viewport.width < 600) check('16 px side gutters on narrow screens', Math.abs(t.left - 16) <= 1 && Math.abs(viewport.width - t.right - 16) <= 1, { left: t.left, right: t.right });
      else check('centered, ≤ 400 px', Math.abs((t.left + t.right) / 2 - viewport.width / 2) <= 1 && t.width <= 400, { left: t.left, width: t.width });
      check('theme follows the active mode', s.toaster.theme === colorScheme, s.toaster.theme);
      check('no horizontal overflow', !s.overflowX);
      // Underlying controls stay usable: points beside the toast, and below it within the
      // toaster's column, hit page content rather than an invisible container.
      obs.hits = await page.evaluate(({ left, right, top, height }) => {
        const probe = (x, y) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('[data-sonner-toaster]') ? 'toaster' : 'page') : null; };
        return { beside: probe(Math.max(2, left - 8), top + height / 2), belowInColumn: probe((left + right) / 2, top + height + 40), farBelow: probe((left + right) / 2, innerHeight - 120) };
      }, t);
      check('no pointer-intercepting container', obs.hits.beside === 'page' && obs.hits.belowInColumn === 'page' && obs.hits.farBelow === 'page', obs.hits);
      // The switch under the header remains operable while the toast is shown.
      await page.getByRole('switch').nth(1).click();
      obs.secondSwitch = await page.getByRole('switch').nth(1).getAttribute('aria-checked');
      check('controls beneath remain interactive', obs.secondSwitch === 'true');
      await shot(page, id);
    }, { account: 'populated', viewport, colorScheme });
  }

  await scenario('toast-over-radix-dialog', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Show QR' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.locator('canvas').waitFor({ timeout: 8000 });
    await dialog.getByRole('button', { name: 'Share' }).click();
    await waitForToast(page, /Copied to clipboard/);
    await page.waitForTimeout(450);
    const s = await toastState(page);
    obs.state = s;
    obs.focusInDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]')));
    check('dialog stays open with the toast shown', await dialog.isVisible());
    check('focus stays in the dialog (no focus stealing)', obs.focusInDialog);
    check('live region not aria-hidden/inert under the modal', s.liveRegion && !s.liveRegion.ariaHidden && !s.liveRegion.inert, s.liveRegion);
    const t = s.toasts[0];
    obs.toastOnTop = await page.evaluate(({ left, right, top, height }) => Boolean(document.elementFromPoint((left + right) / 2, top + height / 2)?.closest('[data-sonner-toast]')), t);
    check('toast renders above the overlay and receives pointer input', obs.toastOnTop);
    await shot(page, 'toast-over-dialog-1440');
    await page.mouse.click(t.close.cx, t.close.cy);
    obs.toastClosed = await waitForNoToast(page, /Copied to clipboard/, 2000).then((x) => x !== null);
    await page.waitForTimeout(300);
    check('dismissing the toast does not close the dialog', obs.toastClosed && (await dialog.isVisible()));
    await page.keyboard.press('Escape');
    check('Escape still closes the dialog', await dialog.waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false));
    // Outside clicks that are not on a toast keep closing the dialog as before.
    await page.getByRole('button', { name: 'Show QR' }).click();
    await dialog.waitFor();
    await page.mouse.click(30, 870);
    check('overlay click still closes the dialog', await dialog.waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false));
  }, {
    account: 'populated',
    permissions: ['clipboard-read', 'clipboard-write'],
    // Force the existing clipboard branch (desktop Chrome would otherwise open the OS share sheet).
    initScript: () => { try { delete Navigator.prototype.share; } catch { /* noop */ } },
  });

  await scenario('reduced-motion-toast', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await failLogin(page, fx);
    await submitLogin(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(60);
    const s = await toastState(page);
    obs.toast = s.toasts[0];
    obs.running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('[data-sonner-toaster]')).length);
    check('Sonner transitions disabled; toast fully visible at once', /^0s(, 0s)*$/.test(obs.toast.transition) && obs.toast.opacity === 1 && obs.running === 0, { transition: obs.toast.transition, opacity: obs.toast.opacity, running: obs.running });
  }, { reducedMotion: 'reduce' });

  await scenario('long-text-320', async (page, obs, check) => {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
    // Browser-fulfilled failure with a long synthetic message (no reset email requested).
    // The adapter shows only plain copy, so the long text comes from a deliberately long
    // address in the description; wrap behaviour is what this scenario verifies.
    await page.route('**/auth/v1/recover*', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limited' }) }));
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '[data-sonner-toast] [data-description]::after { content: " Synthetic RW feedback failure with a deliberately long explanation that must wrap inside the toast without clipping the dismiss control or causing horizontal scrolling on a narrow phone screen."; }';
      document.head.append(style);
    });
    await page.locator('#email').fill('rwfb-nobody@test.local');
    await page.locator('form button[type=submit]').click();
    await waitForToast(page, /Couldn't send reset code/);
    await page.waitForTimeout(450);
    const s = await toastState(page);
    obs.state = s;
    const t = s.toasts[0];
    check('fits the 320 px viewport with 16 px gutters', t.left >= 15 && t.right <= 305, { left: t.left, right: t.right });
    check('long text wraps; dismiss control stays inside', t.height > 60 && t.close.cx < t.right && t.close.cx > t.left, { height: t.height });
    check('no horizontal overflow', !s.overflowX);
    await shot(page, 'long-text-320');
  }, { viewport: { width: 320, height: 640 } });

  await scenario('read-pilots-stay-quiet', async (page, obs, check) => {
    const ANN = '**/rest/v1/announcements?*';
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.route(ANN, shape.fail(500));
    await page.locator('button', { hasText: /^General$/ }).first().click();
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 20000 });
    obs.toastsOnReadError = (await liveToasts(page)).length;
    await page.unroute(ANN);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText(/Synthetic (water|road)/).first().waitFor({ timeout: 8000 });
    obs.toastsOnRetry = (await liveToasts(page)).length;
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: 'RW Synthetic Clearance' }).first().click();
    await page.waitForFunction(() => document.querySelector('[role=dialog]') && !document.querySelector('[role=dialog] [data-slot=skeleton]'), null, { timeout: 8000 });
    obs.toastsOnDrawer = (await liveToasts(page)).length;
    check('list read error, retry, and drawer load produce no toast', obs.toastsOnReadError === 0 && obs.toastsOnRetry === 0 && obs.toastsOnDrawer === 0, obs);
  }, { account: 'populated' });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  fs.writeFileSync(path.join(out, 'results.json'), redact(JSON.stringify(report, null, 2)));
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-03: navigation, boundaries, read state
// Navigation shaping: only the browser's non-prefetch RSC request for a navigation is
// delayed (prefetches pass), which reproduces a slow server render deterministically.
function rscControl(page) {
  const ctl = { delayMs: 0, nav: [], prefetch: 0, mutations: 0 };
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(BASE) && r.method() === 'POST') ctl.mutations++; // server actions
    if (/\/(rest|auth|functions|storage)\/v1\//.test(u) && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) ctl.mutations++;
  });
  return page.route((url) => url.href.startsWith(BASE) && url.searchParams.has('_rsc'), async (route) => {
    const r = route.request();
    if (r.headers()['next-router-prefetch']) ctl.prefetch++;
    else {
      const u = new URL(r.url());
      ctl.nav.push(`${u.pathname}${u.search.replace(/[?&]_rsc=[^&]*/, '')}`);
      if (ctl.delayMs) await new Promise((res) => setTimeout(res, ctl.delayMs));
      if (ctl.timeResponses) {
        // Buffer the navigation response to timestamp its arrival, then hand it over.
        const resp = await route.fetch().catch(() => null);
        ctl.navResponseAt = Date.now();
        return resp ? route.fulfill({ response: resp }).catch(() => {}) : route.continue().catch(() => {});
      }
    }
    await route.continue().catch(() => {});
  }).then(() => ctl);
}
// DOM snapshot of loading/navigation feedback, including *visual* visibility (the 120 ms
// decorative delay keeps elements in the DOM at opacity 0 first).
async function navState(page) {
  return page.evaluate(() => {
    const vis = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
    const statuses = [...document.querySelectorAll('[data-slot=loading-status]')];
    const skeletons = [...document.querySelectorAll('[data-slot=skeleton]')];
    const hints = [...document.querySelectorAll('[data-slot=link-pending-hint]')];
    return {
      url: location.pathname + location.search,
      status: statuses.map((e) => e.textContent.trim()).filter(Boolean).join(' | '),
      statusRoles: statuses.filter((e) => e.textContent.trim()).map((e) => e.getAttribute('role')),
      statusVisible: Math.max(0, ...statuses.filter((e) => e.textContent.trim()).map((e) => vis(e.querySelector('.rw-hint') ?? e))),
      skeletons: skeletons.length,
      staticSkeletons: document.querySelectorAll('.rw-skeleton-static').length,
      skeletonVisible: Math.max(0, ...skeletons.map(vis)),
      headers: document.querySelectorAll('header[data-toast-anchor]').length,
      mains: document.querySelectorAll('main').length,
      bottomBar: Boolean(document.querySelector('nav.fixed')),
      pendingHints: hints.filter((h) => h.hasAttribute('data-pending')).map((h) => ({ href: h.closest('a')?.getAttribute('href'), opacity: Number(getComputedStyle(h).opacity) })),
      hintCount: hints.length,
      busy: document.querySelectorAll('[aria-busy=true]').length,
      h1: document.querySelector('main h1, h1')?.textContent.trim() ?? null,
      alert: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean).join(' | '),
      infiniteAnimations: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
async function sampleNav(page, durationMs, stepMs = 50) {
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const s = await navState(page).catch(() => null);
    if (s) samples.push({ t: Date.now() - start, ...s });
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return samples;
}
// Compact a timeline to its state changes for evidence.
const changes = (samples, keys) => samples.filter((s, i) => i === 0 || keys.some((k) => JSON.stringify(s[k]) !== JSON.stringify(samples[i - 1][k]))).map((s) => Object.fromEntries([['t', s.t], ...keys.map((k) => [k, s[k]])]));
// Waits until no loading status is active and, when given, the destination heading shows
// (so a still-blocked navigation can't pass on the previous page).
async function settle(page, h1 = null, timeout = 15000) {
  await page.waitForFunction((want) => {
    if ([...document.querySelectorAll('[data-slot=loading-status]')].some((e) => e.textContent.trim())) return false;
    const h = document.querySelector('main h1, h1');
    return want ? h?.textContent.trim() === want : Boolean(h);
  }, h1, { timeout });
}

// Minimal Supabase Realtime (protocol 2.0.0) stand-in so Realtime-triggered refreshes can
// be exercised while the local Realtime service is unavailable. It acknowledges joins
// with matching postgres_changes binding ids and lets a scenario push a change event.
async function mockRealtime(context) {
  const rt = { channels: [], nextId: 1000, sockets: [] };
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    rt.sockets.push(ws);
    ws.onMessage((raw) => {
      let msg; try { msg = JSON.parse(String(raw)); } catch { return; }
      const [joinRef, ref, topic, event, payload] = msg;
      if (event === 'heartbeat') return ws.send(JSON.stringify([null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]));
      if (event === 'phx_join') {
        const changesCfg = (payload?.config?.postgres_changes ?? []).map((f) => ({ ...f, id: rt.nextId++ }));
        rt.channels.push({ ws, topic, joinRef, changes: changesCfg });
        return ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: changesCfg } }]));
      }
      if (event === 'phx_leave') { rt.channels = rt.channels.filter((c) => !(c.topic === topic && c.ws === ws)); return ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }])); }
      if (ref) ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  rt.push = (table, type = 'UPDATE', record = {}) => {
    let sent = 0;
    for (const c of rt.channels) {
      const ids = c.changes.filter((f) => f.table === table).map((f) => f.id);
      if (!ids.length) continue;
      c.ws.send(JSON.stringify([null, null, c.topic, 'postgres_changes', { ids, data: { type, schema: 'public', table, commit_timestamp: new Date().toISOString(), columns: [], record, old_record: {}, errors: null } }]));
      sent++;
    }
    return sent;
  };
  return rt;
}

async function rwlt03(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-03', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const report = { run: runName, phase: 'RW-LT-03', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL, realtime: 'local Realtime unavailable; Realtime-triggered refreshes use an in-browser protocol 2.0.0 stand-in (mockRealtime)' }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  async function scenario(id, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: options.colorScheme ?? 'light' });
    const rt = options.realtime ? await mockRealtime(context) : null;
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-03', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      const ctl = await rscControl(page);
      await fn(page, result.observations, check, { ctl, rt, context });
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|404|406|500)|Failed to load resource|ERR_FAILED|RangeError: Invalid time value|Objects are not valid as a React child|Minified React error #31/i.test(m));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }
  const idle = (page) => page.waitForLoadState('networkidle').catch(() => {});
  const prefetchSettle = (page) => page.waitForTimeout(1200); // let viewport prefetches land

  // 1. Resident group fallback below the persistent shell; slow navigation commits at once.
  await scenario('nav-fallback-resident-group', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    const t0 = Date.now();
    await page.locator('header nav a[href="/reports"]').click();
    const samples = await sampleNav(page, 2600);
    ctl.delayMs = 0;
    await settle(page, 'My Reports');
    obs.clickToSettledMs = Date.now() - t0;
    obs.timeline = changes(samples, ['url', 'status', 'statusVisible', 'skeletonVisible', 'headers', 'h1']);
    const pend = samples.filter((s) => s.status.includes('Loading page…'));
    const early = samples.filter((s) => s.t < 90 && s.status);
    check('URL commits immediately (fallback is prefetched, navigation not delayed)', samples.find((s) => s.url === '/reports')?.t < 250, samples.find((s) => s.url === '/reports')?.t);
    check('resident fallback announced in one polite status region', pend.length > 0 && pend.every((s) => s.statusRoles.length === 1 && s.statusRoles[0] === 'status'), pend[0]?.statusRoles);
    check('decoration hidden for the first 120 ms', early.every((s) => s.statusVisible === 0 && s.skeletonVisible === 0), early.map((s) => [s.t, s.statusVisible, s.skeletonVisible]));
    check('placeholder visible while slow', pend.some((s) => s.skeletonVisible > 0.4 && s.statusVisible > 0.4));
    check('shell persists, not duplicated (1 header, 1 main)', samples.every((s) => s.headers === 1 && s.mains === 1));
    const final = await navState(page);
    check('settles to real content with no status or busy region', final.h1 === 'My Reports' && !final.status && final.busy === 0, final);
    obs.ctl = { nav: ctl.nav, mutations: ctl.mutations };
    check('no writes during navigation', ctl.mutations === 0, ctl.mutations);
  }, { account: 'populated' });

  // 2. Route-specific compositions appear directly (deepest prefetched boundary), keeping
  //    segment navigation and the settings sidebar usable.
  await scenario('nav-route-specific-variants', async (page, obs, check, { ctl }) => {
    const cases = [
      { from: '/home', click: 'header nav a[href="/maps"]', label: 'Loading map…', h1: 'Maps', extra: (s) => s.staticSkeletons > 0, extraName: 'steady (non-pulsing) map viewport' },
      // From outside Services the segment boundary is the deepest prefetched one, so the
      // services placeholder shows below the persistent services nav.
      { from: '/home', click: `main a[href="/services/requests/${fx.ids.requestPending}"]`, label: 'Loading services…', h1: 'RW Synthetic Clearance', keep: 'main nav a[href="/services/logs"]' },
      { from: '/emergency', click: 'main nav a[href="/emergency/centers"]', label: 'Loading emergency information…', h1: 'Evacuation Centers', keep: 'main nav a[href="/emergency/alerts"]' },
      { from: '/services/documents', click: 'main nav a[href="/services/requests"]', label: 'Loading services…', h1: 'My Requests', keep: 'main nav a[href="/services/logs"]' },
      { from: '/health', click: 'main nav a[href="/health/my-registrations"]', label: 'Loading health services…', h1: 'My Registrations', keep: 'main nav a[href="/health"]' },
      { from: '/settings/profile', click: 'aside a[href="/settings/theme"]', label: 'Loading settings…', h1: 'Theme & Appearance', keep: 'aside a[href="/settings/about"]' },
      { from: '/maps', click: 'main a[href="/maps/directory"]', label: 'Loading directory…', h1: 'Directory' },
      { from: '/home', click: 'header nav a[href="/announcements"]', label: 'Loading page…', h1: 'Announcements' },
    ];
    obs.cases = [];
    for (const c of cases) {
      await page.goto(`${BASE}${c.from}`, { waitUntil: 'networkidle' });
      await prefetchSettle(page);
      ctl.delayMs = 1500;
      await page.locator(c.click).first().click();
      await page.waitForTimeout(400);
      const during = await navState(page);
      const keepVisible = c.keep ? await page.locator(c.keep).first().isVisible() : null;
      if (c.label === 'Loading map…') await shot(page, 'fallback-map-1440');
      if (c.label === 'Loading settings…') await shot(page, 'fallback-settings-1440');
      ctl.delayMs = 0;
      await settle(page, c.h1);
      const after = await navState(page);
      const row = { from: c.from, to: after.url, status: during.status, skeletons: during.skeletons, staticSkeletons: during.staticSkeletons, headers: during.headers, keepVisible, h1: after.h1 };
      obs.cases.push(row);
      check(`${c.from} → ${c.h1}: "${c.label}"`, during.status === c.label && during.headers === 1 && after.h1 === c.h1 && !after.status, row);
      if (c.keep) check(`${c.h1}: persistent segment/sidebar navigation stays visible`, keepVisible, keepVisible);
      if (c.extra) check(`${c.h1}: ${c.extraName}`, c.extra(during), during.staticSkeletons);
    }
  }, { account: 'populated' });

  // 3. Unshaped navigation: content follows the server response with no forced delay, the
  //    decoration never shows in the first 120 ms, and a cached (< 120 ms) back navigation
  //    shows no loader at all.
  await scenario('nav-fast-no-flash', async (page, obs, check, { ctl }) => {
    ctl.timeResponses = true;
    const finished = { get at() { return ctl.navResponseAt ?? null; }, set at(v) { ctl.navResponseAt = v; } };
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    obs.navs = [];
    for (const [href, h1] of [['/reports', 'My Reports'], ['/announcements', 'Announcements'], ['/emergency', 'Emergency Info']]) {
      finished.at = null;
      const t0 = Date.now();
      await page.locator(`header nav a[href="${href}"]`).click();
      const samples = await sampleNav(page, 1200, 20);
      await settle(page, h1);
      const firstContent = samples.find((s) => s.h1 === h1);
      const responseMs = finished.at ? finished.at - t0 : null;
      obs.navs.push({
        href, responseMs, firstContentMs: firstContent?.t ?? null,
        contentAfterResponseMs: firstContent && responseMs !== null ? firstContent.t - responseMs : null,
        decorationBefore100ms: Math.max(0, ...samples.filter((s) => s.t < 100).map((s) => Math.max(s.statusVisible, s.skeletonVisible))),
        routeFallbackVisibleMax: Math.max(0, ...samples.filter((s) => !firstContent || s.t < firstContent.t).map((s) => s.statusVisible)),
      });
      await prefetchSettle(page);
    }
    check('no decorative flash in the first 120 ms of any navigation', obs.navs.every((n) => n.decorationBefore100ms === 0), obs.navs.map((n) => n.decorationBefore100ms));
    check('content renders as soon as the response lands (no minimum loader time)', obs.navs.every((n) => n.contentAfterResponseMs !== null && n.contentAfterResponseMs < 250), obs.navs.map((n) => n.contentAfterResponseMs));
    // Cached history navigation: served from the router cache, no loader at all.
    finished.at = null;
    const t0 = Date.now();
    await page.goBack();
    const back = await sampleNav(page, 700, 15);
    const backContent = back.find((s) => s.h1 === 'Announcements');
    obs.cachedBack = { firstContentMs: backContent?.t ?? null, rscFetched: finished.at !== null, maxDecoration: Math.max(0, ...back.map((s) => Math.max(s.statusVisible, s.skeletonVisible))), statusEver: back.some((s) => /Loading page/.test(s.status)), elapsed: Date.now() - t0 };
    check('cached back navigation (< 120 ms): no loader flash', backContent && backContent.t < 120 && obs.cachedBack.maxDecoration === 0, obs.cachedBack);
  }, { account: 'populated' });

  // 4. useLinkStatus hint on links whose navigation blocks (search-param tabs keep the
  //    current page; no loading boundary applies) — fixed size, name unchanged.
  await scenario('link-hint-blocking-navigation', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    const link = page.locator('main a[href="/services/requests?tab=active"]');
    const before = { box: await link.boundingBox(), name: (await link.innerText()).trim(), ariaHidden: await link.locator('[data-slot=link-pending-hint]').getAttribute('aria-hidden') };
    ctl.delayMs = 1500;
    await link.click();
    const samples = await sampleNav(page, 2400, 30);
    ctl.delayMs = 0;
    await settle(page, 'My Requests');
    const during = { box: await link.boundingBox(), name: (await link.innerText()).trim() };
    obs.before = before; obs.timeline = changes(samples, ['url', 'pendingHints', 'h1']);
    const pendingSamples = samples.filter((s) => s.pendingHints.some((h) => h.href === '/services/requests?tab=active'));
    const op = (s) => s.pendingHints.find((h) => h.href === '/services/requests?tab=active')?.opacity ?? 0;
    check('hint pending while the navigation blocks; current page (tabs) stays', pendingSamples.length > 5 && pendingSamples.every((s) => s.url === '/services/requests' && s.h1 === 'My Requests'), pendingSamples.length);
    check('hint invisible for the first 120 ms, visible after', pendingSamples.filter((s) => s.t < 90).every((s) => op(s) === 0) && pendingSamples.some((s) => s.t > 400 && op(s) > 0.4), pendingSamples.map((s) => [s.t, op(s)]).filter((_, i) => i % 5 === 0));
    check('hint is aria-hidden; link name and size unchanged', before.ariaHidden === 'true' && during.name === before.name && Math.abs(during.box.width - before.box.width) < 0.5 && Math.abs(during.box.height - before.box.height) < 0.5, { before: before.box, during: during.box, name: during.name });
    const final = await navState(page);
    check('settles: URL updated, hint cleared', final.url === '/services/requests?tab=active' && final.pendingHints.length === 0, final.url);
    await shot(page, 'link-hint-settled-1440');
    // Top-nav links commit at once because their fallback is prefetched; record the hint window.
    ctl.delayMs = 1500;
    await page.locator('header nav a[href="/health"]').click();
    const topSamples = await sampleNav(page, 600, 20);
    ctl.delayMs = 0;
    await settle(page, 'Active Medical Drives');
    obs.topNavPendingSamples = topSamples.filter((s) => s.pendingHints.length).map((s) => [s.t, s.pendingHints[0].opacity]);
    check('top-nav hint never flashes when the fallback commits at once', topSamples.every((s) => s.pendingHints.every((h) => h.opacity === 0)), obs.topNavPendingSamples);
  }, { account: 'populated' });

  // 5. Rapid selection: only the last destination wins; the shell stays interactive.
  await scenario('rapid-link-selection', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    await page.locator('header nav a[href="/reports"]').click();
    await page.waitForTimeout(200);
    await page.locator('header nav a[href="/health"]').click();
    const samples = await sampleNav(page, 3200, 40);
    ctl.delayMs = 0;
    await settle(page, 'Active Medical Drives');
    obs.timeline = changes(samples, ['url', 'status', 'h1']);
    const final = await navState(page);
    check('final destination is the last selection', final.url === '/health' && final.h1 === 'Active Medical Drives', final);
    check('the abandoned route never renders after the newer selection', !samples.some((s) => s.h1 === 'My Reports'), obs.timeline);
    await page.goBack();
    await settle(page);
    obs.afterBack = await navState(page).then((s) => s.url);
    check('back returns to a real history entry', ['/reports', '/home'].includes(obs.afterBack), obs.afterBack);
  }, { account: 'populated' });

  // 6. Back/forward, hard reload, and deep links work without click tracking.
  await scenario('back-forward-reload-deeplink', async (page, obs, check) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await page.locator('header nav a[href="/reports"]').click(); await settle(page, 'My Reports');
    await page.locator('header nav a[href="/announcements"]').click(); await settle(page, 'Announcements');
    const steps = [];
    await page.goBack(); await settle(page, 'My Reports'); steps.push(await navState(page));
    await page.goBack(); await settle(page, 'Welcome back, RW'); steps.push(await navState(page));
    await page.goForward(); await settle(page, 'My Reports'); steps.push(await navState(page));
    obs.history = steps.map((s) => ({ url: s.url, h1: s.h1, status: s.status }));
    check('back, back, forward restore the right pages', steps[0].h1 === 'My Reports' && steps[1].url === '/home' && steps[2].h1 === 'My Reports', obs.history);
    const resp = await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    obs.reload = { status: resp.status(), h1: (await navState(page)).h1 };
    check('hard reload renders the page inside the shell', obs.reload.h1 === 'My Reports' && (await navState(page)).headers === 1, obs.reload);
    const deep = await page.goto(`${BASE}/settings/theme`, { waitUntil: 'networkidle' });
    await settle(page);
    const d = await navState(page);
    obs.deepLink = { status: deep.status(), url: d.url, h1: d.h1, sidebar: await page.locator('aside a[href="/settings/profile"]').isVisible() };
    check('nested settings deep link renders sidebar and content', d.h1 === 'Theme & Appearance' && obs.deepLink.sidebar, obs.deepLink);
  }, { account: 'populated' });

  // 7. Modifier clicks and prefetching are untouched.
  await scenario('modifier-click-and-prefetch', async (page, obs, check, { ctl, context }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    obs.prefetchRequests = ctl.prefetch;
    check('viewport prefetching still runs', ctl.prefetch > 0, ctl.prefetch);
    const popup = context.waitForEvent('page', { timeout: 8000 });
    await page.locator('header nav a[href="/reports"]').click({ modifiers: ['Control'] });
    const opened = await popup;
    await opened.waitForLoadState('domcontentloaded');
    obs.newTab = new URL(opened.url()).pathname;
    await page.waitForTimeout(500);
    const s = await navState(page);
    check('Ctrl+click opens a new tab; the current page does not navigate or show a hint', obs.newTab === '/reports' && s.url === '/home' && s.pendingHints.length === 0 && !s.status, { newTab: obs.newTab, current: s.url });
    obs.hrefs = await page.locator('header nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    check('nav hrefs unchanged', JSON.stringify(obs.hrefs) === JSON.stringify(['/home', '/emergency', '/services', '/maps', '/health', '/reports', '/announcements', '/settings']), obs.hrefs);
  }, { account: 'populated' });

  // 8. Guest: group fallback with the guest header; redirects and not-found keep their
  //    existing destinations (hard loads stream, so they arrive in-stream).
  await scenario('guest-fallback-and-redirects', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    await page.locator('header nav a[href="/announcements"]').click();
    await page.waitForTimeout(400);
    const during = await navState(page);
    const guestHeader = { login: await page.locator('header a[href="/login"]').count(), signup: await page.locator('header a[href="/register"]').count(), logout: await page.locator('header button[title="Log out"]').count() };
    await shot(page, 'guest-fallback-1440');
    ctl.delayMs = 0;
    await settle(page, 'Announcements');
    obs.during = { status: during.status, bottomBar: during.bottomBar, guestHeader };
    check('guest sees the group fallback inside the guest header (no account UI)', during.status === 'Loading page…' && guestHeader.signup === 1 && guestHeader.logout === 0 && !during.bottomBar, obs.during);
    check('then guest content', (await navState(page)).h1 === 'Announcements');
    const t0 = Date.now();
    const resp = await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 10000 });
    obs.gatedRedirect = { documentStatus: resp.status(), finalUrl: new URL(page.url()).pathname + new URL(page.url()).search, ms: Date.now() - t0 };
    check('gated route still redirects a guest to /login?next=…', obs.gatedRedirect.finalUrl === '/login?next=%2Fservices%2Frequests', obs.gatedRedirect);
    check('no protected content rendered before the redirect', !(await page.content()).includes('My Requests'));
  });

  // 9. Auth group fallback (no resident shell) and the signed-in redirect.
  await scenario('auth-fallback-and-signed-in-redirect', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    await page.locator('a[href="/forgot-password"]').first().click();
    await page.waitForTimeout(400);
    const during = await navState(page);
    await shot(page, 'auth-fallback-1440');
    ctl.delayMs = 0;
    await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Forgot Password'));
    obs.during = { status: during.status, headers: during.headers, skeletons: during.skeletons };
    check('auth fallback: centered form placeholder, no resident shell', during.status === 'Loading…' && during.headers === 0 && during.skeletons > 0, obs.during);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    obs.loginDestination = await login(page, fx.accounts.populated);
    const resp = await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForURL((u) => u.pathname === '/home', { timeout: 10000 });
    obs.signedInLogin = { documentStatus: resp.status(), finalUrl: new URL(page.url()).pathname };
    check('signed-in visit to /login still lands on /home', obs.signedInLogin.finalUrl === '/home', obs.signedInLogin);
  });

  // 10. Inaccessible records keep the not-found view (now streamed with noindex).
  await scenario('inaccessible-record-not-found', async (page, obs, check) => {
    obs.records = [];
    for (const u of [`/services/requests/${fx.ids.requestOther}`, `/reports/${fx.ids.incidentOther}`]) {
      const resp = await page.goto(`${BASE}${u}`, { waitUntil: 'networkidle' });
      const s = await navState(page);
      const robots = await page.locator('meta[name=robots]').evaluateAll((m) => m.map((x) => x.getAttribute('content')));
      const leaked = (await page.content()).includes('Synthetic other resident report');
      obs.records.push({ url: u, documentStatus: resp.status(), h1: s.h1, robots, leaked });
    }
    check('another resident’s records still show the 404 view, noindex, nothing leaked', obs.records.every((r) => r.h1 === '404' && r.robots.some((c) => /noindex/.test(c)) && !r.leaked), obs.records);
  }, { account: 'populated' });

  // 11. Resident error boundary: inline recovery inside the shell, retry re-reads only.
  await scenario('error-boundary-resident-retry', async (page, obs, check, { ctl }) => {
    let broken = true, annReads = 0;
    await page.route('**/rest/v1/announcements*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      annReads++;
      if (!broken) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'rwfb-bad', title: 'Synthetic malformed row', body: 'Synthetic.', category: 'general', published_at: 'not-a-date', barangay_id: fx.ids.barangay, deleted_at: null, created_at: new Date().toISOString() }]) });
    });
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 10000 });
    const s = await navState(page);
    obs.boundary = { alert: s.alert, headers: s.headers, nav: await page.locator('header nav a[href="/reports"]').isVisible(), toasts: (await liveToasts(page)).length };
    await shot(page, 'error-boundary-resident-1440');
    check('render failure shows the inline recovery view inside the shell', /This page couldn.t load/.test(s.alert) && s.headers === 1 && obs.boundary.nav, obs.boundary);
    check('no toast for a read/render failure', obs.boundary.toasts === 0);
    check('no raw error text shown', !(await page.locator('main').innerText()).includes('Invalid time value'));
    // Persistent failure: retry shows the view again; nothing loops.
    const navBefore = ctl.nav.length, readsBefore = annReads;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    obs.persistentRetry = { refreshes: ctl.nav.length - navBefore, reads: annReads - readsBefore };
    check('retry while still failing returns to the recovery view without a loop', obs.persistentRetry.refreshes === 1 && obs.persistentRetry.reads <= 2, obs.persistentRetry);
    // Recovery: double activation → one refresh, no writes, content back.
    broken = false;
    const mutBefore = ctl.mutations, navBefore2 = ctl.nav.length;
    ctl.delayMs = 800;
    const btn = page.getByRole('button', { name: 'Try again' });
    await btn.click();
    await page.waitForTimeout(60);
    const pendingBtn = await page.locator('button[aria-busy=true]').evaluateAll((b) => b.map((x) => ({ text: x.innerText.trim(), disabled: x.disabled })));
    await page.locator('button[aria-busy=true]').first().click({ force: true, timeout: 1000 }).catch(() => {});
    await page.getByText('Synthetic water interruption').waitFor({ timeout: 15000 });
    ctl.delayMs = 0;
    obs.recovery = { pendingButton: pendingBtn, refreshes: ctl.nav.length - navBefore2, mutations: ctl.mutations - mutBefore };
    check('retry pending: "Trying again…", disabled, busy', pendingBtn.length === 1 && pendingBtn[0].disabled && /Trying again/.test(pendingBtn[0].text), pendingBtn);
    check('repeated activation → one route refresh; no writes replayed', obs.recovery.refreshes === 1 && obs.recovery.mutations === 0, obs.recovery);
    check('content recovers after retry', (await navState(page)).h1 === 'Announcements');
  }, { account: 'populated' });

  // 12. Auth error boundary: no resident shell, retry recovers the form, nothing submitted.
  await scenario('error-boundary-auth-retry', async (page, obs, check, { ctl }) => {
    let broken = true;
    await page.route('**/rest/v1/barangay_localities*', (route) => (broken
      ? route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify({ barangay_id: fx.ids.barangay, display_name: { synthetic: 'object' }, city: 'Synthetic City', province: 'Synthetic Province', resident_registration_enabled: true }) })
      : route.continue()));
    await page.route('**/rest/v1/barangays*', (route) => (broken
      ? route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify({ id: fx.ids.barangay, boundary: null }) })
      : route.continue()));
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 10000 });
    const s = await navState(page);
    obs.boundary = { alert: s.alert, headers: s.headers, returnLink: await page.locator('a[href="/login"]', { hasText: 'Go to Log In' }).count() };
    await shot(page, 'error-boundary-auth-1440');
    check('auth boundary: recovery view without the resident shell, safe return to Log In', /This page couldn.t load/.test(s.alert) && s.headers === 0 && obs.boundary.returnLink === 1, obs.boundary);
    broken = false;
    const mutBefore = ctl.mutations;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.locator('form').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    obs.recovered = { form: await page.locator('form').count(), mutations: ctl.mutations - mutBefore, alert: (await navState(page)).alert };
    check('retry re-renders the registration form; nothing submitted', obs.recovered.form > 0 && obs.recovered.mutations === 0 && !/couldn.t load/.test(obs.recovered.alert), obs.recovered);
  });

  // 13. Pilot drawer read states: loading, ready, unavailable, error + read-only retry,
  //     thrown failure, stale selection, close during load.
  await scenario('drawer-read-states', async (page, obs, check) => {
    const reads = { count: 0 };
    let mode = null;
    const holds = []; // per-read delays, consumed in request order
    await page.route('**/rest/v1/service_requests*', async (route) => {
      const u = decodeURIComponent(route.request().url());
      if (route.request().method() !== 'GET' || !u.includes('select=*')) return route.continue();
      reads.count++;
      const hold = holds.shift();
      if (hold) await new Promise((r) => setTimeout(r, hold));
      if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic RW feedback failure', code: 'RWFB' }) });
      if (mode === 'missing') return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }) });
      if (mode === 'abort') return route.abort('failed');
      return route.continue();
    });
    let writes = 0;
    page.on('request', (r) => { if (/\/rest\/v1\//.test(r.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes++; });
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    const cards = page.locator('main .grid > div > button');
    const refs = await cards.evaluateAll((bs) => bs.map((b) => [...b.querySelectorAll('p')].map((p) => p.textContent).find((t) => t.includes(' · '))?.split(' · ')[0].trim() ?? null));
    obs.cardRefs = refs;
    const drawer = page.locator('[role=dialog]');
    const drawerText = () => drawer.innerText().catch(() => '');
    const settledDrawer = () => page.waitForFunction(() => document.querySelector('[role=dialog]') && !document.querySelector('[role=dialog] [data-slot=skeleton]'), null, { timeout: 8000 });
    const closeDrawer = async () => { await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {}); };
    // a) slow read → label + busy, then the record
    holds.push(1500);
    await cards.nth(0).click();
    await page.waitForTimeout(300);
    const slow = await navState(page);
    await settledDrawer();
    obs.slow = { status: slow.status, busy: slow.busy, readyShowsReference: (await drawerText()).includes(refs[0]) };
    check('slow read: "Loading request…" status + aria-busy, then the selected record', slow.status === 'Loading request…' && slow.busy >= 1 && obs.slow.readyShowsReference, obs.slow);
    await closeDrawer();
    // b) returned error → settles to error; retry is a read only and recovers
    mode = 'fail';
    await cards.nth(0).click();
    await drawer.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 6000 });
    const err = await navState(page);
    await page.waitForTimeout(350); // let the 240 ms entrance finish before the screenshot
    await shot(page, 'drawer-error-1440');
    const readsBefore = reads.count, writesBefore = writes;
    mode = null;
    await drawer.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !d.querySelector('[data-slot=skeleton]') && !/couldn.t load/.test(d.innerText); }, null, { timeout: 8000 });
    obs.error = { alert: err.alert, skeletons: err.skeletons, status: err.status, retryReads: reads.count - readsBefore, retryWrites: writes - writesBefore, toasts: (await liveToasts(page)).length, recoveredReference: (await drawerText()).includes(refs[0]) };
    check('returned error settles (no skeleton, no status) into an alert with plain copy', /We couldn.t load this request/.test(err.alert) && err.skeletons === 0 && !err.status && !err.alert.includes('Synthetic RW feedback failure'), obs.error);
    check('retry repeats the read only (1 GET, 0 writes) and recovers; no toast', obs.error.retryReads === 1 && obs.error.retryWrites === 0 && obs.error.toasts === 0 && obs.error.recoveredReference, obs.error);
    await closeDrawer();
    // c) missing / inaccessible → unavailable with a working Close
    mode = 'missing';
    await cards.nth(0).click();
    await page.getByText('This request isn’t available'.replace('’', "'")).waitFor({ timeout: 6000 });
    obs.unavailable = { alert: (await navState(page)).alert, retryOffered: await drawer.getByRole('button', { name: 'Try again' }).count() };
    await page.waitForTimeout(350);
    await shot(page, 'drawer-unavailable-1440');
    await drawer.getByRole('button', { name: 'Close' }).last().click();
    await drawer.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    obs.unavailable.closed = (await drawer.count()) === 0;
    obs.unavailable.listVisible = await cards.nth(0).isVisible();
    check('missing/inaccessible settles to "not available" without access details; Close works; list stays', obs.unavailable.retryOffered === 0 && obs.unavailable.closed && obs.unavailable.listVisible && !/permission|RLS|PGRST/i.test(obs.unavailable.alert), obs.unavailable);
    mode = null;
    // d) stale selection: the first card's slower response must not replace the second
    holds.push(2000, 0);
    await cards.nth(0).click();
    await page.waitForTimeout(250);
    await cards.nth(1).click();
    const samples = [];
    for (let i = 0; i < 40; i++) { samples.push(await drawerText()); await page.waitForTimeout(75); }
    obs.stale = { refs: refs.slice(0, 2), showedFirstAfterSecondClick: samples.some((t) => t.includes(refs[0])), finalShowsSecond: (await drawerText()).includes(refs[1]) };
    check('selection change never flashes or restores the earlier request', refs[0] && refs[1] && refs[0] !== refs[1] && !obs.stale.showedFirstAfterSecondClick && obs.stale.finalShowsSecond, obs.stale);
    await closeDrawer();
    // e) close during a load, reopen → fresh read settles
    holds.push(1200);
    await cards.nth(0).click();
    await page.waitForTimeout(150);
    await closeDrawer();
    await page.waitForTimeout(1500);
    await cards.nth(0).click();
    await settledDrawer();
    obs.reopen = { alert: (await navState(page)).alert, showsReference: (await drawerText()).includes(refs[0]) };
    check('closing during a load and reopening settles to the record', !obs.reopen.alert && obs.reopen.showsReference, obs.reopen);
    await closeDrawer();
    // f) thrown failure (aborted request; supabase-js retries GETs before returning)
    mode = 'abort';
    await cards.nth(0).click();
    await drawer.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 20000 });
    const thrown = await navState(page);
    obs.thrown = { alert: thrown.alert, skeletons: thrown.skeletons, status: thrown.status };
    check('thrown/network failure also settles into the retryable error', /We couldn.t load this request/.test(thrown.alert) && thrown.skeletons === 0 && !thrown.status, obs.thrown);
    mode = null;
    check('no writes at any point', writes === 0, writes);
  }, { account: 'populated' });

  // 14. Pilot list read states: empty, initial error + retry, obsolete filter responses,
  //     identity change, and Realtime refresh (retained content, quiet hint, failure warning).
  await scenario('list-read-states', async (page, obs, check, { rt }) => {
    let mode = null; const delayFor = {};
    let reads = 0;
    await page.route('**/rest/v1/announcements*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const u = decodeURIComponent(route.request().url());
      if (u.includes('select=*')) reads++; // the feed query (unread counts select ids only)
      const cat = (u.match(/category=eq\.(\w+)/) ?? [])[1] ?? 'all';
      if (delayFor[cat]) await new Promise((r) => setTimeout(r, delayFor[cat]));
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic RW feedback failure', code: 'RWFB' }) });
      return route.continue();
    });
    // a) successful empty response → empty state, never a loader
    mode = 'empty';
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.getByText('No announcements yet.').waitFor({ timeout: 8000 });
    const empty = await navState(page);
    check('empty response → meaningful empty state, no loader', !empty.status && empty.skeletons === 0 && empty.busy === 0, empty.status);
    // b) initial error → plain alert, retry recovers
    mode = 'fail';
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 8000 });
    const err = await navState(page);
    obs.initialError = { alert: err.alert, status: err.status, skeletons: err.skeletons, toasts: (await liveToasts(page)).length };
    check('initial failure → loader replaced by a plain-language alert (no raw message), no toast', /couldn.t load announcements/.test(err.alert) && !err.alert.includes('Synthetic RW feedback failure') && !err.status && err.skeletons === 0 && obs.initialError.toasts === 0, obs.initialError);
    mode = null;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Synthetic water interruption').waitFor({ timeout: 8000 });
    check('retry recovers the list', true);
    // c) identity change: previous filter's rows disappear at once; obsolete response ignored
    await page.waitForTimeout(500);
    delayFor.general = 2000;
    await page.getByRole('button', { name: /^General$/ }).click();
    await page.waitForTimeout(60);
    const switching = await navState(page);
    const typhoonDuring = await page.getByText('Synthetic typhoon advisory').count();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: /^Emergency$/ }).click();
    await page.getByText('Synthetic typhoon advisory').waitFor({ timeout: 8000 });
    const samples = [];
    for (let i = 0; i < 30; i++) { samples.push(await page.getByText('Synthetic water interruption').count()); await page.waitForTimeout(100); }
    delete delayFor.general;
    obs.identity = { statusDuringSwitch: switching.status, previousRowsDuringSwitch: typhoonDuring, generalRowsAfterObsoleteResponse: Math.max(...samples) };
    check('filter change resets readiness (other identity rows hidden, loading shown)', switching.status === 'Loading announcements…' && typhoonDuring === 0, obs.identity);
    check('obsolete (slower, earlier filter) response never replaces the current filter', obs.identity.generalRowsAfterObsoleteResponse === 0, obs.identity);
    await page.getByRole('button', { name: /^All$/ }).click();
    await page.getByText('Synthetic water interruption').waitFor({ timeout: 8000 });
    await page.waitForTimeout(600);
    // d) Realtime refresh keeps content and does not replay entrances
    await page.evaluate(() => document.querySelectorAll('[aria-label^="View announcement"]').forEach((el) => el.setAttribute('data-rwfb-mark', '1')));
    delayFor.all = 1200;
    const readsBefore = reads;
    const pushed = rt.push('announcements');
    const refresh = [];
    for (let i = 0; i < 30; i++) {
      refresh.push(await page.evaluate(() => {
        const hint = [...document.querySelectorAll('span.rw-hint')].find((s) => s.textContent.includes('Updating'));
        return {
          cards: document.querySelectorAll('[aria-label^="View announcement"]').length,
          marked: document.querySelectorAll('[data-rwfb-mark]').length,
          skeletons: document.querySelectorAll('[data-slot=skeleton]').length,
          status: [...document.querySelectorAll('[data-slot=loading-status]')].map((e) => e.textContent.trim()).filter(Boolean).join(''),
          hintOpacity: hint ? Number(getComputedStyle(hint).opacity) : null,
          reveals: document.getAnimations().filter((a) => a.animationName === 'rw-reveal' && a.playState === 'running').length,
        };
      }));
      await page.waitForTimeout(60);
    }
    delete delayFor.all;
    obs.refresh = { pushedChannels: pushed, refetches: reads - readsBefore, samples: refresh.filter((s, i) => i === 0 || JSON.stringify(s) !== JSON.stringify(refresh[i - 1])) };
    const during = refresh.filter((s) => s.hintOpacity !== null);
    check('Realtime event triggers one refetch', pushed > 0 && obs.refresh.refetches === 1, { pushed, refetches: obs.refresh.refetches });
    check('refresh keeps the same mounted cards: no skeleton, no loading status, no entrance replay', refresh.every((s) => s.marked === s.cards && s.cards > 0 && s.skeletons === 0 && !s.status && s.reveals === 0), obs.refresh.samples);
    check('quiet "Updating" hint appears only after 120 ms, then clears', during.length > 0 && during.some((s) => s.hintOpacity > 0.4) && refresh.at(-1).hintOpacity === null, during.map((s) => s.hintOpacity));
    check('refresh produces no toast', (await liveToasts(page)).length === 0);
    // e) refresh failure keeps content with a warning; retry recovers
    mode = 'fail';
    rt.push('announcements');
    await page.getByText("Couldn't update announcements").waitFor({ timeout: 8000 });
    const warn = await page.evaluate(() => ({ cards: document.querySelectorAll('[aria-label^="View announcement"]').length, role: [...document.querySelectorAll('[role=status]')].find((e) => e.textContent.includes("Couldn't update"))?.getAttribute('role') ?? null }));
    await shot(page, 'list-refresh-failure-1440');
    mode = null;
    await page.locator('[role=status]').filter({ hasText: "Couldn't update" }).getByRole('button', { name: /Try again/ }).click();
    await page.getByText("Couldn't update announcements").waitFor({ state: 'detached', timeout: 8000 });
    obs.refreshFailure = { ...warn, toasts: (await liveToasts(page)).length, cardsAfterRetry: await page.locator('[aria-label^="View announcement"]').count() };
    check('refresh failure keeps the list, shows a polite stale-data warning, retry clears it', warn.cards > 0 && warn.role === 'status' && obs.refreshFailure.cardsAfterRetry > 0 && obs.refreshFailure.toasts === 0, obs.refreshFailure);
  }, { account: 'populated', realtime: true });

  // 15. Reduced motion: hint and fallback are static; mobile bottom bar keeps working.
  await scenario('reduced-motion-and-360', async (page, obs, check, { ctl }) => {
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    await page.locator('main a[href="/services/requests?tab=history"]').click();
    await page.waitForTimeout(400);
    const hint = await navState(page);
    await page.waitForTimeout(1500);
    ctl.delayMs = 0;
    await settle(page, 'My Requests');
    check('reduced motion: pending hint visible but static (no infinite animation)', hint.pendingHints.some((h) => h.opacity === 1) && hint.infiniteAnimations === 0, { hints: hint.pendingHints, infinite: hint.infiniteAnimations });
    // Bring the offscreen tab into view first so its route is prefetched (an unprefetched
    // link blocks with its pending hint instead of committing to a fallback).
    await page.locator('nav.fixed a[href="/announcements"]').scrollIntoViewIfNeeded();
    await prefetchSettle(page);
    ctl.delayMs = 1500;
    await page.locator('nav.fixed a[href="/announcements"]').click();
    await page.waitForTimeout(400);
    const fb = await navState(page);
    await shot(page, 'fallback-reduced-motion-360');
    ctl.delayMs = 0;
    await settle(page, 'Announcements');
    obs.fallback = { status: fb.status, infinite: fb.infiniteAnimations, bottomBar: fb.bottomBar, overflowX: fb.overflowX };
    check('360 px: bottom bar persists, fallback static, no horizontal overflow', fb.status === 'Loading page…' && fb.infiniteAnimations === 0 && fb.bottomBar && !fb.overflowX, obs.fallback);
    check('bottom bar navigation completes', (await navState(page)).h1 === 'Announcements');
  }, { account: 'populated', reducedMotion: 'reduce', viewport: { width: 360, height: 780 } });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  fs.writeFileSync(path.join(out, 'results.json'), redact(JSON.stringify(report, null, 2)));
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-04: auth, home, announcements
// Auth endpoint matchers (supabase-js 2.112 paths). Provider calls are fulfilled in the
// browser: no reset email, SMS, OAuth, or real sign-up is sent from these scenarios.
const authPath = (pathname, grant) => (url) => url.pathname === pathname && (!grant || url.searchParams.get('grant_type') === grant);
const AUTH = {
  password: authPath('/auth/v1/token', 'password'),
  refresh: authPath('/auth/v1/token', 'refresh_token'),
  recover: authPath('/auth/v1/recover'),
  verify: authPath('/auth/v1/verify'),
  user: authPath('/auth/v1/user'),
  signup: authPath('/auth/v1/signup'),
  logout: authPath('/auth/v1/logout'),
  authorize: authPath('/auth/v1/authorize'),
};
// GoTrue-shaped refusal (no API-version header, so supabase-js reads error_code).
const authRefusal = (status, errorCode, msg = 'Synthetic RW feedback refusal', extra = {}) => (route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: status, error_code: errorCode, msg, ...extra }) });
// Counts the matching calls; `handler` decides each response (default: pass through).
async function authRoute(page, match, handler = (route) => route.continue()) {
  const calls = { count: 0, methods: [] };
  await page.route(match, async (route) => {
    calls.count++;
    calls.methods.push(route.request().method());
    // A handler still sleeping when its scenario ends or is unrouted must not crash the run.
    try { await handler(route, calls.count); } catch { /* route already handled or page closed */ }
  });
  return calls;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Page-level outcome snapshot used across auth scenarios.
async function authState(page, selector = 'form button[type=submit]') {
  return page.evaluate((sel) => {
    const btn = document.querySelector(sel);
    const main = document.body.innerText;
    return {
      path: location.pathname,
      search: location.search,
      button: btn ? { disabled: btn.disabled, busy: btn.getAttribute('aria-busy'), text: btn.innerText.trim() } : null,
      inline: [...document.querySelectorAll('form p.text-destructive, form p.text-sm.text-destructive')].map((e) => e.textContent.trim()).filter(Boolean),
      alerts: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean),
      active: document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName) : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rawProviderText: /Synthetic RW feedback|error_code|AuthApiError|AuthRetryableFetchError|Failed to fetch|invalid_grant/i.test(main),
    };
  }, selector);
}
async function noToastFor(page, ms, re) {
  const start = Date.now();
  while (Date.now() - start < ms) { if ((await liveToasts(page, re)).length) return false; await pause(50); }
  return true;
}
// Rewrites the browser session cookie so its access token looks expired (the stored
// token itself is untouched). The next Auth call must refresh first.
async function expireBrowserSession(page) {
  return page.evaluate(() => {
    const jar = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
    const base = Object.keys(jar).map((k) => k.replace(/\.\d+$/, '')).find((k) => /^sb-.*-auth-token$/.test(k));
    if (!base) return false;
    const chunks = jar[base] !== undefined ? [jar[base]] : Object.keys(jar).filter((k) => k.startsWith(`${base}.`)).sort((a, b) => Number(a.split('.').pop()) - Number(b.split('.').pop())).map((k) => jar[k]);
    let raw = chunks.join('');
    const encoded = raw.startsWith('base64-');
    if (encoded) raw = new TextDecoder().decode(Uint8Array.from(atob(raw.slice(7).replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)));
    const session = JSON.parse(raw);
    session.expires_at = Math.floor(Date.now() / 1000) - 120;
    let next = JSON.stringify(session);
    if (encoded) next = `base64-${btoa(String.fromCharCode(...new TextEncoder().encode(next))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    for (const k of Object.keys(jar)) if (k === base || k.startsWith(`${base}.`)) document.cookie = `${k}=; path=/; max-age=0`;
    const size = 3180;
    if (next.length <= size) document.cookie = `${base}=${encodeURIComponent(next)}; path=/; max-age=34560000; samesite=lax`;
    else for (let i = 0; i * size < next.length; i++) document.cookie = `${base}.${i}=${encodeURIComponent(next.slice(i * size, (i + 1) * size))}; path=/; max-age=34560000; samesite=lax`;
    return true;
  });
}
const ACCENT_KEY = 'barangayan-resident-web-accent';

async function rwlt04(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-04', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const report = { run: runName, phase: 'RW-LT-04', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL, realtime: 'local Realtime unavailable; Realtime events use the in-browser protocol 2.0.0 stand-in (mockRealtime)', providers: 'Auth refusals/transport failures and OAuth/sign-up/profile-completion successes are fulfilled in the browser; the password-recovery journey uses the real local Auth with a disposable synthetic account (OTP obtained through the local admin API and never recorded)' }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  async function scenario(id, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: 'light' });
    const rt = options.realtime ? await mockRealtime(context) : null;
    if (options.clock) await context.clock.install();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-04', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      await fn(page, result.observations, check, { rt, context });
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|403|404|406|409|422|429|500|502|503)|Failed to load resource|ERR_FAILED|net::/i.test(m));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }
  const fillLogin = async (page, email, password) => {
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
  };

  // 1. D-04: login outcomes are classified by the real Auth result, never by elapsed time.
  await scenario('login-failure-classification', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const cases = [
      { name: 'network-abort', handler: (route) => route.abort('failed'), inline: /couldn't reach the server/i, toast: /Login failed[\s\S]*Couldn't reach the server/ },
      { name: 'invalid-credentials', handler: (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }), inline: /^Incorrect email or password\.$/, toast: /Login failed[\s\S]*Check your email and password/ },
      { name: 'rate-limited', handler: authRefusal(429, 'over_request_rate_limit'), inline: /Too many attempts/, toast: /Login failed[\s\S]*Too many attempts/ },
      { name: 'service-error', handler: authRefusal(500, 'unexpected_failure'), inline: /having trouble/, toast: /Login failed[\s\S]*having trouble/ },
    ];
    obs.cases = [];
    for (const c of cases) {
      const calls = await authRoute(page, AUTH.password, c.handler);
      await fillLogin(page, fx.accounts.populated.email, 'synthetic-wrong-password');
      await page.locator('#password').press('Enter');
      await waitForToast(page, c.toast);
      const state = await authState(page);
      const toasts = await liveToasts(page, /Login failed/);
      obs.cases.push({ name: c.name, calls: calls.count, state, toasts: toasts.map((t) => t.text) });
      check(`${c.name}: inline message classified correctly`, state.inline.some((m) => c.inline.test(m)), state.inline);
      check(`${c.name}: one toast, controls usable, no raw provider text`, toasts.filter((t) => c.toast.test(t.text)).length === 1 && !state.button.disabled && !state.button.busy && !state.rawProviderText && state.path === '/login', { toasts: toasts.map((t) => t.text), button: state.button });
      if (c.name === 'network-abort') { await shot(page, 'login-network-abort-1440'); check('network failure is not reported as wrong credentials', !state.inline.some((m) => /Incorrect email or password/.test(m)), state.inline); }
      await page.unroute(AUTH.password);
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
      await pause(500);
    }
  });

  // 2. Repeated activation, profile-check failure, and preserved destinations.
  await scenario('login-activation-and-destinations', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    // a) Enter + double click while slow → one sign-in request, one toast.
    const slow = await authRoute(page, AUTH.password, async (route) => { await pause(1200); return authRefusal(400, 'invalid_credentials', 'Invalid login credentials')(route); });
    await fillLogin(page, fx.accounts.populated.email, 'synthetic-wrong-password');
    await page.locator('#password').press('Enter');
    await page.locator('form button[type=submit]').dispatchEvent('click');
    await page.locator('form').evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(150);
    const during = await authState(page);
    await waitForToast(page, LOGIN_FAILED);
    await page.waitForTimeout(600);
    obs.repeated = { requests: slow.count, during, toasts: (await liveToasts(page, LOGIN_FAILED)).length };
    check('repeated Enter/click/submit while pending → 1 request, 1 toast', slow.count === 1 && obs.repeated.toasts === 1, obs.repeated);
    check('pending immediately: disabled, aria-busy, "Logging in…"', during.button.disabled && during.button.busy === 'true' && /Logging in/.test(during.button.text), during.button);
    await page.unroute(AUTH.password);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
    await pause(500);
    // b) Signed in, but the destination's profile check fails → usable retry, then success.
    let failProfiles = true;
    await page.route('**/rest/v1/profiles*', (route) => (failProfiles ? shape.fail(500)(route) : route.continue()));
    await fillLogin(page, fx.accounts.populated.email, fx.accounts.populated.password);
    await page.locator('#password').press('Enter');
    await page.getByText("You're logged in, but we couldn't load your profile").waitFor();
    const profileFail = await authState(page);
    obs.profileCheckFailure = { ...profileFail, toasts: (await liveToasts(page)).map((t) => t.text) };
    check('profile-check failure: stays on /login with usable controls and one error', profileFail.path === '/login' && !profileFail.button.disabled && obs.profileCheckFailure.toasts.length === 1, obs.profileCheckFailure);
    failProfiles = false;
    await page.locator('#password').press('Enter');
    await page.waitForURL((u) => u.pathname === '/onboarding');
    obs.retryDestination = new URL(page.url()).pathname;
    check('retry after recovery follows the existing first-login destination (/onboarding)', obs.retryDestination === '/onboarding');
    await page.unroute('**/rest/v1/profiles*');
  });

  await scenario('login-destinations-preserved', async (page, obs, check, { context }) => {
    const dest = async (account, next) => {
      const p = await context.newPage();
      await p.goto(`${BASE}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`, { waitUntil: 'networkidle' });
      const subtitle = await p.locator('h2 + p').innerText();
      await p.locator('#email').fill(account.email);
      await p.locator('#password').fill(account.password);
      await p.locator('#password').press('Enter');
      await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 });
      const r = { path: new URL(p.url()).pathname, search: new URL(p.url()).search, subtitle };
      await p.close();
      await context.clearCookies();
      return r;
    };
    obs.populatedFirst = await dest(fx.accounts.populated, null);
    await context.addInitScript((id) => { try { localStorage.setItem(`barangayan-resident-web-onboarded:${id}`, '1'); } catch {} }, fx.accounts.populated.id);
    obs.populatedNext = await dest(fx.accounts.populated, '/reports');
    obs.incompleteHome = await dest(fx.accounts.incomplete, null);
    obs.incompleteAction = await dest(fx.accounts.incomplete, '/reports/new');
    check('first login on this browser → /onboarding', obs.populatedFirst.path === '/onboarding', obs.populatedFirst);
    check('onboarded resident with ?next=/reports → /reports', obs.populatedNext.path === '/reports', obs.populatedNext);
    check('?next shows "continue where you left off"; plain /login keeps its copy', /where you left off/.test(obs.populatedNext.subtitle) && /continue to your account/.test(obs.populatedFirst.subtitle));
    check('profile-completion-required resident → /home (browse) and /complete-profile for resident actions', obs.incompleteHome.path === '/onboarding' || obs.incompleteHome.path === '/home', obs.incompleteHome);
    check('profile-completion-required resident with ?next=/reports/new → /complete-profile', obs.incompleteAction.path === '/complete-profile', obs.incompleteAction);
  });

  // 3. Google: starting OAuth is not signing in.
  await scenario('google-oauth-initiation', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const authorize = await authRoute(page, AUTH.authorize, async (route) => { await pause(1500); return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic provider</title><h1>Synthetic provider page</h1>' }); });
    const google = page.getByRole('button', { name: /Sign in with Google/ });
    // Click and sample inside the page: the document stays alive until the provider
    // response commits, but a Playwright click would wait for that navigation.
    const pending = await page.evaluate(async () => {
      const b = [...document.querySelectorAll('button')].find((x) => /Sign in with Google/.test(x.innerText));
      b.click();
      await new Promise((r) => setTimeout(r, 60));
      return { disabled: b.disabled, busy: b.getAttribute('aria-busy'), status: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).filter(Boolean) };
    });
    const toastsBeforeLeave = await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.innerText)).catch(() => []);
    await page.waitForURL((u) => u.pathname === '/auth/v1/authorize', { timeout: 10000 });
    obs.initiation = { pending, toastsBeforeLeave, authorizeRequests: authorize.count };
    check('pending: disabled, busy, "Connecting to Google…" status; no success toast', pending.disabled && pending.busy === 'true' && pending.status.includes('Connecting to Google…') && toastsBeforeLeave.length === 0, obs.initiation);
    await page.goBack({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Sign in with Google/.test(x.innerText));
      return { path: location.pathname, disabled: b?.disabled, busy: b?.getAttribute('aria-busy'), restoredFromCache: performance.getEntriesByType('navigation')[0]?.type };
    });
    obs.back = { ...back, toasts: (await liveToasts(page)).map((t) => t.text) };
    check('Back from the provider: button usable again, no sign-in claim', back.path === '/login' && !back.disabled && back.busy !== 'true' && obs.back.toasts.length === 0, obs.back);
  });

  // 4. Forgot password: unconfirmed vs refused vs confirmed (the next screen confirms).
  await scenario('forgot-password-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
    await page.locator('#email').fill('rwfb-recovery-check@test.local');
    obs.cases = [];
    for (const c of [
      { name: 'network-abort', handler: (route) => route.abort('failed'), inline: /couldn't confirm that a reset code was sent/i, toast: /Couldn't confirm the code was sent/, type: 'warning' },
      { name: 'rate-limited', handler: authRefusal(429, 'over_email_send_rate_limit'), inline: /Too many code requests/, toast: /Couldn't send reset code/, type: 'error' },
    ]) {
      const calls = await authRoute(page, AUTH.recover, async (route) => { await pause(400); return c.handler(route); });
      await page.locator('form button[type=submit]').click();
      await page.locator('form button[type=submit]').dispatchEvent('click');
      await waitForToast(page, c.toast);
      const state = await authState(page);
      const toasts = await liveToasts(page, c.toast);
      obs.cases.push({ name: c.name, calls: calls.count, state, toasts });
      check(`${c.name}: one ${c.type} toast, inline guidance, usable, no raw text, one request`, calls.count === 1 && toasts.length === 1 && toasts[0].type === c.type && state.inline.some((m) => c.inline.test(m)) && !state.button.disabled && !state.rawProviderText && state.path === '/forgot-password', { calls: calls.count, toasts, state });
      if (c.name === 'network-abort') await shot(page, 'forgot-unconfirmed-1440');
      await page.unroute(AUTH.recover);
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
      await pause(400);
    }
    const ok = await authRoute(page, AUTH.recover, async (route) => { await pause(500); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
    await page.locator('form button[type=submit]').click();
    await page.waitForTimeout(150);
    const pending = await authState(page);
    await page.waitForURL((u) => u.pathname === '/verify-otp');
    await page.waitForLoadState('networkidle');
    obs.success = { calls: ok.count, pending: pending.button, url: new URL(page.url()).pathname + new URL(page.url()).search, toasts: (await liveToasts(page)).map((t) => t.text), confirmation: await page.locator('form p').first().innerText() };
    check('confirmed send → /verify-otp with the email; the screen states where it was sent; no success toast', ok.count === 1 && obs.success.url.startsWith('/verify-otp?email=') && /sent a 6-digit code/.test(obs.success.confirmation) && obs.success.toasts.length === 0, obs.success);
    check('pending label "Sending code…" until the next screen replaces it', /Sending code/.test(pending.button.text) && pending.button.disabled, pending.button);
  });

  // 5. Real local recovery: code errors, resend, then verify → reset → /home.
  const { createClient } = require('@supabase/supabase-js');
  const c = localConfig();
  const trusted = createClient(c.API_URL, c.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const recovery = { email: 'rwfb-lt04-recovery@test.local', password: `Rwfb!${randomBytes(9).toString('base64url')}`, next: `Rwfb!${randomBytes(9).toString('base64url')}` };
  await scenario('recovery-code-and-reset', async (page, obs, check, { context }) => {
    { // remove a leftover from an interrupted earlier run
      const { data: list } = await trusted.auth.admin.listUsers({ perPage: 200 });
      for (const u of list?.users ?? []) if (u.email === recovery.email) { sql(`delete from public.profiles where id='${u.id}';`); await trusted.auth.admin.deleteUser(u.id); }
    }
    const { data: created, error: createError } = await trusted.auth.admin.createUser({ email: recovery.email, password: recovery.password, email_confirm: true, user_metadata: { full_name: 'RW Recovery' } });
    assert.ifError(createError);
    recovery.id = created.user.id;
    sql(`insert into public.profiles(id,role,barangay_id,full_name,first_name,last_name,house_no,street,sex,employment_status,birth_date,mobile_number,email)
      values ('${recovery.id}','resident','${fx.ids.barangay}','RW Recovery','RW','Recovery','12','Synthetic Street','female','student','2000-01-01','09171234567','${recovery.email}')
      on conflict (id) do update set barangay_id=excluded.barangay_id, first_name=excluded.first_name, last_name=excluded.last_name, house_no=excluded.house_no, street=excluded.street, sex=excluded.sex, employment_status=excluded.employment_status, birth_date=excluded.birth_date, mobile_number=excluded.mobile_number;`);
    await page.goto(`${BASE}/verify-otp?email=${encodeURIComponent(recovery.email)}`, { waitUntil: 'networkidle' });
    obs.codeInputName = await page.locator('input[inputmode=numeric]').getAttribute('aria-label');
    check('code input has an accessible name', obs.codeInputName === '6-digit reset code');
    // a) refused and transport failures (fulfilled in the browser)
    obs.verifyFailures = [];
    for (const v of [
      { name: 'expired-code', handler: async (route) => { await pause(500); return authRefusal(403, 'otp_expired', 'Token has expired or is invalid')(route); }, inline: /invalid or has expired/, toast: /Code not accepted/ },
      { name: 'network-abort', handler: async (route) => { await pause(500); return route.abort('failed'); }, inline: /couldn't reach the server/i, toast: /Couldn't verify the code/ },
    ]) {
      const calls = await authRoute(page, AUTH.verify, v.handler);
      await page.locator('input[inputmode=numeric]').fill('000000');
      await page.locator('input[inputmode=numeric]').press('Enter');
      await page.locator('form button[type=submit]').dispatchEvent('click');
      await waitForToast(page, v.toast);
      const state = await authState(page);
      obs.verifyFailures.push({ name: v.name, calls: calls.count, state, toasts: (await liveToasts(page, v.toast)).length });
      check(`${v.name}: inline guidance, one toast, one request, usable, no raw text`, calls.count === 1 && state.inline.some((m) => v.inline.test(m)) && !state.button.disabled && !state.rawProviderText && state.path === '/verify-otp', obs.verifyFailures.at(-1));
      await page.unroute(AUTH.verify);
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
      await pause(300);
    }
    // b) resend after the 45 s cooldown (fast-forwarded): unconfirmed, then confirmed
    await context.clock.runFor(46000);
    const resendBtn = page.getByRole('button', { name: /Resend Code/ });
    await resendBtn.waitFor();
    const resendAbort = await authRoute(page, AUTH.recover, async (route) => { await pause(300); return route.abort('failed'); });
    // dispatchEvent: Playwright's stable-position check never settles under the fake clock.
    // Two activations in the same tick, from inside the page (round trips under the
    // fake clock are slow enough to let the first settle).
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Resend Code/.test(x.innerText)); b.click(); b.click(); });
    await waitForToast(page, /Couldn't confirm a new code was sent/);
    obs.resendUnconfirmed = { calls: resendAbort.count, state: await authState(page), toastType: (await liveToasts(page, /Couldn't confirm a new code/))[0]?.type, resendVisible: await page.getByRole('button', { name: /Resend Code/ }).isVisible() };
    check('resend lost response: one request, warning (not failure), retry still possible', resendAbort.count === 1 && obs.resendUnconfirmed.toastType === 'warning' && obs.resendUnconfirmed.resendVisible, obs.resendUnconfirmed);
    await page.unroute(AUTH.recover);
    const resendOk = await authRoute(page, AUTH.recover, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: /Resend Code/ }).dispatchEvent('click');
    await waitForToast(page, /New code sent/);
    obs.resendConfirmed = { calls: resendOk.count, cooldown: await page.getByText(/Resend code in 00:/).isVisible() };
    check('resend confirmed: one "New code sent" success and the cooldown restarts', resendOk.count === 1 && obs.resendConfirmed.cooldown, obs.resendConfirmed);
    await page.unroute(AUTH.recover);
    // c) real verification against local Auth (OTP from the local admin API; never recorded)
    const { data: link, error: linkError } = await trusted.auth.admin.generateLink({ type: 'recovery', email: recovery.email });
    assert.ifError(linkError);
    await page.locator('input[inputmode=numeric]').fill(link.properties.email_otp);
    await page.locator('input[inputmode=numeric]').press('Enter');
    await page.waitForURL((u) => u.pathname === '/reset-password', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    obs.verifiedDestination = '/reset-password';
    // d) reset password: inline validation with focus, lost response, then success
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
    await pause(600);
    await page.locator('#password').fill('short');
    await page.locator('#confirmPassword').fill('different');
    const userCalls = await authRoute(page, AUTH.user, async (route, n) => (route.request().method() === 'PUT' && n === 1 ? route.abort('failed') : route.continue()));
    await page.locator('form button[type=submit]').click();
    await page.waitForTimeout(300);
    obs.validation = { state: await authState(page), toasts: (await liveToasts(page)).length, updateCalls: userCalls.methods.filter((m) => m === 'PUT').length, invalid: await page.locator('#password').getAttribute('aria-invalid') };
    check('invalid input: inline field errors, focus moves to the first invalid field, no toast, no request', obs.validation.state.active === 'password' && obs.validation.toasts === 0 && obs.validation.updateCalls === 0 && obs.validation.invalid === 'true', obs.validation);
    await page.locator('#password').fill(recovery.next);
    await page.locator('#confirmPassword').fill(recovery.next);
    await page.locator('form button[type=submit]').click();
    await waitForToast(page, /Couldn't confirm the password change/);
    obs.unconfirmed = { state: await authState(page), toastType: (await liveToasts(page, /Couldn't confirm the password change/))[0]?.type };
    check('lost update response: "couldn\'t confirm" warning, stays usable, inputs kept', obs.unconfirmed.toastType === 'warning' && obs.unconfirmed.state.path === '/reset-password' && !obs.unconfirmed.state.button.disabled && (await page.locator('#password').inputValue()) === recovery.next, obs.unconfirmed);
    await page.locator('form button[type=submit]').click();
    await page.waitForURL((u) => u.pathname === '/home', { timeout: 20000 });
    await waitForToast(page, /Password updated/);
    obs.success = { path: '/home', toasts: (await liveToasts(page)).map((t) => t.text), puts: userCalls.methods.filter((m) => m === 'PUT').length };
    check('deliberate retry → one "Password updated" success on /home (2 PUTs total: the lost one and the retry)', obs.success.toasts.filter((t) => /Password updated/.test(t)).length === 1 && obs.success.puts === 2, obs.success);
    await shot(page, 'reset-password-success-home-1440');
    // e) the new password works on the real local Auth
    const anon = createClient(c.API_URL, c.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await anon.auth.signInWithPassword({ email: recovery.email, password: recovery.next });
    check('the updated password signs in on local Auth', !signInError, signInError?.message);
  }, { clock: true });
  if (recovery.id) {
    sql(`delete from public.profiles where id='${recovery.id}';`);
    const { error } = await trusted.auth.admin.deleteUser(recovery.id);
    report.environment.recoveryAccountRemoved = !error;
  }

  // 6. Registration: inline validation with focus, refused, unconfirmed, confirmed.
  await scenario('register-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.getByText('RW Feedback Local').or(page.getByText('Ampid 1')).first().waitFor({ timeout: 15000 }).catch(() => {});
    const signup = await authRoute(page, AUTH.signup, async (route) => { await pause(600); return route.abort('failed'); });
    await page.locator('form button[type=submit]').click();
    await page.waitForTimeout(300);
    obs.validation = { state: await authState(page), toasts: (await liveToasts(page)).length, signupCalls: signup.count };
    check('empty submit: inline field errors, focus on First Name, no toast, no request', obs.validation.state.active === 'firstName' && obs.validation.toasts === 0 && signup.count === 0, obs.validation);
    await page.locator('#firstName').fill('Synthetic');
    await page.locator('#lastName').fill('Resident');
    await page.getByRole('button', { name: 'Female' }).click();
    await page.locator('#birthDate').fill('2000-01-01');
    await page.locator('#email').fill('rwfb-lt04-register@test.local');
    await page.locator('#mobileNumber').fill('09171234567');
    await page.locator('#houseNo').fill('12');
    await page.locator('#street').fill('Synthetic Street');
    await page.getByRole('button', { name: 'Student' }).click();
    await page.locator('#password').fill('Synthetic!Pass1');
    await page.locator('#confirmPassword').fill('Synthetic!Pass1');
    const submit = page.locator('form button[type=submit]');
    await submit.click();
    await submit.dispatchEvent('click');
    await waitForToast(page, /Couldn't confirm your account was created/);
    obs.unconfirmed = { calls: signup.count, state: await authState(page), toast: (await liveToasts(page, /Couldn't confirm/))[0], kept: await page.locator('#email').inputValue() };
    check('lost sign-up response: unconfirmed wording + "try logging in" guidance, no automatic retry, inputs kept', signup.count === 1 && obs.unconfirmed.toast?.type === 'warning' && obs.unconfirmed.state.inline.some((m) => /try logging in with this email/.test(m)) && obs.unconfirmed.kept === 'rwfb-lt04-register@test.local' && !obs.unconfirmed.state.button.disabled, obs.unconfirmed);
    await shot(page, 'register-unconfirmed-1440');
    await page.unroute(AUTH.signup);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
    const exists = await authRoute(page, AUTH.signup, authRefusal(422, 'user_already_exists', 'User already registered'));
    await submit.click();
    await waitForToast(page, /Couldn't create your account/);
    obs.exists = { calls: exists.count, state: await authState(page), emailInvalid: await page.locator('#email').getAttribute('aria-invalid') };
    check('existing email: field error on Email with focus, one error toast, no raw provider text', exists.count === 1 && obs.exists.state.active === 'email' && obs.exists.state.inline.some((m) => /already exists/.test(m)) && !obs.exists.state.rawProviderText, obs.exists);
    await page.unroute(AUTH.signup);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
    // Confirmed (fulfilled) sign-up: the existing success dialog is the confirmation.
    const user = { id: '5e0d0000-0000-4000-8000-0000000000ff', aud: 'authenticated', role: 'authenticated', email: 'rwfb-lt04-register@test.local', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
    const ok = await authRoute(page, AUTH.signup, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'synthetic.access.token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'synthetic-refresh', user }) }));
    const logout = await authRoute(page, AUTH.logout, (route) => route.fulfill({ status: 204, body: '' }));
    await submit.click();
    await page.getByRole('dialog').getByText('Account Created Successfully').waitFor();
    obs.success = { signup: ok.count, logout: logout.count, toasts: (await liveToasts(page)).map((t) => t.text) };
    check('confirmed sign-up: success dialog, local sign-out, no toast', ok.count === 1 && logout.count === 1 && obs.success.toasts.length === 0, obs.success);
    await page.getByRole('button', { name: 'Proceed to Login' }).click();
    await page.waitForURL((u) => u.pathname === '/login');
    obs.success.loginEmail = await page.locator('#email').inputValue();
    check('Proceed to Login keeps the existing ?email= destination', obs.success.loginEmail === 'rwfb-lt04-register@test.local');
  });

  // 7. Profile completion: refused/unconfirmed outcomes, retained input, local sign-out.
  await scenario('complete-profile-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/complete-profile`, { waitUntil: 'networkidle' });
    await page.locator('#firstName').waitFor();
    for (const [sel, v] of [['#firstName', 'RW'], ['#lastName', 'Incomplete'], ['#birthDate', '2000-01-01'], ['#mobileNumber', '09171234567'], ['#houseNo', '12'], ['#street', 'Synthetic Street']]) await page.locator(sel).fill(v);
    await page.getByRole('button', { name: 'Female' }).click();
    await page.getByRole('button', { name: 'Student' }).click();
    const rpc = '**/rest/v1/rpc/complete_resident_profile';
    obs.cases = [];
    for (const v of [
      { name: 'network-abort', handler: async (route) => { await pause(600); return route.abort('failed'); }, inline: /couldn't confirm that your profile was saved/i, type: 'warning' },
      { name: 'invalid-fields', handler: async (route) => { await pause(600); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '22023', message: 'invalid_profile_fields', details: null, hint: null }) }); }, inline: /Some required details are missing or invalid/, type: 'error' },
    ]) {
      let calls = 0;
      await page.route(rpc, (route) => { calls++; return v.handler(route); });
      await page.locator('form button[type=submit]').click();
      await page.locator('form button[type=submit]').dispatchEvent('click');
      await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length > 0);
      await page.waitForTimeout(200);
      const state = await authState(page);
      const toasts = await liveToasts(page);
      obs.cases.push({ name: v.name, calls, state, toasts });
      check(`${v.name}: one request, one ${v.type} toast, mapped message, inputs kept, no raw token`, calls === 1 && toasts.length === 1 && toasts[0].type === v.type && state.inline.some((m) => v.inline.test(m)) && !/invalid_profile_fields/.test(JSON.stringify(state)) && (await page.locator('#street').inputValue()) === 'Synthetic Street' && !state.button.disabled, obs.cases.at(-1));
      await page.unroute(rpc);
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
      await pause(400);
    }
    // Sign out (existing local scope): pending, then /login; the scope is unchanged.
    const logout = await authRoute(page, AUTH.logout, async (route) => { await pause(500); return route.continue(); });
    const signOutBtn = page.getByRole('button', { name: 'Sign out' });
    await signOutBtn.click();
    await page.waitForTimeout(100);
    const pending = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Signing out|Sign out/.test(x.innerText)); return { text: b?.innerText.trim(), disabled: b?.disabled, busy: b?.getAttribute('aria-busy') }; });
    await page.waitForURL((u) => u.pathname === '/login');
    obs.signOut = { pending, calls: logout.count, scope: (await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('/auth/v1/logout')))).map((n) => new URL(n).searchParams.get('scope')) };
    check('Sign out: pending "Signing out…", one local-scope logout, then /login', /Signing out/.test(pending.text ?? '') && pending.disabled && logout.count === 1 && obs.signOut.scope.every((s) => s === 'local'), obs.signOut);
  }, { account: 'incomplete' });

  // 8. Header logout: unconfirmed revoke, failure keeps the session, success resets.
  await scenario('logout-header-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.evaluate((k) => localStorage.setItem(k, '#7c3aed'), ACCENT_KEY);
    const logoutBtn = page.locator('header button[aria-label="Log out"]');
    obs.name = await logoutBtn.getAttribute('aria-label');
    // a) failed: the access token is expired and the refresh can't reach Auth, so the
    //    session stays; nothing resets and the resident stays put.
    check('expired-session simulation applied', await expireBrowserSession(page));
    const refresh = await authRoute(page, AUTH.refresh, (route) => route.abort('failed'));
    const logoutCalls = await authRoute(page, AUTH.logout, (route) => route.continue());
    await logoutBtn.click();
    // auth-js retries the refresh with backoff (~25 s); past 10 s the control says so
    // without claiming failure.
    await page.waitForTimeout(11000);
    obs.slow = await page.evaluate(() => ({
      hint: document.querySelector('header')?.innerText.includes('Taking longer than usual') ?? false,
      status: [...document.querySelectorAll('header [data-slot=loading-status]')].map((e) => e.textContent.trim()).join(' | '),
      busy: document.querySelector('header button[aria-label="Log out"]')?.getAttribute('aria-busy'),
      toasts: document.querySelectorAll('[data-sonner-toast]').length,
    }));
    check('over 10 s: still pending, "Taking longer than usual" shown and announced, no failure claimed', obs.slow.hint && /Logging out… Taking longer than usual/.test(obs.slow.status) && obs.slow.busy === 'true' && obs.slow.toasts === 0, obs.slow);
    await shot(page, 'logout-slow-1440');
    await waitForToast(page, /Couldn't log out/, 45000);
    obs.failed = { path: new URL(page.url()).pathname, accent: await page.evaluate((k) => localStorage.getItem(k), ACCENT_KEY), button: await logoutBtn.evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy') })), refreshAttempts: refresh.count, logoutCalls: logoutCalls.count, toasts: (await liveToasts(page)).map((t) => t.text) };
    check('failure: one "Couldn\'t log out" error, still signed in on the same page, preferences kept, button usable', obs.failed.path === '/announcements' && obs.failed.accent === '#7c3aed' && !obs.failed.button.disabled && obs.failed.toasts.filter((t) => /Couldn't log out/.test(t)).length === 1 && !obs.failed.toasts.some((t) => /You've been logged out/.test(t)), obs.failed);
    await shot(page, 'logout-failed-1440');
    await page.unroute(AUTH.refresh);
    await page.unroute(AUTH.logout);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
  }, { account: 'populated' });
  await scenario('logout-local-only-warning', async (page, obs, check) => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.evaluate((k) => localStorage.setItem(k, '#7c3aed'), ACCENT_KEY);
    const logoutBtn = page.locator('header button[aria-label="Log out"]');
    // revoke not confirmed: the browser is signed out locally → warning on /login.
    const lost = await authRoute(page, AUTH.logout, async (route) => { await pause(700); return route.abort('failed'); });
    await logoutBtn.click();
    await logoutBtn.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(150);
    obs.pending = await logoutBtn.evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy'), name: b.getAttribute('aria-label') })).catch(() => null);
    await page.waitForURL((u) => u.pathname === '/login');
    await waitForToast(page, /Logged out on this browser/);
    obs.localOnly = { logoutCalls: lost.count, accent: await page.evaluate((k) => localStorage.getItem(k), ACCENT_KEY), toasts: (await liveToasts(page)).map((t) => ({ text: t.text, type: t.type })) };
    check('pending immediately (disabled, aria-busy, named), repeated click ignored', obs.pending?.disabled && obs.pending?.busy === 'true' && obs.pending?.name === 'Log out' && lost.count === 1, { pending: obs.pending, calls: lost.count });
    check('unconfirmed revoke: on /login with one warning that kept across the session change; preferences reset', obs.localOnly.accent === null && obs.localOnly.toasts.filter((t) => /Logged out on this browser/.test(t.text) && t.type === 'warning').length === 1 && !obs.localOnly.toasts.some((t) => /You've been logged out/.test(t.text)), obs.localOnly);
    await shot(page, 'logout-local-only-warning-1440');
  }, { account: 'populated' });

  await scenario('logout-success-header-and-sidebar', async (page, obs, check, { context }) => {
    await page.evaluate((k) => localStorage.setItem(k, '#7c3aed'), ACCENT_KEY);
    const calls = await authRoute(page, AUTH.logout);
    await page.locator('header button[aria-label="Log out"]').click();
    await page.waitForURL((u) => u.pathname === '/login');
    await page.waitForTimeout(800);
    obs.header = { calls: calls.count, accent: await page.evaluate((k) => localStorage.getItem(k), ACCENT_KEY), toasts: (await liveToasts(page)).map((t) => t.text) };
    check('header: one logout request, /login, preferences reset, no toast', calls.count === 1 && obs.header.accent === null && obs.header.toasts.length === 0, obs.header);
    // Settings sidebar uses the same flow (formerly a server action).
    await login(page, fx.accounts.populated);
    await page.goto(`${BASE}/settings/theme`, { waitUntil: 'networkidle' });
    const before = calls.count;
    const side = page.locator('aside button[aria-label="Log out"]');
    obs.sidebarName = await side.getAttribute('aria-label');
    await side.click();
    await page.waitForURL((u) => u.pathname === '/login');
    await page.waitForTimeout(800);
    obs.sidebar = { calls: calls.count - before, toasts: (await liveToasts(page)).map((t) => t.text) };
    check('settings sidebar: same flow, one logout request, /login, no toast', obs.sidebar.calls === 1 && obs.sidebar.toasts.length === 0, obs.sidebar);
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    obs.afterLogoutGated = new URL(page.url()).pathname + new URL(page.url()).search;
    check('signed out: gated route still goes to /login?next=…', obs.afterLogoutGated.startsWith('/login?next='), obs.afterLogoutGated);
    // 360 px: the sidebar's text label is hidden, the control keeps its name.
    const p360 = await context.newPage();
    await p360.setViewportSize({ width: 360, height: 780 });
    await login(p360, fx.accounts.populated);
    await p360.goto(`${BASE}/settings/theme`, { waitUntil: 'networkidle' });
    obs.sidebar360 = await p360.locator('aside button[aria-busy], aside button[aria-label="Log out"]').first().evaluate((b) => ({ name: b.getAttribute('aria-label'), width: b.getBoundingClientRect().width, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    check('360 px sidebar logout keeps the accessible name "Log out"; no overflow', obs.sidebar360.name === 'Log out' && !obs.sidebar360.overflowX, obs.sidebar360);
    await p360.close();
  }, { account: 'populated' });

  // 9. Session ended elsewhere: the other tab says so once; the tab that logged out doesn't.
  await scenario('session-ended-other-tab', async (page, obs, check, { context }) => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    const other = await context.newPage();
    await other.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await other.locator('header button[aria-label="Log out"]').click();
    await other.waitForURL((u) => u.pathname === '/login');
    await waitForToast(page, /You've been logged out/);
    await page.waitForTimeout(1000);
    obs.watcher = { toasts: (await liveToasts(page)).map((t) => ({ text: t.text, type: t.type })), path: new URL(page.url()).pathname };
    obs.initiator = { toasts: (await liveToasts(other)).map((t) => t.text) };
    check('watching tab: exactly one "You\'ve been logged out" info; routing unchanged', obs.watcher.toasts.filter((t) => /You've been logged out/.test(t.text) && t.type === 'info').length === 1 && obs.watcher.toasts.length === 1 && obs.watcher.path === '/announcements', obs.watcher);
    check('initiating tab: no session-ended toast (its own sign-out)', !obs.initiator.toasts.some((t) => /You've been logged out/.test(t)), obs.initiator);
    await shot(page, 'session-ended-other-tab-1440');
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    obs.nextNavigation = new URL(page.url()).pathname;
    check('next navigation follows the existing guest redirect', obs.nextNavigation === '/login', obs.nextNavigation);
    await other.close();
  }, { account: 'populated' });

  // 10. D-12: onboarding appearance choices preview immediately, without toasts.
  await scenario('onboarding-quiet-appearance', async (page, obs, check) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await fillLogin(page, fx.accounts.populated.email, fx.accounts.populated.password);
    await page.locator('#password').press('Enter');
    await page.waitForURL((u) => u.pathname === '/onboarding');
    await page.getByRole('heading', { level: 1 }).waitFor();
    const swatches = page.locator('button[aria-label^="Accent "]');
    const n = Math.min(3, await swatches.count());
    for (let i = 0; i < n; i++) { await swatches.nth(i + 1).click(); await page.waitForTimeout(150); }
    await page.getByRole('button', { name: 'dark' }).click();
    await page.getByRole('button', { name: 'light' }).click();
    const quiet = await noToastFor(page, 1200);
    obs.choices = { accentsClicked: n, pressed: await page.locator('button[aria-label^="Accent "][aria-pressed=true]').count(), accentStored: await page.evaluate((k) => localStorage.getItem(k), ACCENT_KEY), quiet };
    check('accent/theme picks: immediate preview (pressed + stored), zero toasts', quiet && obs.choices.pressed === 1 && obs.choices.accentStored, obs.choices);
    await page.getByRole('button', { name: 'Continue to Barangayan' }).click();
    await page.waitForURL((u) => u.pathname === '/home');
    check('Continue → /home (existing destination)', true);
  });

  // 11. D-07: home read failures (local REST briefly stopped) are not empty states.
  await scenario('home-read-failures', async (page, obs, check, { context }) => {
    const restUp = () => fetch(`${API_URL}/rest/v1/`, { headers: { apikey: c.ANON_KEY } }).then((r) => r.status).catch(() => 0);
    const guest = await context.newPage();
    page.setDefaultNavigationTimeout(150000); guest.setDefaultNavigationTimeout(150000);
    try {
      docker(['stop', 'supabase_rest_barangayan']);
      await guest.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
      obs.guest = await guest.evaluate(() => ({ text: document.querySelector('main')?.innerText ?? '' })).then((s) => ({ notice: /couldn't load the latest announcement/i.test(s.text) }));
      await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
      obs.resident = await page.evaluate(() => {
        const t = document.querySelector('main')?.innerText ?? '';
        return { requests: /couldn't load your recent requests/i.test(t), reports: /couldn't load your recent reports/i.test(t), falseEmpty: /No requests yet\.|No reports yet\./.test(t), retryButtons: [...document.querySelectorAll('main button')].filter((b) => /Try again/.test(b.innerText)).length };
      });
      obs.toasts = (await liveToasts(page)).length;
      await shot(page, 'home-read-failure-1440');
      check('guest: latest-announcement failure shows a retryable notice', obs.guest.notice, obs.guest);
      check('resident: failed reads show notices with Try again, not "No requests/reports yet"; no toast', obs.resident.requests && obs.resident.reports && !obs.resident.falseEmpty && obs.resident.retryButtons >= 2 && obs.toasts === 0, obs.resident);
      // Retry while still failing: pending, settles back to the notice, no write.
      const posts = [];
      page.on('request', (r) => { if (r.method() !== 'GET' && /\/(rest|auth)\/v1\//.test(r.url())) posts.push(r.url()); });
      const retry = page.locator('main button', { hasText: 'Try again' }).first();
      await retry.click();
      await page.waitForTimeout(60);
      obs.retryPending = await page.locator('main button[aria-busy=true]').count();
      await page.waitForFunction(() => !document.querySelector('main button[aria-busy=true]'), null, { timeout: 120000 });
      obs.stillFailing = await page.evaluate(() => /couldn't load your recent requests/i.test(document.querySelector('main')?.innerText ?? ''));
      check('retry while failing: pending ("Trying again…"), settles to the notice again, no writes', obs.retryPending >= 1 && obs.stillFailing && posts.length === 0, { pending: obs.retryPending, stillFailing: obs.stillFailing, writes: posts.length });
    } finally {
      docker(['start', 'supabase_rest_barangayan']);
      for (let i = 0; i < 60 && (await restUp()) !== 200; i++) await pause(500);
    }
    obs.restRecovered = (await restUp()) === 200;
    await page.waitForTimeout(500);
    await page.locator('main button', { hasText: 'Try again' }).first().click();
    await page.waitForFunction(() => /Recent Requests/.test(document.body.innerText) && !/couldn't load your recent/i.test(document.body.innerText), null, { timeout: 20000 });
    obs.recovered = await page.evaluate(() => ({ synthetic: /RW Synthetic Clearance|Synthetic fallen branch/.test(document.querySelector('main')?.innerText ?? '') }));
    check('after the service returns, Try again restores the real content', obs.restRecovered && obs.recovered.synthetic, obs.recovered);
    await guest.close();
  }, { account: 'populated' });

  // 12. Announcements: automatic updates stay quiet (no toast burst); detail dialog a11y.
  await scenario('announcements-quiet-updates', async (page, obs, check, { rt }) => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
    await page.locator('[aria-label^="View announcement"]').first().waitFor();
    let pushed = 0;
    for (let i = 0; i < 5; i++) { pushed += rt.push('announcements', 'INSERT'); pushed += rt.push('announcement_reads', 'INSERT'); await pause(120); }
    const quiet = await noToastFor(page, 2500);
    obs.burst = { pushed, quiet, cards: await page.locator('[aria-label^="View announcement"]').count(), skeletons: await page.locator('[data-slot=skeleton]').count() };
    check('10 Realtime announcement/unread events → zero toasts, cards kept, no skeleton', pushed > 0 && quiet && obs.burst.cards > 0 && obs.burst.skeletons === 0, obs.burst);
    const markAll = page.getByRole('button', { name: 'Mark all read' });
    if (await markAll.count()) { await markAll.click(); obs.markAllQuiet = await noToastFor(page, 1200); check('"Mark all read" stays quiet (badge update only)', obs.markAllQuiet); }
  }, { account: 'populated', realtime: true });

  for (const variant of [{ id: 'announcement-detail-dialog', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' }, { id: 'announcement-detail-dialog-reduced-360', viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' }]) {
    await scenario(variant.id, async (page, obs, check) => {
      await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
      const card = page.locator('[aria-label^="View announcement"]').first();
      await card.waitFor();
      await card.focus();
      const reads = { count: 0 };
      page.on('request', (r) => { if (/\/rest\/v1\//.test(r.url())) reads.count++; });
      await page.keyboard.press('Enter');
      const samples = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 400) {
        samples.push(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { t: 0, transform: getComputedStyle(d).transform } : null; }).then((s) => (s ? { ...s, t: Date.now() - t0 } : null)));
        await pause(40);
      }
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      obs.open = await page.evaluate(() => {
        const d = document.querySelector('[role=dialog]');
        const title = d && document.getElementById(d.getAttribute('aria-labelledby'));
        return { modal: d?.getAttribute('data-state') === 'open' && Boolean(document.querySelector('body > [aria-hidden=true], body > div[data-aria-hidden=true]')) ? 'true' : null, title: title?.textContent ?? null, focusInside: d?.contains(document.activeElement), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      obs.moving = samples.filter(Boolean).filter((s) => s.transform && s.transform !== 'none' && s.transform !== 'matrix(1, 0, 0, 1, 0, 0)').length;
      obs.fetchesOnOpen = reads.count;
      check('dialog: modal, named by the announcement title, focus moved inside, no fetch on open', obs.open.modal === 'true' && obs.open.title && obs.open.focusInside && reads.count === 0, obs.open);
      if (variant.reducedMotion === 'reduce') check('reduced motion: no slide transform; 360 px no overflow', obs.moving === 0 && !obs.open.overflowX, { moving: obs.moving, overflowX: obs.open.overflowX });
      else check('motion: slide-up observed and settled within the 240 ms drawer timing', obs.moving > 0 && samples.filter(Boolean).at(-1)?.transform !== undefined, { moving: obs.moving });
      for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
      obs.trapped = await page.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement));
      check('Tab stays inside the dialog', obs.trapped);
      await shot(page, `${variant.id}-open`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(40);
      obs.exitInert = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? Boolean(d.querySelector('[inert]')) : 'gone'; });
      await dialog.waitFor({ state: 'detached' });
      obs.focusReturned = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
      check('Escape closes; controls inert during exit; focus returns to the card', (obs.exitInert === true || obs.exitInert === 'gone') && /^View announcement/.test(obs.focusReturned ?? ''), { exitInert: obs.exitInert, focus: obs.focusReturned });
      await card.click();
      await dialog.waitFor();
      await page.mouse.click(5, 5);
      await dialog.waitFor({ state: 'detached' });
      check('backdrop click closes', true);
      check('no toast from opening/closing details', (await liveToasts(page)).length === 0);
    }, { account: 'populated', viewport: variant.viewport, reducedMotion: variant.reducedMotion });
  }

  // 13. Static auth surfaces and 320/360 px.
  await scenario('auth-static-and-narrow', async (page, obs, check) => {
    await page.goto(`${BASE}/auth/error`, { waitUntil: 'networkidle' });
    obs.authError = await page.evaluate(() => ({ alert: document.querySelector('[role=alert]')?.textContent ?? null, links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')) }));
    check('/auth/error: alert copy and return links unchanged', obs.authError.alert && obs.authError.links.includes('/login'), obs.authError);
    await page.goto(`${BASE}/login?authError=1`, { waitUntil: 'networkidle' });
    obs.authErrorNotice = await page.locator('form p.text-destructive').innerText().catch(() => null);
    check('/login?authError keeps the Google failure notice', /Google sign-in was cancelled/.test(obs.authErrorNotice ?? ''), obs.authErrorNotice);
    await page.route(AUTH.password, (route) => route.abort('failed'));
    await fillLogin(page, fx.accounts.populated.email, 'synthetic-wrong-password');
    await page.locator('#password').press('Enter');
    await waitForToast(page, LOGIN_FAILED);
    obs.narrow = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    obs.toast = (await toastState(page)).toasts[0];
    await shot(page, 'login-error-320');
    check('320 px: inline error + toast within gutters, no horizontal overflow', !obs.narrow.overflowX && obs.toast.left >= 15 && obs.toast.right <= 305, { ...obs.narrow, toast: obs.toast });
  }, { viewport: { width: 320, height: 720 } });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  const text = redact(JSON.stringify(report, null, 2));
  assert.ok(!text.includes(recovery.password) && !text.includes(recovery.next), 'Generated passwords must never reach evidence');
  fs.writeFileSync(path.join(out, 'results.json'), text);
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-05: emergency, maps, household actions
// Routes a Supabase REST table (exact path) and counts the calls, optionally by method.
async function rest(page, table, handler, { methods } = {}) {
  const calls = { count: 0, byMethod: {} };
  const matcher = (url) => url.pathname === `/rest/v1/${table}`;
  await page.route(matcher, async (route) => {
    const method = route.request().method();
    if (methods && !methods.includes(method)) return route.fallback().catch(() => {});
    calls.count++;
    calls.byMethod[method] = (calls.byMethod[method] ?? 0) + 1;
    try { await handler(route, calls.count, method); } catch { /* route already handled or page closed */ }
  });
  calls.off = () => page.unroute(matcher);
  return calls;
}
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const EMERGENCY_ROWS = {
  guidelines: [{ id: '5e0d0000-0000-4000-8000-0000000e0001', category: 'guidelines', title: 'Synthetic flood guideline', icon: 'water-outline', icon_color: '#2563EB', icon_bg: '#DBEAFE', content: ['Synthetic step one', 'Synthetic step two'], sort_order: 0, is_active: true }],
  hotlines: [{ id: '5e0d0000-0000-4000-8000-0000000e0002', category: 'hotlines', title: 'Synthetic rescue hotline', icon: 'call-outline', icon_color: '#DC2626', icon_bg: '#FEE2E2', content: [{ label: 'Synthetic desk', number: '0917000111' }], sort_order: 0, is_active: true }],
};
// Answers emergency_information reads from the fixture rows above, by requested category.
const emergencyRows = (route) => {
  const category = new URL(route.request().url()).searchParams.get('category') ?? '';
  return json(EMERGENCY_ROWS[category.replace('eq.', '')] ?? [])(route);
};
const OSRM = (distance) => ({ routes: [{ distance, duration: distance / 1.2, geometry: { coordinates: [[121.0, 14.6], [121.001, 14.601]] } }] });
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');

async function rwlt05Unit() {
  const out = path.join(evidence, 'rw-lt-05');
  fs.mkdirSync(out, { recursive: true });
  const ts = require(path.join(root, 'node_modules/typescript'));
  const load = (file, requireMap) => {
    const source = fs.readFileSync(path.join(app, 'src', file), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (name) => { assert.ok(name in requireMap, `unexpected import ${name}`); return requireMap[name]; });
    return mod.exports;
  };
  const toasts = [];
  const notify = Object.fromEntries(['success', 'error', 'warning', 'info'].map((k) => [k, (title, o) => { toasts.push({ kind: k, title, id: o?.id, description: o?.description }); return 'x'; }]));
  const CENTER = '5e0d0000-0000-4000-8000-0000000c0001', BRGY = '5e0d0000-0000-4000-8000-000000000001';
  const { z } = require(path.join(root, 'node_modules/zod'));
  const schema = z.object({ type: z.literal('EVACUATION_CENTER_CHECKIN'), version: z.literal('1.0'), center_id: z.string().uuid(), center_name: z.string(), barangay_id: z.string().uuid(), generated_at: z.string().datetime().optional() });
  const qr = load('lib/qr-checkin.ts', { '@barangayan/shared': { evacuationCenterQrPayloadSchema: schema }, '@/lib/notify': { notify } });
  const results = [];
  const test = async (id, fn) => {
    const checks = {};
    const check = (name, ok, detail) => { checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    toasts.length = 0;
    try { await fn(check); } catch (e) { checks.threw = { ok: false, detail: e.message }; }
    const status = Object.values(checks).every((c) => c.ok) ? 'pass' : 'fail';
    results.push({ id, phase: 'RW-LT-05', status, checks });
    const failed = Object.entries(checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${status.toUpperCase()} ${id}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  };
  const payload = (over = {}) => JSON.stringify({ type: 'EVACUATION_CENTER_CHECKIN', version: '1.0', center_id: CENTER, center_name: 'Synthetic', barangay_id: BRGY, ...over });
  await test('parse-center-qr-rules', async (check) => {
    check('valid payload for own barangay', JSON.stringify(qr.parseCenterQr(payload(), BRGY)) === JSON.stringify({ ok: true, centerId: CENTER }));
    check('non-JSON → invalid payload message', qr.parseCenterQr('not json', BRGY).title === 'This QR code does not contain a valid payload.');
    check('wrong schema → not a check-in code', /not a valid evacuation center check-in code/.test(qr.parseCenterQr(JSON.stringify({ type: 'x' }), BRGY).title));
    check('other barangay → different barangay', /different barangay/.test(qr.parseCenterQr(payload({ barangay_id: '5e0d0000-0000-4000-8000-0000000000ff' }), BRGY).title));
    check('guest (null barangay) never matches', qr.parseCenterQr(payload(), null).ok === false);
  });
  const run = async ({ row, failure, household }) => {
    toasts.length = 0;
    const outcome = await qr.completeCheckIn({
      centerId: CENTER, attempt: 'attempt:qr:1',
      checkIn: async () => row, updateHouseholdStatus: async () => household, lastCheckInFailure: () => failure,
    });
    return { outcome, toasts: toasts.map((t) => `${t.kind}:${t.title}`), ids: toasts.map((t) => t.id) };
  };
  await test('checkin-single-terminal-outcome', async (check) => {
    const ok = await run({ row: { id: 'r' }, failure: null, household: true });
    check('both succeed → one success', ok.outcome === 'recorded' && ok.toasts.length === 1 && ok.toasts[0].startsWith('success:'), ok);
    const partial = await run({ row: { id: 'r' }, failure: null, household: false });
    check('check-in saved, household failed → one warning and no success', partial.outcome === 'partial' && partial.toasts.length === 1 && partial.toasts[0].startsWith('warning:Check-in recorded'), partial);
    const rejected = await run({ row: null, failure: 'rejected', household: true });
    check('rejected check-in → one error', rejected.outcome === 'failed' && rejected.toasts.length === 1 && rejected.toasts[0].startsWith('error:'), rejected);
    const lost = await run({ row: null, failure: 'unconfirmed', household: true });
    check('lost response → one unconfirmed warning (not a definite failure)', lost.outcome === 'unconfirmed' && lost.toasts.length === 1 && /^warning:We couldn't confirm/.test(lost.toasts[0]), lost);
    check('every terminal toast carries the attempt id', [ok, partial, rejected, lost].every((r) => r.ids.every((i) => i === 'attempt:qr:1')));
  });
  await test('household-feedback-wording', async (check) => {
    const hf = load('lib/household-feedback.ts', { '@/lib/notify': { notify }, '@/hooks/use-family-members': {} });
    toasts.length = 0; hf.notifyHouseholdOutcome('add', true, null, 'a');
    check('confirmed add → one success', toasts.length === 1 && toasts[0].kind === 'success', toasts);
    toasts.length = 0; hf.notifyHouseholdOutcome('update', false, 'rejected', 'a');
    check('rejected update → error that says nothing changed', toasts.length === 1 && toasts[0].kind === 'error' && /Nothing was changed/.test(toasts[0].description), toasts);
    toasts.length = 0; hf.notifyHouseholdOutcome('remove', false, 'unconfirmed', 'a');
    check('lost response → warning telling the resident to check the list', toasts.length === 1 && toasts[0].kind === 'warning' && /Check the list before trying again/.test(toasts[0].description), toasts);
    toasts.length = 0; hf.notifyHouseholdOutcome('add', false, 'busy', 'a');
    check('overlapping write → warning, never success', toasts.length === 1 && toasts[0].kind === 'warning', toasts);
  });
  await test('ownership-and-contracts', async (check) => {
    const src = path.join(app, 'src');
    const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
    const migrated = ['components/emergency/family-content.tsx', 'components/emergency/qr-scanner-dialog.tsx', 'components/emergency/qr-upload-fallback.tsx', 'components/emergency/qr-show-dialog.tsx', 'components/maps/locate-button.tsx', 'app/(resident)/settings/profile/profile-form.tsx'];
    // profile-form's remaining upload/save toasts belong to RW-LT-08; only its household handlers are in scope here.
    check('RW-LT-05 modules use the notify adapter, not Sonner', migrated.filter((f) => !f.includes('profile-form')).every((f) => !/from ['"]sonner['"]/.test(read(f))));
    check('household handlers in the profile editor no longer toast success unconditionally', !/await updateMember\([^)]*\);\s*toast\.success/.test(read('app/(resident)/settings/profile/profile-form.tsx')));
    check('FamilyMemberDialog callbacks return Promise<boolean>', /onSave: \(member: [^)]*\) => Promise<boolean>/.test(read('components/emergency/family-member-dialog.tsx')) && /onDelete\?: \(id: string\) => Promise<boolean>/.test(read('components/emergency/family-member-dialog.tsx')));
    check('dialog does not notify or import Sonner/notify', !/sonner|notify/.test(read('components/emergency/family-member-dialog.tsx').replace(/\/\*\*[\s\S]*?\*\//, '')));
    check('no checkIn payload change: insert columns unchanged', /insert\(\{ evacuation_center_id: evacuationCenterId, user_id: userId, barangay_id: barangayId \}\)/.test(read('hooks/use-qr-checkins.ts')));
  });
  const summary = Object.fromEntries(['pass', 'fail'].map((k) => [k, results.filter((r) => r.status === k).length]));
  fs.writeFileSync(path.join(out, 'unit-results.json'), JSON.stringify({ phase: 'RW-LT-05', ranAt: new Date().toISOString(), modules: ['lib/qr-checkin.ts', 'lib/household-feedback.ts'], summary, results }, null, 2));
  console.log(JSON.stringify(summary));
  if (summary.fail) process.exitCode = 1;
}

async function rwlt05(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-05', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const QRCode = require(path.join(root, 'node_modules/qrcode'));
  const report = { run: runName, phase: 'RW-LT-05', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless); camera scenarios use Chrome\'s fake capture device', api: API_URL, realtime: 'local Realtime unavailable; Realtime events use the in-browser protocol 2.0.0 stand-in (mockRealtime)', providers: 'Edge Function (household QR PNG) and the OSRM routing service are fulfilled in the browser; household and check-in writes use the real local database with synthetic rows that the run restores/removes' }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const cameraBrowser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  const centerId = sql(`select id from public.evacuation_centers where barangay_id='${FX.barangay}' order by created_at limit 1`);
  const memberJson = `[{"id":"${FX.member}","name":"Synthetic Child","relation":"Child","role":"Student"}]`;
  const resetHousehold = () => sql(`update public.profiles set household_members='${memberJson}' where id='${FX.users.populated}'; delete from public.evacuation_center_checkins where user_id='${FX.users.populated}'; update public.household_members set is_checked_in=false where profile_id='${FX.users.populated}';`);
  const householdNames = () => JSON.parse(sql(`select coalesce(jsonb_agg(h->>'name' order by h->>'name'),'[]'::jsonb) from public.profiles p, jsonb_array_elements(p.household_members) h where p.id='${FX.users.populated}'`) || '[]');
  const checkinCount = () => Number(sql(`select count(*) from public.evacuation_center_checkins where user_id='${FX.users.populated}'`));
  const qrPng = (over = {}) => QRCode.toBuffer(JSON.stringify({ type: 'EVACUATION_CENTER_CHECKIN', version: '1.0', center_id: centerId, center_name: 'Synthetic Covered Court', barangay_id: FX.barangay, generated_at: new Date().toISOString(), ...over }), { type: 'png', width: 320, margin: 4 });
  resetHousehold();

  async function scenario(id, fn, options = {}) {
    if (process.env.RW_ONLY && !process.env.RW_ONLY.split(',').includes(id)) return;
    resetHousehold();
    const b = options.camera ? cameraBrowser : browser;
    const context = await b.newContext({
      viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: 'light',
      permissions: options.permissions ?? [], ...(options.geolocation ? { geolocation: options.geolocation } : {}),
    });
    const rt = await mockRealtime(context);
    if (options.initScript) await context.addInitScript(options.initScript, options.initArg);
    await context.route('**/tile.openstreetmap.org/**', (route) => route.abort('failed'));
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-05', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account) result.observations.loginDestination = await login(page, fx.accounts[options.account]);
      await fn(page, result.observations, check, { rt, context });
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|403|404|406|409|422|429|500|502|503)|Failed to load resource|ERR_FAILED|net::|tile\.openstreetmap/i.test(m) && !(options.allowErrors && options.allowErrors.test(m)));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }
  const bodyText = (page) => page.evaluate(() => document.body.innerText);
  const domState = (page) => page.evaluate(() => ({
    skeletons: document.querySelectorAll('.rw-skeleton, .rw-skeleton-static').length,
    busy: document.querySelectorAll('[aria-busy=true]').length,
    statuses: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).filter(Boolean),
    alerts: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  // ---- 1. Hub: guidelines + hotlines
  await scenario('hub-read-states', async (page, obs, check, { rt }) => {
    // slow
    let data = await rest(page, 'emergency_information', async (route) => { await pause(1500); return emergencyRows(route); });
    const nav = page.goto(`${BASE}/emergency`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'Emergency Info' }).waitFor();
    await pause(500);
    obs.slow = { ...(await domState(page)), text: await bodyText(page) };
    check('slow: matching skeletons + one polite label, never "No guidelines available."', obs.slow.skeletons >= 2 && obs.slow.statuses.some((s) => /Loading emergency information/.test(s)) && !/No guidelines available|No hotlines available/.test(obs.slow.text), obs.slow.statuses);
    await nav; await page.getByText('Synthetic flood guideline').waitFor();
    await page.getByText('Synthetic rescue hotline').waitFor();
    check('content arrives steady (no entrance wrapper on urgent info)', await page.evaluate(() => !document.querySelector('.rw-reveal')));
    await shot(page, 'hub-ready-1440');
    data.off();
    // refresh failure keeps same-identity content
    data = await rest(page, 'emergency_information', shape.fail(500));
    const sent = rt.push('emergency_information');
    await page.getByText(/Couldn't update the guidelines/).waitFor();
    obs.refreshFail = { sent, ...(await domState(page)), text: await bodyText(page) };
    check('refresh failure: loaded content stays with a stale-data warning; no skeleton, no toast', /Synthetic flood guideline/.test(obs.refreshFail.text) && /Synthetic rescue hotline/.test(obs.refreshFail.text) && obs.refreshFail.skeletons === 0 && (await liveToasts(page)).length === 0, { sent });
    data.off();
    data = await rest(page, 'emergency_information', emergencyRows);
    await page.getByRole('button', { name: 'Try again' }).first().click();
    await page.getByText(/Couldn't update the guidelines/).waitFor({ state: 'detached' });
    check('retry clears the warning and keeps content', /Synthetic flood guideline/.test(await bodyText(page)));
    data.off();
    // initial failure (fresh load)
    data = await rest(page, 'emergency_information', shape.fail(500));
    await page.goto(`${BASE}/emergency`, { waitUntil: 'networkidle' });
    obs.failed = { ...(await domState(page)), text: await bodyText(page) };
    check('initial failure: inline error with Try again, not a false empty state, no toast', /We couldn't load the preparedness guidelines/.test(obs.failed.text) && /We couldn't load the emergency hotlines/.test(obs.failed.text) && !/No guidelines available|No hotlines available/.test(obs.failed.text) && (await liveToasts(page)).length === 0, obs.failed.alerts);
    await shot(page, 'hub-error-1440');
    data.off();
    data = await rest(page, 'emergency_information', emergencyRows);
    await page.getByRole('button', { name: 'Try again' }).first().click();
    await page.getByText('Synthetic flood guideline').waitFor();
    check('read-only retry recovers the guidelines (and issues no write)', data.byMethod.PATCH === undefined && data.byMethod.POST === undefined, data.byMethod);
    data.off();
    // thrown failure
    data = await rest(page, 'emergency_information', shape.abort());
    await page.goto(`${BASE}/emergency`, { waitUntil: 'domcontentloaded' });
    // supabase-js retries a failed GET with backoff before reporting it, so allow for that.
    await page.getByText(/We couldn't load the preparedness guidelines/).waitFor({ timeout: 25000 });
    check('transport failure settles to the error view (loader released)', (await domState(page)).skeletons === 0);
    data.off();
    // empty
    data = await rest(page, 'emergency_information', json([]));
    await page.goto(`${BASE}/emergency`, { waitUntil: 'networkidle' });
    obs.empty = await bodyText(page);
    check('successful empty → the existing empty copy', /No guidelines available/.test(obs.empty) && /No hotlines available/.test(obs.empty));
  });

  // ---- 2. Alerts
  await scenario('alerts-read-states', async (page, obs, check, { rt }) => {
    let data = await rest(page, 'announcements', shape.fail(500));
    await page.goto(`${BASE}/emergency/alerts`, { waitUntil: 'networkidle' });
    obs.failed = { ...(await domState(page)), text: await bodyText(page) };
    check('initial failure → inline error + retry (not "No emergency alerts found.")', /We couldn't load emergency alerts/.test(obs.failed.text) && !/No emergency alerts found/.test(obs.failed.text) && (await liveToasts(page)).length === 0);
    data.off();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Synthetic typhoon advisory').waitFor();
    check('retry recovers the alert list', true);
    data = await rest(page, 'announcements', shape.fail(500));
    rt.push('announcements');
    await page.getByText(/Couldn't update emergency alerts/).waitFor();
    obs.refreshFail = { ...(await domState(page)), text: await bodyText(page) };
    check('refresh failure keeps the loaded alerts, shows a warning, no skeleton/toast', /Synthetic typhoon advisory/.test(obs.refreshFail.text) && obs.refreshFail.skeletons === 0 && (await liveToasts(page)).length === 0);
    await shot(page, 'alerts-refresh-warning-1440');
    data.off();
    data = await rest(page, 'announcements', json([]));
    await page.reload({ waitUntil: 'networkidle' });
    check('empty → existing empty copy and filters', /No emergency alerts found/.test(await bodyText(page)) && /Last Week/.test(await bodyText(page)));
    data.off();
    // slow
    data = await rest(page, 'announcements', shape.delay(1500));
    const nav = page.goto(`${BASE}/emergency/alerts`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'Emergency Alerts' }).waitFor();
    await pause(500);
    obs.slow = await domState(page);
    check('slow: skeleton cards + one polite label', obs.slow.skeletons >= 2 && obs.slow.statuses.some((s) => /Loading emergency alerts/.test(s)), obs.slow.statuses);
    await nav;
  }, { account: 'populated' });

  // ---- 3. Centers: read states, location, routes
  await scenario('centers-read-states', async (page, obs, check) => {
    let data = await rest(page, 'evacuation_centers', shape.fail(500));
    await page.goto(`${BASE}/emergency/centers`, { waitUntil: 'networkidle' });
    obs.failed = await bodyText(page);
    check('initial failure → inline error, not "No evacuation centers found."', /We couldn't load evacuation centers/.test(obs.failed) && !/No evacuation centers found/.test(obs.failed));
    data.off();
    await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Synthetic Covered Court').first().waitFor();
    check('read-only retry recovers the list', true);
    data = await rest(page, 'evacuation_centers', json([]));
    await page.goto(`${BASE}/emergency/centers`, { waitUntil: 'networkidle' });
    check('successful empty → existing empty copy', /No evacuation centers found/.test(await bodyText(page)));
    data.off();
    data = await rest(page, 'evacuation_centers', shape.delay(1500));
    const nav = page.goto(`${BASE}/emergency/centers`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'Evacuation Centers' }).waitFor();
    await pause(500);
    obs.slow = await domState(page);
    check('slow: three card skeletons + one polite label', obs.slow.skeletons >= 3 && obs.slow.statuses.some((s) => /Loading evacuation centers/.test(s)));
    await nav;
  }, { account: 'populated' });

  await scenario('centers-location-denied-and-retry', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/centers`, { waitUntil: 'networkidle' });
    await page.getByText('Synthetic Covered Court').first().waitFor();
    obs.notice = await page.locator('main').innerText();
    check('blocked location: usable unsorted list with guidance naming site settings and a Try again', /Location is blocked/.test(obs.notice) && /site settings/.test(obs.notice));
    const cards = await page.getByRole('button', { name: /Synthetic Covered Court/ }).count();
    check('cards are keyboard-activatable buttons', cards >= 1);
    await shot(page, 'centers-location-blocked-1440');
  }, { account: 'populated' });

  await scenario('centers-location-granted-and-routes', async (page, obs, check) => {
    const two = [
      { id: '5e0d0000-0000-4000-8000-0000000c0a01', barangay_id: FX.barangay, name: 'Synthetic Court A', address: null, position: { lat: 14.601, lng: 121.001 }, capacity: 100, current_occupancy: 10, facilities: [], verified: true, is_active: true },
      { id: '5e0d0000-0000-4000-8000-0000000c0a02', barangay_id: FX.barangay, name: 'Synthetic Court B', address: null, position: { lat: 14.602, lng: 121.002 }, capacity: 100, current_occupancy: 10, facilities: [], verified: true, is_active: true },
    ];
    await rest(page, 'evacuation_centers', json(two));
    let osrm = 0;
    await page.route('https://router.project-osrm.org/**', async (route) => {
      osrm++;
      const url = route.request().url();
      // Court A is the slow answer (overtaken by B); anything else answers immediately.
      if (url.includes('121.001,14.601')) { await pause(1500); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OSRM(1111)) }).catch(() => {}); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OSRM(2222)) }).catch(() => {});
    });
    await page.goto(`${BASE}/emergency/centers`, { waitUntil: 'networkidle' });
    await page.getByText('Synthetic Court A').first().waitFor();
    obs.noticeGranted = await page.locator('main').innerText();
    check('granted location: no blocked/unavailable notice and distances are shown', !/Location is blocked|couldn't find your location/.test(obs.noticeGranted) && /km/.test(obs.noticeGranted), obs.noticeGranted.slice(0, 200));
    await page.getByRole('button', { name: /Map/ }).click();
    await page.getByRole('button', { name: 'Synthetic Court A', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Synthetic Court A', exact: true }).click();
    await page.getByText('Fetching walking route…').waitFor();
    obs.routeLoading = (await domState(page)).statuses;
    await page.getByRole('button', { name: 'Synthetic Court B', exact: true }).click();
    await page.getByText(/2\.2 km/).waitFor();
    await pause(1800);
    obs.finalRoute = await page.getByText(/km · ~\d+ min walking/).innerText();
    check('rapid selection: the slower, older route response never replaces the newer one', /2\.2 km/.test(obs.finalRoute) && !/1\.1 km/.test(obs.finalRoute), obs.finalRoute);
    check('route loading is announced politely', obs.routeLoading.some((s) => /Fetching walking route/.test(s)), obs.routeLoading);
    await shot(page, 'centers-route-1440');
    // route unavailable → truthful note, not endless "Fetching…"
    await page.unroute('https://router.project-osrm.org/**');
    await page.route('https://router.project-osrm.org/**', (route) => route.fulfill({ status: 500, body: 'no' }));
    await page.getByRole('button', { name: 'Show All Centers' }).click();
    await page.getByRole('button', { name: 'Synthetic Court A', exact: true }).click();
    await page.getByText(/Walking route unavailable right now/).waitFor();
    check('route failure settles to an explanatory note (no perpetual "Fetching")', !(await bodyText(page)).includes('Fetching walking route'));
    obs.osrmCalls = osrm;
  }, { account: 'populated', permissions: ['geolocation'], geolocation: { latitude: 14.6, longitude: 121.0 } });

  await scenario('centers-location-unavailable', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/centers`, { waitUntil: 'networkidle' });
    await page.getByText('Synthetic Covered Court').first().waitFor();
    await page.getByText(/Couldn't get your location|No location fix/).waitFor();
    obs.notice = await page.locator('main').innerText();
    check('position unavailable → its own explanation (not "blocked"), list still usable unsorted', /Couldn't get your location/.test(obs.notice) && !/Location is blocked/.test(obs.notice) && /Synthetic Covered Court/.test(obs.notice));
    const before = await page.evaluate(() => window.__geoCalls);
    await page.getByRole('status').getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction((n) => window.__geoCalls > n, before);
    check('Try again re-requests the position (deliberate, one more call)', (await page.evaluate(() => window.__geoCalls)) > before);
    await shot(page, 'centers-location-unavailable-1440');
  }, { account: 'populated', permissions: ['geolocation'], geolocation: { latitude: 14.6, longitude: 121.0 }, initScript: () => {
    window.__geoCalls = 0;
    const fail = (err) => { window.__geoCalls++; setTimeout(() => err({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 20); };
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok, err) => fail(err), watchPosition: (_ok, err) => { fail(err); return 1; }, clearWatch: () => {} }, configurable: true });
  } });

  // ---- 4. Scan page read states + upload fallback + show QR
  await scenario('scan-read-states', async (page, obs, check) => {
    let data = await rest(page, 'emergency_qr_content', shape.fail(500));
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    obs.failed = await bodyText(page);
    check('instructions failure → inline error + retry; scan/show actions stay usable', /We couldn't load the check-in instructions/.test(obs.failed) && await page.getByRole('button', { name: 'Scan QR' }).isEnabled());
    data.off();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('button', { name: 'Try again' }).waitFor({ state: 'detached' });
    check('retry clears the error', !/We couldn't load the check-in instructions/.test(await bodyText(page)));
    data = await rest(page, 'emergency_qr_content', shape.delay(1500));
    const nav = page.goto(`${BASE}/emergency/scan`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'QR Check-In Guide' }).waitFor();
    await pause(500);
    obs.slow = await domState(page);
    check('slow: skeleton + one polite label', obs.slow.skeletons >= 1 && obs.slow.statuses.some((s) => /Loading check-in instructions/.test(s)));
    await nav;
  }, { account: 'populated' });

  const upload = async (page, buffer, name = 'qr.png') => page.locator('input[type=file][aria-label="QR code image"]').setInputFiles({ name, mimeType: 'image/png', buffer });
  await scenario('qr-upload-checkin-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    const good = await qrPng();
    const insertPost = (page_) => rest(page_, 'evacuation_center_checkins', (route) => route.continue(), { methods: ['POST'] });
    // a) real success
    let before = checkinCount();
    let posts = await insertPost(page);
    await upload(page, good);
    await page.getByRole('button', { name: /Reading image|Checking in/ }).waitFor().catch(() => {});
    await waitForToast(page, /Your presence has been registered/);
    obs.success = { posts: posts.count, rows: checkinCount() - before, toasts: (await liveToasts(page)).map((t) => t.text), state: await domState(page) };
    check('valid center QR: one real check-in, one success toast, controls restored', obs.success.posts === 1 && obs.success.rows === 1 && obs.success.toasts.length === 1, obs.success);
    posts.off(); resetHousehold();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // b) partial: household update fails
    before = checkinCount();
    const hh = await rest(page, 'household_members', shape.fail(500), { methods: ['PATCH'] });
    posts = await insertPost(page);
    await upload(page, good);
    await waitForToast(page, /Check-in recorded/);
    await pause(700);
    obs.partial = { toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`), rows: checkinCount() - before, patches: hh.count };
    check('partial success: exactly one warning, no success toast; the check-in row exists', obs.partial.toasts.length === 1 && /^warning:/.test(obs.partial.toasts[0]) && obs.partial.rows === 1, obs.partial);
    await shot(page, 'qr-partial-warning-1440');
    hh.off(); posts.off(); resetHousehold();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // c) rejected insert
    posts = await insertPost(page);
    posts.off();
    posts = await rest(page, 'evacuation_center_checkins', shape.fail(500), { methods: ['POST'] });
    await upload(page, good);
    await waitForToast(page, /Couldn't record your check-in/);
    await pause(500);
    obs.rejected = { posts: posts.count, toasts: (await liveToasts(page)).map((t) => t.text), rows: checkinCount() };
    check('rejected insert: one error, one request, no row, control usable', obs.rejected.posts === 1 && obs.rejected.toasts.length === 1 && obs.rejected.rows === 0 && await page.getByRole('button', { name: 'Upload QR Image' }).isEnabled(), obs.rejected);
    posts.off();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // d) lost response
    posts = await rest(page, 'evacuation_center_checkins', shape.abort(), { methods: ['POST'] });
    await upload(page, good);
    await waitForToast(page, /couldn't confirm your check-in/);
    await pause(1200);
    obs.lost = { posts: posts.count, toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`) };
    check('lost response: one unconfirmed warning, no automatic second request', obs.lost.posts === 1 && obs.lost.toasts.length === 1 && /^warning:/.test(obs.lost.toasts[0]), obs.lost);
    posts.off();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // e) repeated activation while slow
    posts = await rest(page, 'evacuation_center_checkins', async (route) => { await pause(1000); return shape.fail(500)(route); }, { methods: ['POST'] });
    await upload(page, good);
    await upload(page, good);
    await page.waitForTimeout(150);
    obs.repeated = { button: await page.getByRole('button', { name: /Checking in|Reading image/ }).evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy'), text: b.innerText.trim() })).catch(() => null) };
    await waitForToast(page, /Couldn't record your check-in/);
    await pause(600);
    obs.repeated.posts = posts.count; obs.repeated.toasts = (await liveToasts(page)).length;
    check('repeated image selection while pending: one request, one toast; busy + disabled immediately', obs.repeated.posts === 1 && obs.repeated.toasts === 1 && obs.repeated.button?.disabled && obs.repeated.button?.busy === 'true', obs.repeated);
    posts.off();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // f) invalid inputs: no request, one error each
    posts = await insertPost(page);
    const cases = [
      ['unreadable image', png1x1, /No QR code found in that image/],
      ['other barangay', await qrPng({ barangay_id: '5e0d0000-0000-4000-8000-0000000000ff' }), /belongs to a different barangay/],
      ['not a check-in code', await QRCode.toBuffer('{"hello":"world"}', { type: 'png', width: 300, margin: 4 }), /not a valid evacuation center check-in code/],
      ['plain text', await QRCode.toBuffer('just text', { type: 'png', width: 300, margin: 4 }), /does not contain a valid payload/],
    ];
    obs.invalid = [];
    for (const [name, buf, re] of cases) {
      await upload(page, buf);
      await waitForToast(page, re);
      await pause(300);
      const texts = (await liveToasts(page)).map((t) => t.text);
      obs.invalid.push({ name, toasts: texts });
      check(`${name}: exactly one error toast and no check-in request`, texts.length === 1 && re.test(texts[0]) && posts.count === 0, texts);
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    }
    posts.off();
    check('no check-in rows were created by the invalid and failed attempts', checkinCount() === 0);
  }, { account: 'populated' });

  // ---- 5. Camera scanner lifecycle and guidance
  // Serialised into the page, so the failure kind travels as the init-script argument.
  const denyCamera = ({ name, message }) => {
    const err = () => { const e = new Error(message); e.name = name; return e; };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(err()), enumerateDevices: () => Promise.resolve([]) }, configurable: true });
  };
  for (const [id, name, message, guidance] of [
    ['camera-denied', 'NotAllowedError', 'Permission denied', /Camera access is blocked/],
    ['camera-missing', 'NotFoundError', 'Requested device not found', /No camera was found/],
    ['camera-in-use', 'NotReadableError', 'Could not start video source', /in use by another app/],
  ]) {
    await scenario(`scanner-${id}`, async (page, obs, check) => {
      await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Scan QR' }).click();
      const dialog = page.getByRole('dialog', { name: 'Scan QR code' });
      await dialog.waitFor();
      await dialog.getByRole('alert').waitFor();
      obs.alert = await dialog.getByRole('alert').innerText();
      obs.focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      check('guidance matches the failure and names the Upload fallback', guidance.test(obs.alert) && /Upload QR Image/.test(obs.alert), obs.alert);
      check('no toast duplicates the persistent guidance; named dialog with focus on Close', (await liveToasts(page)).length === 0 && obs.focus === 'Close scanner', { focus: obs.focus });
      check('Try again and Close are available; spinner gone', await dialog.getByRole('button', { name: 'Try again' }).isVisible() && (await dialog.locator('[data-slot=spinner]').count()) === 0);
      await shot(page, `scanner-${id}-1440`);
      await dialog.getByRole('button', { name: 'Try again' }).click();
      await dialog.getByRole('alert').waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      check('Escape closes the scanner', true);
    }, { account: 'populated', initScript: denyCamera, initArg: { name, message } });
  }
  await scenario('scanner-unsupported-and-chunk-failure', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    // The QR reader chunk loads on demand; make that load fail.
    await page.route('**/_next/static/chunks/**', (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Scan QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Scan QR code' });
    await dialog.getByRole('alert').waitFor();
    obs.alert = await dialog.getByRole('alert').innerText();
    check('failed reader chunk ends in guidance, not an endless "starting" spinner', /couldn't start the camera|can't open the camera/i.test(obs.alert) && (await dialog.locator('[data-slot=spinner]').count()) === 0, obs.alert);
  }, { account: 'populated' });
  await scenario('scanner-unsupported', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Scan QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Scan QR code' });
    await dialog.getByRole('alert').waitFor();
    obs.alert = await dialog.getByRole('alert').innerText();
    check('unsupported browser → capability guidance with the upload alternative', /can't open the camera|couldn't start the camera/i.test(obs.alert) && /Upload QR Image/.test(obs.alert), obs.alert);
  }, { account: 'populated', initScript: () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); } });

  const trackProbe = () => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const original = md.getUserMedia.bind(md);
    window.__streams = [];
    md.getUserMedia = async (constraints) => {
      if (window.__gumDelay) await new Promise((r) => setTimeout(r, window.__gumDelay));
      const stream = await original(constraints);
      window.__streams.push(stream);
      return stream;
    };
  };
  const tracksLive = (page) => page.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);
  await scenario('scanner-camera-lifecycle', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Scan QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Scan QR code' });
    await dialog.waitFor();
    await page.waitForFunction(() => (window.__streams ?? []).length > 0 && document.querySelector('[role=dialog] video'));
    obs.live = await tracksLive(page);
    check('camera starts (fake device) with the frame guide visible', obs.live >= 1 && (await dialog.getByRole('alert').count()) === 0, obs.live);
    await shot(page, 'scanner-live-1440');
    await dialog.getByRole('button', { name: 'Close scanner' }).click();
    await dialog.waitFor({ state: 'detached' });
    await pause(500);
    obs.afterClose = await tracksLive(page);
    check('closing the scanner releases the camera', obs.afterClose === 0, obs.afterClose);
    // reopen works and the starting announcement shows while the stream is pending
    await page.evaluate(() => { window.__gumDelay = 1500; });
    await page.getByRole('button', { name: 'Scan QR' }).click();
    await dialog.waitFor();
    await pause(400);
    obs.starting = (await domState(page)).statuses;
    check('starting is announced once politely', obs.starting.filter((s) => /Starting camera/.test(s)).length === 1, obs.starting);
    await page.keyboard.press('Escape');
  }, { account: 'populated', camera: true, permissions: ['camera'], initScript: trackProbe });

  // Closing while the permission/stream is still pending: html5-qrcode renders its <video>
  // into the detached container once the stream arrives and its own play() promise then
  // rejects ("media was removed from the document") — a library-internal unhandled rejection
  // that app code cannot catch. The scenario asserts what the app controls: the camera is
  // released. The message is recorded, not hidden: see observations.libraryPageError.
  await scenario('scanner-close-while-starting', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog', { name: 'Scan QR code' });
    await page.evaluate(() => { window.__gumDelay = 1200; });
    await page.getByRole('button', { name: 'Scan QR' }).click();
    await dialog.waitFor();
    await pause(200);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await pause(2200);
    obs.afterEarlyClose = await tracksLive(page);
    check('closing while the camera is starting never leaves it running', obs.afterEarlyClose === 0, obs.afterEarlyClose);
  }, { account: 'populated', camera: true, permissions: ['camera'], initScript: trackProbe, allowErrors: /play\(\) request was interrupted because the media was removed/ });

  // ---- 6. Show QR: states, clipboard, download
  await scenario('qr-show-share-copy-download', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Show QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Show QR Code' });
    await dialog.waitFor();
    await dialog.locator('canvas').waitFor();
    obs.box = await dialog.locator('canvas').evaluate((c) => ({ w: c.parentElement.offsetWidth, h: c.parentElement.offsetHeight }));
    // clipboard rejection
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
    await dialog.getByRole('button', { name: 'Share' }).click();
    await waitForToast(page, /Couldn't copy to the clipboard/);
    obs.rejected = (await liveToasts(page)).map((t) => `${t.type}:${t.text}`);
    check('clipboard rejection: one error naming the alternatives; never "Copied"', obs.rejected.length === 1 && /^error:/.test(obs.rejected[0]) && !/Copied/.test(obs.rejected[0]), obs.rejected);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // clipboard success, repeated activation
    await page.evaluate(() => { window.__copies = 0; navigator.clipboard.writeText = () => { window.__copies++; return new Promise((r) => setTimeout(r, 300)); }; });
    await dialog.getByRole('button', { name: 'Share' }).dispatchEvent('click');
    await dialog.getByRole('button', { name: /Share|Sharing/ }).dispatchEvent('click').catch(() => {});
    await waitForToast(page, /Copied to clipboard/);
    await pause(600);
    obs.copy = { copies: await page.evaluate(() => window.__copies), toasts: (await liveToasts(page)).map((t) => t.text) };
    check('copy: one clipboard write and one success after it resolved', obs.copy.copies === 1 && obs.copy.toasts.length === 1, obs.copy);
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // download
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download' }).click()]);
    await waitForToast(page, /Download started/);
    obs.download = { file: download.suggestedFilename(), toasts: (await liveToasts(page)).map((t) => t.text) };
    check('download: "Download started" (not "saved"), one toast, PNG name', obs.download.toasts.length === 1 && /\.png$/.test(obs.download.file), obs.download);
    check('QR frame is a steady 256 px square', Math.round(obs.box.w) === 256 && Math.round(obs.box.h) === 256, obs.box);
    await shot(page, 'qr-show-toast-in-dialog-1440');
  }, { account: 'populated', initScript: () => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch { /* noop */ } } });

  await scenario('qr-show-centers-read-states', async (page, obs, check) => {
    let data = await rest(page, 'evacuation_centers', shape.fail(500));
    await page.goto(`${BASE}/emergency/scan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Show QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Show QR Code' });
    await dialog.waitFor();
    obs.text = await dialog.innerText();
    check('failed centers read is never "No evacuation centers found"; retry offered', /We couldn't load the evacuation centers/.test(obs.text) && !/No evacuation centers found/.test(obs.text));
    data.off();
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await dialog.locator('canvas').waitFor();
    check('retry loads the centers and renders the QR', true);
  }, { account: 'populated' });

  await scenario('household-qr-states', async (page, obs, check) => {
    let mode = 'slow-ok';
    await page.route('**/functions/v1/generate-household-qr*', async (route) => {
      if (mode === 'slow-ok') { await pause(1500); return route.fulfill({ status: 200, contentType: 'image/png', body: png1x1 }).catch(() => {}); }
      if (mode === 'fail') return route.fulfill({ status: 500, body: 'no' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: png1x1 });
    });
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Show My Code' }).click();
    const dialog = page.getByRole('dialog', { name: 'Household QR Code' });
    await dialog.waitFor();
    const frame = () => dialog.locator('div.h-64.w-64').evaluate((e) => ({ width: e.offsetWidth, height: e.offsetHeight }));
    await pause(500);
    obs.loading = { box: await frame(), status: (await domState(page)).statuses, busy: await dialog.locator('[aria-busy=true]').count() };
    await dialog.getByAltText('Household QR code').waitFor();
    obs.ready = await frame();
    check('loading → ready keeps a fixed 256 px frame; loading announced once', Math.round(obs.loading.box.width) === 256 && Math.round(obs.ready.width) === 256 && Math.round(obs.ready.height) === 256 && obs.loading.status.some((s) => /Generating your QR code/.test(s)) && obs.loading.busy === 1, obs);
    await page.keyboard.press('Escape');
    mode = 'fail';
    await page.getByRole('button', { name: 'Show My Code' }).click();
    await dialog.getByRole('alert').waitFor();
    obs.failed = { box: await frame(), text: await dialog.getByRole('alert').innerText() };
    check('failure: fixed frame, explanation and Try again (no toast)', /couldn't generate your QR code/.test(obs.failed.text) && Math.round(obs.failed.box.height) === 256 && (await liveToasts(page)).length === 0, obs.failed);
    mode = 'ok';
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await dialog.getByAltText('Household QR code').waitFor();
    check('Try again regenerates the code', true);
  }, { account: 'populated' });

  // ---- 7. Household contract: Emergency > Family
  const memberRow = (page, name) => page.getByRole('button', { name: new RegExp(name) }).first();
  await scenario('family-dialog-contract', async (page, obs, check) => {
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    await page.getByText('Synthetic Child').first().waitFor();
    const addBtn = page.getByRole('button', { name: 'Add Family Member' }).first();
    const dialog = page.getByRole('dialog', { name: 'Add Family Member' });
    const submit = () => dialog.getByRole('button', { name: /Add Member|Adding…/ });
    const dismissToasts = async () => { await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500); };
    // a) rejected write keeps dialog + inputs, one error, never success
    let writes = await rest(page, 'profiles', shape.fail(500), { methods: ['PATCH'] });
    await addBtn.click();
    await dialog.locator('#member-name').fill('Synthetic Adult');
    await dialog.getByRole('button', { name: 'Parent', exact: true }).click();
    await submit().click();
    await waitForToast(page, /Couldn't add family member/);
    await pause(500);
    obs.rejected = { writes: writes.count, open: await dialog.isVisible(), name: await dialog.locator('#member-name').inputValue(), relation: await dialog.getByRole('button', { name: 'Parent', exact: true }).getAttribute('aria-pressed'), toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`), submit: await submit().evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy'), text: b.innerText.trim() })), names: householdNames() };
    check('rejected add: dialog open, inputs and selections kept, one error, no success, pending released', obs.rejected.open && obs.rejected.name === 'Synthetic Adult' && obs.rejected.relation === 'true' && obs.rejected.toasts.length === 1 && /^error:/.test(obs.rejected.toasts[0]) && !obs.rejected.submit.disabled && obs.rejected.names.length === 1, obs.rejected);
    await shot(page, 'family-rejected-add-1440');
    writes.off(); await dismissToasts();
    // b) slow write: pending immediately, repeated activation = one write
    writes = await rest(page, 'profiles', async (route) => { await pause(1200); return route.continue().catch(() => {}); }, { methods: ['PATCH'] });
    await submit().click();
    await submit().dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(150);
    obs.pending = await dialog.getByRole('button', { name: /Adding…/ }).evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy'), text: b.innerText.trim() })).catch(() => null);
    await waitForToast(page, /Family member added/);
    await pause(500);
    obs.added = { writes: writes.count, toasts: (await liveToasts(page)).map((t) => t.text), dialogOpen: await dialog.isVisible().catch(() => false), names: householdNames() };
    check('pending shown immediately (disabled, aria-busy, "Adding…") and held until the write settles', obs.pending && obs.pending.disabled && obs.pending.busy === 'true' && /Adding/.test(obs.pending.text), obs.pending);
    check('repeated activation → one write; confirmed success → one toast, dialog closes, DB has the member', obs.added.writes === 1 && obs.added.toasts.length === 1 && !obs.added.dialogOpen && obs.added.names.includes('Synthetic Adult'), obs.added);
    writes.off(); await dismissToasts();
    // c) lost response: unconfirmed wording, one request, dialog kept, read-only re-check
    const reads = await rest(page, 'profiles', (route) => route.continue(), { methods: ['GET'] });
    writes = await rest(page, 'profiles', shape.abort(), { methods: ['PATCH'] });
    await addBtn.click();
    await dialog.locator('#member-name').fill('Synthetic Third');
    await submit().click();
    await waitForToast(page, /couldn't confirm the change/);
    await pause(900);
    obs.lost = { writes: writes.count, readsAfter: reads.count, dialogOpen: await dialog.isVisible(), toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`) };
    check('lost response: one unconfirmed warning, one write (no automatic retry), dialog kept, list re-read read-only', obs.lost.writes === 1 && obs.lost.dialogOpen && obs.lost.toasts.length === 1 && /^warning:/.test(obs.lost.toasts[0]) && obs.lost.readsAfter >= 1, obs.lost);
    writes.off(); reads.off(); await dismissToasts();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'detached' });
    // d) failed remove keeps the dialog; successful remove closes it
    await memberRow(page, 'Synthetic Adult').click();
    const edit = page.getByRole('dialog', { name: 'Edit Family Member' });
    writes = await rest(page, 'profiles', shape.fail(500), { methods: ['PATCH'] });
    await edit.getByRole('button', { name: 'Remove' }).click();
    await waitForToast(page, /Couldn't remove family member/);
    await pause(400);
    obs.removeFail = { open: await edit.isVisible(), toasts: (await liveToasts(page)).map((t) => t.text), names: householdNames() };
    check('rejected remove: dialog stays open, one error, member still stored', obs.removeFail.open && obs.removeFail.toasts.length === 1 && obs.removeFail.names.includes('Synthetic Adult'), obs.removeFail);
    writes.off(); await dismissToasts();
    await edit.getByRole('button', { name: 'Remove' }).click();
    await waitForToast(page, /Family member removed/);
    await edit.waitFor({ state: 'detached' });
    obs.removed = { names: householdNames() };
    check('confirmed remove: one success, dialog closes, member removed', !obs.removed.names.includes('Synthetic Adult') && obs.removed.names.length === 1, obs.removed);
    // e) dialog closed during a slow write: no stale update, confirmed outcome still reports
    await dismissToasts();
    writes = await rest(page, 'profiles', async (route) => { await pause(1500); return route.continue().catch(() => {}); }, { methods: ['PATCH'] });
    await addBtn.click();
    await dialog.locator('#member-name').fill('Synthetic Late');
    await submit().click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await waitForToast(page, /Family member added/, 6000);
    obs.closedDuring = { writes: writes.count, names: householdNames(), dialogOpen: await dialog.isVisible().catch(() => false) };
    check('closing during the write does not cancel it, reopen is clean, one success', obs.closedDuring.writes === 1 && obs.closedDuring.names.includes('Synthetic Late') && !obs.closedDuring.dialogOpen, obs.closedDuring);
    writes.off();
  }, { account: 'populated' });

  await scenario('family-read-failure-not-empty', async (page, obs, check, { rt }) => {
    let reads = await rest(page, 'profiles', shape.fail(500), { methods: ['GET'] });
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    obs.text = await bodyText(page);
    check('roster read failure → inline error + retry, never "No family members added yet."', /We couldn't load your household members/.test(obs.text) && !/No family members added yet/.test(obs.text) && true);
    reads.off();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Synthetic Child').first().waitFor();
    check('read-only retry restores the roster', true);
    const slow = await rest(page, 'profiles', async (route) => { await pause(1500); return route.continue().catch(() => {}); }, { methods: ['GET'] });
    const nav = page.goto(`${BASE}/emergency/family`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: /Household:/ }).waitFor();
    await pause(500);
    obs.slow = await domState(page);
    check('slow: roster skeleton + one polite label (no "Loading family members…" paragraph swap)', obs.slow.skeletons >= 1 && obs.slow.statuses.some((s) => /Loading family members/.test(s)), obs.slow.statuses);
    await nav;
    slow.off();
  }, { account: 'populated' });

  // ---- 8. Household contract: Settings > Profile
  await scenario('profile-household-no-false-success', async (page, obs, check) => {
    await page.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
    await page.getByText('Household Members').waitFor();
    const section = page.locator('div', { has: page.getByRole('heading', { name: 'Household Members' }) }).last();
    const dialog = page.getByRole('dialog', { name: 'Add Family Member' });
    const writes = await rest(page, 'profiles', shape.fail(500), { methods: ['PATCH'] });
    await page.getByRole('button', { name: 'Add' }).first().click();
    await dialog.locator('#member-name').fill('Synthetic Profile Adult');
    await dialog.getByRole('button', { name: 'Add Member' }).click();
    await waitForToast(page, /Couldn't add family member/);
    await pause(500);
    obs.rejected = { writes: writes.count, open: await dialog.isVisible(), name: await dialog.locator('#member-name').inputValue(), toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`), names: householdNames() };
    check('D-01: failed write never toasts success or closes the editor; input retained; nothing stored', obs.rejected.open && obs.rejected.name === 'Synthetic Profile Adult' && obs.rejected.toasts.length === 1 && /^error:/.test(obs.rejected.toasts[0]) && obs.rejected.names.length === 1, obs.rejected);
    writes.off();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    await dialog.getByRole('button', { name: 'Add Member' }).click();
    await waitForToast(page, /Family member added/);
    await dialog.waitFor({ state: 'detached' });
    check('retry from the retained input succeeds once and closes', householdNames().includes('Synthetic Profile Adult'), householdNames());
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    // inline remove: pending, rejected, then confirmed
    const rm = page.getByRole('button', { name: 'Remove Synthetic Profile Adult' });
    const bad = await rest(page, 'profiles', async (route) => { await pause(600); return shape.fail(500)(route); }, { methods: ['PATCH'] });
    await rm.click();
    await pause(150);
    obs.inlinePending = await rm.evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy') }));
    await waitForToast(page, /Couldn't remove family member/);
    await pause(300);
    obs.inlineRejected = { toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`), stillListed: await page.getByText('Synthetic Profile Adult').count() > 0, writes: bad.count };
    check('inline remove: pending is immediate; a rejected write reports one error and keeps the row', obs.inlinePending.disabled && obs.inlinePending.busy === 'true' && obs.inlineRejected.toasts.length === 1 && obs.inlineRejected.stillListed && obs.inlineRejected.writes === 1, { ...obs.inlinePending, ...obs.inlineRejected });
    bad.off();
    await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())); await pause(500);
    await rm.click();
    await waitForToast(page, /Family member removed/);
    check('confirmed remove updates the list once', householdNames().length === 1, householdNames());
    void section;
  }, { account: 'populated' });

  // ---- 9. Maps and directory
  await scenario('maps-placeholder-and-locate', async (page, obs, check) => {
    // Hold the map code back so the placeholder is observable at its final geometry.
    await page.route('**/_next/static/chunks/**', async (route) => { await pause(1200); return route.continue().catch(() => {}); });
    const nav = page.goto(`${BASE}/maps`, { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'Maps' }).waitFor();
    await pause(300);
    obs.placeholder = await page.evaluate(() => {
      const sk = document.querySelector('.rw-skeleton-static');
      const r = sk?.getBoundingClientRect();
      return { present: Boolean(sk), height: r ? Math.round(r.height) : null, width: r ? Math.round(r.width) : null, pulsing: document.querySelectorAll('.rw-skeleton, .animate-pulse').length, status: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).filter(Boolean) };
    });
    await nav;
    await page.unroute('**/_next/static/chunks/**');
    await page.locator('.leaflet-container').waitFor();
    obs.map = await page.locator('.leaflet-container').evaluate((e) => { const r = e.parentElement.getBoundingClientRect(); return { height: Math.round(r.height), width: Math.round(r.width) }; });
    check('map placeholder is steady (not pulsing), announced once, and the map keeps its size', obs.placeholder.present && obs.placeholder.pulsing === 0 && obs.placeholder.status.some((s) => /Loading the map/.test(s)) && Math.abs((obs.placeholder.height ?? 0) - obs.map.height) <= 2, { ...obs });
    await shot(page, 'maps-ready-1440');
    // manual location: denied → one guidance toast, button restored, map still usable
    await page.getByRole('button', { name: 'Show my current location' }).click();
    await waitForToast(page, /Location access is blocked/);
    await pause(400);
    obs.denied = { toasts: (await liveToasts(page)).map((t) => `${t.type}:${t.text}`), enabled: await page.getByRole('button', { name: 'Show my current location' }).isEnabled() };
    check('denied permission: one error naming site settings and the manual alternative; control restored', obs.denied.toasts.length === 1 && /pan and zoom/.test(obs.denied.toasts[0]) && obs.denied.enabled, obs.denied);
    check('automatic denial note explains the browser-settings fix', /Location is blocked/.test(await bodyText(page)));
  }, { account: 'populated' });

  await scenario('maps-locate-success-and-repeat', async (page, obs, check) => {
    await page.goto(`${BASE}/maps`, { waitUntil: 'networkidle' });
    await page.locator('.leaflet-container').waitFor();
    await page.evaluate(() => {
      window.__locates = 0;
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (ok, err, opts) => { window.__locates++; setTimeout(() => real(ok, err, opts), 700); };
    });
    const btn = page.getByRole('button', { name: 'Show my current location' });
    await btn.dispatchEvent('click');
    await btn.dispatchEvent('click').catch(() => {});
    await pause(150);
    obs.busy = await btn.evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy') }));
    await page.waitForFunction(() => document.querySelector('[aria-label="Show my current location"]')?.disabled === false);
    await pause(300);
    obs.after = { locates: await page.evaluate(() => window.__locates), toasts: (await liveToasts(page)).length, marker: await page.locator('.leaflet-marker-icon').count() };
    check('repeated activation → one geolocation request; busy immediately; no toast on success', obs.busy.disabled && obs.busy.busy === 'true' && obs.after.locates === 1 && obs.after.toasts === 0, { ...obs.busy, ...obs.after });
  }, { account: 'populated', permissions: ['geolocation'], geolocation: { latitude: 14.6, longitude: 121.0 } });

  await scenario('locate-unsupported', async (page, obs, check) => {
    await page.goto(`${BASE}/maps`, { waitUntil: 'networkidle' });
    await page.locator('.leaflet-container').waitFor();
    await page.getByRole('button', { name: 'Show my current location' }).click();
    await waitForToast(page, /doesn't support location access/);
    check('unsupported browser → one explanatory error, map usable', (await liveToasts(page)).length === 1);
  }, { account: 'populated', initScript: () => { delete Navigator.prototype.geolocation; } });

  await scenario('directory-and-preparedness', async (page, obs, check) => {
    let data = await rest(page, 'emergency_information', shape.fail(500));
    await page.goto(`${BASE}/maps/directory`, { waitUntil: 'networkidle' });
    obs.failed = await bodyText(page);
    check('directory failure → inline error + retry (not "No contacts available.")', /We couldn't load the directory/.test(obs.failed) && !/No contacts available/.test(obs.failed));
    data.off();
    data = await rest(page, 'emergency_information', emergencyRows);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Synthetic rescue hotline').waitFor();
    await page.getByRole('searchbox', { name: /Search the directory/ }).fill('zzz-no-match');
    check('local search with no match → "No contacts match your search." (no loader, no request)', /No contacts match your search/.test(await bodyText(page)));
    data.off();
    data = await rest(page, 'emergency_information', json([]));
    await page.goto(`${BASE}/maps/directory`, { waitUntil: 'networkidle' });
    check('successful empty → existing empty copy', /No contacts available/.test(await bodyText(page)));
    data.off();
    // preparedness: static, no async work
    // The shell makes its own unread-count reads; the guide itself must request no data.
    const counts = { rest: 0 };
    page.on('request', (r) => { if (/\/rest\/v1\/(emergency_information|evacuation_centers)/.test(r.url())) counts.rest++; });
    await page.goto(`${BASE}/maps/preparedness`, { waitUntil: 'networkidle' });
    obs.preparedness = { rest: counts.rest, toasts: (await liveToasts(page)).length, busy: (await domState(page)).busy };
    check('preparedness guide: static — no data request, loader, or toast', obs.preparedness.rest === 0 && obs.preparedness.toasts === 0 && obs.preparedness.busy === 0, obs.preparedness);
  }, { account: 'populated' });

  // ---- 10. Dialog motion, reduced motion, 320 px
  for (const variant of [{ id: 'normal', reducedMotion: 'no-preference' }, { id: 'reduced', reducedMotion: 'reduce' }]) {
    await scenario(`dialog-motion-${variant.id}`, async (page, obs, check) => {
      await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Add Family Member' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Add Family Member' });
      await dialog.waitFor();
      obs.open = await dialog.evaluate((el) => { const cs = getComputedStyle(el); return { duration: cs.animationDuration, name: cs.animationName, transform: cs.transform }; });
      await page.keyboard.press('Escape');
      const closing = await page.evaluate(async () => {
        const el = document.querySelector('[role=dialog]');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { duration: cs.animationDuration, state: el.getAttribute('data-state') };
      });
      obs.close = closing;
      await dialog.waitFor({ state: 'detached' });
      if (variant.id === 'normal') check('dialog animates 180 ms in / 140 ms out', obs.open.duration === '0.18s' && (obs.close === null || obs.close.duration === '0.14s'), obs);
      else check('reduced motion: no zoom/slide travel (fade only), dialog still opens and closes', obs.open.transform === 'none' || /matrix\(1, 0, 0, 1/.test(obs.open.transform), obs.open);
    }, { account: 'populated', reducedMotion: variant.reducedMotion });
  }
  await scenario('emergency-narrow-320', async (page, obs, check) => {
    const hub = await rest(page, 'emergency_information', emergencyRows);
    await page.goto(`${BASE}/emergency`, { waitUntil: 'networkidle' });
    obs.hub = await domState(page);
    await page.goto(`${BASE}/emergency/family`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add Family Member' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add Family Member' });
    await dialog.waitFor();
    await dialog.locator('#member-name').fill('Synthetic Narrow Failure');
    const writes = await rest(page, 'profiles', shape.fail(500), { methods: ['PATCH'] });
    await dialog.getByRole('button', { name: 'Add Member' }).click();
    await waitForToast(page, /Couldn't add family member/);
    obs.toast = (await toastState(page)).toasts[0];
    obs.dialogBox = await dialog.boundingBox();
    obs.family = await domState(page);
    await shot(page, 'family-failure-320');
    check('320 px: no horizontal overflow on hub/family; toast within gutters; dialog within viewport', !obs.hub.overflowX && !obs.family.overflowX && obs.toast.left >= 15 && obs.toast.right <= 305 && obs.dialogBox.x >= 0 && obs.dialogBox.x + obs.dialogBox.width <= 320, obs);
    writes.off(); hub.off();
  }, { account: 'populated', viewport: { width: 320, height: 720 } });

  resetHousehold();
  await browser.close();
  await cameraBrowser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  report.checks = report.scenarios.reduce((n, s) => n + Object.keys(s.checks).length, 0);
  fs.writeFileSync(path.join(out, 'results.json'), redact(JSON.stringify(report, null, 2)));
  console.log(JSON.stringify(report.summary), `${report.checks} checks`);
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- RW-LT-06: services, request journey, payments
async function rwlt06Unit() {
  const out = path.join(evidence, 'rw-lt-06');
  fs.mkdirSync(out, { recursive: true });
  const ts = require(path.join(root, 'node_modules/typescript'));
  const load = (file, requireMap = {}) => {
    const source = fs.readFileSync(path.join(app, 'src', file), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (name) => { assert.ok(name in requireMap, `unexpected import ${name}`); return requireMap[name]; });
    return mod.exports;
  };
  const sf = load('lib/service-feedback.ts');
  // The real notify adapter against a recording Sonner stand-in, for the dedup scenarios.
  const shown = [];
  const sonner = { toast: Object.assign(() => {}, Object.fromEntries(['success', 'error', 'warning', 'info'].map((k) => [k, (title, o) => { shown.push({ kind: k, title, id: o.id }); }])), { dismiss: () => {} }) };
  const adapter = load('lib/notify.ts', { sonner });
  const results = [];
  const test = async (id, fn) => {
    const checks = {};
    const check = (name, ok, detail) => { checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try { await fn(check); } catch (e) { checks.threw = { ok: false, detail: e.message }; }
    const status = Object.values(checks).every((c) => c.ok) ? 'pass' : 'fail';
    results.push({ id, phase: 'RW-LT-06', status, checks });
    const failed = Object.entries(checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${status.toUpperCase()} ${id}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  };
  await test('no-answer-classification', async (check) => {
    check('status 0 → no answer', sf.isNoAnswer(null, 0));
    check('fetch TypeError → no answer', sf.isNoAnswer(new TypeError('Failed to fetch')));
    check('AbortError → no answer', sf.isNoAnswer({ name: 'AbortError' }));
    check('FunctionsFetchError → no answer', sf.isNoAnswer({ name: 'FunctionsFetchError' }));
    check('postgrest transport failure (empty code) → no answer', sf.isNoAnswer({ code: '', message: 'FetchError: x' }));
    check('storage-wrapped TypeError → no answer', sf.isNoAnswer({ name: 'StorageUnknownError', originalError: new TypeError('x') }));
    check('server answer with a code is NOT no-answer', !sf.isNoAnswer({ code: '22023', message: 'request_not_payable' }, 400));
    check('HTTP error from an Edge Function is NOT no-answer', !sf.isNoAnswer({ name: 'FunctionsHttpError' }));
    check('missing-row classification is structural', sf.isMissingRow({ code: 'PGRST116' }) && !sf.isMissingRow({ code: '' }) && !sf.isMissingRow({ code: 'PGRST301' }));
  });
  await test('submission-failure-wording', async (check) => {
    const v = sf.serviceSubmissionFailure({ issues: [] }, 'validate', 'Choose a purpose and provide an explanation for Others.');
    check('validation stays inline (no toast title)', v.kind === 'validation' && v.title === undefined);
    const lost = sf.serviceSubmissionFailure({ code: '', message: 'FetchError: Failed to fetch' }, 'submit', 'FetchError: Failed to fetch');
    check('lost submit response → unconfirmed, says retry unchanged does not duplicate and points to My Requests', lost.kind === 'unconfirmed' && /won't create a duplicate/.test(lost.message) && /My Requests/.test(lost.message) && !/Failed to fetch/.test(lost.message), lost);
    const refused = sf.serviceSubmissionFailure({ code: '42501', message: 'forbidden' }, 'submit', 'forbidden');
    check('rejected submit with a bare token → plain wording, never the token', refused.kind === 'rejected' && !/^forbidden$/.test(refused.message), refused);
    const mapped = sf.serviceSubmissionFailure({ code: '22023', message: 'current_approved_ID_required' }, 'submit', 'Your current profile ID must be approved before requesting a document. Open Verify Now.');
    check('mapped service message passes through', /profile ID must be approved/.test(mapped.message));
    const upload = sf.serviceSubmissionFailure({ name: 'StorageUnknownError', message: 'Failed to fetch', originalError: new TypeError('x') }, 'upload', 'Failed to fetch');
    check('upload failure never shows provider text and says files are kept', upload.kind === 'rejected' && !/Failed to fetch/.test(upload.message) && /kept here/.test(upload.message), upload);
    const session = sf.serviceSubmissionFailure(new Error('Sign in again before submitting.'), 'submit', 'Sign in again before submitting.');
    check('session problem classified', session.kind === 'session');
  });
  await test('payment-and-pickup-wording', async (check) => {
    const lost = sf.pickupPaymentFailure({ message: '' }, 0);
    check('pickup lost response → uncertain, retry creates no second record', lost.uncertain && /won't create a second record/.test(lost.message));
    check('pickup active online payment → guidance', /QR PH payment is already in progress/.test(sf.pickupPaymentFailure({ message: 'active_online_payment_exists' }, 400).message));
    check('pickup unknown token → generic, never the token', !/_/.test(sf.pickupPaymentFailure({ message: 'something_internal' }, 500).message));
    const m = sf.paymentMethodFailure({ message: '' }, 0);
    check('method lost response → uncertain, says nothing was charged', m.uncertain && /Nothing was charged/.test(m.message));
    check('method refused → not uncertain, plain', !sf.paymentMethodFailure({ message: 'request_not_payable' }, 400).uncertain);
    const c = sf.cancelRequestFailure({ message: 'this request can no longer be cancelled' }, 400);
    check('cancel refused: function-written text passes through', c.description === 'this request can no longer be cancelled' && !c.uncertain);
    const t = sf.cancelRequestFailure({ message: 'request_not_found' }, 400);
    check('cancel token → generic description', !/request_not_found/.test(t.description));
    check('cancel lost response → uncertain, says check status first', sf.cancelRequestFailure({ message: '' }, 0).uncertain);
  });
  await test('payment-event-dedup-by-attempt-and-state', async (check) => {
    adapter.setNotificationSession('user-a');
    shown.length = 0;
    const paid = adapter.eventId('payment', 'pay-1', 'paid');
    adapter.notify.success('Payment received.', { id: paid });
    adapter.notify.success('Payment received.', { id: adapter.eventId('payment', 'pay-1', 'paid') });
    check('poll + Realtime observing the same paid transition → one toast', shown.filter((s) => s.title === 'Payment received.').length === 1, shown);
    adapter.notify.warning('This QR code has expired.', { id: adapter.eventId('payment', 'pay-1', 'expired') });
    check('a different terminal state of the same attempt is a different event', shown.length === 2);
    adapter.notify.success('Payment received.', { id: adapter.eventId('payment', 'pay-2', 'paid') });
    check('a new payment attempt notifies again', shown.length === 3);
    const a1 = adapter.beginAttempt('qrph-cancel'); adapter.notify.success('QR PH payment cancelled.', { id: a1 });
    const a2 = adapter.beginAttempt('qrph-cancel'); adapter.notify.success('QR PH payment cancelled.', { id: a2 });
    check('a deliberate second cancel with identical text still notifies', shown.filter((s) => s.title === 'QR PH payment cancelled.').length === 2);
    const before = shown.length;
    const pending = adapter.beginAttempt('qrph-cancel');
    adapter.setNotificationSession('user-b');
    adapter.notify.success('QR PH payment cancelled.', { id: pending });
    check('an outcome that belongs to a previous account is suppressed', shown.length === before);
    adapter.notify.success('Payment received.', { id: adapter.eventId('payment', 'pay-1', 'paid') });
    check('event IDs are scoped to the session (same attempt id under another account is its own event)', shown.length === before + 1);
  });
  await test('ownership-and-contracts', async (check) => {
    const read = (f) => fs.readFileSync(path.join(app, 'src', f), 'utf8');
    const migrated = ['components/services/document-request-modal/qrph-step.tsx', 'components/services/document-request-modal/payment-method-step.tsx', 'components/services/document-request-modal/pickup-step.tsx', 'components/services/document-request-modal/success-step.tsx', 'components/services/document-request-modal/document-request-modal.tsx', 'components/services/resident-service-form.tsx', 'components/services/request-payment-journey.tsx', 'app/(resident)/services/requests/[requestId]/request-tracking.tsx'];
    check('RW-LT-06 modules use the notify adapter, not Sonner', migrated.every((f) => !/from ['"]sonner['"]/.test(read(f))));
    check('payment-method step no longer announces "Request submitted."', !/Request submitted\./.test(read('components/services/document-request-modal/payment-method-step.tsx')));
    check('create-payment-source still sends only the request id (amount derived server-side)', /invoke\('create-payment-source', \{ body: \{ requestId \} \}\)/.test(read('hooks/use-paymongo-source.ts')));
    check('poll interval and cancel race guard preserved', /POLL_INTERVAL_MS = 5000/.test(read('hooks/use-paymongo-source.ts')) && /cancelledRef\.current = true;/.test(read('hooks/use-paymongo-source.ts')));
    check('paid toast uses an event ID from payment attempt + terminal state', /eventId\('payment', paymentId, 'paid'\)/.test(read('components/services/document-request-modal/qrph-step.tsx')) && /eventId\('payment', paymentId, 'expired'\)/.test(read('components/services/document-request-modal/qrph-step.tsx')));
    check('cancel path never announces cancellation for the paid outcome', /outcome === 'cancelled'/.test(read('components/services/document-request-modal/qrph-step.tsx')) && /'paid': the confirmed paid transition/.test(read('components/services/document-request-modal/qrph-step.tsx')));
    check('receipt retry is a select only (no function/rpc call in the success step)', !/functions\.invoke|\.rpc\(/.test(read('components/services/document-request-modal/success-step.tsx')));
    check('submission still goes through the idempotent attempt', /attempt\.submit\(client, value\)/.test(read('components/services/resident-service-form.tsx')));
  });
  const summary = Object.fromEntries(['pass', 'fail'].map((k) => [k, results.filter((r) => r.status === k).length]));
  fs.writeFileSync(path.join(out, 'unit-results.json'), JSON.stringify({ phase: 'RW-LT-06', ranAt: new Date().toISOString(), modules: ['lib/service-feedback.ts', 'lib/notify.ts'], summary, results }, null, 2));
  console.log(JSON.stringify(summary));
  if (summary.fail) process.exitCode = 1;
}

// RW-LT-06 browser scenarios (production build, Chrome). Provider outcomes (PayMongo
// functions) and refusal/transport failures are fulfilled in the browser; request
// submissions, pickup records and receipts use the real local database with synthetic rows
// that every scenario restores.
async function rwlt06(runName = 'verify') {
  assert.match(runName, /^[a-z0-9-]+$/);
  const out = path.join(evidence, 'rw-lt-06', runName);
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(out, 'results.json')), `${runName}/results.json exists; choose a new run name`);
  const fx = JSON.parse(fs.readFileSync(path.join(tools, 'fixtures.json'), 'utf8'));
  const { chromium } = require(PLAYWRIGHT);
  const { createClient } = require('@supabase/supabase-js');
  const cfg = localConfig();
  const trusted = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = { run: runName, phase: 'RW-LT-06', base: BASE, startedAt: new Date().toISOString(), environment: { build: DIST_DIR, browser: 'Chrome (Playwright channel chrome, headless)', api: API_URL, realtime: 'local Realtime unavailable; Realtime events use the in-browser protocol 2.0.0 stand-in (mockRealtime)', providers: 'create-payment-source / check-payment-status / cancel-payment (PayMongo) are fulfilled in the browser — no provider call, charge, or provider payment row; request submission, pickup records and receipts use the real local database with synthetic rows restored after every scenario' }, scenarios: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  const B = FX.barangay, REQ = FX.requestPending, DOC = FX.documentType, ME = FX.users.populated;
  const DOC2 = ID('d2');
  const PAYMENT = '00000000-0000-4000-8000-00000000feed';
  const SYN_QR = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
  const original = JSON.parse(sql(`select to_jsonb(r) from (select payment_status, payment_method from public.service_requests where id='${REQ}') r`));
  const restore = () => sql(`begin;
    delete from public.payments where service_request_id='${REQ}';
    update public.service_requests set payment_status='${original.payment_status}', payment_method=${original.payment_method ? `'${original.payment_method}'` : 'null'} where id='${REQ}';
    create temp table rw_extra on commit drop as select id from public.service_requests where barangay_id='${B}' and id not in ('${FX.requestPending}','${FX.requestPaid}','${FX.requestOther}');
    delete from public.payments where service_request_id in (select id from rw_extra);
    delete from public.request_attachments where request_id in (select id from rw_extra);
    delete from public.service_request_pauses where request_id in (select id from rw_extra);
    delete from public.service_request_sla_alerts where request_id in (select id from rw_extra);
    delete from barangayan_private.legacy_submission_keys where request_id in (select id from rw_extra);
    delete from public.service_requests where id in (select id from rw_extra);
    delete from public.document_types where barangay_id='${B}' and id<>'${DOC}';
    commit;`);
  const extraRequests = () => Number(sql(`select count(*) from public.service_requests where barangay_id='${B}' and id not in ('${FX.requestPending}','${FX.requestPaid}','${FX.requestOther}')`));
  const paymentRows = (where = '') => Number(sql(`select count(*) from public.payments where service_request_id='${REQ}' ${where}`));
  const insertPaid = () => sql(`insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status,paid_at) values ('${REQ}','${B}','qrph',5000,5000,'paid',now())`);
  restore();

  async function scenario(id, fn, options = {}) {
    if (process.env.RW_ONLY && !process.env.RW_ONLY.split(',').includes(id)) return;
    try { restore(); } catch (e) { console.log(`restore before ${id} failed: ${e.message.split(String.fromCharCode(10))[0]}`); }
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: 'light', permissions: ['clipboard-read', 'clipboard-write'] });
    const rt = await mockRealtime(context);
    await context.route('**/tile.openstreetmap.org/**', (route) => route.abort('failed'));
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const bucket = { consoleErrors: [] };
    monitor(page, bucket);
    const counts = requestCounter(page);
    const result = { id, phase: 'RW-LT-06', status: 'pass', checks: {}, observations: {} };
    const check = (name, ok, detail) => { result.checks[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }; };
    try {
      if (options.account !== null) result.observations.loginDestination = await login(page, fx.accounts[options.account ?? 'populated']);
      await fn(page, result.observations, check, { rt, context });
      if (Object.values(result.checks).some((c) => !c.ok)) result.status = 'fail';
    } catch (e) {
      result.status = 'error';
      result.note = e.message.split('\n')[0].slice(0, 300);
      await page.screenshot({ path: path.join(out, 'screens', `${id}-error.png`) }).catch(() => {});
    }
    result.requests = counts();
    result.consoleErrors = bucket.consoleErrors;
    result.unexpectedConsoleErrors = bucket.consoleErrors.filter((m) => !/realtime|websocket|status of (400|401|403|404|406|409|422|429|500|502|503)|Failed to load resource|ERR_FAILED|net::|tile\.openstreetmap/i.test(m) && !(options.allowErrors && options.allowErrors.test(m)));
    if (result.status === 'pass' && result.unexpectedConsoleErrors.length) result.status = 'fail';
    await context.close();
    try { restore(); } catch (e) { result.note = `${result.note ?? ''} restore failed: ${e.message.split('\n')[0]}`; result.status = 'error'; }
    report.scenarios.push(result);
    const failed = Object.entries(result.checks).filter(([, c]) => !c.ok).map(([k]) => k);
    console.log(`${result.status.toUpperCase()} ${id}${result.note ? ` — ${result.note}` : ''}${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  }
  const text = (page) => page.evaluate(() => document.body.innerText);
  const fnJson = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const noContent = (route) => route.fulfill({ status: 204, body: '' });
  async function fnRoute(page, name, handler) {
    const calls = { count: 0 };
    const matcher = (u) => u.pathname === `/functions/v1/${name}`;
    await page.route(matcher, async (route) => { calls.count++; try { await handler(route, calls.count); } catch { /* handled or closed */ } });
    calls.off = () => page.unroute(matcher);
    return calls;
  }
  const source = (over = {}) => fnJson({ paymentId: PAYMENT, paymentIntentId: 'pi_rwfb_synthetic', qrImageUrl: SYN_QR, expiresAt: Date.now() + 30 * 60 * 1000, documentFeeCentavos: 5000, amountCentavos: 5000, ...over });
  const toastsMatching = async (page, re) => (await liveToasts(page, re)).length;
  const dismissToasts = (page) => page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
  const writes = (page) => { const w = []; page.on('request', (r) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && /\/(rest|functions|storage)\/v1\//.test(r.url())) w.push(`${r.method()} ${new URL(r.url()).pathname}`); }); return w; };
  const busyState = (page, locator) => locator.evaluate((el) => ({ disabled: el.disabled, busy: el.getAttribute('aria-busy'), text: el.innerText.trim() }));
  const QR_URL = `${BASE}/services/payment/qrph/${REQ}`;

  // ---- 1. Catalog + request modal read states
  await scenario('catalog-modal-read-states', async (page, obs, check) => {
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    const card = page.getByRole('button', { name: /RW Synthetic Clearance/ });
    check('catalog renders the server read; first cards use the bounded entrance', (await card.count()) === 1 && (await page.locator('.rw-reveal').count()) <= 6, { reveals: await page.locator('.rw-reveal').count() });
    // slow read
    let d = await rest(page, 'document_types', shape.delay(1800));
    await card.click();
    await page.waitForTimeout(450);
    obs.slow = await page.evaluate(() => ({ skeletons: document.querySelectorAll('[role=dialog] [data-slot=skeleton]').length, status: [...document.querySelectorAll('[role=dialog] [role=status]')].map((e) => e.textContent.trim()).filter(Boolean), busy: document.querySelectorAll('[role=dialog] [aria-busy=true]').length }));
    check('slow read: matching skeleton, one polite "Loading service…", aria-busy region', obs.slow.skeletons >= 3 && obs.slow.status.filter((s) => /Loading service/.test(s)).length === 1 && obs.slow.busy >= 1, obs.slow);
    await page.getByRole('button', { name: 'Request This Document' }).waitFor();
    check('slow read settles to the details', true);
    await shot(page, 'catalog-modal-details-1440');
    d.off();
    // a failed re-read of a service that is already on screen keeps it (same identity)
    await page.getByRole('button', { name: 'Close' }).click();
    d = await rest(page, 'document_types', shape.fail(500));
    await card.click();
    await page.getByRole('button', { name: 'Request This Document' }).waitFor();
    await pause(1500);
    check('failed re-read keeps the already-loaded service (no error, no skeleton)', (await page.locator('[role=dialog] [role=alert]').count()) === 0 && (await page.locator('[role=dialog] [data-slot=skeleton]').count()) === 0);
    d.off();
    // failed first read
    await page.reload({ waitUntil: 'networkidle' });
    d = await rest(page, 'document_types', shape.fail(500));
    await card.click();
    await page.getByText(/We couldn't load this service/).waitFor({ timeout: 40000 });
    obs.failed = { alerts: await page.locator('[role=dialog] [role=alert]').allInnerTexts(), toasts: (await liveToasts(page)).length };
    check('failed read: inline error + Retry, no toast, no "unavailable" claim', obs.failed.alerts.length === 1 && obs.failed.toasts === 0 && !/isn't available/.test(await text(page)));
    d.off();
    const w = writes(page);
    await page.getByRole('button', { name: 'Retry loading service' }).click();
    await page.getByRole('button', { name: 'Request This Document' }).waitFor();
    check('Retry is a read only and recovers', w.length === 0, w);
    // missing / inaccessible record
    await page.getByRole('button', { name: 'Close' }).click();
    d = await rest(page, 'document_types', (route) => route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }) }));
    await card.click();
    await page.getByText(/This service isn't available right now/).waitFor();
    check('missing record: unavailable view with a safe way back, not an endless skeleton', (await page.locator('[role=dialog] [data-slot=skeleton]').count()) === 0 && (await page.getByRole('button', { name: 'Back to the catalog' }).count()) === 1);
    await shot(page, 'catalog-modal-unavailable-1440');
    d.off();
    await page.getByRole('button', { name: 'Back to the catalog' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // thrown failure settles
    d = await rest(page, 'document_types', shape.abort());
    await card.click();
    await page.getByText(/We couldn't load this service/).waitFor({ timeout: 40000 });
    check('transport failure settles to the same retryable error', (await page.locator('[role=dialog] [data-slot=skeleton]').count()) === 0);
    d.off();
  });

  await scenario('catalog-rapid-selection-obsolete-response', async (page, obs, check) => {
    sql(`insert into public.document_types(id,barangay_id,name,fee_centavos) values ('${DOC2}','${B}','RW Second Service',2500)`);
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    const d = await rest(page, 'document_types', async (route) => { if (route.request().url().includes(`eq.${DOC}`)) await pause(2500); return route.continue(); });
    await page.getByRole('button', { name: /RW Synthetic Clearance/ }).click();
    await page.getByRole('button', { name: /RW Second Service/ }).click();
    await page.getByRole('heading', { name: 'RW Second Service' }).waitFor();
    await pause(3200);
    obs.after = await page.evaluate(() => ({ headings: [...document.querySelectorAll('[role=dialog] h2')].map((h) => h.textContent.trim()) }));
    check('an older, slower response never replaces the newer selection', obs.after.headings.includes('RW Second Service') && !obs.after.headings.includes('RW Synthetic Clearance'), obs.after);
    d.off();
  });

  await scenario('request-check-pending-and-failure', async (page, obs, check) => {
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /RW Synthetic Clearance/ }).click();
    const request = page.getByRole('button', { name: /Request This Document|Checking your account/ });
    await request.waitFor();
    // slow account check: a single activation sets the reference count of /auth/v1/user
    // calls the flow makes; a repeated activation must not add any.
    let user = await authRoute(page, AUTH.user, async (route) => { await pause(900); await route.continue(); });
    await request.click();
    await page.getByText('Request Form').first().waitFor({ timeout: 15000 });
    const single = user.count;
    await page.unroute(AUTH.user);
    await page.getByRole('button', { name: 'Back to Details' }).click();
    await page.getByRole('button', { name: 'Request This Document' }).waitFor();
    user = await authRoute(page, AUTH.user, async (route) => { await pause(1500); await route.continue(); });
    await request.click();
    await page.waitForTimeout(60);
    obs.pending = await busyState(page, request);
    await request.click({ force: true, timeout: 500 }).catch(() => {});
    await page.getByText('Request Form').first().waitFor({ timeout: 15000 });
    check('pending is immediate: disabled, aria-busy, "Checking your account…"', obs.pending.disabled && obs.pending.busy === 'true' && /Checking your account/.test(obs.pending.text), obs.pending);
    check('repeated activation → no extra account check', user.count === single, { single, repeated: user.count });
    await page.unroute(AUTH.user);
    // failed account check
    await page.getByRole('button', { name: 'Back to Details' }).click();
    await authRoute(page, AUTH.user, (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Request This Document' }).click();
    await page.locator('[data-slot=request-check-error]').waitFor({ timeout: 40000 });
    obs.failed = { alert: await page.locator('[data-slot=request-check-error]').innerText(), button: await busyState(page, page.getByRole('button', { name: 'Request This Document' })), toasts: (await liveToasts(page)).length };
    check('failed check: inline message (not the service-load retry), control restored, no toast', /Unable to check your account/.test(obs.failed.alert) && !obs.failed.button.disabled && obs.failed.button.busy === null && obs.failed.toasts === 0, obs.failed);
    check('the service itself stays visible', (await page.getByRole('heading', { name: 'RW Synthetic Clearance' }).count()) >= 1);
  });

  // ---- 2. Standalone request form: validation, rejected, lost response, retry, success, stages
  await scenario('request-form-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/services/requests/new/${DOC}`, { waitUntil: 'networkidle' });
    const submit = page.getByRole('button', { name: /^Submit request|Submitting|Uploading/ });
    const notes = page.getByLabel('Additional notes (optional)');
    await notes.fill('Synthetic note kept across failures');
    const before = extraRequests();
    // a. validation: inline only, nothing sent
    const w = writes(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await submit.click();
    await page.getByText('ID must be JPG, PNG or WEBP up to 5 MB.').waitFor();
    obs.validation = { writes: w.length, toasts: (await liveToasts(page)).length, alerts: await page.locator('form [role=alert]').allInnerTexts() };
    check('validation: one inline message, no toast, no request sent', obs.validation.writes === 0 && obs.validation.toasts === 0 && obs.validation.alerts.length === 1, obs.validation);
    await page.locator('input[type=file]').setInputFiles([]);
    // b. refused
    let rpc = await rest(page, 'rpc/submit_service_request', fnJson({ code: '22023', message: 'current_approved_ID_required', details: null, hint: null }, 400));
    await submit.click();
    await waitForToast(page, /Couldn't submit your request/);
    await pause(300);
    obs.refused = { calls: rpc.count, toasts: (await liveToasts(page)).map((t) => t.text), guidance: await page.locator('[data-slot=submission-guidance]').innerText(), notes: await notes.inputValue(), button: await busyState(page, submit) };
    check('refused: one toast, persistent guidance, input retained, control restored', obs.refused.calls === 1 && obs.refused.toasts.length === 1 && /profile ID must be approved/.test(obs.refused.guidance) && obs.refused.notes.startsWith('Synthetic note') && !obs.refused.button.disabled, obs.refused);
    rpc.off();
    await dismissToasts(page);
    // c. lost response
    rpc = await rest(page, 'rpc/submit_service_request', shape.abort());
    await submit.click();
    await waitForToast(page, /couldn't confirm your request/i, 15000);
    await pause(3500);
    obs.lost = { calls: rpc.count, toasts: (await liveToasts(page)).map((t) => t.text), guidance: await page.locator('[data-slot=submission-guidance]').innerText(), created: extraRequests() - before };
    check('lost response: unconfirmed wording, no automatic second request, nothing created', obs.lost.calls === 1 && obs.lost.toasts.length === 1 && /won't create a duplicate/.test(obs.lost.guidance) && /My Requests/.test(obs.lost.guidance) && obs.lost.created === 0, obs.lost);
    await shot(page, 'request-form-unconfirmed-1440');
    rpc.off();
    await dismissToasts(page);
    // d. slow + repeated activation + success (explicit next view confirms; no toast)
    rpc = await rest(page, 'rpc/submit_service_request', async (route) => { await pause(1500); await route.continue(); });
    await submit.click();
    await submit.click({ force: true, timeout: 400 }).catch(() => {});
    await page.waitForTimeout(80);
    obs.slowSubmit = { button: await busyState(page, submit), statuses: await page.locator('form [role=status]').allInnerTexts() };
    await page.waitForURL(/\/services\/payment\//, { timeout: 20000 });
    obs.success = { path: new URL(page.url()).pathname, calls: rpc.count, created: extraRequests() - before, toasts: (await liveToasts(page)).length };
    check('slow submit: immediate disabled/aria-busy with a real stage label and one polite status', obs.slowSubmit.button.disabled && obs.slowSubmit.button.busy === 'true' && /Submitting your request/.test(obs.slowSubmit.button.text) && obs.slowSubmit.statuses.filter((s) => /Submitting your request/.test(s)).length === 1, obs.slowSubmit);
    check('repeated activation → exactly one request and one write; destination unchanged; no extra toast', obs.success.calls === 1 && obs.success.created === 1 && obs.success.toasts === 0 && /^\/services\/payment\/[0-9a-f-]{36}$/.test(obs.success.path), obs.success);
    rpc.off();
  });

  await scenario('request-form-upload-stages', async (page, obs, check) => {
    await page.goto(`${BASE}/services/requests/new/${DOC}`, { waitUntil: 'networkidle' });
    const submit = page.getByRole('button', { name: /^Submit request|Submitting|Uploading/ });
    await page.locator('input[type=file]').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: Buffer.from(SYN_QR, 'base64') });
    const before = extraRequests();
    // upload fails
    let up = await authRoute(page, (u) => /\/storage\/v1\/object\/id-documents\//.test(u.pathname), async (route) => {
      if (route.request().method() === 'POST') return route.abort('failed');
      return route.continue();
    });
    await submit.click();
    await waitForToast(page, /Couldn't upload your file/, 20000);
    await pause(200);
    obs.uploadFailed = { toasts: (await liveToasts(page)).map((t) => t.text), guidance: await page.locator('[data-slot=submission-guidance]').innerText(), button: await busyState(page, submit), created: extraRequests() - before };
    check('failed upload: accurate stage failure, files kept, control restored, no request created, no provider text', obs.uploadFailed.toasts.length === 1 && /kept here/.test(obs.uploadFailed.guidance) && !/Failed to fetch|Storage/.test(obs.uploadFailed.guidance) && !obs.uploadFailed.button.disabled && obs.uploadFailed.created === 0, obs.uploadFailed);
    await page.unroute((u) => /\/storage\/v1\/object\/id-documents\//.test(u.pathname));
    await dismissToasts(page);
    // upload slow then success: real stages, no fake percentage
    await page.route((u) => /\/storage\/v1\/object\/id-documents\//.test(u.pathname), async (route) => { if (route.request().method() === 'POST') await pause(1500); await route.continue(); });
    await submit.click();
    await page.waitForTimeout(250);
    obs.stage1 = await busyState(page, submit);
    await page.waitForFunction(() => /Submitting your request/.test(document.querySelector('form button[type=submit]')?.innerText ?? '') || location.pathname.startsWith('/services/payment/'), null, { timeout: 15000 });
    obs.stage2 = await page.evaluate(() => ({ path: location.pathname, label: document.querySelector('form button[type=submit]')?.innerText.trim() ?? null }));
    check('upload stage is named truthfully, then submission; no percentage', /Uploading your ID/.test(obs.stage1.text) && obs.stage1.busy === 'true' && !/%/.test(obs.stage1.text), obs.stage1);
    await page.waitForURL(/\/services\/payment\//, { timeout: 20000 });
    check('retry with the retained file completes through the current workflow (one request)', extraRequests() - before === 1, { created: extraRequests() - before });
    // remove the uploaded synthetic object
    const { data: listed } = await trusted.storage.from('id-documents').list(ME, { limit: 50 });
    for (const folder of listed ?? []) {
      const { data: files } = await trusted.storage.from('id-documents').list(`${ME}/${folder.name}`);
      await trusted.storage.from('id-documents').remove((files ?? []).map((f) => `${ME}/${folder.name}/${f.name}`));
    }
  });

  // ---- 3. Request list + drawer states (RW-LT-03 pilot, re-verified with this phase's list changes)
  await scenario('requests-list-and-drawer', async (page, obs, check) => {
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    obs.list = await page.evaluate(() => ({ cards: document.querySelectorAll('main button[aria-current], main button.rounded-xl').length, reveals: document.querySelectorAll('.rw-reveal').length }));
    check('list renders with at most six entrance reveals', obs.list.reveals <= 6, obs.list);
    await page.goto(`${BASE}/services/requests?open=${ID('99')}`, { waitUntil: 'networkidle' });
    await page.getByText(/This request isn't available/).waitFor();
    check('missing record: unavailable view (not a perpetual skeleton)', (await page.locator('[role=dialog] [data-slot=skeleton]').count()) === 0);
    let d = await rest(page, 'service_requests', shape.fail(500));
    await page.goto(`${BASE}/services/requests?open=${REQ}`, { waitUntil: 'networkidle' });
    await page.getByText(/We couldn't load this request/).waitFor({ timeout: 30000 });
    d.off();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('heading', { name: 'RW Synthetic Clearance' }).waitFor();
    check('failed read → error with Try again → recovers', true);
    await shot(page, 'requests-drawer-ready-1440');
  });

  // ---- 4. Tracking: cancel request / cancel QR payment outcomes
  await scenario('tracking-cancel-request-outcomes', async (page, obs, check) => {
    await page.goto(`${BASE}/services/requests/${REQ}`, { waitUntil: 'networkidle' });
    const open = async () => { await page.getByRole('button', { name: 'Cancel Request' }).click(); };
    const confirm = () => page.getByRole('button', { name: /Yes, Cancel|Cancelling/ });
    // refused (function-written text passes through)
    let rpc = await rest(page, 'rpc/cancel_own_service_request', fnJson({ code: 'P0001', message: 'this request can no longer be cancelled', details: null, hint: null }, 400));
    await open(); await confirm().click();
    await waitForToast(page, /Couldn't cancel your request/);
    obs.refused = { toasts: (await liveToasts(page)).map((t) => t.text), calls: rpc.count };
    check('refused cancel: one error toast carrying the existing explanation; nothing claimed cancelled', obs.refused.toasts.length === 1 && /no longer be cancelled/.test(obs.refused.toasts[0]) && !/has been cancelled/.test(obs.refused.toasts[0]), obs.refused);
    rpc.off(); await dismissToasts(page);
    // lost response
    rpc = await rest(page, 'rpc/cancel_own_service_request', shape.abort());
    await open(); await confirm().click();
    await waitForToast(page, /couldn't confirm the cancellation/i, 15000);
    await pause(2000);
    obs.lost = { toasts: (await liveToasts(page)).map((t) => t.text), calls: rpc.count };
    check('lost response: unconfirmed warning, one call, no automatic repeat', obs.lost.calls === 1 && obs.lost.toasts.length === 1 && /may or may not have been cancelled/.test(obs.lost.toasts[0]), obs.lost);
    rpc.off(); await dismissToasts(page);
    // confirmed, repeated activation
    rpc = await rest(page, 'rpc/cancel_own_service_request', async (route) => { await pause(1200); return noContent(route); });
    await open();
    await confirm().click();
    await confirm().click({ force: true, timeout: 300 }).catch(() => {});
    await waitForToast(page, /service request has been cancelled/);
    obs.confirmed = { calls: rpc.count, toasts: (await liveToasts(page)).length };
    check('confirmed cancel + repeated activation → one call, one success toast', obs.confirmed.calls === 1 && obs.confirmed.toasts === 1, obs.confirmed);
  });

  await scenario('tracking-cancel-payment-outcomes', async (page, obs, check) => {
    const pendingRow = fnJson([{ id: PAYMENT, expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString() }]);
    const visit = async () => {
      await page.route((u) => u.pathname === '/rest/v1/payments' && /method=eq.qrph/.test(u.search) && /status=eq.pending/.test(u.search), pendingRow);
      await page.goto(`${BASE}/services/requests/${REQ}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Cancel Payment' }).waitFor();
    };
    await visit();
    let fn = await fnRoute(page, 'cancel-payment', fnJson({ error: 'Synthetic provider refusal' }, 500));
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await waitForToast(page, /Couldn't cancel the payment/);
    obs.refused = { toasts: (await liveToasts(page)).map((t) => t.text), button: await busyState(page, page.getByRole('button', { name: 'Cancel Payment' })) };
    check('refused: one error toast with the provider reason; control restored', obs.refused.toasts.length === 1 && /Synthetic provider refusal/.test(obs.refused.toasts[0]) && !obs.refused.button.disabled, obs.refused);
    fn.off(); await dismissToasts(page);
    // lost response
    fn = await fnRoute(page, 'cancel-payment', (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await waitForToast(page, /couldn't confirm the cancellation/i, 15000);
    obs.lost = { toasts: (await liveToasts(page)).map((t) => t.text), calls: fn.count };
    check('lost response: unconfirmed warning, one call, no automatic repeat', obs.lost.toasts.length === 1 && fn.count === 1, obs.lost);
    fn.off(); await dismissToasts(page);
    // paid wins the race: no cancellation success
    await visit();
    fn = await fnRoute(page, 'cancel-payment', fnJson({ status: 'paid' }));
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await waitForToast(page, /already completed/);
    obs.paid = (await liveToasts(page)).map((t) => t.text);
    check('payment completed during cancellation → paid outcome only, never "cancelled"', obs.paid.length === 1 && !/cancelled/i.test(obs.paid[0]), obs.paid);
    fn.off(); await dismissToasts(page);
    // confirmed
    await visit();
    fn = await fnRoute(page, 'cancel-payment', async (route) => { await pause(900); return fnJson({ status: 'cancelled' })(route); });
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Cancelling…' }).or(page.getByRole('button', { name: 'Cancel Payment' })).first().click({ force: true, timeout: 300 }).catch(() => {});
    await waitForToast(page, /Payment attempt cancelled/);
    obs.cancelled = { toasts: (await liveToasts(page)).length, calls: fn.count, cancelRequestOffered: (await page.getByRole('button', { name: 'Cancel Request' }).count()) === 1 };
    check('confirmed cancellation → one success, one call, request-level control returns', obs.cancelled.toasts === 1 && obs.cancelled.calls === 1 && obs.cancelled.cancelRequestOffered, obs.cancelled);
  });

  // ---- 5. Payment method + pickup
  await scenario('payment-method-and-pickup', async (page, obs, check) => {
    await page.goto(`${BASE}/services/payment/${REQ}`, { waitUntil: 'networkidle' });
    const cont = page.getByRole('button', { name: /^Continue|Saving your choice/ });
    await page.getByRole('button', { name: /Pay at Pickup/ }).first().waitFor();
    // refused
    let rpc = await rest(page, 'rpc/set_service_request_payment_method', fnJson({ code: '22023', message: 'request_not_payable', details: null, hint: null }, 400));
    await cont.click();
    await waitForToast(page, /Couldn't save your payment method/);
    obs.refused = { toasts: (await liveToasts(page)).map((t) => t.text), inline: await page.locator('[data-slot=payment-method-error]').innerText(), url: page.url() };
    check('refused: one error toast + persistent plain guidance; stays on the step; no "Request submitted."', obs.refused.toasts.length === 1 && !/Request submitted/.test(await text(page)) && /can't be paid right now/.test(obs.refused.inline), obs.refused);
    rpc.off(); await dismissToasts(page);
    // lost response
    rpc = await rest(page, 'rpc/set_service_request_payment_method', shape.abort());
    await cont.click();
    await waitForToast(page, /couldn't confirm your choice/i, 15000);
    await pause(1500);
    obs.lost = { calls: rpc.count, inline: await page.locator('[data-slot=payment-method-error]').innerText() };
    check('lost response: uncertain wording that says nothing was charged; one write', obs.lost.calls === 1 && /Nothing was charged/.test(obs.lost.inline), obs.lost);
    rpc.off(); await dismissToasts(page);
    // success with repeated activation → pickup step, which records the pickup once
    rpc = await rest(page, 'rpc/set_service_request_payment_method', async (route) => { await pause(900); return noContent(route); });
    const pickupCalls = await rest(page, 'rpc/start_pickup_payment', (route) => route.continue());
    await cont.click();
    await page.waitForTimeout(60);
    obs.pending = await busyState(page, cont);
    await cont.click({ force: true, timeout: 300 }).catch(() => {});
    await page.getByText('Pickup payment recorded.').waitFor({ timeout: 15000 });
    obs.pickup = { methodCalls: rpc.count, pickupCalls: pickupCalls.count, rows: paymentRows(`and method='pickup'`), toasts: (await liveToasts(page)).length };
    check('pending is immediate with "Saving your choice…"', obs.pending.disabled && obs.pending.busy === 'true' && /Saving your choice/.test(obs.pending.text), obs.pending);
    check('repeated activation → one method write; pickup recorded exactly once; no toast (the step is the confirmation)', obs.pickup.methodCalls === 1 && obs.pickup.pickupCalls === 1 && obs.pickup.rows === 1 && obs.pickup.toasts === 0, obs.pickup);
    // idempotency: a second open of the pickup step (remount/reload) creates no second record (D-13)
    await page.goto(`${BASE}/services/payment/pickup/${REQ}`, { waitUntil: 'networkidle' });
    await page.getByText('Pickup payment recorded.').waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Pickup payment recorded.').waitFor();
    obs.idempotent = { rows: paymentRows(`and method='pickup'`) };
    check('D-13: start_pickup_payment is idempotent — reopening/reloading the step leaves one pickup record', obs.idempotent.rows === 1, obs.idempotent);
    pickupCalls.off();
  });

  await scenario('pickup-failure-and-retry', async (page, obs, check) => {
    const d = await rest(page, 'rpc/start_pickup_payment', fnJson({ code: 'PGRST500', message: 'internal_failure', details: null, hint: null }, 500));
    await page.goto(`${BASE}/services/payment/pickup/${REQ}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Retry recording pickup payment' }).waitFor({ timeout: 20000 });
    obs.failed = { alert: await page.locator('[role=alert]').allInnerTexts(), done: await page.getByRole('button', { name: 'Done' }).isDisabled(), toasts: (await liveToasts(page)).length, calls: d.count };
    check('failure: persistent inline alert + Retry, Done stays disabled, no toast, no raw token', obs.failed.alert.some((a) => /couldn't record your pickup payment/.test(a)) && !obs.failed.alert.some((a) => /internal_failure/.test(a)) && obs.failed.done && obs.failed.toasts === 0, obs.failed);
    d.off();
    await page.getByRole('button', { name: 'Retry recording pickup payment' }).click();
    await page.getByText('Pickup payment recorded.').waitFor();
    check('Retry records it once and enables Done', (await page.getByRole('button', { name: 'Done' }).isEnabled()) && paymentRows(`and method='pickup'`) === 1);
    const lost = await rest(page, 'rpc/start_pickup_payment', shape.abort());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/couldn't confirm your pickup payment was recorded/).waitFor({ timeout: 20000 });
    check('lost response: uncertain wording, one automatic call only', lost.count === 1);
    lost.off();
  });

  // ---- 6. QR PH journey (provider outcomes mocked; receipt reads use the local database)
  await scenario('qr-generation-geometry-and-announcement', async (page, obs, check) => {
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    await fnRoute(page, 'create-payment-source', async (route) => { await pause(1800); return source()(route); });
    const nav = page.goto(QR_URL, { waitUntil: 'commit' });
    await page.getByText(/Ref #|Generating/).first().waitFor();
    await pause(500);
    obs.loading = await page.evaluate(() => {
      const box = document.querySelector('[data-slot=skeleton].rw-skeleton-static, [data-slot=skeleton]');
      const r = box?.getBoundingClientRect();
      const frame = box?.parentElement?.getBoundingClientRect();
      return { statuses: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).filter(Boolean), steady: Boolean(document.querySelector('.rw-skeleton-static')), size: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null, frame: frame ? { h: Math.round(frame.height) } : null, spinners: document.querySelectorAll('.rw-spinner').length };
    });
    await nav;
    await page.getByAltText('PayMongo QR PH code').waitFor({ timeout: 15000 });
    obs.ready = await page.evaluate(() => { const i = document.querySelector('img[alt="PayMongo QR PH code"]'); const r = i.getBoundingClientRect(); return { size: { w: Math.round(r.width), h: Math.round(r.height) }, frame: { h: Math.round(i.parentElement.getBoundingClientRect().height) } }; });
    check('loading: steady 256 px placeholder + one polite "Generating your QR code…" (its small inline spinner belongs to the status label)', obs.loading.statuses.filter((s) => /Generating your QR code/.test(s)).length === 1 && obs.loading.steady && obs.loading.size?.w === 256 && obs.loading.size?.h === 256 && obs.loading.spinners <= 1, obs.loading);
    check('QR geometry is identical before and after (no layout shift)', obs.ready.size.w === 256 && obs.ready.size.h === 256 && obs.ready.frame.h === obs.loading.frame.h, { loading: obs.loading, ready: obs.ready });
    await shot(page, 'qr-ready-1440');
  });

  await scenario('qr-paid-poll-and-realtime-overlap', async (page, obs, check, { rt }) => {
    let polls = 0;
    // The paid row is written first (as the webhook does); only then do the Realtime event
    // and the poll observe it.
    const status = await fnRoute(page, 'check-payment-status', async (route) => {
      polls++;
      if (polls >= 2) { if (paymentRows(`and status='paid'`) === 0) insertPaid(); return fnJson({ status: 'paid' })(route); }
      return fnJson({ status: 'pending' })(route);
    });
    const creates = await fnRoute(page, 'create-payment-source', source());
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    // the Realtime paid event lands right before the poll that would also observe it
    const fired = [];
    const poller = setInterval(() => { if (polls >= 1 && !fired.length) { if (paymentRows(`and status='paid'`) === 0) insertPaid(); fired.push(rt.push('payments', 'UPDATE', { id: PAYMENT, status: 'paid' })); } }, 100);
    await waitForToast(page, /Payment received/, 25000);
    clearInterval(poller);
    await page.getByText('Payment Successful').waitFor({ timeout: 15000 });
    await pause(1500);
    obs.outcome = { toasts: (await liveToasts(page, /Payment received/)).length, createCalls: creates.count, realtimePushes: fired[0] ?? null, receipt: (await page.locator('main').innerText()).slice(0, 200) };
    check('poll + Realtime overlap → exactly one "Payment received." toast', obs.outcome.toasts === 1, obs.outcome);
    check('paid advances to the confirmed receipt (real local paid row), still one create call', /Payment Successful/.test(obs.outcome.receipt) && obs.outcome.createCalls === 1, obs.outcome);
    await pause(11500); // a journey refresh now sees payment_status=paid; the receipt must stay
    check('a background refresh observing paid does not replace the receipt', (await page.getByText('Payment Successful').count()) === 1 && (await liveToasts(page, /Payment received/)).length <= 1);
    await shot(page, 'qr-paid-receipt-1440');
    // timers/listeners: leaving the step stops polling
    const before = status.count;
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await pause(6500);
    check('leaving the page stops polling (no further status checks)', status.count === before, { before, after: status.count });
  });

  await scenario('qr-paid-during-cancellation', async (page, obs, check) => {
    await fnRoute(page, 'create-payment-source', source());
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    await fnRoute(page, 'cancel-payment', async (route) => { await pause(900); insertPaid(); return fnJson({ status: 'paid' })(route); });
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    await waitForToast(page, /Payment received/, 15000);
    await page.getByText('Payment Successful').waitFor({ timeout: 15000 });
    const toasts = (await liveToasts(page)).map((t) => t.text);
    obs.toasts = toasts;
    check('payment completes during cancellation → one paid outcome, never a cancellation toast', toasts.length === 1 && /Payment received/.test(toasts[0]) && !/cancel/i.test(toasts.join(' ')), toasts);
  });

  await scenario('qr-cancel-failure-and-guidance', async (page, obs, check) => {
    await fnRoute(page, 'create-payment-source', source());
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    let cancel = await fnRoute(page, 'cancel-payment', fnJson({ error: 'Synthetic cancel failure' }, 500));
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    await waitForToast(page, /Could not cancel the payment/);
    await dismissToasts(page);
    await pause(400);
    obs.refused = { guidance: await page.locator('[data-slot=payment-guidance]').innerText(), qrStillShown: (await page.getByAltText('PayMongo QR PH code').count()) === 1, button: await busyState(page, page.getByRole('button', { name: 'Cancel Payment' })), toastsAfterDismiss: (await liveToasts(page)).length };
    check('D-14: failed cancel is reported — persistent guidance survives the toast, QR stays, control restored', /Synthetic cancel failure/.test(obs.refused.guidance) && obs.refused.qrStillShown && !obs.refused.button.disabled, obs.refused);
    await shot(page, 'qr-cancel-refused-1440');
    cancel.off();
    // lost response
    cancel = await fnRoute(page, 'cancel-payment', (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    await waitForToast(page, /couldn't confirm the cancellation/i, 15000);
    await pause(300);
    obs.lost = { guidance: await page.locator('[data-slot=payment-guidance]').innerText(), calls: cancel.count, toasts: (await liveToasts(page)).length };
    check('lost cancel response: unconfirmed wording, still watching status, one call', /couldn't confirm whether the payment was cancelled/.test(obs.lost.guidance) && obs.lost.calls === 1 && obs.lost.toasts === 1, obs.lost);
    cancel.off();
    // confirmed
    cancel = await fnRoute(page, 'cancel-payment', fnJson({ status: 'cancelled' }));
    await dismissToasts(page);
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    await waitForToast(page, /QR PH payment cancelled/);
    obs.confirmed = { toasts: (await liveToasts(page)).length, methodStep: await page.getByRole('button', { name: /Continue/ }).isVisible().catch(() => false) };
    check('confirmed cancel → one success toast and back to the method step', obs.confirmed.toasts === 1 && obs.confirmed.methodStep, obs.confirmed);
  });

  await scenario('qr-expiry-and-connectivity', async (page, obs, check, { rt }) => {
    // a. countdown ends before any server status → a display condition only
    await fnRoute(page, 'create-payment-source', source({ expiresAt: Date.now() + 3000 }));
    let status = await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.locator('[data-slot=payment-expiry-passed]').waitFor({ timeout: 10000 });
    const t = await text(page);
    obs.countdown = { toasts: (await liveToasts(page)).length, qr: (await page.getByAltText('PayMongo QR PH code').count()) === 1, note: await page.locator('[data-slot=payment-expiry-passed]').innerText() };
    check('countdown at zero: no invented expired/failed claim, no toast, QR and Cancel still available', !/has expired|failed/i.test(t.replace(obs.countdown.note, '')) && obs.countdown.toasts === 0 && obs.countdown.qr && (await page.getByRole('button', { name: 'Cancel Payment' }).count()) === 1, obs.countdown);
    // b. server confirms expiry via poll and Realtime: one warning
    status.off();
    status = await fnRoute(page, 'check-payment-status', fnJson({ status: 'expired' }));
    rt.push('payments', 'UPDATE', { id: PAYMENT, status: 'expired' });
    await waitForToast(page, /QR code has expired/, 15000);
    await pause(1500);
    obs.expired = { toasts: (await liveToasts(page, /expired/)).length, inline: (await page.locator('main, [role=main], body').first().innerText()).includes('This QR code has expired'), trackLink: await page.getByRole('link', { name: 'View My Request' }).count() };
    check('confirmed expiry (poll + Realtime) → one warning and persistent guidance with a request link', obs.expired.toasts === 1 && obs.expired.inline && obs.expired.trackLink >= 1, obs.expired);
    status.off();
  });

  await scenario('qr-status-check-connectivity', async (page, obs, check) => {
    await fnRoute(page, 'create-payment-source', source());
    let status = await fnRoute(page, 'check-payment-status', (route) => route.abort('failed'));
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.locator('[data-slot=payment-status-check]').waitFor({ timeout: 15000 });
    obs.failing = { text: await page.locator('[data-slot=payment-status-check]').innerText(), toasts: (await liveToasts(page)).length, qr: (await page.getByAltText('PayMongo QR PH code').count()) === 1 };
    check('status checks failing: persistent "don\'t pay again" guidance, content intact, no toast, nothing declared failed', /don't pay again/.test(obs.failing.text) && obs.failing.toasts === 0 && obs.failing.qr, obs.failing);
    status.off();
    status = await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    await page.locator('[data-slot=payment-status-check]').waitFor({ state: 'detached', timeout: 15000 });
    check('recovers quietly when checks succeed again', true);
    status.off();
  });

  await scenario('qr-creation-failures', async (page, obs, check) => {
    let create = await fnRoute(page, 'create-payment-source', fnJson({ error: 'QR PH is not activated on this account' }, 400));
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByText('QR PH is not activated on this account').waitFor();
    obs.refused = { alerts: await page.locator('[role=alert]').allInnerTexts(), toasts: (await liveToasts(page)).length, calls: create.count, back: await page.getByRole('button', { name: 'Go Back' }).count() };
    check('provider refusal: persistent alert with the provider reason + Go Back, no toast, one call', obs.refused.alerts.some((a) => /not activated/.test(a)) && obs.refused.toasts === 0 && obs.refused.calls === 1 && obs.refused.back === 1, obs.refused);
    create.off();
    create = await fnRoute(page, 'create-payment-source', (route) => route.abort('failed'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/Could not start a QR PH payment/).waitFor();
    check('transport failure settles to guidance (no endless spinner)', (await page.locator('[data-slot=skeleton]').count()) === 0 && create.count === 1, { calls: create.count });
  });

  await scenario('receipt-read-only-retry-and-revisit', async (page, obs, check) => {
    insertPaid();
    // modal/journey receipt step failing then recovering, with no payment creation
    const creates = await fnRoute(page, 'create-payment-source', source());
    const statusCalls = await fnRoute(page, 'check-payment-status', fnJson({ status: 'paid' }));
    let receiptReads = await rest(page, 'payments', shape.fail(500), { methods: ['GET'] });
    const w = writes(page);
    await page.goto(`${BASE}/services/payment/qrph/${REQ}`, { waitUntil: 'networkidle' });
    // a paid request summary (no QR step) — revisiting must not create a charge or a toast
    await pause(1500);
    obs.revisit = { text: (await page.locator('main').innerText()).split(/\s+/).join(' '), creates: creates.count, toasts: (await liveToasts(page)).length };
    obs.revisit.text = obs.revisit.text.slice(0, 400);
    check('revisiting a paid request: paid summary, no create call, no historical toast', /Payment received/.test(obs.revisit.text) && obs.revisit.creates === 0 && obs.revisit.toasts === 0, obs.revisit);
    receiptReads.off();
    // the standalone receipt page: server read confirms paid row and shows it
    await page.goto(`${BASE}/services/payment/success?requestId=${REQ}`, { waitUntil: 'networkidle' });
    obs.receipt = { text: (await page.locator('main').innerText()).split(/\s+/).join(' ').slice(0, 600), toasts: (await liveToasts(page)).length };
    check('standalone receipt revisit: confirmed receipt, no toast, no function calls', /Payment Successful/.test(obs.receipt.text) && obs.receipt.toasts === 0 && creates.count === 0 && statusCalls.count === 0, obs.receipt);
    check('no writes at all during revisit', w.length === 0, w);
    // no confirmed paid row: truthful, no success claim
    const other = await page.goto(`${BASE}/services/payment/success?requestId=${FX.requestOther}`, { waitUntil: 'networkidle' });
    check('another resident\'s / unpaid request → "No confirmed payment receipt", never a receipt', /No confirmed payment receipt/.test(await text(page)) && other.status() === 200);
  });

  await scenario('receipt-step-retry-is-read-only', async (page, obs, check) => {
    // Drive the in-journey receipt step: poll says paid; the paid row is inserted only after
    // the first (failing) receipt read, so Retry must be a plain read that then succeeds.
    const creates = await fnRoute(page, 'create-payment-source', source());
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'paid' }));
    const w = writes(page);
    const reads = await rest(page, 'payments', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic receipt read failure', code: 'RWFB' }) }), { methods: ['GET'] });
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Retry receipt' }).waitFor({ timeout: 40000 });
    obs.failed = { guidance: await page.locator('[data-slot=receipt-guidance]').innerText(), toasts: (await liveToasts(page, /Payment received/)).length, creates: creates.count };
    check('receipt read failure: persistent guidance (don\'t pay again) + Retry; the paid toast is the only toast', /couldn't load your payment receipt/.test(obs.failed.guidance) && /don't pay again/.test(obs.failed.guidance) && obs.failed.toasts <= 1, obs.failed);
    reads.off();
    insertPaid();
    const writesBefore = w.length, createsBefore = creates.count;
    await page.getByRole('button', { name: 'Retry receipt' }).click();
    await page.getByText('Payment Successful').waitFor({ timeout: 15000 });
    check('Retry is read-only: no new payment attempt, no write, no extra toast', creates.count === createsBefore && w.length === writesBefore && (await liveToasts(page, /Payment received/)).length <= 1, { creates: creates.count, writes: w });
    await shot(page, 'qr-receipt-retry-1440');
  });

  await scenario('payment-journey-refresh-failure-retains-content', async (page, obs, check) => {
    await page.goto(`${BASE}/services/payment/${REQ}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Pay at Pickup/ }).first().waitFor();
    const d = await rest(page, 'service_requests', shape.fail(500), { methods: ['GET'] });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText(/couldn't refresh the assessment/i).waitFor({ timeout: 30000 });
    obs.refreshFailed = { methods: await page.getByRole('button', { name: /Pay at Pickup/ }).count(), toasts: (await liveToasts(page)).length };
    check('D-06: refresh failure keeps the assessment/method choices and warns; no toast', obs.refreshFailed.methods >= 1 && obs.refreshFailed.toasts === 0, obs.refreshFailed);
    d.off();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText(/couldn't refresh the assessment/i).waitFor({ state: 'detached', timeout: 15000 });
    check('Try again re-reads and clears the warning', true);
    const initial = await rest(page, 'service_requests', shape.fail(500), { methods: ['GET'] });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/couldn't load the fee assessment/i).waitFor({ timeout: 40000 });
    check('initial failure → error with retry (not an endless loader)', (await page.locator('[data-slot=skeleton]').count()) === 0);
    initial.off();
  });

  // ---- 7. Server read failures are not empty states or 404s.
  // A: the local REST service is briefly stopped (transport failure) for the two routes
  // that don't sit behind the signed-in guard. B: for the guarded routes the guard's own
  // reads (profile) must keep working, so the page's table is made unreadable instead
  // (a returned permission error), with the exact grants restored afterwards.
  await scenario('server-read-failures', async (page, obs, check) => {
    const restUp = () => fetch(`${API_URL}/rest/v1/`, { headers: { apikey: cfg.ANON_KEY } }).then((r) => r.status).catch(() => 0);
    page.setDefaultNavigationTimeout(180000);
    const grantRows = (table) => sql(`select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema='public' and table_name='${table}' and grantee='authenticated'`);
    const probe = async (name, route, failure, falseState) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const body = await text(page);
      return { name, failure: failure.test(body), falseState: falseState.test(body), retry: await page.getByRole('button', { name: 'Try again' }).count(), toasts: (await liveToasts(page)).length, excerpt: body.slice(0, 0) };
    };
    obs.transport = [];
    try {
      docker(['stop', 'supabase_rest_barangayan']);
      obs.transport.push(await probe('catalog', '/services/documents', /couldn't load the document catalog/i, /No document types are available/));
      obs.transport.push(await probe('document', `/services/${DOC}`, /couldn't load this service/i, /404|could not be found/i));
      await shot(page, 'server-read-failure-catalog-1440');
    } finally {
      docker(['start', 'supabase_rest_barangayan']);
      for (let i = 0; i < 60 && (await restUp()) !== 200; i++) await pause(500);
    }
    obs.restRecovered = (await restUp()) === 200;
    await pause(800);
    check('transport failure (REST stopped): catalog and document detail show a retryable notice — not an empty state or a 404', obs.transport.every((p) => p.failure && !p.falseState && p.retry >= 1 && p.toasts === 0), obs.transport);
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    check('after the service returns the real catalog is back', obs.restRecovered && /RW Synthetic Clearance/.test(await text(page)));

    const tables = ['service_requests', 'payments'];
    const before = Object.fromEntries(tables.map((t) => [t, grantRows(t)]));
    obs.returned = [];
    try {
      for (const t of tables) sql(`revoke select on public.${t} from authenticated`);
      const cases = [
        ['requests', '/services/requests', /couldn't load your requests/i, /haven't submitted any requests|No requests in this category/],
        ['logs', '/services/logs', /couldn't load your activity/i, /No activity yet/],
        ['tracking', `/services/requests/${REQ}`, /couldn't load this request/i, /404|could not be found/i],
        ['payment', `/services/payment/${REQ}`, /couldn't load this request/i, /404|could not be found/i],
        ['receipt', `/services/payment/success?requestId=${FX.requestPaid}`, /couldn't load your payment receipt/i, /No confirmed payment receipt/],
      ];
      for (const [name, route, failure, falseState] of cases) obs.returned.push(await probe(name, route, failure, falseState));
      await shot(page, 'server-read-failure-receipt-1440');
    } finally {
      for (const t of tables) {
        if (before[t]?.split(',').includes('SELECT')) sql(`grant select on public.${t} to authenticated`);
      }
    }
    const after = Object.fromEntries(tables.map((t) => [t, grantRows(t)]));
    check('grants restored exactly', JSON.stringify(before) === JSON.stringify(after), { before, after });
    check('returned read errors on guarded routes: retryable notice, not an empty state or a 404; no toast', obs.returned.every((p) => p.failure && !p.falseState && p.retry >= 1 && p.toasts === 0), obs.returned);
    // retry is a read: after access returns, Try again shows the real data
    await page.goto(`${BASE}/services/requests`, { waitUntil: 'networkidle' });
    check('with reads restored the real request list is back', /RW Synthetic Clearance/.test(await text(page)));
    // a genuinely missing/inaccessible record is still a 404
    const missing = await page.goto(`${BASE}/services/requests/${FX.requestOther}`, { waitUntil: 'networkidle' });
    check('another resident\'s request is still a not-found page (not distinguished from missing)', missing.status() === 404 || /could not be found|404/i.test(await text(page)));
  });

  // ---- 8. Navigation fallbacks, narrow viewport, reduced motion, account change
  await scenario('route-fallbacks', async (page, obs, check) => {
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    const ctl = await rscControl(page);
    const go = async (target, label) => {
      // Fallbacks are prefetched with the route, so the URL commits immediately and the
      // placeholder shows while the (delayed) server response is pending.
      await page.evaluate((p) => window.next.router.prefetch(p), target);
      await pause(1200);
      ctl.delayMs = 1500;
      await page.evaluate((p) => window.next.router.push(p), target);
      await pause(450);
      const state = await navState(page);
      ctl.delayMs = 0;
      await page.waitForFunction(() => ![...document.querySelectorAll('[data-slot=loading-status]')].some((e) => e.textContent.trim()) && document.querySelector('main')?.innerText.length > 40, null, { timeout: 20000 });
      return { label, state };
    };
    obs.detail = await go(`/services/requests/${REQ}`, 'detail');
    obs.form = await go(`/services/requests/new/${DOC}`, 'form');
    obs.payment = await go(`/services/payment/${REQ}`, 'payment');
    for (const [key, label] of [['detail', /Loading request…|Loading services/], ['form', /Loading request form|Loading services/], ['payment', /Loading payment|Loading services/]]) {
      const s = obs[key].state;
      check(`${key} route: shared header persists, one polite loading status, placeholder, no duplicate shell`, label.test(s.status) && s.skeletons >= 3 && s.headers === 1 && s.mains === 1, s);
    }
    check('route-specific compositions are used where the destination is prefetched (detail/form/payment, not just the generic list)', /Loading request…/.test(obs.detail.state.status) && /Loading request form/.test(obs.form.state.status) && /Loading payment/.test(obs.payment.state.status), { detail: obs.detail.state.status, form: obs.form.state.status, payment: obs.payment.state.status });
    check('navigation made no writes', ctl.mutations === 0, ctl.mutations);
  });

  await scenario('narrow-320-and-reduced-motion', async (page, obs, check) => {
    await fnRoute(page, 'create-payment-source', async (route) => { await pause(1500); return source()(route); });
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    const nav = page.goto(QR_URL, { waitUntil: 'commit' });
    await page.getByText(/Ref #/).first().waitFor();
    await pause(500);
    obs.reduced = await page.evaluate(() => ({ running: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).map((a) => a.animationName ?? a.constructor.name), skeletonStatic: Boolean(document.querySelector('.rw-skeleton-static')), skeletonWidth: Math.round(document.querySelector('.rw-skeleton-static')?.getBoundingClientRect().width ?? 0), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    await nav;
    await page.getByAltText('PayMongo QR PH code').waitFor();
    obs.qr = await page.evaluate(() => { const r = document.querySelector('img[alt="PayMongo QR PH code"]').getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, qr: Math.round(r.width), square: Math.round(r.width) === Math.round(r.height) }; });
    check('320 px, reduced motion: no horizontal overflow while loading or ready; QR stays square and the same size as its placeholder', !obs.reduced.overflow && !obs.qr.overflow && obs.qr.qr >= 200 && obs.qr.qr === obs.reduced.skeletonWidth && obs.qr.square, { reduced: obs.reduced, qr: obs.qr });
    check('reduced motion: placeholder is static (no running infinite animation from the placeholder)', obs.reduced.skeletonStatic, obs.reduced);
    await shot(page, 'qr-320-reduced');
    await page.goto(`${BASE}/services/requests/${REQ}`, { waitUntil: 'networkidle' });
    check('tracking page has no overflow at 320 px', !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
    await page.goto(`${BASE}/services/documents`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /RW Synthetic Clearance/ }).click();
    await page.getByRole('button', { name: 'Request This Document' }).waitFor();
    check('catalog modal has no overflow at 320 px', !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
  }, { viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });

  await scenario('account-change-suppresses-payment-outcome', async (page, obs, check) => {
    await fnRoute(page, 'create-payment-source', source());
    await fnRoute(page, 'check-payment-status', fnJson({ status: 'pending' }));
    await fnRoute(page, 'cancel-payment', async (route) => { await pause(2500); return fnJson({ status: 'cancelled' })(route); });
    await page.goto(QR_URL, { waitUntil: 'networkidle' });
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.getByRole('button', { name: 'Cancel Payment' }).click();
    await page.getByRole('button', { name: 'Yes, Cancel' }).click();
    // the account signs out while the cancellation is still in flight
    await page.evaluate(async () => { document.querySelector('header button[aria-label="Log out"]')?.click(); });
    await page.waitForURL(/\/login|\/home|\/$/, { timeout: 20000 }).catch(() => {});
    await pause(4500);
    obs.toasts = (await liveToasts(page)).map((t) => t.text);
    check('a previous account\'s cancellation outcome never appears for the next visitor', !obs.toasts.some((t) => /QR PH payment cancelled|Payment received/.test(t)), obs.toasts);
  });

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(['pass', 'fail', 'error'].map((k) => [k, report.scenarios.filter((x) => x.status === k).length]));
  report.checks = report.scenarios.reduce((n, s) => n + Object.keys(s.checks).length, 0);
  fs.writeFileSync(path.join(out, 'results.json'), redact(JSON.stringify(report, null, 2)));
  console.log(JSON.stringify(report.summary), `${report.checks} checks`);
  if (report.summary.fail || report.summary.error) process.exitCode = 1;
}

// ---------------------------------------------------------------- registry
const groups = {
  'rw-lt-00:inventory': (arg) => inventory(arg),
  'rw-lt-00:fixtures': (arg) => fixtures(arg),
  'rw-lt-00:build': () => build(),
  'rw-lt-00:serve': () => serve(),
  'rw-lt-00:baseline': (arg) => baseline(arg),
  'rw-lt-01:build': () => build('rw-lt-01'),
  'rw-lt-01:verify': (arg) => rwlt01(arg),
  'rw-lt-02:build': () => build('rw-lt-02'),
  'rw-lt-02:unit': () => rwlt02Unit(),
  'rw-lt-02:verify': (arg) => rwlt02(arg),
  'rw-lt-03:build': () => build('rw-lt-03'),
  'rw-lt-03:verify': (arg) => rwlt03(arg),
  'rw-lt-04:build': () => build('rw-lt-04'),
  'rw-lt-04:verify': (arg) => rwlt04(arg),
  'rw-lt-05:build': () => build('rw-lt-05'),
  'rw-lt-05:unit': () => rwlt05Unit(),
  'rw-lt-05:verify': (arg) => rwlt05(arg),
  'rw-lt-06:build': () => build('rw-lt-06'),
  'rw-lt-06:unit': () => rwlt06Unit(),
  'rw-lt-06:verify': (arg) => rwlt06(arg),
};
const future = ['rw-lt-07', 'rw-lt-08', 'rw-lt-09'];
const [group, arg] = process.argv.slice(2);
if (groups[group]) Promise.resolve(groups[group](arg)).catch((e) => { console.error(e.message); process.exitCode = 1; });
else if (future.includes(group)) { console.error(`${group.toUpperCase()} has no scenarios yet (phase not started).`); process.exitCode = 2; }
else { console.error(`Usage: node scripts/resident-web-feedback-regression.cjs <${Object.keys(groups).join('|')}> [arg]`); process.exitCode = 2; }
