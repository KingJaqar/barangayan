// Render the actual eight screens; only navigation, database and action adapters are mocked.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const require = createRequire(path.join(app, 'package.json'));
const evidence = path.join(root, 'tmp/admin-context-menu');
fs.mkdirSync(evidence, { recursive: true });
const adapters = path.join(import.meta.dirname, 'record-adapters.js');
const bundle = await build({ entryPoints: { screens: path.join(import.meta.dirname, 'record-fixture.jsx'), generic: path.join(import.meta.dirname, 'context-menu-fixture.tsx') },
  bundle: true, write: false, outdir: 'context-menu-preview', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  plugins: [{ name: 'screen-fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$|^@\/lib\/supabase\/client$|^@\/actions\/(admin-(record|audit)|request-review)-actions$/ }, () => ({ path: adapters }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'import React from "react"; export default function Link(props){return React.createElement("a",props)}', loader: 'js', resolveDir: app }));
  } }] });
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css;
const server = http.createServer((req, res) => {
  const filename = new URL(req.url, 'http://fixture').pathname.slice(1);
  const output = bundle.outputFiles.find(file => path.basename(file.path) === filename);
  if (output) { res.setHeader('content-type', filename.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(output.contents); }
  else if (filename === 'globals.css') { res.setHeader('content-type', 'text/css'); res.end(css); }
  else {
    const name = filename === 'generic' ? 'generic' : 'screens';
    res.setHeader('content-type', 'text/html');
    res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/${name}.css"></head><body><div id="root"></div><script src="/${name}.js"></script></body></html>`);
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const report = { checks: [], pageErrors: [], limitations: ['Actual screen components with synthetic data and mocked backend/navigation; live authenticated routes and database writes were not exercised.'] };
let browser;
let page;
const save = () => fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const menu = page.getByRole('menu', { name: 'Row actions' });
  async function assertIconContrast(icon) {
    const ratio = await icon.evaluate(svg => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      function luminance(color) {
        context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const rgb = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
          const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      }
      const foreground = luminance(getComputedStyle(svg).color);
      const background = luminance(getComputedStyle(svg.closest('[role="menu"]')).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    assert.ok(ratio >= 3, `Icon contrast must be at least 3:1; received ${ratio}`);
  }
  const row = () => page.locator('tbody tr:not([data-filler-row])').first();
  async function open() {
    const cell = row().locator('td').first();
    await cell.scrollIntoViewIfNeeded();
    // Playwright scrolls wide tables before clicking. Let that scroll finish before
    // opening, just as a physical right-click starts on an already visible cell.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await cell.click({ button: 'right' }); await menu.waitFor();
  }
  async function pick(label) {
    await open();
    const item = menu.getByRole('menuitem', { name: label, exact: true });
    const source = row().locator('[data-context-menu-actions]').getByRole('button', { name: label, exact: true });
    const expectedIcon = await source.evaluate(control => control.querySelector('svg')?.innerHTML ?? null);
    assert.equal(await item.evaluate(control => control.querySelector('svg')?.innerHTML ?? null), expectedIcon, `${label}: menu matches button icon`);
    await item.click(); await menu.waitFor({ state: 'detached' });
  }
  async function closeDetails() { await page.getByRole('dialog').first().getByRole('button', { name: 'Close form', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' }); }
  for (const screen of ['requests', 'transactions', 'residents', 'incidents', 'health', 'applicants', 'households', 'staff']) {
    await page.goto(`${url}/?screen=${screen}`);
    await row().getByRole('button', { name: 'View Details', exact: true }).waitFor();
    const expected = await row().locator('[data-context-menu-actions]').evaluate(cell => Array.from(cell.querySelectorAll('button,a[href]')).map(control => ({
      label: (control.getAttribute('aria-label') || control.textContent || control.title).trim(), disabled: control.matches(':disabled'),
    })));
    await open();
    assert.deepEqual(await menu.getByRole('menuitem').evaluateAll(items => items.map(item => ({ label: item.textContent, disabled: item.disabled }))), expected, `${screen}: exact Actions parity`);
    assert.deepEqual(await menu.getByRole('menuitem').evaluateAll(items => items.map(item => item.querySelector('svg')?.innerHTML ?? null)),
      await row().locator('[data-context-menu-actions]').evaluate(cell => Array.from(cell.querySelectorAll('button,a[href]')).map(control => control.querySelector('svg')?.innerHTML ?? null)), `${screen}: matching icons`);
    for (const action of ['View Details', 'Archive', 'Delete']) {
      const icon = menu.getByRole('menuitem', { name: action, exact: true }).locator('svg');
      const sourceIcon = row().getByRole('button', { name: action, exact: true }).locator('svg');
      assert.equal(await icon.evaluate(svg => getComputedStyle(svg).color), await sourceIcon.evaluate(svg => getComputedStyle(svg).color));
      await assertIconContrast(icon);
      assert.equal(await icon.getAttribute('aria-hidden'), 'true');
      const bounds = await icon.boundingBox();
      assert.equal(bounds.width, 16); assert.equal(bounds.height, 16);
    }
    if (screen === 'requests') {
      const workflowIcon = menu.getByRole('menuitem', { name: 'Move to Processing', exact: true }).locator('svg');
      assert.notEqual(await workflowIcon.evaluate(svg => getComputedStyle(svg).color), await menu.evaluate(element => getComputedStyle(element).color));
      await assertIconContrast(workflowIcon);
      await page.screenshot({ path: path.join(evidence, 'request-menu-icons.png') });
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await open();
      assert.notEqual(await workflowIcon.evaluate(svg => getComputedStyle(svg).color), await menu.evaluate(element => getComputedStyle(element).color));
      for (const action of ['Move to Processing', 'Cancel Request', 'View Details', 'Archive', 'Delete']) {
        await assertIconContrast(menu.getByRole('menuitem', { name: action, exact: true }).locator('svg'));
      }
      await page.screenshot({ path: path.join(evidence, 'request-menu-icons-dark.png') });
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await open();
    }
    assert.equal(await page.getByRole('dialog').count(), 0, 'Right-click does not open row details');
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
    await pick('View Details');
    await page.getByRole('dialog').first().getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await closeDetails();
    for (const [action, confirm] of [['Archive', 'Archive record'], ['Delete', 'Delete permanently']]) {
      await pick(action);
      const confirmation = page.getByRole('dialog').last();
      await confirmation.getByRole('button', { name: confirm, exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.recordFixture.mutations), [], `${action} preserves confirmation`);
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await closeDetails();
    }
    // Existing Actions buttons still work after context-menu use.
    await row().getByRole('button', { name: 'View Details', exact: true }).click();
    await closeDetails();
    report.checks.push(`${screen}: matching icons, readable foreground, action parity, details, archive/delete confirmation, original Actions controls`);
  }
  for (const [screen, initial, action, next] of [
    ['requests', 'submitted', 'Move to Processing', 'in_progress'],
    ['requests', 'in_progress', 'Mark as Ready for Pickup', 'ready_for_pickup'],
    ['requests', 'ready_for_pickup', 'Mark as Completed', 'completed'],
    ['incidents', 'open', 'Mark as In Progress', 'in_progress'],
    ['incidents', 'in_progress', 'Mark as Resolved', 'resolved'],
    ['incidents', 'open', 'Mark as Unresolved', 'unresolved'],
    ['incidents', 'open', 'Withdraw', 'withdrawn'],
  ]) {
    await page.goto(`${url}/?screen=${screen}`);
    await page.evaluate(({ screen, initial }) => { Object.assign(window.recordFixture.rows[screen], { status: initial, payment_status: 'paid' }); window.dispatchEvent(new Event('record-refresh')); }, { screen, initial });
    await pick(action);
    await page.waitForFunction(({ screen, next }) => window.recordFixture.rows[screen].status === next, { screen, next });
    assert.equal(await page.evaluate(() => window.recordFixture.workflowCalls.length), 1);
    report.checks.push(`${screen}: ${action} invokes existing workflow once`);
  }
  await page.goto(`${url}/?screen=requests`);
  await pick('Cancel Request');
  await page.getByPlaceholder('Reason for cancellation…').waitFor();
  await open(); assert.ok(await menu.getByRole('menuitem', { name: 'Confirm', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  await page.getByPlaceholder('Reason for cancellation…').fill('Context menu cancellation');
  await pick('Confirm');
  await page.waitForFunction(() => window.recordFixture.rows.requests.status === 'cancelled');
  report.checks.push('Requests: cancellation retains reason validation and existing form state');

  await page.goto(`${url}/?screen=requests`);
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.requests, { contract_version: 2, requirements_review_state: 'incomplete', eligibility_state: 'pending' }); window.dispatchEvent(new Event('record-refresh')); });
  await open();
  assert.ok(await menu.getByRole('menuitem', { name: 'Move to Processing', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  await page.goto(`${url}/?screen=requests`);
  await page.evaluate(() => { window.recordFixture.workflowDelay = 1500; });
  await pick('Move to Processing');
  await open();
  assert.ok(await menu.getByRole('menuitem', { name: 'Move to Processing', exact: true }).isDisabled());
  assert.ok(await menu.getByRole('menuitem', { name: 'Cancel Request', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.recordFixture.rows.requests.status === 'in_progress');
  assert.equal(await page.evaluate(() => window.recordFixture.workflowCalls.length), 1);
  await page.goto(`${url}/?screen=requests`);
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.requests, { status: 'ready_for_pickup', payment_status: 'pending', payment_method: 'pickup' }); window.dispatchEvent(new Event('record-refresh')); });
  await pick('Mark Payment Collected');
  await page.waitForFunction(() => window.recordFixture.rows.requests.payment_status === 'paid');
  report.checks.push('Requests: review guards, busy state, single execution, pickup payment collection');

  for (const [method, refund, amount, visible] of [['pickup', 'none', 5000, false], ['qrph', 'pending', 5000, false], ['qrph', 'none', 50, true]]) {
    await page.goto(`${url}/?screen=transactions`);
    await page.evaluate(({ method, refund, amount }) => { Object.assign(window.recordFixture.rows.transactions, { method, status: 'paid', refund_status: refund, amount_centavos: amount }); window.dispatchEvent(new Event('record-refresh')); }, { method, refund, amount });
    await open();
    const item = menu.getByRole('menuitem', { name: 'Refund Payment', exact: true });
    assert.equal(await item.count(), visible ? 1 : 0);
    if (visible) assert.ok(await item.isDisabled());
    await page.keyboard.press('Escape');
  }
  report.checks.push('Transactions: refund method/status visibility and provider minimum disabled state');

  for (const [screen, action, confirm] of [['applicants', 'Cancel Registration', 'Cancel registration?'], ['transactions', 'Refund Payment', 'Refund full amount?'], ['transactions', 'Retry Refund', 'Retry refund?']]) {
    await page.goto(`${url}/?screen=${screen}`);
    if (screen === 'transactions') await page.evaluate(action => { Object.assign(window.recordFixture.rows.transactions, { method: 'qrph', status: 'paid', refund_status: action === 'Retry Refund' ? 'failed' : null }); window.dispatchEvent(new Event('record-refresh')); }, action);
    await pick(action);
    assert.equal(await page.evaluate(() => window.recordFixture.workflowCalls?.length ?? 0), 0, 'First click retains two-step confirmation');
    await pick(confirm);
    await page.waitForFunction(screen => screen === 'applicants' ? window.recordFixture.rows.applicants.status === 'cancelled' : window.recordFixture.rows.transactions.refund_status === 'pending', screen);
    report.checks.push(`${screen}: ${action} preserves confirmation and executes existing handler`);
  }
  await page.goto(`${url}/?screen=staff`);
  await page.evaluate(() => { window.recordFixture.rows.staff.profile_id = 'signed-in-admin'; window.dispatchEvent(new Event('record-refresh')); });
  await open();
  for (const action of ['Archive', 'Delete']) assert.ok(await menu.getByRole('menuitem', { name: action, exact: true }).isDisabled());
  report.checks.push('Staff: own-record actions remain disabled');

  await page.goto(`${url}/generic`);
  const tables = page.locator('table');
  const first = tables.nth(0).locator('tbody tr').nth(0);
  async function genericOpen(target = first, position) {
    await target.evaluate((element, point) => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: point?.x ?? 30, clientY: point?.y ?? 30 })), position);
    await menu.waitFor();
  }
  await genericOpen();
  assert.equal(await menu.getByRole('menuitem', { name: 'Hidden action' }).count(), 0);
  await page.keyboard.press('ArrowDown');
  assert.equal(await menu.getByRole('menuitem', { name: 'Run first' }).evaluate(item => item === document.activeElement), true);
  await page.keyboard.press('ArrowDown'); // skip disabled item
  assert.equal(await menu.getByRole('menuitem', { name: 'Open link' }).evaluate(item => item === document.activeElement), true);
  await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
  await genericOpen(); await menu.getByRole('menuitem', { name: 'Run first' }).click();
  assert.equal(await page.locator('#count').textContent(), '1');
  await genericOpen(); await menu.getByRole('menuitem', { name: 'Open link' }).click();
  assert.ok(page.url().endsWith('#linked'));
  await genericOpen(); await genericOpen(tables.nth(0).locator('tbody tr').nth(1));
  assert.equal(await page.getByRole('menu').count(), 1); await menu.getByRole('menuitem', { name: 'Run second' }).waitFor();
  await genericOpen(tables.nth(1).locator('tbody tr').first());
  assert.equal(await page.getByRole('menu').count(), 1); await menu.getByRole('menuitem', { name: 'Run other-table' }).waitFor();
  await page.locator('#count').click(); await menu.waitFor({ state: 'detached' });
  for (const target of [tables.nth(2).locator('tbody tr').first(), tables.nth(0).locator('tbody tr').nth(2), tables.nth(0).locator('thead tr')]) {
    assert.equal(await target.evaluate(element => !element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), false, 'Unsupported targets retain browser menu');
    assert.equal(await menu.count(), 0);
  }
  assert.equal(await first.evaluate(element => !element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), true, 'Supported row prevents browser menu');
  await menu.waitFor(); await page.keyboard.press('Escape');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 240 }, { width: 180, height: 100 }]) {
    await page.setViewportSize(viewport);
    await genericOpen(first, { x: viewport.width - 1, y: viewport.height - 1 });
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, JSON.stringify(bounds));
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await genericOpen(); await first.getByRole('button', { name: 'Run first' }).evaluate(button => { button.disabled = true; }); await menu.waitFor({ state: 'detached' });
  await genericOpen(); await tables.nth(0).evaluate(table => { table.parentElement.inert = true; }); await menu.waitFor({ state: 'detached' });
  assert.equal(await first.evaluate(element => !element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), false, 'Inert browse regions cannot expose actions');
  await tables.nth(0).evaluate(table => { table.parentElement.inert = false; });
  await genericOpen(); await page.evaluate(() => window.dispatchEvent(new Event('scroll'))); await menu.waitFor({ state: 'detached' });
  await genericOpen(); await page.setViewportSize({ width: 1300, height: 900 }); await menu.waitFor({ state: 'detached' });
  await genericOpen(); await page.locator('#unmount').click(); await menu.waitFor({ state: 'detached' });
  report.checks.push('Shared menu: hidden/disabled items, keyboard navigation, links, row/table switching, unsupported targets, viewport edges, stale controls, scroll/resize/unmount dismissal');
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed'; save();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page) {
    report.visibleMenu = await page.getByRole('menu').textContent().catch(() => null);
    await page.screenshot({ path: path.join(evidence, 'failure.png') });
  }
  save(); throw error;
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
