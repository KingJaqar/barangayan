// Read-only guest checks against an already-running real Next.js server.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.VALID_ID_TEST_BASE_URL;
if (!base) throw new Error('Set VALID_ID_TEST_BASE_URL to the local resident-web server.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  for (const [path, destination] of [['/settings/valid-id', '/settings/valid-id'], ['/settings/profile#upload-valid-id', '/settings/profile']]) {
    await page.goto(new URL(path, base).href);
    await page.waitForURL(url => url.pathname === '/login');
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('next'), destination);
    assert.equal(await page.getByRole('button', { name: 'Submit', exact: true }).count(), 0);
  }
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  console.log(JSON.stringify({ browser: browser.version(), checks: ['Actual production route redirects guests through Login to the fixed Valid ID destination', 'Old Profile fragment preserves its existing server guard and Profile return destination'], errors, warnings, limitations: ['Guest session only; incomplete/complete residents and live writes are not exercised.'] }, null, 2));
} finally { await browser.close(); }
