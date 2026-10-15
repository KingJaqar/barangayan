// Real local Auth, admin routes, archive reads, sidebar scrolling, and pagination.
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
const { chromium } = require('playwright');
const evidence = path.join(root, 'plans/evidence/admin-archives');
fs.mkdirSync(evidence, { recursive: true });
const sql = query => {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'Local SQL failed');
  return result.stdout.trim();
};
const status = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx supabase status -o json'], { cwd: root, encoding: 'utf8', windowsHide: true });
if (status.status !== 0) throw new Error('Local Supabase is unavailable');
const local = JSON.parse(status.stdout);
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(local.API_URL).hostname));
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  BARANGAYAN_PREVIEW_DIST_DIR: '.next-archives-e2e', NEXT_TELEMETRY_DISABLED: '1' };
const nextBin = require.resolve('next/dist/bin/next');
const base = 'http://127.0.0.1:4197';
const accounts = [];
const uuid = (prefix, index) => `${prefix}1190000-0000-0000-0000-${String(index).padStart(12, '0')}`;
const tenants = `'${uuid('a', 1)}','${uuid('a', 2)}'`;
const sections = [
  ['services', 'Services', '/services', 'Lifecycle document'],
  ['announcements', 'Announcements', '/announcements', 'Archived announcement'],
  ['requests', 'Requests', '/requests', null], ['transactions', 'Transactions', '/transactions', null],
  ['residents', 'Resident Directory', '/residents', 'Lifecycle Resident'],
  ['incidents', 'Incident Reports', '/incident-reports', 'Lifecycle incident'],
  ['health', 'Health', '/health', 'Lifecycle drive'], ['applicants', 'Medical Applicants', '/health/applicants', 'LC-001'],
  ['waste-management', 'Waste Management', '/waste-management', 'Archived zone'],
  ['hub', 'Hub', '/hub', 'Archived hub entry'],
  ['evacuation-centers', 'Evacuation Centers', '/evacuation-centers', 'Archived center'],
  ['households', 'Households & Residents', '/households-residents', 'Fixture Member'],
  ['staff', 'Staff Members', '/staff', 'Lifecycle Staff'],
];
let browser, page, server;
let releaseNavigation;
let serverLog = '';
const report = { checks: [], pageErrors: [], limitations: ['Local Supabase with synthetic records; hosted data was not used.'] };
const save = () => fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
try {
  for (const role of ['admin', 'resident', 'staff', 'foreign']) {
    const email = `archives-${role}-${randomUUID()}@example.test`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    accounts.push({ id: data.user.id, email, password });
  }
  let seed = fs.readFileSync(path.join(root, 'supabase/tests/admin_record_lifecycle.test.sql'), 'utf8');
  seed = seed.slice(seed.indexOf('insert into public.barangays'), seed.indexOf('create temp table lifecycle_fixture'));
  seed = seed.replace(/insert into auth\.users[\s\S]+?;\r?\n/, '').replaceAll('1150000', '1190000');
  accounts.forEach((account, index) => { seed = seed.replaceAll(uuid('b', index + 1), account.id); });
  sql(`begin; ${seed}
    set local request.jwt.claim.sub='${accounts[0].id}';
    insert into public.announcements(barangay_id,title,body,deleted_at) values ('${uuid('a', 1)}','Archived announcement','Archive body',now());
    insert into public.emergency_information(barangay_id,title,category,deleted_at) values ('${uuid('a', 1)}','Archived hub entry','guidelines',now());
    insert into public.evacuation_centers(barangay_id,name,position,deleted_at) values ('${uuid('a', 1)}','Archived center','{"lat":14.7,"lng":121.1}',now());
    insert into public.waste_zones(id,barangay_id,name,deleted_at) values ('${uuid('f', 5)}','${uuid('a', 1)}','Archived zone',now());
    insert into public.waste_collection_schedules(barangay_id,zone_id,day_of_week,start_time,end_time,waste_type,deleted_at)
      values ('${uuid('a', 1)}','${uuid('f', 5)}',1,'08:00','10:00','biodegradable',now());
    insert into public.incident_categories(id,barangay_id,name,is_trash_related) values ('${uuid('f', 6)}','${uuid('a', 1)}','Dumping',true);
    update public.incidents set deleted_at=now(),category_id='${uuid('f', 6)}' where barangay_id='${uuid('a', 1)}';
    update public.document_types set deleted_at=now() where barangay_id='${uuid('a', 1)}';
    insert into public.document_types(barangay_id,name,deleted_at) select '${uuid('a', 1)}','Archived service '||n,now()-interval '1 day' from generate_series(1,12) n;
    insert into public.document_types(barangay_id,name,deleted_at) values ('${uuid('a', 2)}','Foreign archived service',now());
    update public.service_requests set deleted_at=now() where barangay_id='${uuid('a', 1)}';
    update public.payments set deleted_at=now() where barangay_id='${uuid('a', 1)}';
    update public.drive_registrations set deleted_at=now() where drive_id='${uuid('f', 2)}';
    update public.medical_drives set deleted_at=now() where barangay_id='${uuid('a', 1)}';
    update public.household_members set deleted_at=now() where profile_id='${accounts[1].id}';
    update public.barangay_officials set deleted_at=now() where profile_id='${accounts[2].id}';
    update public.profiles set deleted_at=now() where id='${accounts[1].id}'; commit;`);
  if (process.env.ARCHIVES_E2E_REUSE_BUILD !== '1') {
    const build = spawn(process.execPath, [nextBin, 'build', '--webpack'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    build.stdout.on('data', chunk => { log += chunk; }); build.stderr.on('data', chunk => { log += chunk; });
    const code = await new Promise(resolve => build.once('exit', resolve));
    fs.writeFileSync(path.join(evidence, 'build.txt'), log);
    if (code !== 0) throw new Error(log.slice(-4000));
    console.log('Production build passed.');
  }
  server = spawn(process.execPath, [nextBin, 'start', '--port', '4197', '--hostname', '127.0.0.1'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverLog += chunk; }); server.stderr.on('data', chunk => { serverLog += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await fetch(`${base}/login`).then(response => response.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
    if (attempt === 59) throw new Error('App did not start');
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('https://*.supabase.co/**', route => route.abort());
  await page.goto(`${base}/archive/services`);
  await page.waitForURL('**/login');
  report.checks.push('Anonymous archive entry redirects to login: passed');
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[0].password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  // Delay a real navigation response to check feedback without delaying the app itself.
  await page.goto(`${base}/archive/services`);
  await page.getByRole('table').getByText('Lifecycle document', { exact: true }).waitFor();
  const iconTabs = page.getByRole('navigation', { name: 'Archived record sections' });
  const labelMetrics = link => link.evaluate(element => ({
    width: element.lastElementChild.getBoundingClientRect().width,
    opacity: Number(getComputedStyle(element.lastElementChild).opacity),
  }));
  const settledLabels = () => page.waitForFunction(() =>
    [...document.querySelectorAll('nav[aria-label="Archived record sections"] a')].every(link => {
      const label = link.lastElementChild;
      return link.hasAttribute('aria-current') ? label.getBoundingClientRect().width > 0 && Number(getComputedStyle(label).opacity) === 1
        : label.getBoundingClientRect().width < 1 && Number(getComputedStyle(label).opacity) === 0;
    }));
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 390) {
      await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#admin-sidebar').getBoundingClientRect().width <= 61);
    }
    await page.evaluate(() => document.activeElement?.blur());
    await page.getByRole('heading', { name: 'Archives', exact: true }).hover();
    await settledLabels();
    for (const [, label] of sections) {
      const link = iconTabs.getByRole('link', { name: label, exact: true });
      const size = await link.locator('svg').boundingBox();
      assert.equal(size.width, 20); assert.equal(size.height, 20);
      const collapsed = await labelMetrics(link);
      if (label !== 'Services') assert.ok(collapsed.width < 1);
      await link.hover();
      await page.waitForFunction(label => {
        const link = document.querySelector(`nav[aria-label="Archived record sections"] a[aria-label="${label}"]`);
        return Number(getComputedStyle(link.lastElementChild).opacity) === 1 && link.lastElementChild.getBoundingClientRect().width > 0;
      }, label);
      const overlap = await iconTabs.evaluate(nav => {
        const boxes = [...nav.querySelectorAll('a')].map(link => link.getBoundingClientRect());
        return boxes.some((box, index) => index > 0 && box.left < boxes[index - 1].right - 0.5);
      });
      assert.equal(overlap, false);
      await page.getByRole('heading', { name: 'Archives', exact: true }).hover();
      await settledLabels();
    }
  }
  await page.setViewportSize({ width: 1440, height: 800 });
  const keyboardTab = iconTabs.getByRole('link', { name: 'Announcements', exact: true });
  await iconTabs.getByRole('link', { name: 'Services', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await keyboardTab.evaluate(link => link === document.activeElement), true);
  await page.waitForFunction(() => {
    const label = document.activeElement?.lastElementChild;
    return label && Number(getComputedStyle(label).opacity) === 1 && label.getBoundingClientRect().width > 0;
  });
  await page.screenshot({ path: path.join(evidence, 'archives-icon-tabs-focus.png') });
  await page.keyboard.press('Enter');
  await page.waitForURL('**/archive/announcements');
  await page.getByRole('table').getByText('Archived announcement', { exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await keyboardTab.evaluate(link => getComputedStyle(link.lastElementChild).transitionDuration), '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${base}/archive/services`);
  await page.getByRole('table').getByText('Lifecycle document', { exact: true }).waitFor();
  report.checks.push('Icon-only inactive tabs, active labels, hover expansion/collapse, no overlap at 390–1440px, keyboard navigation, and reduced motion: passed');
  const navigationGate = new Promise(resolve => { releaseNavigation = resolve; });
  const slowArchive = async route => {
    const headers = route.request().headers();
    if (headers.rsc === '1' && !headers['next-router-prefetch'] && !headers['next-router-segment-prefetch']) await navigationGate;
    await route.continue();
  };
  await page.route('**/archive/hub*', slowArchive);
  const archiveTabs = page.getByRole('navigation', { name: 'Archived record sections' });
  await archiveTabs.getByRole('link', { name: 'Hub', exact: true }).click();
  await page.waitForFunction(() => {
    const spinner = document.querySelector('nav[aria-label="Archived record sections"] a[href="/archive/hub"] .admin-loading-spinner');
    const placeholder = document.querySelector('section[aria-label="Archived records loading"]');
    return (spinner && Number(getComputedStyle(spinner).opacity) > 0.9) || (placeholder && placeholder.getBoundingClientRect().height > 0);
  });
  assert.equal(await archiveTabs.getByRole('link').count(), 13);
  await page.screenshot({ path: path.join(evidence, 'archives-tab-loading.png') });
  releaseNavigation();
  await page.waitForURL('**/archive/hub');
  await page.getByRole('table').getByText('Archived hub entry', { exact: true }).waitFor();
  await page.unroute('**/archive/hub*', slowArchive);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await archiveTabs.getByRole('link', { name: 'Announcements', exact: true }).click();
  await page.getByRole('table').getByText('Archived announcement', { exact: true }).waitFor();
  const contentAnimation = await page.getByRole('table').evaluate(table => getComputedStyle(table.closest('section').parentElement).animationName);
  assert.equal(contentAnimation, 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  report.checks.push('Delayed archive navigation shows loading feedback; records settle; reduced motion disables entrance animation: passed');
  for (const [key, label, source, text] of sections) {
    console.log(`Checking ${label}: entry button, active tab, archived results, sidebar.`);
    await page.goto(`${base}${source}`);
    await page.locator('#admin-sidebar').evaluate(sidebar => { sidebar.scrollTop = 0; });
    await page.getByRole('link', { name: 'Browse archived records', exact: true }).click();
    await page.waitForURL(`**/archive/${key}`);
    await page.getByRole('heading', { name: 'Archives', exact: true }).waitFor();
    const tabs = page.getByRole('navigation', { name: 'Archived record sections' });
    assert.deepEqual(await tabs.getByRole('link').allTextContents(), sections.map(section => section[1]));
    assert.equal(await tabs.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
    await page.getByText(/Showing \d+–\d+ of/).first().waitFor();
    assert.equal(await page.getByText('Could not load').count(), 0);
    if (text) await page.getByRole('table').getByText(text, { exact: true }).waitFor();
    else assert.ok(await page.getByRole('table').locator('tbody tr').count() > 0);
    await page.waitForFunction(() => {
      const sidebar = document.querySelector('#admin-sidebar');
      const link = sidebar.querySelector('a[href="/archive"]');
      const box = sidebar.getBoundingClientRect(), item = link.getBoundingClientRect();
      return link.getAttribute('aria-current') === 'page' && item.top >= box.top && item.bottom <= box.bottom;
    });
    report.checks.push(`${label}: passed`);
  }
  await page.goto(`${base}/archive`);
  await page.waitForURL('**/archive/services');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Showing 11–13 of 13', { exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('LIFECYCLE');
  await page.getByRole('table').getByText('Lifecycle document', { exact: true }).waitFor();
  await page.getByText('Showing 1–1 of 1', { exact: true }).waitFor();
  assert.equal(await page.getByText('Foreign archived service', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'View details: Lifecycle document' }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Lifecycle document', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  report.checks.push('Default entry, pagination, case-insensitive search, tenant isolation, details: passed');
  await page.getByRole('navigation', { name: 'Archived record sections' }).getByRole('link', { name: 'Waste Management', exact: true }).click();
  await page.getByRole('button', { name: 'Schedules', exact: true }).click();
  await page.getByRole('table').getByText('Archived zone · biodegradable', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Dumping reports', exact: true }).click();
  await page.getByRole('table').getByText('Lifecycle incident', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'archives-waste.png') });
  report.checks.push('Waste zones, schedules, and dumping reports: passed');
  await page.goto(`${base}/archive/announcements`);
  await page.screenshot({ path: path.join(evidence, 'archives-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#admin-sidebar').getBoundingClientRect().width <= 61);
  await page.waitForFunction(() => {
    const tabs = document.querySelector('nav[aria-label="Archived record sections"]');
    const tab = tabs.querySelector('[aria-current="page"]');
    const bounds = tabs.getBoundingClientRect(), selected = tab.getBoundingClientRect();
    return selected.left >= bounds.left && selected.right <= bounds.right;
  });
  assert.equal(await page.evaluate(() => document.querySelector('[data-admin-viewport]').scrollWidth > document.querySelector('[data-admin-viewport]').clientWidth), false);
  await page.screenshot({ path: path.join(evidence, 'archives-narrow.png') });
  await page.locator('html').evaluate(element => element.classList.add('dark'));
  await page.screenshot({ path: path.join(evidence, 'archives-dark.png') });
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    storageState: await page.context().storageState() });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${base}/archive/services`);
  await touchPage.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await touchPage.waitForFunction(() => document.querySelector('#admin-sidebar').getBoundingClientRect().width <= 61);
  const touchTabs = touchPage.getByRole('navigation', { name: 'Archived record sections' });
  for (const [key, label] of sections) {
    const link = touchTabs.getByRole('link', { name: label, exact: true });
    const visible = await labelMetrics(link);
    assert.ok(visible.width > 0 && visible.opacity === 1);
    await link.tap();
    await touchPage.waitForURL(`**/archive/${key}`);
    await touchPage.getByRole('table').waitFor();
    assert.equal(await link.getAttribute('aria-current'), 'page');
  }
  await touchPage.screenshot({ path: path.join(evidence, 'archives-icon-tabs-touch.png') });
  await touchContext.close();
  report.checks.push('Touch device labels are visible and all 13 destinations open with one tap: passed');
  report.checks.push('Narrow layout, selected tab visibility, dark appearance: passed');
  assert.deepEqual(report.pageErrors, []);
  assert.ok(!serverLog.includes('⨯ Error:'), 'No server runtime errors');
  report.status = 'passed';
  console.log('Archives browser → admin routes → local database verification passed.');
} catch (error) {
  report.status = 'failed'; report.error = String(error); process.exitCode = 1;
  if (page) { report.pageText = await page.locator('body').innerText().catch(() => '');
    fs.writeFileSync(path.join(evidence, 'failure-content.html'), await page.locator('[data-admin-viewport]').innerHTML().catch(() => ''));
    await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {}); }
  console.error(report.error);
} finally {
  releaseNavigation?.();
  await browser?.close(); server?.kill();
  fs.writeFileSync(path.join(evidence, 'server.txt'), serverLog);
  try {
    for (const table of ['admin_audit_log', 'payments', 'service_requests', 'incidents', 'medical_drives', 'document_types', 'announcements', 'emergency_information', 'evacuation_centers', 'waste_collection_schedules', 'waste_zones', 'incident_categories']) {
      if (table === 'medical_drives') sql(`delete from public.drive_registrations where drive_id in (select id from public.medical_drives where barangay_id in (${tenants}));`);
      sql(`delete from public.${table} where barangay_id in (${tenants});`);
    }
    if (accounts.length) sql(`delete from public.profiles where id in (${accounts.map(account => `'${account.id}'`).join(',')});`);
    sql(`delete from public.barangays where id in (${tenants});`);
    for (const account of accounts) { const { error } = await admin.auth.admin.deleteUser(account.id); if (error) throw error; }
    report.fixtureCleanup = 'passed';
  } catch (error) { report.fixtureCleanup = String(error); process.exitCode = 1; }
  save();
}
