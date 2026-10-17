import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const appRequire = createRequire(path.join(app, 'package.json'));
const evidence = path.join(root, 'tmp/admin-table-actions');
fs.mkdirSync(evidence, { recursive: true });
const adapters = path.join(import.meta.dirname, 'record-adapters.js');
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'record-fixture.jsx')], bundle: true, write: false, outdir: 'record-preview',
  jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(appRequire.resolve('react/package.json')), 'react-dom': path.dirname(appRequire.resolve('react-dom/package.json')) },
  plugins: [{ name: 'record-fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$|^@\/lib\/supabase\/client$|^@\/actions\/(admin-(record|audit)|request-review)-actions$/ }, () => ({ path: adapters }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'import React from "react"; export default function Link(props){return React.createElement("a",props)}', loader: 'js', resolveDir: app }));
  } }] });
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css;
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const modules = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); }
  else if (req.url === '/fixture.css') { res.setHeader('content-type', 'text/css'); res.end(css + '\n' + modules); }
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><head><title>Admin record lifecycle test</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/fixture`;

const report = { checks: [], pageErrors: [], consoleErrors: [], limitations: ['Actual eight table components with mocked navigation, reads and writes; live backend not exercised.'] };
let browser;
let page;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
  const menu = page.getByRole('menu', { name: 'Row actions' });
  const viewport = page.locator('.table-browse-viewport');
  const row = page.locator('tbody tr:not([data-filler-row])').first();
  const table = page.locator('table');
  const sheet = page.locator('dialog section');
  async function openMenu(action) {
    await row.locator('td').first().click({ button: 'right' });
    await menu.getByRole('menuitem', { name: action, exact: true }).click();
  }
  async function assertScroll(expected, label) {
    await page.waitForTimeout(350);
    assert.ok(Math.abs((await viewport.evaluate(el => el.scrollLeft)) - expected) < 2, label);
    assert.ok(Math.abs((await page.locator('.table-browse-strip').evaluate(el => el.scrollLeft)) - expected) < 2, label + ' (top scrollbar)');
  }
  for (const [name, field, next] of [
    ['requests','Reference','LC-EDIT'], ['transactions','Amount','65.00'], ['residents','Occupation','Teacher'],
    ['incidents','Title','Updated incident'], ['health','Location','Updated clinic'], ['applicants','Age','35'],
    ['households','Name','Updated member'], ['staff','Name','Updated staff']
  ]) {
    await page.goto(url + '?screen=' + name);
    await table.waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await viewport.evaluate(el => { el.scrollLeft = 0; });
    await assertScroll(0, name + ' initial scroll');
    await openMenu('View Details');
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await assertScroll(0, name + ' opening details preserves scroll');
    await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await assertScroll(0, name + ' closing details preserves scroll');
    for (const action of ['Archive','Delete']) {
      await openMenu(action);
      const confirm = page.getByRole('dialog', { name: action.toLowerCase() + ' record', exact: true });
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
      assert.equal(await sheet.count(), 0, name + ' ' + action + ' menu does not open sheet');
      assert.equal(await page.getByRole('dialog').count(), 1, name + ' only confirmation mounted');
      await assertScroll(0, name + ' ' + action + ' menu preserves scroll');
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    await openMenu('Edit (table)');
    await table.getByRole('button', { name: 'Save row', exact: true }).waitFor();
    assert.equal(await sheet.count(), 0, name + ' table menu edit does not open sheet');
    assert.ok(await table.locator('[data-inline-editor]').count() > 1, name + ' multiple fields editable together');
    await assertScroll(0, name + ' menu edit preserves scroll');
    const input = table.getByLabel('Edit ' + field, { exact: true });
    const original = await input.inputValue();
    await input.fill(next);
    await table.getByRole('button', { name: 'Cancel edit', exact: true }).click();
    await table.getByRole('button', { name: 'Edit', exact: true }).click();
    await table.getByRole('button', { name: 'Save row', exact: true }).waitFor();
    assert.equal(await input.inputValue(), original, name + ' cancel discards row draft');
    assert.equal(await sheet.count(), 0, name + ' direct edit does not open sheet');
    await input.fill(next);
    await page.evaluate(() => { window.recordFixture.failNext = true; });
    await table.getByRole('button', { name: 'Save row', exact: true }).click();
    await table.getByRole('alert').waitFor();
    assert.equal(await input.inputValue(), next, name + ' failed save retains draft');
    await table.getByRole('button', { name: 'Retry save', exact: true }).click();
    await table.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    assert.equal(await sheet.count(), 0, name + ' successful save stays in table');
    for (const action of ['Archive','Delete']) {
      await table.getByRole('button', { name: action, exact: true }).click();
      const confirm = page.getByRole('dialog', { name: action.toLowerCase() + ' record', exact: true });
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
      assert.equal(await sheet.count(), 0, name + ' ' + action + ' direct does not open sheet');
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    await viewport.evaluate(el => { el.scrollLeft = 0; });
    await openMenu('Edit (view details)');
    await sheet.getByRole('button', { name: 'Save', exact: true }).waitFor();
    assert.ok(await sheet.locator('input, textarea, [role=combobox]').count() > 0, name + ' details menu starts in edit mode');
    await assertScroll(0, name + ' details edit preserves scroll');
    await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // Open from a nonzero offset using the actual action-column button.
    await table.getByRole('button', { name: 'View Details', exact: true }).scrollIntoViewIfNeeded();
    const before = await viewport.evaluate(el => el.scrollLeft);
    await table.getByRole('button', { name: 'View Details', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await assertScroll(before, name + ' direct details preserves nonzero scroll');
    await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await assertScroll(before, name + ' direct details close preserves nonzero scroll');
    await page.screenshot({ path: path.join(evidence, name + '.png') });
    report.checks.push({ screen: name, status: 'passed' });
  }
  await page.goto(url + '?screen=requests');
  await table.getByRole('button', { name: 'Edit', exact: true }).click();
  await table.getByLabel('Edit Reference', { exact: true }).fill('LC-MULTI');
  await table.getByLabel('Edit Notes', { exact: true }).fill('Multiple field draft');
  await page.evaluate(() => { window.recordFixture.failWriteAt = 2; });
  await table.getByRole('button', { name: 'Save row', exact: true }).click();
  await table.getByRole('alert').waitFor();
  assert.equal(await table.getByLabel('Edit Notes', { exact: true }).inputValue(), 'Multiple field draft');
  await table.getByRole('button', { name: 'Retry save', exact: true }).click();
  await table.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.recordFixture.writeAttempts.map(item => Object.keys(item.patch))), [['reference_number'], ['requester_notes'], ['requester_notes']], 'Retry skips fields already saved');
  assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.requester_notes), 'Multiple field draft');
  report.checks.push({ screen: 'multiple-field save and partial failure retry', status: 'passed' });

  await page.goto(url + '?screen=requests');
  await page.evaluate(() => { window.recordFixture.rows.requests.contract_version = 2; window.dispatchEvent(new Event('record-refresh')); });
  await table.getByRole('button', { name: 'Edit', exact: true }).click();
  await table.getByRole('button', { name: 'Save row', exact: true }).waitFor();
  assert.equal(await table.locator('[data-inline-editor]').count(), 1, 'Versioned requests retain snapshot protection');
  await table.getByRole('combobox', { name: 'Edit Payment method', exact: true }).click();
  await page.getByRole('option', { name: 'QR PH', exact: true }).click();
  await table.getByRole('button', { name: 'Save row', exact: true }).click();
  await table.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.payment_method), 'qrph');
  report.checks.push({ screen: 'versioned request edit guards', status: 'passed' });

  await page.goto(url + '?screen=staff');
  await page.evaluate(() => { window.recordFixture.rows.staff.profile_id = 'signed-in-admin'; window.dispatchEvent(new Event('record-refresh')); });
  for (const action of ['Edit', 'Archive', 'Delete']) assert.ok(await table.getByRole('button', { name: action, exact: true }).isDisabled(), 'Own staff record stays protected');
  report.checks.push({ screen: 'own staff record protection', status: 'passed' });

  for (const reducedMotion of ['reduce', 'no-preference']) {
    await page.goto(url + '?screen=health');
    await page.setViewportSize({ width: 800, height: 700 });
    await page.emulateMedia({ reducedMotion });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await table.getByRole('button', { name: 'View Details', exact: true }).scrollIntoViewIfNeeded();
    const before = await viewport.evaluate(el => el.scrollLeft);
    await table.getByRole('button', { name: 'View Details', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await assertScroll(before, 'Narrow dark sheet preserves scroll (' + reducedMotion + ')');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog')), 'Sheet contains keyboard focus');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await assertScroll(before, 'Escape preserves table scroll');
    await page.screenshot({ path: path.join(evidence, 'narrow-dark-' + reducedMotion + '.png') });
  }
  report.checks.push({ screen: 'narrow viewport, dark theme, normal/reduced motion, keyboard focus and Escape', status: 'passed' });
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; process.exitCode = 1;
  if (page) { report.pageText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(evidence, 'failure.png') }); }
} finally {
  if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
