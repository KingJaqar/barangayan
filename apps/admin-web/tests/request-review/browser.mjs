import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from '../dropdown/preview.mjs';

const server = await preview({ screens: path.resolve(import.meta.dirname, '../table-browse/record-fixture.jsx') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = path.resolve(import.meta.dirname, '../../../../tmp/request-review-ui');
fs.mkdirSync(evidence, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${server.url}/screens?screen=requests`);
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  const sheet = page.getByRole('dialog').first();
  await sheet.getByRole('heading', { name: 'Resident', exact: true }).waitFor();
  for (const name of ['Payment', 'Requirements', 'Purpose', 'Status History']) {
    assert.equal(await sheet.getByRole('heading', { name, exact: true }).count(), 1);
  }
  assert.match(await sheet.textContent(), /1 Fixture Street/);
  assert.match(await sheet.textContent(), /09171234567/);
  assert.match(await sheet.textContent(), /Valid ID/);
  assert.match(await sheet.textContent(), /Proof of residency/);
  assert.match(await sheet.textContent(), /50\.00/);
  assert.equal(await sheet.getByRole('link', { name: /Open request review|Back to Requests/ }).count(), 0);
  await sheet.getByRole('button', { name: 'Move to Processing', exact: true }).click();
  await sheet.getByRole('button', { name: 'Mark as Ready for Pickup', exact: true }).waitFor();
  assert.match(await sheet.textContent(), /Review accepted/);
  assert.equal(new URL(page.url()).pathname, '/screens');
  await page.screenshot({ path: path.join(evidence, 'request-side-sheet.png'), fullPage: true });
  await sheet.getByRole('navigation', { name: 'Request review sections' }).getByRole('link', { name: 'History', exact: true }).click();
  await page.waitForFunction(() => {
    const heading = [...document.querySelectorAll('dialog h2')].find(el => el.textContent === 'Status History');
    const body = document.querySelector('dialog > section > div:nth-child(2)');
    return heading && body && heading.getBoundingClientRect().top >= body.getBoundingClientRect().top && heading.getBoundingClientRect().top < body.getBoundingClientRect().bottom - 60;
  });
  await sheet.getByRole('button', { name: /close/i }).click();
  await page.evaluate(() => { window.recordFixture.reviewFailNext = true; });
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  await sheet.getByRole('button', { name: 'Retry request review' }).waitFor();
  await sheet.getByRole('button', { name: 'Retry request review' }).click();
  await sheet.getByRole('heading', { name: 'Requirements', exact: true }).waitFor();
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForFunction(() => { const button = document.querySelector('nav[aria-label="Request review sections"]')?.nextElementSibling?.querySelector('button'); return button && getComputedStyle(button).backgroundColor === getComputedStyle(button.closest('section')).color; });
  await page.screenshot({ path: path.join(evidence, 'request-side-sheet-dark-narrow.png'), fullPage: true });
  assert.equal(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await sheet.getByRole('button', { name: /close/i }).click();
  await page.evaluate(() => {
    Object.assign(window.recordFixture.rows.requests, { contract_version: 2, status: 'submitted', sla_state: 'pre_processing', fee_assessment_state: 'assessed', assessed_amount_centavos: 0, payment_status: 'waived', supporting_details: { copies: 2, personalAppearanceAcknowledged: true }, purpose_label: 'Employment' });
    window.recordFixture.reviewEvidence = { id_type: 'National ID', version: 1, decision: 'approved' };
    window.recordFixture.reviewEvidenceImages = [{ url: 'https://example.com/id-front' }];
    window.recordFixture.reviewFiles = [{ id: 'evidence', requirement_code: 'residency', mime_type: 'image/jpeg', size_bytes: 1024, url: 'https://example.com/evidence' }];
  });
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  await sheet.getByRole('heading', { name: 'Submitted purpose and supporting information', exact: true }).waitFor();
  assert.match(await sheet.textContent(), /Requested copies2/);
  assert.match(await sheet.textContent(), /Personal appearance acknowledgedYes/);
  assert.equal(await sheet.getByRole('link', { name: /Open RESIDENCY evidence/ }).getAttribute('href'), 'https://example.com/evidence');
  assert.equal(await sheet.getByRole('link', { name: 'View approved ID front' }).getAttribute('href'), 'https://example.com/id-front');
  await sheet.getByRole('button', { name: 'Start processing', exact: true }).click();
  await sheet.getByRole('button', { name: 'Pause for resident', exact: true }).waitFor();
  assert.match(await sheet.textContent(), /Review accepted/);
  for (const width of [1440, 820, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await sheet.getByRole('heading', { name: 'Resident', exact: true }).waitFor();
    assert.equal(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Sheet fits width ' + width);
    const overview = await sheet.locator('[id$="-overview"]').evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length }));
    if (width < 640) assert.equal(overview.columns, 1);
  }
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
    for (const accent of ['#0F6E5B', '#8B4F9F', '#FAD733']) {
      await page.evaluate(accent => document.documentElement.style.setProperty('--accent', accent), accent);
      const values = await sheet.evaluate(el => {
        const close = el.querySelector('button[aria-label="Close form"]');
        const section = el.querySelector('section');
        return { accent: getComputedStyle(section).getPropertyValue('--accent').trim().toLowerCase(), outline: getComputedStyle(close).outlineColor };
      });
      assert.equal(values.accent, accent.toLowerCase());
    }
  }
  await page.evaluate(() => { document.documentElement.style.setProperty('--font-app', 'Georgia, serif'); });
  assert.match(await sheet.locator('[id$="-overview"]').evaluate(el => getComputedStyle(el).fontFamily), /Georgia/);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: path.join(evidence, 'request-side-sheet-dark-mobile.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await sheet.locator('section > div:nth-child(2)').first().evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
  const focused = await sheet.evaluate(el => { const controls = [...el.querySelectorAll('button, a[href], input')].filter(el => !el.disabled && el.getClientRects().length); controls.at(-1).focus(); return controls.at(-1).textContent; });
  assert.ok(focused);
  await page.keyboard.press('Tab');
  assert.equal(await sheet.getByRole('button', { name: /close/i }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: 'View Details', exact: true }).evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  console.log('Passed: review content, fee fallback, in-sheet workflow refresh, retry, narrow dark layout, version 2 evidence and workflow; no browser errors.');
} finally {
  await browser.close();
  await server.close();
}

