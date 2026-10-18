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
  assert.equal(await table.locator('[data-inline-editor]').count(), 2, 'Versioned requests expose both payment fields and retain snapshot protection');
  const paymentEditor = table.getByRole('combobox', { name: 'Edit Payment method', exact: true });
  await viewport.evaluate(element => { element.scrollLeft = 0; });
  await assertScroll(0, 'Payment editor remains visible beside frozen resident column');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
    await page.waitForTimeout(250); // Let the dropdown's theme transition finish before visual capture.
    const layout = await paymentEditor.evaluate(element => {
      const label = [...element.querySelectorAll('span')].find(span => span.textContent === 'Pay at Pickup');
      const style = getComputedStyle(label);
      return { height: element.getBoundingClientRect().height, whiteSpace: style.whiteSpace,
        labelWidth: label.clientWidth, textWidth: label.scrollWidth };
    });
    assert.equal(layout.whiteSpace, 'nowrap', 'Payment label stays on one line');
    assert.ok(layout.height <= 36, 'Payment editor does not inflate row height');
    assert.ok(layout.labelWidth >= layout.textWidth, 'Default payment column fits the full label');
    await page.screenshot({ path: path.join(evidence, 'payment-edit-' + theme + '.png') });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await table.getByRole('combobox', { name: 'Edit Payment method', exact: true }).click();
  await page.getByRole('option', { name: 'QR PH', exact: true }).click();
  await table.getByRole('button', { name: 'Save row', exact: true }).click();
  await table.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.payment_method), 'qrph');
  for (const [label,status] of [['Failed','failed'],['Refunded','refunded'],['Pending','pending'],['Paid','paid']]) {
    const current = await page.evaluate(() => window.recordFixture.rows.requests.payment_status);
    await row.getByText(current[0].toUpperCase()+current.slice(1), {exact:true}).click();
    await table.getByRole('combobox', {name:'Edit Payment status',exact:true}).click();
    assert.deepEqual(await page.getByRole('option').allTextContents(), ['Paid','Pending','Failed','Refunded'], 'Status editor offers requested statuses');
    await page.getByRole('option',{name:label,exact:true}).click();
    await table.getByRole('combobox', {name:'Edit Payment status',exact:true}).waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.payment_status), status, 'Single-cell status save persists');
  }
  report.checks.push({ screen: 'versioned request edit guards', status: 'passed' });

  for (const contract of [1,2]) {
    await page.goto(url + '?screen=requests');
    await page.evaluate(contract => { window.recordFixture.rows.requests.contract_version=contract; window.recordFixture.enforceExpected=true; window.dispatchEvent(new Event('record-refresh')); },contract);
    const headers=await table.locator('thead th').allTextContents();
    assert.ok(headers.includes('Payment method') && headers.includes('Payment status'), 'Two separate payment columns');
    assert.ok(!headers.includes('Payment'), 'Combined payment column removed');
    await openMenu('Edit (table)');
    await table.getByRole('combobox',{name:'Edit Payment method',exact:true}).click();
    await page.getByRole('option',{name:'QR PH',exact:true}).click();
    await table.getByRole('combobox',{name:'Edit Payment status',exact:true}).click();
    await page.getByRole('option',{name:'Failed',exact:true}).click();
    await table.getByRole('button',{name:'Save row',exact:true}).click();
    await table.getByRole('button',{name:'Edit',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(() => [window.recordFixture.rows.requests.payment_method,window.recordFixture.rows.requests.payment_status]),['qrph','failed']);
    await openMenu('Edit (view details)');
    await sheet.getByRole('combobox',{name:'Payment method',exact:false}).click();
    await page.getByRole('option',{name:'Pay at Pickup',exact:true}).click();
    await sheet.getByRole('combobox',{name:'Payment status',exact:false}).click();
    await page.getByRole('option',{name:'Refunded',exact:true}).click();
    await sheet.getByRole('button',{name:'Save',exact:true}).click();
    await sheet.getByRole('button',{name:'Edit',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(() => [window.recordFixture.rows.requests.payment_method,window.recordFixture.rows.requests.payment_status]),['pickup','refunded']);
    await sheet.getByRole('button',{name:'Edit',exact:true}).click();
    assert.match(await sheet.getByRole('combobox',{name:'Payment method',exact:false}).innerText(),/Pay at Pickup/);
    assert.match(await sheet.getByRole('combobox',{name:'Payment status',exact:false}).innerText(),/Refunded/);
    await page.screenshot({path:path.join(evidence,'split-payment-sheet-v'+contract+'.png')});
    await sheet.getByRole('button',{name:'Close form',exact:true}).click();
    report.checks.push({screen:'contract '+contract+' payment method and status row and sheet editors',status:'passed'});
  }

  for (const accountRole of ['resident', 'admin']) {
    await page.goto(url + '?screen=requests');
    await page.evaluate(role => {
      Object.assign(window.recordFixture.rows.requests, { contract_version: 2, sla_state: 'pre_processing', fee_assessment_state: 'assessed', assessed_amount_centavos: 5000 });
      window.recordFixture.rows.requests.profiles.role = role;
      window.dispatchEvent(new Event('record-refresh'));
    }, accountRole);
    await row.locator('td').first().click({ button: 'right' });
    assert.equal(await menu.getByRole('menuitem', { name: 'Details', exact: true }).count(), 0, 'Duplicate full-page Details action removed');
    assert.equal(await menu.getByRole('menuitem', { name: 'View Details', exact: true }).count(), 1, 'One View Details action remains');
    await menu.getByRole('menuitem', { name: 'View Details', exact: true }).click();
    await sheet.getByText('Processing and release readiness', { exact: true }).waitFor();
    await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await openMenu('Edit (view details)');
    await sheet.getByText('Processing and release readiness', { exact: true }).waitFor();
    assert.equal(await sheet.getByLabel('Resident', { exact: true }).count(), 0, 'Original resident stays immutable');
    assert.equal(await sheet.getByLabel('Document type', { exact: true }).count(), 0, 'Original document stays immutable');
    const method = sheet.getByRole('combobox', { name: 'Payment method', exact: false });
    await method.click();
    await page.getByRole('option', { name: 'QR PH', exact: true }).click();
    assert.ok(await sheet.getByRole('button', { name: 'Start processing', exact: true }).isDisabled(), 'Dirty draft cannot race a review action');
    await method.click();
    await page.getByRole('option', { name: 'Pay at Pickup', exact: true }).click();
    await page.screenshot({ path: path.join(evidence, 'request-editor-' + accountRole + '.png') });
    await page.evaluate(() => { window.recordFixture.workflowDelay = 500; window.recordFixture.failNext = true; });
    await sheet.getByRole('button', { name: 'Start processing', exact: true }).click();
    assert.ok(await sheet.getByRole('button', { name: 'Save', exact: true }).isDisabled(), 'Save waits for review writes');
    await sheet.getByText('Workflow permission failure.', { exact: true }).waitFor();
    assert.ok(await sheet.getByRole('button', { name: 'Save', exact: true }).isEnabled(), 'Workflow failure leaves editor usable');
    await sheet.getByRole('button', { name: 'Start processing', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.status), 'in_progress', 'Review workflow runs from edit mode');
    report.checks.push({ screen: accountRole + ' request sheet review in edit mode', status: 'passed' });
  }

  await page.goto(url + '?screen=requests&hideRows=1&record=f1150000-0000-0000-0000-000000000001');
  await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.equal(await table.locator('tbody tr [data-record-actions]').count(), 0, 'Linked record need not be in the filtered table page');
  assert.equal(await sheet.getByText('Requests · Record details', { exact: true }).count(), 1, 'Linked request opens existing record sheet');
  await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(new URL(page.url()).searchParams.get('record'), null, 'Closing the sheet clears its link parameter');
  assert.equal(new URL(page.url()).searchParams.get('tab'), 'all', 'Closing the sheet preserves table filters');
  report.checks.push({ screen: 'request links open the record sheet independently of the visible rows', status: 'passed' });

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
