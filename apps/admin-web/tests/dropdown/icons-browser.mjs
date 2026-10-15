import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from './preview.mjs';

const evidence = path.resolve(import.meta.dirname, '../../../../plans/evidence/admin-dropdown-ui/icon-refinement-2026-10-15');
fs.mkdirSync(evidence, { recursive: true });
const forms = await preview({ icons: path.join(import.meta.dirname, 'icons.tsx'), coverage: path.join(import.meta.dirname, 'coverage.tsx') }, { uiMocks: true });
const records = await preview({ screens: path.resolve(import.meta.dirname, '../table-browse/record-fixture.jsx') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { checks: [], errors: [], warnings: [], limitations: ['Actual frontend components with synthetic records and mocked persistence. No hosted-data writes.'] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  async function icon(control, expected) {
    assert.equal(await control.locator(':scope > span[aria-hidden="true"] svg').getAttribute('class').then(value => value.split(' ').includes(`lucide-${expected}`)), true, expected);
  }
  async function options(control, expected) {
    await control.click();
    for (const [name, glyph] of Object.entries(expected)) {
      const row = page.getByRole('listbox').getByRole('option', { name, exact: true });
      if (glyph) await icon(row, glyph);
      else assert.equal(await row.locator(':scope > span[aria-hidden="true"] svg').count(), 0, `${name} keeps a neutral gutter`);
    }
    await page.keyboard.press('Escape');
  }
  for (const [form, expected] of [
    ['announcements', { General: 'info', Emergency: 'triangle-alert', Health: 'heart', Events: 'calendar-days' }],
    ['faq', { General: 'circle-question-mark', Services: 'file-text', Emergency: 'triangle-alert', Health: 'heart', Billing: 'receipt-text', Account: 'user-round' }],
    ['hub', { Guidelines: 'book-open', Hotlines: 'phone' }],
    ['waste', { Biodegradable: 'leaf', Recyclable: 'recycle', Residual: 'trash-2', 'Special Waste': 'triangle-alert', 'Bulk Waste': 'package' }],
  ]) {
    await page.goto(`${forms.url}/icons?form=${form}`);
    const control = page.getByRole('combobox', { name: form === 'waste' ? 'Waste Type' : 'Category', exact: true });
    await options(control, expected);
    report.checks.push(`Actual ${form} form: every fixed option has its corresponding semantic icon`);
  }
  await page.goto(`${forms.url}/coverage`);
  const compatibility = page.getByRole('combobox');
  await options(compatibility.nth(0), { Male: 'mars', Female: 'venus' });
  await options(compatibility.nth(1), { Employed: 'briefcase-business', Unemployed: 'search', Student: 'graduation-cap', 'Self-Employed': 'store', Retired: 'armchair' });
  await page.getByRole('button', { name: 'Fixture QR instructions' }).click();
  const qr = page.getByRole('combobox', { name: 'Icon', exact: true });
  await options(qr, {
    'qr-code-outline': 'qr-code', 'help-circle-outline': 'circle-question-mark', 'warning-outline': 'triangle-alert',
    'shield-checkmark-outline': 'shield-check', 'flame-outline': 'flame', 'call-outline': 'phone',
    'location-outline': 'map-pin', 'people-outline': 'users', 'home-outline': 'house', 'checkbox-outline': 'square-check',
  });
  await qr.click(); await page.getByRole('option', { name: 'flame-outline', exact: true }).click();
  await icon(qr, 'flame');
  await qr.click();
  await page.keyboard.press('Home');
  await page.getByRole('listbox').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: path.join(evidence, 'qr-icon-previews.png') });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  await page.screenshot({ path: path.join(evidence, 'qr-icon-previews-dark.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('compatibility-writes').textContent(), '0');
  report.checks.push('Actual compatibility sex/employment choices and all ten QR presets; selected QR trigger previews the glyph; no save');

  for (const [screen, field, expected] of [
    ['requests', 'Status', { Submitted: 'file-text', Processing: 'clock', 'Ready for Pickup': 'package', Completed: 'circle-check', Cancelled: 'circle-x' }],
    ['transactions', 'Method', { 'Pay at Pickup': 'hand-coins', 'QR PH': 'qr-code' }],
    ['residents', 'Sex', { '—': null, Male: 'mars', Female: 'venus' }],
    ['health', 'Category', { Vaccination: 'syringe', 'Blood Drive': 'droplet', 'Medicine Distribution': 'pill', 'Dental Care': 'smile-plus', 'Optical Care': 'glasses' }],
    ['staff', 'Role', { Administrator: 'shield-user', Staff: 'user-round-cog', Treasurer: 'coins', 'Barangay Health Worker': 'stethoscope', Tanod: 'shield' }],
  ]) {
    await page.goto(`${records.url}/screens?screen=${screen}`);
    const headers = await page.locator('thead th').allTextContents();
    const index = headers.findIndex(header => header.trim().toLowerCase() === field.toLowerCase());
    assert.ok(index >= 0, `${screen}: ${field} header`);
    await page.locator('tbody tr').first().locator('td').nth(index).click();
    await options(page.getByRole('combobox', { name: `Edit ${field}`, exact: true }), expected);
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.recordFixture.mutations), []);
    report.checks.push(`Actual ${screen} inline editor: semantic icons and cancel without persistence`);
  }
  await page.goto(`${records.url}/screens?screen=requests`);
  await options(page.getByRole('combobox', { name: 'Sort by', exact: true }), { Reference: 'hash', Resident: 'user-round', 'Document type': 'file-text', Status: 'activity', 'Payment status': 'wallet' });
  await options(page.getByRole('combobox', { name: 'Direction', exact: true }), { 'Lowest reference first': 'arrow-down-0-1', 'Highest reference first': 'arrow-up-0-1' });
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  const dialog = page.getByRole('dialog').first();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await options(dialog.getByRole('combobox', { name: /Payment method/ }), { pickup: 'hand-coins', qrph: 'qr-code' });
  await options(dialog.getByRole('combobox', { name: /Payment status/ }), { pending: 'clock', paid: 'badge-check', waived: 'circle-minus' });
  assert.deepEqual(await page.evaluate(() => window.recordFixture.mutations), []);
  report.checks.push('Actual sort fields, numeric directions and record drawer use semantic icons without popup-open/dismiss writes');

  await page.goto(`${forms.url}/icons`);
  await icon(page.getByRole('combobox', { name: 'Explicit icons' }), 'file-text');
  await options(page.getByRole('combobox', { name: 'Explicit icons' }), { First: 'star', Second: null });
  await options(page.getByRole('combobox', { name: 'Unknown value' }), { 'Unknown status': null });
  report.checks.push('Explicit trigger/option overrides preserved; unknown values have an empty icon gutter and remain safe');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
} catch (error) { report.failure = error.stack; throw error; }
finally {
  fs.writeFileSync(path.join(evidence, 'icons-results.json'), JSON.stringify(report, null, 2));
  await browser.close(); await forms.close(); await records.close();
}
