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
const evidence = path.join(root, 'dist/resident-id-review-qa');
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
const report = { checks: [], errors: [], limitations: ['Actual table and side sheet components with synthetic ID evidence and mocked review responses.'] };
let browser, page;
async function seed(status = 'pending', back = false) {
  await page.goto(`${url}?screen=residents`);
  await page.getByRole('button', { name: 'Update ID status for Fixture Resident', exact: true }).waitFor();
  await page.evaluate(({ status, back }) => {
    const fixture = window.recordFixture, row = fixture.rows.residents;
    row.id_verification_status = status;
    row.current_id_submission_id = status ? 'c1300000-0000-0000-0000-000000000001' : null;
    fixture.idEvidence = status ? { id: row.current_id_submission_id, resident_id: row.id, barangay_id: row.barangay_id,
      version: 1, decision: status, front_path: row.id + '/front.jpg', back_path: back ? row.id + '/back.jpg' : null,
      id_type: 'National ID', submitted_at: '2026-10-16T04:00:00Z', evidence_origin: 'resident_upload',
      reviewed_at: null, reviewed_by: null, rejection_reason: null, confirmed_details: { fullName: 'Fixture Resident' } } : null;
    window.dispatchEvent(new Event('record-refresh'));
  }, { status, back });
}
async function tableEditor() {
  await page.getByRole('button', { name: 'Update ID status for Fixture Resident', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Update ID status for Fixture Resident', exact: true });
  await dialog.getByRole('combobox', { name: 'Update ID status', exact: true }).waitFor();
  return dialog;
}
async function choose(scope, label) {
  await scope.getByRole('combobox', { name: 'Update ID status', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.locator('[data-admin-dropdown-surface]').waitFor({ state: 'detached' });
}
const saveButton = scope => scope.getByRole('button', { name: 'Save ID status', exact: true });
async function waitStatus(status) {
  await page.waitForFunction(status => window.recordFixture.rows.residents.id_verification_status === status, status);
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

  await seed();
  let dialog = await tableEditor();
  await dialog.getByRole('img', { name: 'ID document 1', exact: true }).waitFor();
  await choose(dialog, 'Verified ID');
  await saveButton(dialog).click();
  await waitStatus('verified');
  await dialog.getByText('Current: Verified ID', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close ID review' }).click();
  assert.match(await page.getByRole('button', { name: 'Update ID status for Fixture Resident', exact: true }).innerText(), /Verified ID/);
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  dialog = page.getByRole('dialog').first();
  await dialog.getByText('Current: Verified ID', { exact: true }).waitFor();
  report.checks.push('Table approval refreshes the cell and is visible in side sheet details');

  await choose(dialog, 'Verification Failed (revoke approval)');
  assert.ok(await saveButton(dialog).isDisabled());
  await dialog.getByRole('textbox', { name: 'Reason for revocation' }).fill('ID approval withdrawn after review.');
  await saveButton(dialog).click();
  await waitStatus('verification_failed');
  await dialog.getByText('Current: Verification Failed, Try Again', { exact: true }).waitFor();
  const calls = await page.evaluate(() => window.recordFixture.workflowCalls);
  assert.equal(calls.at(-1).input.p_input.decision, 'revoked');
  assert.equal(calls.at(-1).input.p_input.reason, 'ID approval withdrawn after review.');
  await page.screenshot({ path: path.join(evidence, 'side-sheet-status-updated.png') });
  report.checks.push('Side sheet revocation requires a reason and persists the actual failed status');

  await seed('pending', true);
  dialog = await tableEditor();
  await dialog.getByRole('img', { name: 'ID document 2', exact: true }).waitFor();
  await choose(dialog, 'Verification Failed, Try Again');
  assert.ok(await saveButton(dialog).isDisabled());
  await dialog.getByRole('textbox', { name: 'Reason for rejection' }).fill('ID image is unreadable.');
  await saveButton(dialog).click();
  await waitStatus('verification_failed');
  assert.equal(await page.evaluate(() => window.recordFixture.workflowCalls.at(-1).input.p_input.decision), 'verification_failed');
  report.checks.push('Table rejection requires a reason and supports front/back evidence');

  await seed(); dialog = await tableEditor();
  await choose(dialog, 'Verified ID');
  await page.evaluate(() => { window.recordFixture.failNext = true; });
  await saveButton(dialog).click();
  await dialog.getByRole('alert').filter({ hasText: 'Workflow permission failure.' }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.residents.id_verification_status), 'pending');
  assert.ok(await dialog.getByRole('button', { name: 'Close ID review' }).isEnabled());
  await dialog.getByRole('button', { name: 'Reload ID', exact: true }).click();
  await choose(dialog, 'Verified ID');
  await saveButton(dialog).click(); await waitStatus('verified');
  report.checks.push('Failed writes preserve status and allow a successful retry');

  await seed(); dialog = await tableEditor(); await choose(dialog, 'Verified ID');
  await page.evaluate(() => { window.recordFixture.staleIdNext = true; });
  await saveButton(dialog).click();
  await dialog.getByText('This ID submission changed or was already reviewed. Reload the ID before trying again.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.residents.id_verification_status), 'pending');
  report.checks.push('Stale evidence cannot report success or overwrite an ID decision');

  await seed();
  await page.evaluate(() => { window.recordFixture.photoFail = true; });
  dialog = await tableEditor();
  await dialog.getByRole('button', { name: 'Reload ID photos' }).waitFor();
  await choose(dialog, 'Verified ID');
  assert.ok(await saveButton(dialog).isDisabled());
  await page.evaluate(() => { window.recordFixture.photoFail = false; });
  await dialog.getByRole('button', { name: 'Reload ID photos' }).click();
  await dialog.getByRole('img', { name: 'ID document 1', exact: true }).waitFor();
  await choose(dialog, 'Verified ID');
  await page.screenshot({ path: path.join(evidence, 'table-id-status-editor.png') });
  assert.ok(await saveButton(dialog).isEnabled());
  report.checks.push('Unavailable photos block approval until evidence reload succeeds');

  await page.evaluate(() => { window.recordFixture.throwNext = true; });
  await saveButton(dialog).click();
  await dialog.getByText('Fixture transport failure.', { exact: true }).waitFor();
  assert.ok(await dialog.getByRole('button', { name: 'Close ID review' }).isEnabled());
  report.checks.push('Transport errors release the saving state');

  await seed(null);
  await page.getByRole('button', { name: 'Update ID status for Fixture Resident', exact: true }).click();
  await page.getByText('No current ID submission. Ask the resident to upload an ID before updating its status.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save ID status', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  report.checks.push('Accounts without ID evidence cannot be approved; Escape closes the editor');

  async function editResident(hasEvidence = true) {
    // Keyboard activation also reaches the table action when frozen columns cover it at narrow widths.
    await page.getByRole('button', { name: 'View Details', exact: true }).press('Enter');
    const sheet = page.getByRole('dialog').first();
    await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
    if (hasEvidence) await sheet.getByRole('combobox', { name: 'Update ID status', exact: true }).waitFor();
    else await sheet.getByText('Current: No ID', { exact: true }).waitFor();
    assert.equal(await sheet.locator('form form').count(), 0, 'Profile and ID review forms must be siblings');
    return sheet;
  }

  await seed();
  dialog = await editResident();
  await dialog.getByLabel('Occupation', { exact: true }).fill('Draft occupation');
  await page.evaluate(() => {
    window.recordFixture.enforceExpected = true;
    window.recordFixture.idReviewProfilePatch = { updated_at: '2026-10-18T08:00:00Z' };
    window.recordFixture.workflowDelay = 800;
  });
  await choose(dialog, 'Verified ID');
  await saveButton(dialog).click();
  assert.ok(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled());
  assert.ok(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  assert.ok(await dialog.isVisible(), 'The editor stays open during an ID decision');
  await dialog.getByText('Current: Verified ID', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Save', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[form]')?.disabled);
  assert.equal(await dialog.getByLabel('Occupation', { exact: true }).inputValue(), 'Draft occupation');
  assert.equal(await page.evaluate(() => window.recordFixture.mutations.length), 0, 'Saving an ID must not save profile fields');
  await page.screenshot({ path: path.join(evidence, 'edit-mode-id-review.png') });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.residents.occupation), 'Draft occupation');
  report.checks.push('Edit mode reviews ID separately, preserves drafts, protects in-flight saves and refreshes the profile version');

  await seed('verified'); dialog = await editResident();
  await choose(dialog, 'Verification Failed (revoke approval)');
  assert.ok(await saveButton(dialog).isDisabled());
  await dialog.getByRole('textbox', { name: 'Reason for revocation' }).fill('The ID document needs replacement.');
  await saveButton(dialog).click(); await waitStatus('verification_failed');
  await dialog.getByText('Current: Verification Failed, Try Again', { exact: true }).waitFor();
  assert.ok(await dialog.getByLabel('Occupation', { exact: true }).isVisible());
  report.checks.push('Edit mode can revoke approval with a required reason while keeping profile editing open');

  await seed(); dialog = await editResident();
  await dialog.getByLabel('Occupation', { exact: true }).fill('Keep my draft');
  await page.evaluate(() => { window.recordFixture.failNext = true; });
  await choose(dialog, 'Verified ID'); await saveButton(dialog).click();
  await dialog.getByRole('alert').filter({ hasText: 'Workflow permission failure.' }).waitFor();
  assert.equal(await dialog.getByLabel('Occupation', { exact: true }).inputValue(), 'Keep my draft');
  assert.ok(await dialog.getByRole('button', { name: 'Save', exact: true }).isEnabled());
  report.checks.push('Failed ID decisions preserve profile drafts and release the editor controls');

  await seed(); dialog = await editResident();
  await dialog.getByLabel('Occupation', { exact: true }).fill('My profile draft');
  await page.evaluate(() => {
    window.recordFixture.enforceExpected = true;
    window.recordFixture.idReviewProfilePatch = { occupation: 'Concurrent change', updated_at: '2026-10-18T09:00:00Z' };
  });
  await choose(dialog, 'Verified ID'); await saveButton(dialog).click();
  await dialog.getByRole('alert').filter({ hasText: 'The resident profile also changed.' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[form]')?.disabled);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Fixture stale profile version.' }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.residents.occupation), 'Concurrent change');
  assert.equal(await dialog.getByLabel('Occupation', { exact: true }).inputValue(), 'My profile draft');
  report.checks.push('ID decisions never bypass conflict protection for concurrent profile edits');

  await seed(null); dialog = await editResident(false);
  await dialog.getByText('No current ID submission. Ask the resident to upload an ID before updating its status.', { exact: true }).waitFor();
  assert.equal(await saveButton(dialog).count(), 0);
  report.checks.push('Edit mode displays No ID without allowing approval of missing evidence');

  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await seed('pending', true);
    await page.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.style.setProperty('--accent', '#8855bb'); });
    dialog = await editResident();
    await saveButton(dialog).scrollIntoViewIfNeeded();
    assert.ok(await dialog.locator('section').first().evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Edit sheet must not overflow horizontally');
    await page.screenshot({ path: path.join(evidence, `edit-mode-dark-${width}.png`) });
  }
  report.checks.push('ID review remains usable in the edit sheet at 360px and 768px with dark mode and a custom accent');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${url}?screen=health`);
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  dialog = page.getByRole('dialog').first();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByLabel('Location *', { exact: true }).fill('Updated fixture clinic');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.recordFixture.rows.health.location), 'Updated fixture clinic');
  report.checks.push('Other record-sheet editors retain their profile Save action and form association');

  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; process.exitCode = 1;
  if (page) { report.pageText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(evidence, 'failure.png') }); }
} finally {
  if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
