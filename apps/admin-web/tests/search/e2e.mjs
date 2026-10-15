// Real Admin Web -> session-authenticated API -> local Supabase -> record pages.
// Fault injection is limited to recovery/race tests; normal data reads are real.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const require = createRequire(path.join(app, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const { chromium } = require('playwright');
const evidence = path.join(root, 'plans/evidence/admin-web-search');
fs.mkdirSync(evidence, { recursive: true });
const sql = statement => {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: statement, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'Local database unavailable');
  return result.stdout.trim();
};
const status = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx supabase status -o json'], { cwd: root, encoding: 'utf8', windowsHide: true });
if (status.status !== 0) throw new Error('Local Supabase unavailable');
const local = JSON.parse(status.stdout);
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(local.API_URL).hostname), 'This test must never write to a hosted database');
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  BARANGAYAN_PREVIEW_DIST_DIR: '.next-admin-search-e2e', NEXT_TELEMETRY_DISABLED: '1' };
delete env.SUPABASE_SERVICE_ROLE_KEY;
const base = 'http://127.0.0.1:4199';
const nextBin = require.resolve('next/dist/bin/next');
const tenants = [randomUUID(), randomUUID()];
const ids = Object.fromEntries(['announcement', 'archived', 'foreign', 'help', 'emergency', 'center', 'zone', 'schedule', 'punctuation', 'foreignResident', 'rankExact', 'rankPrefix', 'rankBody'].map(name => [name, randomUUID()]));
const extraResidents = Array.from({ length: 12 }, () => randomUUID());
const loadResidents = Array.from({ length: 500 }, () => randomUUID());
const accounts = [];
const report = { status: 'running', checks: [], pageErrors: [], limitations: ['Synthetic fixtures in the real local Supabase stack. Hosted data was not changed. Delays and HTTP failures are injected only for recovery tests.'] };
let browser, page, server, serverLog = '';
const check = name => { report.checks.push(name); console.log(`Passed: ${name}`); };
const save = () => fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
async function ready() {
  await page.getByRole('region', { name: 'Search results', exact: true }).getByRole('status').filter({ hasText: /results for/ }).waitFor();
}
async function api(params, context = page.request) {
  const response = await context.get(`${base}/api/search?${new URLSearchParams(params)}`);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['cache-control'], 'private, no-store');
  return response.json();
}
async function sessionContext(account) {
  const context = await browser.newContext();
  let cookies = [];
  const db = createServerClient(local.API_URL, local.ANON_KEY, { cookies: { getAll: () => [], setAll: values => { cookies = values; } } });
  const result = await db.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.equal(result.error, null);
  await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: base, sameSite: 'Lax' })));
  return context;
}
try {
  for (let index = 0; index < 4; index++) {
    const email = `admin-search-${randomUUID()}@example.test`, password = randomUUID() + 'Aa1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    accounts.push({ id: data.user.id, email, password });
  }
  let seed = fs.readFileSync(path.join(root, 'supabase/tests/admin_record_lifecycle.test.sql'), 'utf8');
  seed = seed.slice(seed.indexOf('insert into public.barangays'), seed.indexOf('create temp table lifecycle_fixture'));
  seed = seed.replace(/insert into auth\.users[\s\S]+?;\r?\n/, '').replaceAll('Lifecycle', 'Searchprobe');
  const substitutions = new Map([...seed.matchAll(/[a-f]1150000-0000-0000-0000-\d{12}/g)].map(match => [match[0], randomUUID()]));
  for (let index = 0; index < 2; index++) substitutions.set(`a1150000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, tenants[index]);
  for (let index = 0; index < 4; index++) substitutions.set(`b1150000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, accounts[index].id);
  for (const [before, after] of substitutions) seed = seed.replaceAll(before, after);
  sql(`begin; ${seed}
    insert into auth.users(id,email,raw_user_meta_data) values ${extraResidents.map(id => `('${id}','search-person-${id}@example.test','{}')`).join(',')};
    insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name) values ${extraResidents.map((id, index) => `('${id}','${tenants[0]}','resident','Searchprobe Person ${index}','Searchprobe','Person')`).join(',')};
    insert into auth.users(id,email,raw_user_meta_data) values ${loadResidents.map(id => `('${id}','load-person-${id}@example.test','{}')`).join(',')};
    insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name) values ${loadResidents.map((id, index) => `('${id}','${tenants[0]}','resident','Loadprobe Person ${index}','Loadprobe','Person ${index}')`).join(',')};
    insert into auth.users(id,email,raw_user_meta_data) values ('${ids.foreignResident}','foreign-${ids.foreignResident}@example.test','{}');
    insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name) values ('${ids.foreignResident}','${tenants[1]}','resident','Searchprobe Foreign Resident','Searchprobe','Foreign');
    insert into public.announcements(id,barangay_id,title,body) values
      ('${ids.announcement}','${tenants[0]}','Searchprobe community update','Actual searchable preview for the admin.'),
      ('${ids.archived}','${tenants[0]}','Searchprobe archived update','Archived content'),
      ('${ids.foreign}','${tenants[1]}','Searchprobe foreign update','Other barangay content'),
      ('${ids.punctuation}','${tenants[0]}','Literal A.* 100% under_score, comma (quote) "x"','Punctuation test'),
      ('${ids.rankExact}','${tenants[0]}','Qualityprobe','Exact title'),
      ('${ids.rankPrefix}','${tenants[0]}','Qualityprobe community update','Prefix title'),
      ('${ids.rankBody}','${tenants[0]}','Other content','Qualityprobe body match');
    update public.announcements set deleted_at=now() where id='${ids.archived}';
    insert into public.faq_articles(id,barangay_id,question,answer,is_active) values ('${ids.help}','${tenants[0]}','Searchprobe help question','Full useful answer',false);
    insert into public.emergency_information(id,barangay_id,category,title,body) values ('${ids.emergency}','${tenants[0]}','guidelines','Searchprobe emergency guide','Emergency steps');
    insert into public.evacuation_centers(id,barangay_id,name,address,position) values ('${ids.center}','${tenants[0]}','Searchprobe evacuation center','Fixture street','{"lat":14.7,"lng":121.1}');
    insert into public.waste_zones(id,barangay_id,name,description) values ('${ids.zone}','${tenants[0]}','Searchprobe waste zone','Collection zone');
    insert into public.waste_collection_schedules(id,barangay_id,zone_id,waste_type,day_of_week,start_time,end_time,notes) values
      ('${ids.schedule}','${tenants[0]}','${ids.zone}','biodegradable',1,'08:00','10:00','Searchprobe collection schedule');
    commit;`);
  if (process.env.ADMIN_SEARCH_REUSE_BUILD !== '1') {
    console.log('Building Admin Web against local Supabase.');
    const build = spawn(process.execPath, [nextBin, 'build', '--webpack'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    build.stdout.on('data', chunk => { log += chunk; }); build.stderr.on('data', chunk => { log += chunk; });
    const code = await new Promise(resolve => build.once('exit', resolve));
    fs.writeFileSync(path.join(evidence, 'build.txt'), log);
    if (code !== 0) throw new Error(log.slice(-4000));
  }
  server = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', '4199'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverLog += chunk; }); server.stderr.on('data', chunk => { serverLog += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await fetch(base + '/login').then(response => response.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
    if (attempt === 59) throw new Error('Admin Web did not start.');
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('https://*.supabase.co/**', route => route.abort('blockedbyclient'));
  await page.goto(base + '/login');
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[0].password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const navbar = page.getByRole('combobox', { name: 'Search admin content' });
  await navbar.click();
  await page.getByText('Find people, requests, reports, and community content.', { exact: true }).waitFor();
  await navbar.fill('S');
  await page.getByText('Type at least 2 characters to search.', { exact: true }).waitFor();
  check('Empty query guidance and minimum query length');
  await navbar.fill('Searchprobe');
  await page.getByRole('option', { name: /^Residents / }).first().waitFor();
  await page.screenshot({ path: path.join(evidence, 'navbar-suggestions.png') });
  // Arrow Up from an unselected input must choose the last visible item.
  const optionIds = await page.getByRole('option').evaluateAll(options => options.map(option => option.id));
  await navbar.press('ArrowUp'); assert.equal(await navbar.getAttribute('aria-activedescendant'), optionIds.at(-1));
  const lastBounds = await page.locator('[aria-selected="true"]').boundingBox();
  const listBounds = await page.getByRole('listbox').boundingBox();
  assert.ok(lastBounds && listBounds && lastBounds.y + lastBounds.height <= listBounds.y + listBounds.height + 1);
  await navbar.press('Escape'); await navbar.click(); await page.getByRole('listbox').waitFor();
  await navbar.press('ArrowDown');
  assert.ok(await navbar.getAttribute('aria-activedescendant'));
  await navbar.press('Enter');
  await page.waitForURL('**/search?q=Searchprobe'); await ready();
  const data = await api({ q: 'Searchprobe' });
  assert.equal(data.groups.length, 15); assert.ok(data.groups.every(group => !group.unavailable && group.total > 0));
  assert.ok(!JSON.stringify(data).includes(ids.foreign)); assert.ok(!JSON.stringify(data).includes(ids.archived));
  assert.ok(!JSON.stringify(data).includes(ids.foreignResident));
  check('Keyboard submission, grouped real-data results across all 15 categories, tenant and archive boundaries');
  const ranked = await api({ q: 'Qualityprobe', mode: 'suggestions' });
  assert.equal(ranked.countsExact, false);
  assert.deepEqual(ranked.groups.find(group => group.category === 'announcements').hits.map(hit => hit.id), [ids.rankExact, ids.rankPrefix]);
  const fallback = await api({ q: 'body match', mode: 'suggestions' });
  assert.equal(fallback.groups.find(group => group.category === 'announcements').hits[0].id, ids.rankBody);
  const latency = { suggestions: [], results: [], fixtureResidents: loadResidents.length };
  for (const mode of ['suggestions', 'results']) {
    for (let iteration = 0; iteration < 5; iteration++) {
      const start = performance.now();
      const response = await api({ q: 'Loadprobe', ...(mode === 'suggestions' ? { mode } : {}) });
      latency[mode].push(Math.round(performance.now() - start));
      assert.ok(response.groups.every(group => !group.unavailable));
      if (mode === 'results') assert.equal(response.groups[0].total, loadResidents.length);
    }
    assert.ok(Math.max(...latency[mode]) < 2000, `${mode} requests exceed the 2s local budget: ${latency[mode]}`);
  }
  report.performance = latency;
  check('Real title-prefix ranking, body fallback, and response-time budgets with 500 additional residents');
  await page.screenshot({ path: path.join(evidence, 'grouped-results.png') });
  // Every category result opens its exact record, including records off table page one.
  for (const group of data.groups) {
    const hit = group.hits[0];
    await page.goto(base + hit.href);
    if (group.category === 'requests') await page.getByText(`Ref #${hit.title}`, { exact: true }).waitFor();
    else { await page.getByRole('heading', { level: 1, name: hit.title, exact: true }).waitFor(); await page.getByRole('link', { name: /Open .* workspace/ }).waitFor(); }
  }
  check('All 15 result categories navigate to corresponding record content');
  await page.goto(base + '/search/announcements/' + ids.announcement + '?q=Searchprobe');
  await page.getByText('Actual searchable preview for the admin.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Back to search results' }).click(); await ready();
  await page.getByRole('navigation', { name: 'Search categories' }).getByRole('link', { name: /Residents/ }).click();
  await page.getByRole('navigation', { name: 'Search categories' }).getByRole('link', { name: /^Residents/ }).and(page.locator('[aria-current="page"]')).waitFor();
  await ready();
  const residents = page.getByRole('region', { name: 'Residents', exact: true });
  assert.equal(await residents.getByRole('link').count(), 10);
  await page.getByRole('link', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 2', { exact: true }).waitFor(); await ready();
  assert.equal(await residents.getByRole('link').count(), 3);
  await residents.getByRole('link').first().click();
  await page.getByRole('link', { name: 'Back to search results' }).click();
  await page.getByText('Page 2 of 2', { exact: true }).waitFor(); await ready();
  assert.equal(await residents.getByRole('link').count(), 3);
  const clamped = await api({ q: 'Searchprobe', category: 'residents', page: '999' });
  assert.equal(clamped.page, 2); assert.equal(clamped.groups[0].hits.length, 3);
  check('Specific record previews, return to results, category filters, complete pagination, and deep-page clamping');
  for (const q of ['A.*', '100%', 'under_score', ', comma', '(quote)', '"x"']) {
    const literal = await api({ q });
    const hits = literal.groups.flatMap(group => group.hits);
    assert.deepEqual(hits.map(hit => hit.id), [ids.punctuation], `Literal search: ${q}`);
  }
  const multi = await api({ q: 'Searchprobe Resident' });
  assert.ok(multi.groups[0].hits.some(hit => hit.id === accounts[1].id));
  check('Literal punctuation and multi-word query semantics against PostgreSQL');
  await page.goto(base + '/search?q=zz-no-match-unique'); await ready();
  await page.getByRole('heading', { name: 'No results found' }).waitFor();
  await page.goto(base + '/search');
  await page.getByRole('heading', { name: 'What are you looking for?' }).waitFor();
  check('No-result and empty results-page states');
  // Race: delayed old query may settle after the new query; its hits must stay hidden.
  await page.route('**/api/search?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'Searchprobe') {
      const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 600));
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  const oldRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/search' && new URL(request.url()).searchParams.get('q') === 'Searchprobe');
  await navbar.fill('Searchprobe'); await oldRequest;
  await page.getByText('Searching…', { exact: true }).waitFor();
  assert.equal(await page.getByRole('listbox').getAttribute('aria-busy'), 'true');
  await page.screenshot({ path: path.join(evidence, 'suggestions-loading.png') });
  await navbar.fill('zz-no-match-unique');
  await page.getByText(/No results for “zz-no-match-unique”/).waitFor();
  await page.waitForTimeout(750);
  assert.equal(await page.getByRole('option', { name: /^Residents / }).count(), 0);
  await page.unroute('**/api/search?**');
  await navbar.press('Escape'); assert.equal(await navbar.getAttribute('aria-expanded'), 'false');
  await navbar.click(); await page.getByRole('button', { name: 'Clear admin search' }).click();
  assert.equal(await navbar.inputValue(), '');
  await page.getByRole('option').filter({ hasText: 'Searchprobe' }).waitFor();
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  check('Rapid typing race protection, Escape, clearing, and recent-search management');
  // Input stays responsive while requests are debounced; composition waits until committed.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.searchPaintTimes = [];
    document.querySelector('[role="combobox"]').addEventListener('input', () => {
      const start = performance.now(); requestAnimationFrame(() => window.searchPaintTimes.push(performance.now() - start));
    });
  });
  const requestLog = [];
  const capture = request => { if (new URL(request.url()).pathname === '/api/search') requestLog.push(request.url()); };
  page.on('request', capture);
  await navbar.fill(''); await navbar.pressSequentially('Searchprobe', { delay: 8 });
  await page.getByRole('option', { name: /^Residents / }).first().waitFor();
  page.off('request', capture);
  const paintTimes = await page.evaluate(() => window.searchPaintTimes);
  assert.ok(paintTimes.length && Math.max(...paintTimes) < 250, `Typing paint budget exceeded: ${paintTimes}`);
  assert.equal(requestLog.length, 1, 'Typing should produce one debounced API request');
  report.performance.inputPaintMs = paintTimes.map(value => Math.round(value));
  report.performance.cpuThrottle = 4;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  await navbar.fill('');
  const imeRequests = [];
  const captureIme = request => { if (new URL(request.url()).pathname === '/api/search') imeRequests.push(request.url()); };
  page.on('request', captureIme);
  await navbar.dispatchEvent('compositionstart'); await navbar.fill('Qualityprobe'); await page.waitForTimeout(350);
  assert.equal(imeRequests.length, 0, 'Incomplete IME composition must not issue requests');
  await navbar.dispatchEvent('compositionend'); await page.getByRole('option', { name: /^Announcements Qualityprobe/ }).first().waitFor();
  page.off('request', captureIme); assert.equal(imeRequests.length, 1);
  await navbar.press('Escape');
  check('Debounced typing stays within paint budget at 4x CPU throttle; IME composition causes one committed search');
  // HTTP outage recovery through both surfaces.
  await page.route('**/api/search?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture outage"}' }));
  await navbar.fill('Searchprobe');
  await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  await page.unroute('**/api/search?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('option', { name: /^Residents / }).first().waitFor();
  await navbar.press('Escape');
  await page.route('**/api/search?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture outage"}' }));
  await page.goto(base + '/search?q=Searchprobe');
  await page.getByRole('heading', { name: 'Search is unavailable' }).waitFor();
  await page.unroute('**/api/search?**'); await page.getByRole('button', { name: 'Try again' }).click(); await ready();
  // A partial response keeps available matches and says which category failed.
  await page.route('**/api/search?**', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.groups[0] = { ...body.groups[0], hits: [], total: 0, unavailable: true };
    await route.fulfill({ response, json: body });
  });
  await page.reload(); await ready(); await page.getByRole('alert').filter({ hasText: 'Could not load Residents' }).waitFor();
  await page.unroute('**/api/search?**'); await page.getByRole('button', { name: 'Retry search' }).click(); await ready();
  check('Navbar and results-page outage recovery; partial failures remain explicit');
  await page.route('**/api/search?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"query":"Searchprobe","groups":[{"hits":null}]}' }));
  await page.reload(); await page.getByRole('heading', { name: 'Search is unavailable' }).waitFor();
  await page.unroute('**/api/search?**'); await page.getByRole('button', { name: 'Try again' }).click(); await ready();
  await page.route('**/api/search?**', async route => { const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 800)); await route.fulfill({ response }); });
  await page.reload(); await page.getByRole('region', { name: 'Search results', exact: true }).getByRole('status').filter({ hasText: 'Searching your barangay' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'results-loading.png') });
  await ready(); await page.unroute('**/api/search?**');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/search?**', async route => { const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 800)); await route.fulfill({ response }); });
  await navbar.fill('Qualityprobe'); await page.getByText('Searching…', { exact: true }).waitFor();
  const animations = await page.locator('[aria-hidden="true"] [class*="skeletonIcon"]').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName));
  assert.ok(animations.length && animations.every(name => name === 'none'));
  await page.getByRole('option', { name: /^Announcements Qualityprobe/ }).first().waitFor();
  await page.unroute('**/api/search?**'); await page.emulateMedia({ reducedMotion: 'no-preference' }); await navbar.press('Escape');
  check('Malformed responses recover without rendering errors; slow loading and reduced-motion animations are verified');
  const guest = await browser.newContext();
  assert.equal((await guest.request.get(base + '/api/search?q=Searchprobe')).status(), 401); await guest.close();
  const residentContext = await sessionContext(accounts[1]);
  assert.equal((await residentContext.request.get(base + '/api/search?q=Searchprobe')).status(), 403); await residentContext.close();
  const foreignContext = await sessionContext(accounts[3]);
  const foreign = await api({ q: 'Searchprobe' }, foreignContext.request);
  assert.ok(!JSON.stringify(foreign).includes(ids.announcement)); assert.ok(JSON.stringify(foreign).includes(ids.foreign));
  const foreignPage = await foreignContext.newPage(); await foreignPage.goto(base + '/search/announcements/' + ids.announcement);
  await foreignPage.getByRole('heading', { name: 'Record unavailable' }).waitFor(); await foreignContext.close();
  await page.goto(base + '/search/announcements/' + ids.archived);
  await page.getByRole('heading', { name: 'Record unavailable' }).waitFor();
  sql(`update public.profiles set deleted_at=now() where id='${accounts[0].id}';`);
  assert.equal((await page.request.get(base + '/api/search?q=Searchprobe')).status(), 403);
  sql(`update public.profiles set deleted_at=null where id='${accounts[0].id}';`);
  check('Anonymous and resident rejection, archived-admin rejection, cross-tenant search and direct-record access denial');
  await page.goto(base + '/search?q=Searchprobe'); await ready();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(evidence, 'dark-results.png') });
  await page.setViewportSize({ width: 820, height: 1050 });
  await navbar.fill('Searchprobe'); await page.getByRole('option', { name: /^Residents / }).first().waitFor();
  const inputBox = await navbar.boundingBox(); const suggestionBox = await page.getByRole('listbox').boundingBox();
  assert.ok(inputBox && suggestionBox && suggestionBox.x >= 0 && suggestionBox.x + suggestionBox.width <= 820);
  await page.screenshot({ path: path.join(evidence, 'compact-admin-search.png') });
  check('Dark theme and compact admin-web layout');
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error); console.error(report.error); process.exitCode = 1;
  if (page) { report.failurePage = await page.locator('body').innerText().catch(() => ''); await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {}); }
} finally {
  await browser?.close(); server?.kill();
  fs.writeFileSync(path.join(evidence, 'server.txt'), serverLog);
  try {
    const scope = tenants.map(id => `'${id}'`).join(',');
    sql(`begin;
      delete from public.admin_audit_log where barangay_id in (${scope});
      delete from public.payments where barangay_id in (${scope});
      delete from public.service_requests where barangay_id in (${scope});
      delete from public.incidents where barangay_id in (${scope});
      delete from public.drive_registrations where drive_id in (select id from public.medical_drives where barangay_id in (${scope}));
      delete from public.medical_drives where barangay_id in (${scope});
      delete from public.announcements where barangay_id in (${scope});
      delete from public.faq_articles where barangay_id in (${scope});
      delete from public.emergency_information where barangay_id in (${scope});
      delete from public.waste_collection_schedules where barangay_id in (${scope});
      delete from public.waste_zones where barangay_id in (${scope});
      delete from public.evacuation_centers where barangay_id in (${scope});
      delete from public.document_types where barangay_id in (${scope});
      delete from public.profiles where barangay_id in (${scope});
      delete from public.barangays where id in (${scope});
      delete from auth.users where id in (${[...extraResidents, ...loadResidents, ids.foreignResident].map(id => `'${id}'`).join(',')}); commit;`);
    for (const account of accounts) { const { error } = await admin.auth.admin.deleteUser(account.id); if (error) throw error; }
    report.fixtureCleanup = 'passed';
  } catch (error) { report.fixtureCleanup = String(error); process.exitCode = 1; }
  save();
}
