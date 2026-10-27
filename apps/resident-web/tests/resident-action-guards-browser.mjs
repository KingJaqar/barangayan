/* Real resident web sheets/forms; synthetic account/query boundaries only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve('tmp/resident-action-guards');
fs.mkdirSync(output, { recursive: true });
const mock = path.join(import.meta.dirname, 'resident-action-guards-mocks.jsx');
const bundle = await build({
  entryPoints: [path.join(import.meta.dirname, 'resident-action-guards-fixture.jsx')], bundle: true, write: false,
  outdir: output, jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { ...Object.fromEntries(['next/link', 'next/navigation', '@/lib/supabase/client', '@/hooks/use-medical-drives', '@/components/theme/use-reset-preferences', '@/components/reports/location-picker-map-wrapper'].map(name => [name, mock])), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture.supabase.test"', 'process.env': '{}' },
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('http://resident-guards.fixture/**', route => {
  const pathname = new URL(route.request().url()).pathname;
  return route.fulfill({ contentType: pathname === '/fixture.js' ? 'application/javascript' : pathname === '/fixture.css' ? 'text/css' : 'text/html', body: pathname === '/fixture.js' ? js : pathname === '/fixture.css' ? css : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
});
const open = async (action, mode, role = 'resident') => {
  await page.evaluate(({ action, mode, role }) => window.__guards.open(action, mode, role), { action, mode, role });
  if (action === 'document') await page.getByRole('button', { name: 'Request This Document', exact: true }).click();
};
const warning = () => page.getByRole('dialog', { name: 'Before you continue', exact: true });
const close = async () => { await warning().getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
const checkBlocked = async (action, mode, role = 'resident') => {
  console.log(`Checking ${role} ${action}: ${mode} (${page.viewportSize().width}px)`);
  await open(action, mode, role);
  assert.equal(await page.evaluate(() => window.__guards.profile.role), role);
  await warning().waitFor();
  assert.equal(await warning().getByRole('link', { name: 'Complete Profile', exact: true }).count(), mode.includes('incomplete') ? 1 : 0);
  assert.equal(await warning().getByRole('link', { name: 'Verify Now', exact: true }).count(), mode.includes('unverified') ? 1 : 0);
  if (mode.includes('incomplete')) assert.equal(await warning().getByRole('link', { name: 'Complete Profile', exact: true }).getAttribute('href'), '/settings/profile');
  if (mode.includes('unverified')) assert.equal(await warning().getByRole('link', { name: 'Verify Now', exact: true }).getAttribute('href'), '/settings/valid-id');
  assert.equal(await page.locator('form').count(), 0, 'Blocked forms never mount');
  assert.equal(await page.locator('[data-registration-consent]').count(), 0);
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await warning().evaluate(element => element.contains(document.activeElement)), true, 'Focus remains inside warning');
  }
  const layers = await warning().evaluate(element => {
    const sheet = Array.from(document.querySelectorAll('[role="dialog"]')).find(dialog => dialog !== element);
    return { warning: +getComputedStyle(element).zIndex, sheet: +getComputedStyle(sheet).zIndex, overlay: getComputedStyle(element.previousElementSibling).zIndex,
      atCorner: document.elementFromPoint(innerWidth - 10, 100) === element.previousElementSibling,
      overflow: element.scrollWidth > element.clientWidth + 1 };
  });
  assert.ok(layers.warning > layers.sheet && +layers.overlay > layers.sheet, JSON.stringify(layers));
  assert.equal(layers.atCorner, true, 'Overlay catches pointer input above sheet');
  assert.equal(layers.overflow, false, 'Warning fits viewport');
  await page.mouse.click(10, 10);
  assert.equal(await warning().isVisible(), true, 'Outside click cannot expose blocked form');
  const reads = await page.evaluate(() => window.__guards.reads);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__guards.reads), reads, 'No repeated account reads after settling');
  assert.deepEqual(await page.evaluate(() => window.__guards.writes), []);
  await page.screenshot({ path: path.join(output, `${role}-${action}-${mode}-${page.viewportSize().width}.png`) });
};
try {
  await page.goto('http://resident-guards.fixture/');
  await page.waitForFunction(() => !!window.__guards?.open);
  for (const role of ['admin', 'resident']) {
    for (const [action, modes] of [['drive', ['incomplete', 'incomplete-birth-date']], ['report', ['incomplete', 'incomplete-birth-date']], ['document', ['incomplete', 'unverified', 'incomplete-unverified']]]) {
      if (role === 'admin' && action === 'drive') continue;
      for (const mode of modes) { await checkBlocked(action, mode, role); await close(); }
    }
  }
  await checkBlocked('drive', 'incomplete');
  await warning().getByRole('link', { name: 'Complete Profile', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__guards.destination), '/settings/profile');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  // Medical registrations require resident identity; other services retain their rules.
  for (const role of ['resident', 'admin']) {
    if (role === 'resident') {
      await open('drive', 'unverified', role);
      await page.locator('[data-registration-consent]').check();
      await page.getByRole('button', { name: 'Submit Registration', exact: true }).click();
      await page.getByText('Registration Confirmed!', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__guards.writes.length), 1);
    }
    await open('report', 'unverified', role);
    await page.locator('#incident-title').waitFor();
    assert.equal(await warning().count(), 0);
    await open('document', 'complete', role);
    await page.getByRole('button', { name: 'Submit request', exact: true }).waitFor();
    assert.equal(await warning().count(), 0);
  }

  for (const mode of ['complete', 'incomplete', 'incomplete-birth-date']) {
    await open('drive', mode, 'admin');
    await page.getByRole('heading', { name: 'Use your resident account' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Complete Profile', exact: true }).count(), 0, 'Role restriction comes before completion');
    assert.equal(await page.locator('[data-registration-consent]').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__guards.writes), []);
    await page.getByRole('button', { name: 'Keep browsing', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  for (const [mode, role] of [['deleted', 'resident'], ['complete', 'unknown']]) {
    await open('drive', mode, role);
    await page.getByRole('heading', { name: 'Use your resident account' }).waitFor();
    assert.equal(await page.locator('[data-registration-consent]').count(), 0);
  }
  await open('drive', 'missing-profile');
  await page.getByRole('button', { name: 'Retry account check' }).waitFor();
  assert.equal(await page.locator('[data-registration-consent]').count(), 0);

  // Switching reuses the real local sign-out flow and keeps the selected drive.
  await open('drive', 'complete', 'admin');
  const switchAccount = page.getByRole('button', { name: 'Sign out and switch account', exact: true });
  await switchAccount.waitFor();
  assert.deepEqual(await page.evaluate(() => window.__guards.signOutCalls), [], 'No automatic sign-out');
  await page.evaluate(() => { window.__guards.signOutFails = true; });
  await switchAccount.click();
  await page.waitForFunction(() => window.__guards.signOutCalls.length === 1);
  assert.equal(await page.evaluate(() => window.__guards.destination), null);
  assert.equal(await switchAccount.isEnabled(), true);
  assert.equal(await page.evaluate(() => window.__guards.preferencesReset), false);
  await page.evaluate(() => { window.__guards.signOutFails = false; });
  await switchAccount.evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => !!window.__guards.destination);
  assert.deepEqual(await page.evaluate(() => window.__guards.signOutCalls), ['local', 'local']);
  assert.equal(await page.evaluate(() => window.__guards.destination), `/login?next=${encodeURIComponent('/health/register/a1260000-0000-4000-8000-000000000001')}`);
  assert.equal(await page.evaluate(() => window.__guards.preferencesReset), true);

  // A changed role at submission still receives account guidance; unknown replies stay uncertain.
  for (const [code, message, text] of [
    ['P0010', 'Only an active resident', 'Use your resident account'],
    ['P0003', 'No remaining slots', 'This medical drive has no remaining slots.'],
    ['P0004', 'Already registered', 'You are already registered for this medical drive. Open My Registrations to view your registration.'],
    ['', 'Lost reply', "We couldn't confirm your registration. Check My Registrations before trying again."],
  ]) {
    await open('drive', 'complete');
    await page.locator('[data-registration-consent]').check();
    await page.evaluate(({ code, message }) => { window.__guards.registrationError = { code, message }; }, { code, message });
    await page.getByRole('button', { name: 'Submit Registration', exact: true }).click();
    if (code === 'P0010') await page.getByRole('heading', { name: text, exact: true }).waitFor();
    else await page.locator('#health-registration-error').filter({ hasText: text }).waitFor();
    if (code === 'P0010') assert.equal(await page.locator('[data-registration-consent]').count(), 0);
    if (code === 'P0004' || !code) assert.equal(await page.getByRole('link', { name: 'Open My Registrations', exact: true }).getAttribute('href'), '/health/my-registrations');
  }

  // Failure stays closed to form interaction and supports one explicit retry.
  for (const action of ['drive', 'report', 'document']) {
    await open(action, 'error');
    await page.getByRole('button', { name: 'Retry account check' }).waitFor();
    assert.equal(await page.locator('form').count(), 0);
    await page.evaluate(() => { window.__guards.error = false; });
    await page.getByRole('button', { name: 'Retry account check' }).click();
    if (action === 'drive') await page.locator('[data-registration-consent]').waitFor();
    else if (action === 'report') await page.locator('#incident-title').waitFor();
    else await page.getByRole('button', { name: 'Submit request', exact: true }).waitFor();
  }
  // Stale completion after closing and opening another sheet cannot override its warning.
  await open('report', 'delayed');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await checkBlocked('report', 'incomplete');
  await page.waitForTimeout(600);
  assert.equal(await warning().isVisible(), true);
  await close();
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await checkBlocked('document', 'incomplete-unverified'); await close();
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await open('drive', 'complete', 'admin');
  const notice = page.getByRole('region', { name: 'Resident account required' });
  await notice.waitFor();
  await page.waitForFunction(() => Math.abs(document.querySelector('[role="dialog"]').getBoundingClientRect().left) < 1);
  assert.equal(await notice.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  const noticeBounds = await notice.boundingBox();
  assert.ok(noticeBounds.x >= 0 && noticeBounds.x + noticeBounds.width <= 321, 'Notice stays inside the viewport');
  await page.screenshot({ path: path.join(output, 'admin-drive-320-dark.png') });
  await page.evaluate(() => window.__guards.open('logout', 'complete'));
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForFunction(() => window.__guards.destination === '/login');
  assert.deepEqual(await page.evaluate(() => window.__guards.signOutCalls), ['local'], 'Ordinary logout retains its existing destination and scope');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, roles: ['resident', 'admin', 'unknown'], checks: ['resident profile completion', 'admin role rejection before completion', 'deleted and unknown roles blocked', 'missing profile fails closed', 'explicit local sign-out with preserved drive and failure retry', 'specific registration rejections and uncertain outcomes', 'eligible resident drive submission', 'unchanged report/document rules for both roles', 'keyboard focus and pointer layering', 'read failure retry', 'stale reads ignored', 'React StrictMode', 'dark narrow layout'], errors, limitation: 'Synthetic account/data boundaries; no live database writes.' }, null, 2));
  console.log(`PASS: resident action guards. Evidence: ${output}`);
} catch (error) {
  console.error(await page.locator('body').innerText()); console.error(errors); throw error;
} finally { await browser.close(); }
