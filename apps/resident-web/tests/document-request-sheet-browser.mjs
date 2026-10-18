/* Real sheet, form and payment components with local network boundaries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve('tmp/document-request-sheet');
fs.mkdirSync(output, { recursive: true });
const mock = path.join(import.meta.dirname, 'document-request-sheet-mocks.jsx');
const bundle = await build({
  entryPoints: [path.join(import.meta.dirname, 'document-request-sheet-fixture.jsx')], bundle: true, write: false,
  outdir: output, jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { ...Object.fromEntries(['next/link', 'next/navigation', '@/lib/supabase/client', '@/hooks/use-scoped-read', '@/hooks/use-paymongo-source'].map(name => [name, mock])), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_QRPH_SETTLEMENT_READY': '"true"' },
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/fixture.js' ? 'application/javascript' : req.url === '/fixture.css' ? 'text/css' : 'text/html');
  res.end(req.url === '/fixture.js' ? js : req.url === '/fixture.css' ? css : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(process.env.SHEET_PREVIEW ? 4317 : 0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
if (process.env.SHEET_PREVIEW) console.log(`Preview: ${url}`);
else {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Intercept the entire fixture origin so verification also runs without network access.
  await page.route('http://document-sheet.fixture/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ contentType: pathname === '/fixture.js' ? 'application/javascript' : pathname === '/fixture.css' ? 'text/css' : 'text/html', body: pathname === '/fixture.js' ? js : pathname === '/fixture.css' ? css : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
  });
  const reset = async mode => { await page.evaluate(mode => window.__documentSheet.reset(mode), mode); await page.getByRole('heading', { name: /Requirements and Guidelines/ }).waitFor(); };
  const form = async () => {
    await page.getByRole('button', { name: 'Request This Document', exact: true }).click();
    await page.getByRole('heading', { name: 'Request Document', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Submit request', exact: true }).waitFor();
  };
  const submit = async () => {
    await page.getByLabel('Purpose of request').selectOption('medical');
    await page.getByRole('checkbox', { name: /personal appearance/ }).check();
    await page.getByRole('button', { name: 'Submit request', exact: true }).click();
    await page.getByText('Payment Method', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Payment', exact: true }).evaluate(element => element.lastElementChild.scrollTop), 0, 'A new screen starts at its heading');
  };
  const noOverflow = async () => {
    const overflow = await page.getByRole('dialog', { name: /Requirements|Request Document|Payment/ }).evaluate(element => ({ width: element.lastElementChild.clientWidth, scroll: element.lastElementChild.scrollWidth }));
    assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
  };
  const capture = async name => {
    await page.waitForFunction(() => {
      const sheet = document.querySelector('[role="dialog"]');
      return sheet && Math.abs(sheet.getBoundingClientRect().right - innerWidth) < 1;
    });
    await page.screenshot({ path: path.join(output, name) });
  };
  try {
    await page.goto('http://document-sheet.fixture/');
    await page.getByRole('heading', { name: 'Certificate of Indigency', exact: true }).waitFor();
    await capture('details-desktop.png');
    await noOverflow();
    await form();
    await page.getByRole('button', { name: 'Submit request', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__documentSheet.calls.length), 0, 'Required fields prevent writes');
    await capture('request-desktop.png');
    await submit();
    assert.equal(await page.evaluate(() => window.__documentSheet.calls.filter(call => call.name === 'submit_service_request').length), 1);
    await capture('method-desktop.png');
    await page.evaluate(() => { window.__documentSheet.error = { code: 'XX000', message: 'fixture error' }; });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('[data-slot="payment-method-error"]').waitFor();
    await page.evaluate(() => { window.__documentSheet.error = null; });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Pickup payment recorded. Payment is due at collection.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Payment Successful', exact: true }).count(), 0, 'Pickup remains unpaid');
    assert.equal(await page.getByRole('link', { name: 'View My Requests', exact: true }).getAttribute('href'), '/services/requests');
    await capture('pickup-desktop.png');

    await reset(); await form(); await submit();
    await page.getByRole('button', { name: /Pay with QR PH/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.waitForFunction(() => { const image = document.querySelector('img[alt="PayMongo QR PH code"]'); return image?.complete && image.naturalWidth > 0; });
    await capture('qr-desktop.png');
    await page.evaluate(() => window.__documentSheet.pay());
    await page.getByRole('button', { name: 'OK', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Payment Successful', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('heading', { name: 'Payment Successful', exact: true }).waitFor();
    await capture('success-desktop.png');
    assert.equal(await page.getByRole('link', { name: 'Track My Request', exact: true }).getAttribute('href'), `/services/requests/e1260000-0000-4000-8000-000000000001`);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Receipt' }).click();
    const download = await downloadEvent;
    await download.saveAs(path.join(output, 'receipt.pdf'));
    assert.ok(fs.readFileSync(path.join(output, 'receipt.pdf'), 'utf8').startsWith('%PDF-1.4'));

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.style.setProperty('--accent', '#a78bfa'); document.documentElement.style.setProperty('--font-app', 'Georgia, serif'); });
      await noOverflow();
      await capture(`success-dark-${width}.png`);
      await reset(); await noOverflow();
      await capture(`details-dark-${width}.png`);
      await form(); await noOverflow();
      await capture(`request-dark-${width}.png`);
      await submit(); await noOverflow();
      const amount = await page.locator('[data-fixed-fee="true"] > div:last-child > span:last-child').evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
      assert.ok(amount.height <= amount.lineHeight + 1, 'Currency stays on one line');
      await capture(`method-dark-${width}.png`);
      await page.getByRole('button', { name: /Pay with QR PH/ }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByAltText('PayMongo QR PH code').waitFor(); await noOverflow();
      await capture(`qr-dark-${width}.png`);
      await page.evaluate(() => window.__documentSheet.pay());
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await page.getByRole('heading', { name: 'Payment Successful', exact: true }).waitFor();
    }
    const theme = await page.getByRole('dialog', { name: 'Payment', exact: true }).evaluate(element => ({ font: getComputedStyle(element).fontFamily, accent: getComputedStyle(element).getPropertyValue('--primary').trim() }));
    assert.match(theme.font, /Georgia/); assert.equal(theme.accent, '#a78bfa');
    await page.setViewportSize({ width: 320, height: 844 });
    await reset('business'); await form();
    await page.getByLabel('Business name').fill('Sample Shop');
    await page.getByLabel('Establishment address').fill('12 Sample Street');
    await submit(); await noOverflow();
    assert.equal(await page.getByRole('button', { name: /Pay with QR PH/ }).count(), 0);
    await capture('business-dark-320.png');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Pickup payment recorded. Payment is due at collection.', { exact: true }).waitFor();
    await noOverflow(); await capture('pickup-dark-320.png');
    await reset(); await form(); await submit();
    await page.getByRole('button', { name: /Pay with QR PH/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel Payment', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, Cancel', exact: true }).click();
    await page.getByText('Payment Method', { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await reset('guest');
    assert.equal(await page.getByRole('link', { name: 'Log In to Request' }).getAttribute('href'), '/login');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Open document' }).click();
    await page.getByRole('heading', { name: 'Requirements and Guidelines' }).waitFor();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, checks: ['required fields before writes', 'single request submission', 'payment failure and retry', 'pickup remains due', 'QR confirmation waits for OK', 'QR cancellation returns to method', 'request tracking URL', 'PDF receipt download', '320/390/768px dark accent and font layout', 'currency stays on one line', 'variable business fee and pickup-only gating', 'guest login', 'close/reopen with reduced motion'], errors, limitation: 'Synthetic network boundaries; no live payment or database writes.' }, null, 2));
    console.log(`PASS: document request sheet browser checks. Evidence: ${output}`);
  } catch (error) {
    console.error(await page.locator('body').innerText());
    console.error(errors);
    throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
