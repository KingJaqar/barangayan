// Complete resident-web → session-authenticated API → real local Supabase flow.
// All fixtures have generated tenant/account IDs and are removed in finally.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../..');
const app = path.join(root, 'apps/resident-web');
const require = createRequire(path.join(app, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const evidence = path.join(root, 'plans/evidence/resident-web-search');
fs.mkdirSync(evidence, { recursive: true });
const sql = statement => {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'Local database unavailable');
  return result.stdout.trim();
};
const status = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx supabase status -o json'], { cwd: root, encoding: 'utf8', windowsHide: true });
if (status.status !== 0) throw new Error('Local Supabase unavailable');
const local = JSON.parse(status.stdout);
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(local.API_URL).hostname), 'This test must never write to a hosted database');
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// No elevated database key enters the resident app's environment.
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY, BARANGAYAN_PREVIEW_DIST_DIR: '.next-resident-search-e2e', NEXT_TELEMETRY_DISABLED: '1' };
delete env.SUPABASE_SERVICE_ROLE_KEY;
const base = 'http://127.0.0.1:4198';
const nextBin = require.resolve('next/dist/bin/next');
const tenants = [randomUUID(), randomUUID()];
const ids = Object.fromEntries(['document', 'announcement', 'drive', 'help', 'report', 'request', 'otherReport', 'otherRequest', 'inactive', 'archived', 'foreignDrive', 'foreignHelp', 'punctuation'].map(name => [name, randomUUID()]));
const accounts = [];
const report = { status: 'running', checks: [], pageErrors: [], metrics: {}, limitations: ['Synthetic fixtures in the local Supabase stack; no hosted data or payment provider calls. HTTP failures/delays are injected only for recovery/race checks. Performance measurements describe this local environment, not hosted production latency.'] };
let browser, page, server, serverLog = '';
const check = name => { report.checks.push(name); console.log(`Passed: ${name}`); };
const save = () => fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
async function assertSearchReady() {
  await page.getByRole('region', { name: 'Search results', exact: true }).getByRole('status').filter({ hasText: /results? for|Showing available/ }).waitFor();
}
async function api(params, context = page.request) {
  const response = await context.get(`${base}/api/search?${new URLSearchParams(params)}`);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['cache-control'], 'private, no-store');
  return response.json();
}
try {
  for (let index = 0; index < 3; index++) {
    const email = `resident-search-${randomUUID()}@example.test`, password = randomUUID() + 'Aa1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    accounts.push({ id: data.user.id, email, password });
  }
  sql(`begin;
    insert into public.barangays(id,name) values ('${tenants[0]}','Search fixture A'),('${tenants[1]}','Search fixture B');
    ${accounts.map((account, index) => `insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,house_no,street,sex,employment_status,mobile_number,birth_date,email) values ('${account.id}','${tenants[index === 2 ? 1 : 0]}','resident','Search Resident','Search','Resident','1','Fixture Street','female','student','09171234567','2000-01-01','${account.email}');`).join('\n')}
    insert into public.document_types(id,barangay_id,name,description,fee_centavos) values ('${ids.document}','${tenants[0]}','Searchprobe Clearance','Searchprobe proof of residency and eligibility-only-token',5000);
    insert into public.document_types(id,barangay_id,name,is_active,deleted_at) values ('${ids.inactive}','${tenants[0]}','Searchprobe hidden inactive',false,null),('${ids.archived}','${tenants[0]}','Searchprobe hidden archived',true,now());
    insert into public.announcements(id,barangay_id,title,body,detailed_description) values ('${ids.announcement}','${tenants[0]}','Searchprobe Community update','Searchprobe meeting this week.','Full announcement detail for residents.');
    insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,location,stock_total,stock_remaining) values ('${ids.drive}','${tenants[0]}','Searchprobe Vaccination','vaccination',current_date+7,'08:00','12:00','Searchprobe all adult residents','Searchprobe community clinic',20,20),('${ids.foreignDrive}','${tenants[1]}','Searchprobe Foreign vaccination','vaccination',current_date+7,'08:00','12:00','Adults','Other clinic',20,20);
    insert into public.faq_articles(id,barangay_id,question,answer) values ('${ids.help}','${tenants[0]}','Searchprobe How do I request a clearance?','Searchprobe gather your requirements and request online.'),('${ids.foreignHelp}','${tenants[1]}','Searchprobe foreign tenant help','Must not appear for tenant A.'),('${ids.punctuation}','${tenants[0]}','Searchprobe 100%_literal, "quote"','Literal punctuation is searchable.');
    insert into public.faq_articles(barangay_id,question,answer) select '${tenants[0]}','Searchprobe pagination '||lpad(n::text,2,'0'),'Pagination article '||n from generate_series(1,25) n;
    insert into public.faq_articles(barangay_id,question,answer) select '${tenants[0]}','A quality article '||lpad(n::text,2,'0'),'Qualityrank body content '||n from generate_series(1,25) n;
    insert into public.faq_articles(barangay_id,question,answer) select '${tenants[0]}','Z Qualityrank title '||lpad(n::text,2,'0'),'Title priority content '||n from generate_series(1,21) n;
    insert into public.faq_articles(barangay_id,question,answer) select '${tenants[0]}','Load fixture article '||n,'Unrelated fixture content for workload checks' from generate_series(1,3000) n;
    insert into public.incidents(id,barangay_id,reporter_id,title,description,location) values ('${ids.report}','${tenants[0]}','${accounts[0].id}','Searchprobe Street concern','Searchprobe damaged pavement','{"lat":14.7,"lng":121.1}'),('${ids.otherReport}','${tenants[0]}','${accounts[1].id}','Searchprobe Private other resident','Private concern','{"lat":14.7,"lng":121.1}');
    insert into public.service_requests(id,barangay_id,resident_id,document_type_id,requester_notes) values ('${ids.request}','${tenants[0]}','${accounts[0].id}','${ids.document}','Searchprobe owner note'),('${ids.otherRequest}','${tenants[0]}','${accounts[1].id}','${ids.document}','Searchprobe private other note');
    commit;`);

  if (process.env.SEARCH_E2E_REUSE_BUILD !== '1') {
    console.log('Building resident web with local Supabase.');
    const build = spawn(process.execPath, [nextBin, 'build', '--webpack'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    build.stdout.on('data', value => { log += value; }); build.stderr.on('data', value => { log += value; });
    const code = await new Promise(resolve => build.once('exit', resolve));
    fs.writeFileSync(path.join(evidence, 'build.txt'), log);
    if (code !== 0) throw new Error(log.slice(-3000));
  }
  server = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', '4198'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', value => { serverLog += value; }); server.stderr.on('data', value => { serverLog += value; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await fetch(base + '/login').then(response => response.ok).catch(() => false)) break;
    if (attempt === 99) throw new Error('Resident test server did not start');
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const browserOptions = { headless: true };
  if (!fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
  browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.addInitScript(id => localStorage.setItem(`barangayan-resident-web-onboarded:${id}`, '1'), accounts[0].id);
  await page.goto(base + '/login?next=%2Fhome');
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[0].password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/home');
  const input = () => page.getByRole('combobox', { name: 'Search your barangay' });
  await input().click();
  await page.getByRole('listbox', { name: 'Search suggestions' }).waitFor();
  assert.equal(await page.getByRole('option').count(), 4);
  await input().fill('Searchprobe');
  await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  assert.ok(await page.getByRole('option').nth(2).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  }), 'Home suggestions must stay above the quick-action cards');
  await page.screenshot({ path: path.join(evidence, 'suggestions-desktop.png') });
  await input().press('Escape');
  assert.equal(await input().getAttribute('aria-expanded'), 'false');
  await input().press('Enter');
  await page.waitForURL('**/search?q=Searchprobe');
  await assertSearchReady();
  await page.screenshot({ path: path.join(evidence, 'results-desktop.png') });
  check('Home query → debounced real-data suggestions → Enter → grouped results');

  const result = await api({ q: 'Searchprobe' });
  assert.deepEqual(result.groups.map(g => g.category), ['documents', 'announcements', 'health', 'help', 'requests', 'reports']);
  const found = result.groups.flatMap(group => group.results);
  assert.ok(found.some(row => row.id === ids.request)); assert.ok(found.some(row => row.id === ids.report));
  for (const id of [ids.otherReport, ids.otherRequest, ids.inactive, ids.archived, ids.foreignDrive, ids.foreignHelp]) assert.ok(!found.some(row => row.id === id));
  assert.ok(result.groups.every(group => !group.failed));
  check('Real API results enforce tenant, owner, active and archive filters');
  const spoofed = await api({ q: 'Searchprobe', category: 'reports', userId: accounts[1].id, barangayId: tenants[1] });
  assert.equal(spoofed.groups[0].count, 1); assert.equal(spoofed.groups[0].results[0].id, ids.report);
  // Next.js streamed pages can send 200 before notFound() resolves; assert the
  // rendered unavailable-content state and absence of protected content instead.
  await page.goto(base + '/health/drives/' + ids.foreignDrive);
  await page.getByRole('heading', { name: '404', exact: true }).waitFor();
  assert.equal(await page.getByText('Searchprobe Foreign vaccination', { exact: true }).count(), 0);
  await page.goto(base + '/reports/' + ids.otherReport);
  await page.getByRole('heading', { name: '404', exact: true }).waitFor();
  assert.equal(await page.getByText('Searchprobe Private other resident', { exact: true }).count(), 0);
  check('Caller-supplied tenant/owner identifiers are ignored; unauthorized direct links show 404 content');

  const bodySearch = await api({ q: 'eligibility-only-token' });
  assert.equal(bodySearch.groups.find(g => g.category === 'documents').results[0].id, ids.document);
  const literal = await api({ q: '100%_literal, "quote"', category: 'help' });
  assert.equal(literal.groups[0].count, 1); assert.equal(literal.groups[0].results[0].id, ids.punctuation);
  const injection = await api({ q: 'x",id.not.is.null)', category: 'help' });
  assert.equal(injection.groups[0].count, 0); assert.equal(injection.groups[0].failed, false);
  check('Body matches, literal punctuation and filter-injection resistance');
  const words = await api({ q: 'Clearance Searchprobe', category: 'documents' });
  assert.equal(words.groups[0].count, 1); assert.equal(words.groups[0].results[0].id, ids.document);
  check('Multiple search words match in any order');

  const reference = sql(`select reference_number from public.service_requests where id='${ids.request}';`);
  const requestMatch = await api({ q: reference, category: 'requests' });
  assert.equal(requestMatch.groups[0].count, 1); assert.equal(requestMatch.groups[0].results[0].id, ids.request);
  check('Personal request reference lookup');
  const mixedReference = await api({ q: 'Clearance ' + reference, category: 'requests' });
  assert.equal(mixedReference.groups[0].count, 1); assert.equal(mixedReference.groups[0].results[0].id, ids.request);
  const ranked = [];
  for (let rankPage = 1; rankPage <= 3; rankPage++) {
    const response = await api({ q: 'Qualityrank', category: 'help', page: String(rankPage) });
    assert.equal(response.groups[0].count, 46); assert.equal(response.groups[0].failed, false);
    ranked.push(...response.groups[0].results);
  }
  assert.equal(ranked.length, 46); assert.equal(new Set(ranked.map(row => row.id)).size, 46);
  assert.ok(ranked.slice(0, 21).every(row => row.title.includes('Qualityrank')));
  assert.ok(ranked.slice(21).every(row => !row.title.includes('Qualityrank')));
  const outOfRange = await api({ q: 'Qualityrank', category: 'help', page: '999' });
  assert.equal(outOfRange.page, 3); assert.equal(outOfRange.groups[0].results.length, 6);
  const malformedPage = await api({ q: 'Searchprobe', category: 'help', page: 'Infinity' });
  assert.equal(malformedPage.page, 1); assert.equal(malformedPage.groups[0].failed, false);
  check('Title relevance precedes body matches across pagination, without duplicates or out-of-range backend errors');
  const durations = [];
  await api({ q: 'Searchprobe', suggestions: '1' });
  for (let batch = 0; batch < 2; batch++) {
    await Promise.all(Array.from({ length: 6 }, async () => {
      const started = performance.now();
      const response = await api({ q: 'Searchprobe', suggestions: '1' });
      assert.ok(response.groups.every(group => !group.failed));
      durations.push(Math.round(performance.now() - started));
    }));
  }
  durations.sort((a,b) => a-b);
  report.metrics.localConcurrentSearch = { samples: durations.length, concurrency: 6, additionalUnmatchedArticles: 3000, medianMs: durations[Math.floor(durations.length / 2)], p95Ms: durations[Math.ceil(durations.length * .95) - 1], maxMs: durations.at(-1) };
  assert.ok(durations.at(-1) < 5000, 'Local concurrent searches should complete below the backend deadline');
  check('Concurrent real-data suggestion requests complete without backend failures');

  for (const [category, id, heading] of [['documents', ids.document, 'Searchprobe Clearance'], ['announcements', ids.announcement, 'Searchprobe Community update'], ['health', ids.drive, 'Searchprobe Vaccination'], ['help', ids.help, 'Searchprobe How do I request a clearance?'], ['reports', ids.report, 'Searchprobe Street concern']]) {
    await page.goto(base + '/search?q=Searchprobe&category=' + category); await assertSearchReady();
    const link = page.getByRole('region', { name: 'Search results', exact: true }).getByRole('link').filter({ hasText: heading });
    await link.click();
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    if (category === 'health') await page.getByRole('link', { name: 'Register for this drive' }).waitFor();
    check(`${category} result opens its corresponding content (${id})`);
  }
  await page.goto(base + '/search?q=' + encodeURIComponent(reference) + '&category=requests'); await assertSearchReady();
  await page.getByRole('region', { name: 'Search results', exact: true }).getByRole('link').filter({ hasText: reference }).click();
  await page.waitForURL('**/services/requests/' + ids.request);
  await page.getByText(`Ref #${reference}`, { exact: true }).waitFor();
  check('Request result opens existing request tracking');

  await page.goto(base + '/search?q=Searchprobe%20pagination&category=help'); await assertSearchReady();
  assert.equal(await page.getByRole('region', { name: 'Help articles', exact: true }).getByRole('listitem').count(), 20);
  await page.getByRole('link', { name: 'Next', exact: true }).click(); await page.waitForURL('**page=2'); await assertSearchReady();
  assert.equal(await page.getByRole('region', { name: 'Help articles', exact: true }).getByRole('listitem').count(), 5);
  await page.reload(); await assertSearchReady();
  await page.goBack();
  await page.waitForURL(url => !url.searchParams.has('page'));
  await page.getByRole('navigation', { name: 'Result pages' }).getByText('Page 1 of 2', { exact: true }).waitFor();
  await assertSearchReady();
  assert.equal(await page.getByRole('region', { name: 'Help articles', exact: true }).getByRole('listitem').count(), 20);
  check('Category pagination, reload and browser back preserve query/filter state');

  // Intercept only the transport timing; successful responses still come from the
  // real server/database. Check loading motion, same-query refresh and typing.
  let suggestionCalls = 0;
  await page.route('**/api/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has('suggestions')) suggestionCalls++;
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue().catch(() => {});
  });
  await page.goto(base + '/search?q=Qualityrank&category=help');
  const skeleton = page.locator('[data-slot="skeleton"]').first();
  await skeleton.waitFor();
  assert.notEqual(await skeleton.evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, 'results-loading.png') });
  await assertSearchReady();
  await input().click();
  const suggestionRequest = page.waitForRequest(request => request.url().includes('suggestions=1'));
  await input().fill('Searchprobe');
  await suggestionRequest;
  await page.screenshot({ path: path.join(evidence, 'suggestions-loading.png') });
  assert.equal(await page.getByRole('combobox').inputValue(), 'Searchprobe');
  await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  await input().press('Escape');
  await input().fill('Qualityrank'); await input().press('Escape');
  await input().press('Enter');
  await page.getByRole('status').filter({ hasText: 'Updating results' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Help articles', exact: true }).getByRole('listitem').count(), 20);
  await assertSearchReady();
  check('Animated loading placeholders and same-query refresh retain useful current results');

  await input().fill('');
  await input().press('Escape');
  const beforeTyping = suggestionCalls;
  const performanceClient = await context.newCDPSession(page);
  await performanceClient.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.searchInputDurations = [];
    window.searchInputObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (entry.name === 'keydown' || entry.name === 'input') window.searchInputDurations.push(entry.duration);
    });
    window.searchInputObserver.observe({ type: 'event', buffered: false, durationThreshold: 16 });
  });
  const startedTyping = performance.now();
  await input().pressSequentially('Searchprobe', { delay: 15 });
  report.metrics.rapidTypingMs = Math.round(performance.now() - startedTyping);
  await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  assert.equal(suggestionCalls - beforeTyping, 1, 'Rapid typing should issue only the debounced query');
  report.metrics.throttledInput = await page.evaluate(() => {
    window.searchInputObserver.disconnect();
    return { cpuSlowdown: 4, slowInputEvents: window.searchInputDurations.length, maxInputEventMs: Math.max(0, ...window.searchInputDurations) };
  });
  assert.ok(report.metrics.throttledInput.maxInputEventMs < 200, 'Typing should stay responsive under fourfold CPU slowdown');
  await performanceClient.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await performanceClient.detach();
  await input().press('ArrowUp');
  const selected = page.getByRole('option', { selected: true });
  assert.ok(await selected.evaluate(element => {
    const menu = element.closest('div');
    const bounds = element.getBoundingClientRect(), container = menu.getBoundingClientRect();
    return bounds.top >= container.top && bounds.bottom <= container.bottom;
  }), 'Keyboard selection should remain visible in the scrolling suggestion menu');
  await input().press('Escape');
  await page.unroute('**/api/search?**');
  check('Rapid typing stays interactive, debounces requests and scrolls keyboard selection into view');

  let compositionRequests = 0;
  const countComposition = request => { if (request.url().includes('/api/search?') && request.url().includes('suggestions=1')) compositionRequests++; };
  page.on('request', countComposition);
  await input().dispatchEvent('compositionstart');
  await input().fill('ComposingSearchprobe');
  await page.waitForTimeout(450);
  assert.equal(compositionRequests, 0);
  await input().dispatchEvent('compositionend');
  await page.waitForRequest(request => request.url().includes('q=ComposingSearchprobe'));
  await input().press('Escape');
  page.off('request', countComposition);
  check('IME composition does not issue incomplete searches');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/search?**', async route => { await new Promise(resolve => setTimeout(resolve, 1000)); await route.continue().catch(() => {}); });
  await page.goto(base + '/search?q=Qualityrank&category=help');
  await page.locator('[data-slot="skeleton"]').first().waitFor();
  assert.ok(await page.locator('[data-slot="skeleton"]').first().evaluate(element => getComputedStyle(element).animationDuration.split(',').every(duration => Number.parseFloat(duration) === 0)));
  await assertSearchReady();
  await page.unroute('**/api/search?**'); await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('Reduced-motion preference disables loading pulses and result entrance motion');

  await page.goto(base + '/search'); await page.getByRole('heading', { name: 'What are you looking for?' }).waitFor();
  await input().fill('no-such-searchprobe-result'); await input().press('Enter');
  await page.getByRole('heading', { name: 'No results found' }).waitFor();
  await input().fill('Searchprobe'); await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  await input().press('ArrowDown'); await input().press('Enter');
  await page.waitForURL(url => url.pathname !== '/search');
  assert.ok(!new URL(page.url()).pathname.startsWith('/search'));
  check('Empty/no-results states and keyboard suggestion selection');

  await page.route('**/api/search?**', async route => {
    if (!new URL(route.request().url()).searchParams.has('suggestions')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Injected network failure' }) });
    return route.continue();
  });
  await page.goto(base + '/search?q=Searchprobe');
  await page.getByRole('alert').filter({ hasText: 'Check your connection' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'No results found' }).count(), 0);
  await page.unroute('**/api/search?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await assertSearchReady();
  check('Search errors are distinct from empty results and retry recovers');

  await page.route('**/api/search?**', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.groups.find(group => group.category === 'announcements').failed = true;
    body.groups.find(group => group.category === 'announcements').results = [];
    body.groups.find(group => group.category === 'announcements').count = 0;
    await route.fulfill({ response, json: body });
  });
  await input().press('Escape'); await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: "couldn't load announcements" }).waitFor();
  await page.getByRole('region', { name: 'Documents & services', exact: true }).waitFor();
  await page.unroute('**/api/search?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await assertSearchReady();
  check('Partial category failures preserve available results and recover on retry');

  await page.route('**/api/search?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"groups":null}' }));
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Check your connection' }).waitFor();
  await page.getByText('Showing the last loaded results, which may be out of date.').waitFor();
  await page.getByRole('region', { name: 'Documents & services', exact: true }).waitFor();
  await page.unroute('**/api/search?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await assertSearchReady();
  check('Malformed success responses produce a retryable error and retain last loaded results');

  await page.route('**/api/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('q') === 'delayed-old-query') {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: 'delayed-old-query', groups: [{ category: 'help', count: 1, failed: false, results: [{ id: 'old', category: 'help', title: 'STALE OLD RESULT', href: '/settings/help/old', preview: '', meta: '' }] }], isAuthenticated: true, page: 1, pageSize: 3 }) }).catch(() => {});
    }
    return route.continue();
  });
  await input().fill('delayed-old-query'); await page.waitForRequest(request => request.url().includes('q=delayed-old-query'));
  await input().fill('Searchprobe'); await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  await page.waitForTimeout(1400);
  assert.equal(await page.getByText('STALE OLD RESULT').count(), 0);
  await page.unroute('**/api/search?**');
  check('An overtaken suggestion response cannot replace current results');

  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  assert.equal(await input().inputValue(), '');
  await input().press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/search?q=Searchprobe'); await assertSearchReady();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No narrow-web horizontal overflow');
  await page.screenshot({ path: path.join(evidence, 'results-narrow-web.png') });
  await input().fill('Searchprobe'); await page.getByRole('option').filter({ hasText: 'Searchprobe Clearance' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'suggestions-narrow-web.png') });
  await input().press('Escape');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(evidence, 'results-dark.png') });
  check('Clear search, narrow-web layout and theme compatibility');

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const guestResult = await api({ q: 'Searchprobe' }, guest.request);
  assert.equal(guestResult.isAuthenticated, false);
  assert.ok(guestResult.groups.every(group => !['requests', 'reports'].includes(group.category)));
  await guestPage.goto(base + '/health/drives/' + ids.drive);
  await guestPage.getByRole('link', { name: 'Log in to register' }).waitFor();
  await guestPage.goto(base + '/search?q=Searchprobe');
  await guestPage.getByRole('navigation', { name: 'Search filters' }).waitFor();
  assert.equal(await guestPage.getByRole('link', { name: 'My requests', exact: true }).count(), 0);
  await guest.close();
  check('Guests can browse public search content and cannot search private records');
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
      delete from public.service_requests where barangay_id in (${scope});
      delete from public.incidents where barangay_id in (${scope});
      delete from public.announcements where barangay_id in (${scope});
      delete from public.faq_articles where barangay_id in (${scope});
      delete from public.medical_drives where barangay_id in (${scope});
      delete from public.document_types where barangay_id in (${scope});
      delete from public.profiles where barangay_id in (${scope});
      delete from public.barangays where id in (${scope}); commit;`);
    for (const account of accounts) { const { error } = await admin.auth.admin.deleteUser(account.id); if (error) throw error; }
    report.fixtureCleanup = 'passed';
  } catch (error) { report.fixtureCleanup = String(error); process.exitCode = 1; }
  save();
}
