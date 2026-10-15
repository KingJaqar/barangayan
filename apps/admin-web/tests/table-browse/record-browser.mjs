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
const evidence = path.join(root, 'plans/evidence/admin-record-lifecycle');
fs.mkdirSync(evidence, { recursive: true });
const adapters = path.join(import.meta.dirname, 'record-adapters.js');
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'record-fixture.jsx')], bundle: true, write: false, outdir: 'record-preview',
  jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(appRequire.resolve('react/package.json')), 'react-dom': path.dirname(appRequire.resolve('react-dom/package.json')) },
  plugins: [{ name: 'record-fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$|^@\/lib\/supabase\/client$|^@\/actions\/admin-(record|audit)-actions$/ }, () => ({ path: adapters }));
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
const report = { checks: [], limitations: ['Actual screen components with synthetic data and action adapters; database persistence and RLS are covered separately by rollback-only PostgreSQL tests.'] };
let browser;
let page;
const save = () => fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(report, null, 2));
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  report.pageErrors = errors;
  report.consoleErrors = consoleErrors;
  for (const [name, field, value] of [['requests','Notes','Updated note'], ['transactions','Amount (centavos)','6000'], ['residents','Occupation','Updated occupation'],
    ['incidents','Title','Updated incident'], ['health','Location','Updated clinic'], ['applicants','Age','35'], ['households','Name','Updated household'], ['staff','Full name','Updated staff']]) {
    await page.goto(`${url}?screen=${name}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    for (const action of ['View Details', 'Archive', 'Delete']) {
      const button = page.getByRole('button', { name: action, exact: true });
      assert.equal((await button.innerText()).trim(), '', `${name}: ${action} is icon-only`);
      assert.ok(await button.getAttribute('title'), `${name}: ${action} has a descriptive tooltip`);
      const bounds = await button.boundingBox();
      assert.ok(bounds.width >= 40 && bounds.height >= 40, `${name}: ${action} has a visible 40px target`);
    }
    await page.evaluate(() => { window.recordFixture.readThrowNext = true; });
    await page.getByRole('button', { name: 'View Details', exact: true }).click();
    const sheet = page.getByRole('dialog').first();
    await sheet.getByRole('button', { name: 'Retry details', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    assert.equal(await sheet.locator('input,textarea,select').count(), 0, `${name}: read-only by default`);
    const bounds = await sheet.locator('section').first().boundingBox();
    assert.ok(bounds.x + bounds.width > 1438, `${name}: side sheet aligns to right edge`);
    await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
    const input = sheet.getByLabel(field, { exact: false }).first();
    const original = await input.inputValue();
    await input.fill(value);
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await sheet.getByLabel(field, { exact: false }).first().inputValue(), original, `${name}: Cancel discards draft`);
    await sheet.getByLabel(field, { exact: false }).first().fill(value);
    await page.evaluate(() => { window.recordFixture.throwNext = true; });
    await sheet.getByRole('button', { name: 'Save', exact: true }).click();
    await sheet.getByRole('alert').filter({ hasText: 'could not be completed' }).waitFor();
    assert.equal(await sheet.getByLabel(field, { exact: false }).first().inputValue(), value, `${name}: transport failure preserves the draft`);
    await page.evaluate(() => { window.recordFixture.failNext = true; });
    await sheet.getByRole('button', { name: 'Save', exact: true }).click();
    await sheet.getByRole('alert').filter({ hasText: 'Fixture permission' }).waitFor();
    assert.equal(await sheet.getByRole('button', { name: 'Save', exact: true }).count(), 1, `${name}: failed save retains draft`);
    await sheet.getByRole('button', { name: 'Save', exact: true }).click();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Changes saved.' }).waitFor();
    await sheet.getByRole('status').filter({ hasText: 'Changes saved.' }).waitFor();
    await page.screenshot({ path: path.join(evidence, `${name}-details.png`) });
    await sheet.getByRole('button', { name: 'Close form', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'archive record', exact: true });
    await page.evaluate(() => { window.recordFixture.failNext = true; });
    await confirm.getByRole('button', { name: 'Archive record', exact: true }).click();
    await confirm.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => window.recordFixture.rows[window.recordFixture.name].deleted_at), null, `${name}: failed archive preserves the active record`);
    await confirm.getByRole('button', { name: 'Archive record', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Record archived.' }).waitFor();
    await page.getByRole('button', { name: 'View Details', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'View Details', exact: true }).count(), 0, `${name}: archived record leaves list`);
    await page.locator('#fixture-archive').click();
    await page.getByRole('button', { name: 'View Details', exact: true }).click();
    await page.getByRole('dialog').first().getByText('Archived record', { exact: true }).waitFor();
    await page.getByRole('dialog').first().getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.evaluate(() => { window.recordFixture.throwNext = true; });
    await page.getByRole('dialog', { name: 'restore record', exact: true }).getByRole('button', { name: 'Restore record', exact: true }).click();
    await page.getByRole('dialog', { name: 'restore record', exact: true }).getByRole('alert').waitFor();
    assert.ok(await page.evaluate(() => !!window.recordFixture.rows[window.recordFixture.name].deleted_at), `${name}: failed restore preserves the archive`);
    await page.getByRole('dialog', { name: 'restore record', exact: true }).getByRole('button', { name: 'Restore record', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Record restored.' }).waitFor();
    await page.locator('#fixture-archive').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const deletion = page.getByRole('dialog', { name: 'delete record', exact: true });
    await deletion.getByText(/cannot be undone/).waitFor();
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => window.recordFixture.mutations.filter(item => item.operation === 'delete').length), 0, `${name}: deletion requires explicit confirmation`);
    await page.getByRole('dialog').first().getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const deletionAgain = page.getByRole('dialog', { name: 'delete record', exact: true });
    await page.evaluate(() => { window.recordFixture.failNext = true; });
    await deletionAgain.getByRole('button', { name: 'Delete permanently', exact: true }).click();
    await deletionAgain.getByRole('alert').waitFor();
    await deletionAgain.getByRole('button', { name: 'Delete permanently', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Record permanently deleted.' }).waitFor();
    await page.getByRole('button', { name: 'View Details', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'View Details', exact: true }).count(), 0, `${name}: successful deletion refreshes list`);
    report.checks.push({ screen: name, status: 'passed', checks: ['icon-only actions with tooltips and accessible labels','40px button targets','failed details load and retry','read-only right sheet','Edit/Save/Cancel','save transport and permission failures retain draft','failed archive preserves active record','archive list removal','archived details','restore failure and retry','irreversible-delete confirmation','failed delete retry','list refresh'] });
    save();
  }
  await page.goto(`${url}?screen=requests`, { waitUntil: 'domcontentloaded' });
  const processing = page.getByRole('button', { name: 'Move to Processing', exact: true });
  assert.ok((await processing.innerText()).includes('Move to Processing'), 'Request workflow labels remain visible');
  await page.getByRole('button', { name: 'Archive', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, 'request-row-workflows.png') });
  await processing.click();
  await page.getByRole('button', { name: 'Mark as Ready for Pickup', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as Completed', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Request marked as completed.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Move to Processing', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Mark as Completed', exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.recordFixture.workflowCalls.map(call => call.name)), ['begin_processing_request', 'mark_request_ready_for_pickup', 'complete_service_request']);
  await page.screenshot({ path: path.join(evidence, 'request-row-icons.png') });
  await page.evaluate(() => {
    const row = window.recordFixture.rows.requests;
    Object.assign(row, { contract_version: 2, status: 'submitted', sla_state: 'pre_processing', requirements_review_state: 'pending', eligibility_state: 'pending' });
    window.dispatchEvent(new Event('record-refresh'));
  });
  assert.ok(await processing.isEnabled(), 'Versioned requests proceed without staff review');
  await processing.click();
  await page.getByRole('button', { name: 'Mark as Ready for Pickup', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: 'Mark as Completed', exact: true }).isDisabled(), 'Versioned release requires confirmed payment');
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.requests, { fee_assessment_state: 'assessed', assessed_amount_centavos: 5000 }); window.dispatchEvent(new Event('record-refresh')); });
  await page.getByRole('button', { name: 'Mark Payment Collected', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Payment marked as collected.' }).waitFor();
  await page.getByRole('button', { name: 'Mark as Completed', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as Completed', exact: true }).waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => window.recordFixture.workflowCalls.filter(call => call.name === 'transition_service_request_sla').map(call => call.input.p_input.action)), ['accept', 'ready', 'release']);
  report.checks.push({ screen: 'request-workflow', status: 'passed', checks: ['visible workflow labels','legacy processing/pickup/completion operations','terminal action visibility','versioned requests without review','confirmed payment before release','controlled versioned transitions'] });
  await page.goto(`${url}?screen=requests`);
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.requests, { status: 'ready_for_pickup', legacy_fee_centavos: 0 }); window.dispatchEvent(new Event('record-refresh')); });
  assert.equal(await page.getByRole('button', { name: 'Mark Payment Collected', exact: true }).count(), 0, 'Free requests do not offer payment collection');
  assert.ok(await page.getByRole('button', { name: 'Mark as Completed', exact: true }).isEnabled());
  report.checks.push({ screen: 'free request', status: 'passed', checks: ['no invalid payment collection action','completion remains available'] });

  await page.goto(`${url}?screen=incidents`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Remove', exact: true }).count(), 0, 'Shared Archive/Delete replaces duplicate Remove');
  await page.getByRole('button', { name: 'Mark as In Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Mark as Resolved', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as Resolved', exact: true }).waitFor({ state: 'detached' });
  await page.evaluate(() => {
    Object.assign(window.recordFixture.rows.incidents, { status: 'open', reporter_id: 'another-resident', created_at: '2020-01-01T00:00:00Z' });
    window.dispatchEvent(new Event('record-refresh'));
  });
  await page.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Archive', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, 'incident-row-workflows.png') });
  await page.evaluate(() => { window.recordFixture.failNext = true; });
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Workflow permission failure' }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Withdraw', exact: true }).isEnabled(), 'Failed withdrawal remains retryable');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).waitFor({ state: 'detached' });
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.incidents, { status: 'in_progress', reporter_id: 'another-resident', created_at: '2020-01-01T00:00:00Z' }); window.dispatchEvent(new Event('record-refresh')); });
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.recordFixture.workflowCalls.filter(call => call.input.p_status === 'withdrawn').every(call => call.name === 'update_incident_status')), 'Admin withdrawal uses the guarded admin workflow');
  assert.equal(await page.getByRole('button', { name: 'Archive', exact: true }).count(), 1, 'Withdrawal retains the report in the directory');
  await page.evaluate(() => { window.recordFixture.rows.incidents.status = 'open'; window.dispatchEvent(new Event('record-refresh')); });
  await page.getByRole('button', { name: 'Mark as Unresolved', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as Unresolved', exact: true }).waitFor({ state: 'detached' });
  report.checks.push({ screen: 'incident-workflow', status: 'passed', checks: ['in-progress/resolved/unresolved transitions','admin withdrawal of old open/in-progress reports from other reporters','withdrawal failure feedback and retry','report retained after withdrawal','visible labels','no duplicate Remove'] });

  await page.goto(`${url}?screen=applicants`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cancel Registration', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel registration?', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Registration cancelled.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Cancel Registration', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Archive', exact: true }).count(), 1);
  report.checks.push({ screen: 'applicant-workflow', status: 'passed', checks: ['visible confirmed cancellation','cancelled records remain available','archive/delete unchanged'] });

  await page.goto(`${url}?screen=transactions`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.transactions, { method: 'qrph', status: 'paid', paymongo_payment_id: null }); window.dispatchEvent(new Event('record-refresh')); });
  assert.ok(await page.getByRole('button', { name: 'Refund Payment', exact: true }).isDisabled(), 'Refunds wait for the provider payment ID');
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.transactions, { paymongo_payment_id: 'pay_fixture', amount_centavos: 50 }); window.dispatchEvent(new Event('record-refresh')); });
  assert.ok(await page.getByRole('button', { name: 'Refund Payment', exact: true }).isDisabled(), 'Refunds respect the provider minimum');
  await page.evaluate(() => { window.recordFixture.rows.transactions.amount_centavos = 5000; });
  await page.evaluate(() => { Object.assign(window.recordFixture.rows.transactions, { method: 'qrph', status: 'paid', refund_status: 'failed' }); window.dispatchEvent(new Event('record-refresh')); });
  await page.getByRole('button', { name: 'Retry Refund', exact: true }).click();
  await page.getByRole('button', { name: 'Retry refund?', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Refund submitted to PayMongo' }).waitFor();
  await page.getByRole('button', { name: 'Retry Refund', exact: true }).waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: 'Retry Refund', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Delete', exact: true }).count(), 1);
  report.checks.push({ screen: 'transaction-workflow', status: 'passed', checks: ['visible refund retry alongside shared icons','existing refund endpoint','pending refund prevents duplicates'] });

  // Each workflow must recover from both returned errors and thrown transport failures.
  for (const [screen, label, status] of [
    ['requests', 'Move to Processing', 'submitted'],
    ['requests', 'Mark as Ready for Pickup', 'in_progress'],
    ['requests', 'Mark as Completed', 'ready_for_pickup'],
    ['requests', 'Mark Payment Collected', 'ready_for_pickup'],
    ['incidents', 'Mark as In Progress', 'open'],
    ['incidents', 'Mark as Resolved', 'in_progress'],
    ['incidents', 'Mark as Unresolved', 'open'],
    ['incidents', 'Withdraw', 'in_progress'],
  ]) {
    await page.goto(`${url}?screen=${screen}`);
    await page.evaluate(({ screen, status }) => { window.recordFixture.rows[screen].status = status; window.dispatchEvent(new Event('record-refresh')); }, { screen, status });
    const action = page.getByRole('button', { name: label, exact: true });
    for (const failure of ['failNext', 'throwNext', 'noopNext']) {
      await page.evaluate(failure => { window.recordFixture[failure] = true; }, failure);
      await action.click();
      await page.getByRole('alert').filter({ hasText: failure === 'failNext' ? 'Workflow permission failure' : failure === 'throwNext' ? 'could not be completed' : screen === 'incidents' ? 'status was not updated' : 'could not be confirmed' }).waitFor();
      assert.ok(await action.isEnabled(), `${label}: ${failure} releases the busy state`);
    }
    await page.evaluate(() => { window.recordFixture.workflowDelay = 100; window.recordFixture.readDelay = 100; });
    const callsBefore = await page.evaluate(() => window.recordFixture.workflowCalls.length);
    await action.evaluate(button => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    assert.ok(await action.isDisabled(), `${label}: locked through write and read-back`);
    await action.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.recordFixture.workflowCalls.length), callsBefore + 1, `${label}: duplicate clicks make one request`);
    report.checks.push({ screen: `${screen}: ${label}`, status: 'passed', checks: ['permission failure','transport failure','zero-change read-back failure','retry','duplicate-click prevention'] });
  }

  for (const contract of [1, 2]) {
    await page.goto(`${url}?screen=requests`);
    await page.evaluate(contract => { Object.assign(window.recordFixture.rows.requests, { contract_version: contract, sla_state: contract === 2 ? 'pre_processing' : 'legacy' }); window.dispatchEvent(new Event('record-refresh')); }, contract);
    await page.getByRole('button', { name: 'Cancel Request', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Confirm', exact: true }).isDisabled(), 'Cancellation requires a reason');
    await page.getByPlaceholder('Reason for cancellation…').fill('Resident requested cancellation');
    for (const failure of ['failNext', 'throwNext']) {
      await page.evaluate(failure => { window.recordFixture[failure] = true; }, failure);
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: failure === 'failNext' ? 'Workflow permission failure' : 'could not be completed' }).waitFor();
      assert.equal(await page.getByPlaceholder('Reason for cancellation…').inputValue(), 'Resident requested cancellation');
    }
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Request cancelled.' }).waitFor();
    assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.status), 'cancelled');
    if (contract === 2) assert.equal(await page.evaluate(() => window.recordFixture.rows.requests.sla_state), 'cancelled', 'Versioned cancellation keeps its SLA state consistent');
    report.checks.push({ screen: `request cancellation v${contract}`, status: 'passed', checks: ['reason validation','permission and transport failure','draft preservation','guarded cancellation'] });
  }

  for (const [screen, trigger, confirmation] of [['applicants', 'Cancel Registration', 'Cancel registration?'], ['transactions', 'Refund Payment', 'Refund full amount?'], ['transactions', 'Retry Refund', 'Retry refund?']]) {
    await page.goto(`${url}?screen=${screen}`);
    if (screen === 'transactions') await page.evaluate(trigger => { Object.assign(window.recordFixture.rows.transactions, { method: 'qrph', status: 'paid', refund_status: trigger === 'Retry Refund' ? 'failed' : null }); window.dispatchEvent(new Event('record-refresh')); }, trigger);
    for (const failure of ['failNext', 'throwNext']) {
      await page.getByRole('button', { name: trigger, exact: true }).click();
      await page.evaluate(failure => { window.recordFixture[failure] = true; }, failure);
      await page.getByRole('button', { name: confirmation, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: failure === 'failNext' ? 'Workflow permission failure' : 'could not be completed' }).waitFor();
      if (failure === 'throwNext') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.ok(await page.getByRole('button', { name: trigger, exact: true }).isEnabled(), `${trigger}: failed confirmation releases the control`);
    }
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await page.getByRole('button', { name: confirmation, exact: true }).click();
    await page.getByRole('button', { name: trigger, exact: true }).waitFor({ state: 'detached' });
    report.checks.push({ screen: trigger, status: 'passed', checks: ['permission and transport failure','confirmation cancellation','retry'] });
  }

  for (const screen of ['requests','transactions','residents','incidents','health','applicants','households','staff']) {
    await page.goto(`${url}?screen=${screen}`);
    await page.evaluate(() => { window.recordFixture.unavailable = true; });
    await page.getByRole('button', { name: 'View Details', exact: true }).click();
    const dialog = page.getByRole('dialog').first();
    await dialog.getByText('This record is unavailable or your access changed.').waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Edit', exact: true }).count(), 0, `${screen}: unavailable records have no write controls`);
    await page.evaluate(() => { window.recordFixture.unavailable = false; });
    await dialog.getByRole('button', { name: 'Retry details', exact: true }).click();
    await dialog.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close form', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.recordFixture.rows[window.recordFixture.name].deleted_at = new Date().toISOString(); window.dispatchEvent(new Event('record-refresh')); });
    await page.locator('#fixture-archive').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog', { name: 'delete record', exact: true }).getByRole('button', { name: 'Delete permanently', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Record permanently deleted.' }).waitFor();
    assert.equal(await page.evaluate(() => window.recordFixture.rows[window.recordFixture.name]), null, `${screen}: archived deletion removes the record`);
    report.checks.push({ screen: `${screen} archive/access`, status: 'passed', checks: ['unavailable record','detail retry','permanent deletion from archive'] });
  }

  await page.goto(`${url}?screen=health`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.setViewportSize({ width: 800, height: 700 });
  await page.getByRole('button', { name: 'Archive', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, 'dark-row-icons.png') });
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  const sheet = page.getByRole('dialog').first();
  await sheet.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'dark-narrow-sheet.png') });
  await sheet.getByRole('button', { name: 'Delete', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog')), 'Tab stays inside the modal sheet');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Escape restores scrolling');
  report.checks.push({ screen: 'accessibility', status: 'passed', checks: ['dark theme','narrow viewport','reduced motion','Escape dismissal','body scroll restoration'] });
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; if (page) { report.pageText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(evidence, 'failure.png') }); } process.exitCode = 1; }
finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); save(); }
console.log(JSON.stringify(report, null, 2));
