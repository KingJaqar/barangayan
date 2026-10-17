// Exercise the eight real table components with existing synthetic record adapters.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const require = createRequire(path.join(app, 'package.json'));
const { chromium } = require('playwright');
const evidence = path.join(root, 'tmp/admin-frozen-columns');
fs.mkdirSync(evidence, { recursive: true });
const bundle = await build({
  entryPoints: [path.join(import.meta.dirname, 'record-fixture.jsx')], bundle: true, write: false,
  outdir: 'frozen-columns-preview', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  plugins: [{ name: 'record-adapters', setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$|^@\/lib\/supabase\/client$|^@\/actions\/(admin-(record|audit)|request-review)-actions$/ },
      () => ({ path: path.join(import.meta.dirname, 'record-adapters.js') }));
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
      contents: 'import React from "react"; export default function Link(props){return React.createElement("a",props)}', loader: 'js', resolveDir: app,
    }));
  } }],
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css
  + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const server = http.createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.setHeader('content-type', 'text/javascript'); response.end(bundle.outputFiles.find(file => file.path.endsWith('.js')).contents);
  } else if (request.url === '/fixture.css') {
    response.setHeader('content-type', 'text/css'); response.end(css);
  } else {
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const expected = {
  requests: ['#', 'Resident'], transactions: ['#', 'Resident'], residents: ['#', 'Email'],
  incidents: ['#', 'Incident', 'Reporter'], health: ['#', 'Drive', 'Category'],
  applicants: ['#', 'Applicant #', 'Drive'], households: ['#', 'Name', 'Resident (Head)'], staff: ['#', 'Role', 'Email'],
};
const report = { checks: [], errors: [] };
let browser;
try {
  browser = await chromium.launch({ channel: process.env.FROZEN_TEST_CHANNEL ?? 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  async function checkAlignment(screen) {
    await page.locator('.table-browse-viewport').scrollIntoViewIfNeeded();
    const result = await page.locator('.table-browse-viewport').evaluate(viewport => {
      const headers = [...viewport.querySelectorAll('th')];
      const bounds = viewport.getBoundingClientRect();
      let left = bounds.left + viewport.clientLeft * (bounds.width / viewport.offsetWidth);
      return headers.filter(header => header.hasAttribute('data-frozen')).map(header => {
        const cell = viewport.querySelector('tbody tr').children[headers.indexOf(header)];
        const result = { header: header.textContent.trim(), headerX: header.getBoundingClientRect().left,
          cellX: cell.getBoundingClientRect().left, expectedX: left, background: getComputedStyle(cell).backgroundColor,
          visible: cell.contains(document.elementFromPoint(cell.getBoundingClientRect().left + 4, cell.getBoundingClientRect().top + 4)) };
        left += header.getBoundingClientRect().width;
        return result;
      });
    });
    for (const item of result) {
      assert.ok(Math.abs(item.headerX - item.expectedX) < 1, `${screen} ${JSON.stringify(item)}`);
      assert.ok(Math.abs(item.cellX - item.expectedX) < 1, `${screen}: body aligns with ${item.header}`);
      assert.ok(!item.background.endsWith(', 0)') && item.background !== 'transparent', `${screen}: opaque ${item.header}`);
      assert.ok(item.visible, `${screen}: ${item.header} remains inside the scroll region`);
    }
  }
  for (const [screen, labels] of Object.entries(expected)) {
    await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}`);
    const viewport = page.locator('.table-browse-viewport');
    await viewport.locator('th[data-frozen]').first().waitFor();
    await viewport.evaluate(element => { element.style.maxHeight = '320px'; });
    assert.deepEqual(await viewport.locator('th[data-frozen]').allTextContents(), labels, `${screen}: exact frozen columns`);
    const order = await viewport.locator('th').allTextContents();
    const before = await viewport.locator('th:not([data-frozen])').first().boundingBox();
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.waitForTimeout(80);
    assert.ok(await viewport.evaluate(element => element.scrollLeft > 0), `${screen}: horizontal overflow`);
    await checkAlignment(screen);
    assert.ok((await viewport.locator('th:not([data-frozen])').first().boundingBox()).x < before.x, `${screen}: other columns scroll`);
    // Keyboard resizing must update every subsequent frozen column's offset.
    const resize = viewport.locator('th[data-frozen]').first().getByRole('separator');
    const width = Number(await resize.getAttribute('aria-valuenow'));
    await resize.dispatchEvent('keydown', { key: 'ArrowRight', shiftKey: true });
    assert.equal(Number(await resize.getAttribute('aria-valuenow')), width + 50);
    await page.waitForTimeout(80);
    await checkAlignment(screen);
    const identifierResize = viewport.locator('th[data-frozen]').last().getByRole('separator');
    const identifierWidth = Number(await identifierResize.getAttribute('aria-valuenow'));
    await identifierResize.dispatchEvent('mousedown', { clientX: 500 });
    await page.mouse.move(520, 300);
    await page.mouse.up();
    assert.equal(Number(await identifierResize.getAttribute('aria-valuenow')), identifierWidth + 20);
    await page.waitForTimeout(80);
    await checkAlignment(screen);
    assert.deepEqual(await viewport.locator('th').allTextContents(), order, `${screen}: column order preserved`);
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      await checkAlignment(screen);
    }
    // Both scrollbars still synchronize with frozen cells in place.
    const strip = page.locator('.table-browse-strip');
    await strip.evaluate(element => { element.scrollLeft = 0; });
    await page.waitForTimeout(80);
    assert.equal(await viewport.evaluate(element => element.scrollLeft), 0);
    await strip.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.waitForTimeout(80);
    await checkAlignment(screen);
    await page.setViewportSize({ width: 768, height: 650 });
    await page.waitForTimeout(80);
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await checkAlignment(screen);
    assert.ok(await viewport.evaluate(element => element.getBoundingClientRect().right <= innerWidth + 1), `${screen}: table viewport contains horizontal overflow`);
    await page.emulateMedia({ forcedColors: 'active' });
    await checkAlignment(screen);
    await page.emulateMedia({ forcedColors: 'none' });
    await page.screenshot({ path: path.join(evidence, `${screen}.png`) });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(80);
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    // Alignment is in rendered pixels, while offsets remain in CSS pixels.
    await checkAlignment(screen);
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.waitForTimeout(80);
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    // The corner headers stay above the frozen body when scrolling vertically.
    await viewport.evaluate(element => { element.style.height = '180px'; element.style.overflowY = 'auto'; element.scrollTop = 30; });
    const headerVisible = await viewport.locator('th[data-frozen]').first().evaluate(header => {
      const rect = header.getBoundingClientRect();
      return header.contains(document.elementFromPoint(rect.left + 4, rect.top + 4));
    });
    assert.ok(headerVisible, `${screen}: header remains above body`);
    await page.setViewportSize({ width: 1100, height: 900 });
    report.checks.push(`${screen}: exact columns, scrolling, keyboard/pointer resizing, themes, forced colors, narrow viewport, 200% zoom, sticky headers`);
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
