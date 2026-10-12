// Isolated browser fixtures: bundle the actual components; only Next navigation is mocked.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../..');
const taskBrowsers = path.join(root, 'dist/admin-table-phase1-browsers');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(taskBrowsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = taskBrowsers;
const { chromium, firefox, webkit } = require('playwright');
const app = path.join(root, 'apps/admin-web');
const evidence = import.meta.dirname;
fs.mkdirSync(evidence, { recursive: true });
const bundle = await build({ entryPoints: [path.join(app, 'tests/table-browse/fixture.tsx')], bundle: true, write: false,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  tsconfig: path.join(app, 'tsconfig.json'),
  plugins: [{ name: 'fixture-navigation', setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(app, 'tests/table-browse/navigation-mock.ts') }));
  } }] });
const cssFile = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(cssFile, 'utf8'), { from: cssFile })).css;
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === '/fixture.css') { res.setHeader('content-type', 'text/css'); res.end(css); }
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/fixture`;
const report = { timestamp: new Date().toISOString(), browsers: [], limitations: [
  'Synthetic component fixtures, not authenticated admin routes or database adapters.',
  'Native physical input, OS overlay scrollbar settings and manual screen-reader verification were not available.',
] };
const save = () => fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
const deadline = setTimeout(() => { save(); server.closeAllConnections(); server.close(); process.exit(1); }, 180000);
async function exercise(browser, result) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.fixtureListeners = {};
    const nativeAdd = window.addEventListener.bind(window), nativeRemove = window.removeEventListener.bind(window);
    const tracked = new Map();
    window.fixtureListenerDetails = () => Object.fromEntries([...tracked.entries()].map(([type, listeners]) => [type, [...listeners].map(listener => String(listener).slice(0, 180))]));
    window.addEventListener = (type, listener, options) => {
      if (['resize', 'popstate', 'mousemove', 'mouseup'].includes(type)) {
        const listeners = tracked.get(type) ?? new Set(); listeners.add(listener); tracked.set(type, listeners);
        window.fixtureListeners[type] = listeners.size;
      }
      return nativeAdd(type, listener, options);
    };
    window.removeEventListener = (type, listener, options) => {
      tracked.get(type)?.delete(listener);
      if (tracked.has(type)) window.fixtureListeners[type] = tracked.get(type).size;
      return nativeRemove(type, listener, options);
    };
    window.fixtureNavigations = [];
    window.addEventListener('fixture-navigation', event => window.fixtureNavigations.push(event.detail));
    window.fixtureObservers = { resize: 0, mutation: 0 };
    for (const [name, key] of [['ResizeObserver', 'resize'], ['MutationObserver', 'mutation']]) {
      const Native = window[name];
      window[name] = class extends Native {
        constructor(...args) { super(...args); this.counted = false; }
        observe(target, ...args) {
          // Scope accounting to table observers; React also owns a document observer.
          if (!this.counted && target.tagName === 'TABLE') { this.counted = true; window.fixtureObservers[key]++; }
          return super.observe(target, ...args);
        }
        disconnect() { if (this.counted) { this.counted = false; window.fixtureObservers[key]--; } super.disconnect(); }
      };
    }
  });
  await page.goto(url);
  const body = page.getByRole('region', { name: 'Fixture rows and columns', exact: true });
  await body.waitFor();
  const check = async (name, run) => { await run(); result.checks.push(name); save(); };
  await check('empty/partial pages and all 45 size/count combinations', async () => {
    for (const count of [0, 1, 7, 10, 11, 23, 100, 101, 1505]) {
      await page.getByLabel('Fixture count').selectOption(String(count));
      for (const size of [10, 20, 30, 50, 100]) {
        await page.getByLabel('Rows per page').selectOption(String(size));
        await page.waitForFunction(size => document.querySelector('.table-browse-pagination select')?.value === String(size), size);
        assert.equal(await body.locator('tbody tr').count(), Math.max(1, Math.min(size, count)));
        if (count > size) await page.getByRole('button', { name: 'Last', exact: true }).click();
        const start = count === 0 ? 0 : (Math.max(1, Math.ceil(count / size)) - 1) * size + 1;
        await page.getByText(`Showing ${start}–${count} of ${count}`, { exact: true }).waitFor();
        assert.equal(await body.locator('tbody tr').count(), count === 0 ? 1 : count - start + 1);
        if (count > size) await page.getByRole('button', { name: 'First', exact: true }).click();
      }
    }
  });
  await page.getByLabel('Fixture count').selectOption('101');
  await page.getByLabel('Rows per page').selectOption('100');
  await check('bounded layout, last row/column, sticky aligned headers and exact mirror range', async () => {
    await body.evaluate(el => { el.scrollTop = el.scrollHeight; el.scrollLeft = el.scrollWidth; });
    await page.waitForTimeout(80);
    const data = await body.evaluate(el => {
      const header = el.querySelector('th'), cell = el.querySelector('tbody td');
      const top = document.querySelector('.table-browse-strip');
      return { height: el.clientHeight, content: el.scrollHeight, headerTop: header.getBoundingClientRect().top,
        bodyTop: el.getBoundingClientRect().top, aligned: header.getBoundingClientRect().left - cell.getBoundingClientRect().left,
        mirror: top.scrollWidth - top.clientWidth, max: el.scrollWidth - el.clientWidth, left: el.scrollLeft, topLeft: top.scrollLeft };
    });
    assert.ok(data.height < data.content); assert.ok(Math.abs(data.headerTop - data.bodyTop) <= 2);
    assert.ok(data.max > 0, 'wide fixture must overflow internally');
    assert.ok(Math.abs(data.aligned) <= 1); assert.ok(Math.abs(data.mirror - data.max) <= 1);
    assert.ok(Math.abs(data.left - data.topLeft) <= 1);
    assert.ok(await body.locator('tbody tr').last().isVisible());
    assert.equal(await page.locator('#legacy tbody tr').count(), 23);
    assert.equal(await page.locator('#legacy [role=region]').count(), 0);
  });
  await check('ten wheel boundary inputs on both axes and horizontal-strip vertical routing', async () => {
    const point = await body.boundingBox();
    result.boundaryGeometry = { point, viewport: page.viewportSize(), style: await body.evaluate(el => getComputedStyle(el).overscrollBehavior) };
    await page.mouse.move(point.x + 60, point.y + point.height / 2);
    const original = await page.locator('main').evaluate(el => [el.scrollTop, el.scrollLeft]);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(100, 100); }
    await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('main').evaluate(el => [el.scrollTop, el.scrollLeft]), original);
    await body.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    for (let i = 0; i < 10; i++) await page.mouse.wheel(-100, -100);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('main').evaluate(el => [el.scrollTop, el.scrollLeft]), original);
    const strip = page.getByRole('region', { name: 'Fixture horizontal scroll', exact: true });
    await strip.dispatchEvent('wheel', { deltaY: 60, deltaMode: 0 });
    assert.ok(await body.evaluate(el => el.scrollTop > 0));
  });
  await check('keyboard scrolling, boundary containment and Tab escape', async () => {
    await body.focus(); await page.keyboard.press('End');
    assert.ok(await body.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1));
    const before = await page.locator('main').evaluate(el => el.scrollTop);
    for (let i = 0; i < 10; i++) await page.keyboard.press('PageDown');
    assert.equal(await page.locator('main').evaluate(el => el.scrollTop), before);
    await page.keyboard.press('Home'); assert.equal(await body.evaluate(el => el.scrollTop), 0);
    await page.keyboard.press('ArrowRight');
    assert.ok(await body.evaluate(el => el.scrollLeft > 0), JSON.stringify(await body.evaluate(el => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth, active: document.activeElement?.outerHTML.slice(0, 150) }))));
    await page.keyboard.press('Tab'); assert.equal(await body.evaluate(el => document.activeElement === el), false);
  });
  await check('keyboard resize and toolbar/header sort agreement without false aria-sort', async () => {
    await body.evaluate(el => el.scrollLeft = 0);
    const handle = page.getByRole('separator', { name: 'Resize Name', exact: true });
    const initial = Number(await handle.getAttribute('aria-valuenow'));
    await handle.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(Number(await handle.getAttribute('aria-valuenow')), initial + 10);
    await body.getByRole('button', { name: 'Name', exact: true }).click();
    assert.equal(await page.getByLabel('Direction', { exact: true }).inputValue(), 'desc');
    assert.equal(await body.locator('th[aria-sort=descending]').count(), 1);
    await page.getByLabel('Sort by').selectOption('created');
    assert.equal(await body.locator('th[aria-sort]').count(), 0);
    await page.getByLabel('Sort by').selectOption('name');
  });
  await check('failed save retains draft, blocks navigation, Retry/Cancel and focus restoration', async () => {
    await page.getByRole('button', { name: 'Fail save: false', exact: true }).click();
    const cell = body.getByLabel('Name: press Enter to edit', { exact: true }).first();
    await cell.focus(); await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: 'Edit Name', exact: true }).fill('Preserved draft');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Edit Name' }).inputValue(), 'Preserved draft');
    const before = page.url();
    await page.getByLabel('Rows per page').selectOption('20');
    assert.equal(page.url(), before);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
    assert.ok(await cell.evaluate(el => document.activeElement === el));
    await page.getByRole('button', { name: 'Fail save: true', exact: true }).click();
  });
  await check('rapid search/control commits one query, Back cancels pending debounce, no scroll reset', async () => {
    const initial = await page.evaluate(() => window.fixtureNavigations.length);
    await page.getByLabel('Search', { exact: true }).fill('Resident 00');
    await page.getByLabel('Rows per page').selectOption('20');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.fixtureNavigations.length), initial + 1);
    assert.equal(new URL(page.url()).searchParams.get('q'), 'Resident 00');
    assert.equal(new URL(page.url()).searchParams.get('page'), '1');
    await page.getByLabel('Search', { exact: true }).fill('should cancel');
    await page.goBack(); await page.waitForTimeout(400);
    assert.notEqual(new URL(page.url()).searchParams.get('q'), 'should cancel');
    assert.ok((await page.evaluate(() => window.fixtureNavigations)).every(item => item.scroll === false));
    await page.getByLabel('Search', { exact: true }).fill(''); await page.waitForTimeout(400);
  });
  await check('pending actions are inert; error Retry preserves URL and announces committed range', async () => {
    await page.getByRole('button', { name: 'Toggle pending', exact: true }).click();
    assert.equal(await body.evaluate(el => !!el.closest('[inert]')), true);
    await page.getByRole('button', { name: 'Toggle pending', exact: true }).click();
    const before = page.url();
    await page.getByRole('button', { name: 'Toggle error', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fixture query failed' }).waitFor();
    await page.getByRole('button', { name: 'Retry', exact: true }).click(); assert.equal(page.url(), before);
    assert.match(await page.locator('.table-browse-panel [role=status]').textContent(), /Showing/);
  });
  await check('successive controls merge while a previous route is still pending', async () => {
    await page.evaluate(() => window.fixtureNavigationDelay = 200);
    await page.getByLabel('Rows per page').selectOption('30');
    await page.getByLabel('Sort by').selectOption('created');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(300);
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get('pageSize'), '30'); assert.equal(params.get('sort'), 'created'); assert.equal(params.get('tab'), 'all');
    await page.evaluate(() => window.fixtureNavigationDelay = 0);
    await page.getByLabel('Sort by').selectOption('name');
  });
  await check('narrow/short/200%/400% equivalent widths, sidebar, dark and forced colors', async () => {
    for (const viewport of [{ width: 1200, height: 900 }, { width: 600, height: 450 }, { width: 300, height: 225 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(80);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.getByRole('button', { name: 'Scroll columns right', exact: true }).click();
      assert.ok(await body.evaluate(el => el.scrollLeft > 0));
    }
    await page.setViewportSize({ width: 1200, height: 900 });
    for (const zoom of [2, 4]) {
      await page.evaluate(zoom => document.documentElement.style.zoom = String(zoom), zoom);
      await page.waitForTimeout(100);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.getByRole('button', { name: 'Next', exact: true }).scrollIntoViewIfNeeded();
      assert.ok(await page.getByRole('button', { name: 'Next', exact: true }).isVisible());
    }
    await page.evaluate(() => document.documentElement.style.zoom = '1');
    await page.locator('main').evaluate(el => el.scrollTop = 0);
    await page.locator('#sidebar').click(); await page.waitForTimeout(80);
    assert.ok(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    assert.equal(await body.locator('th').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(39, 39, 42)');
    await page.emulateMedia({ forcedColors: 'active' }); await body.focus();
    await page.getByRole('region', { name: 'Fixture horizontal scroll', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.notEqual(await body.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await page.emulateMedia({ forcedColors: 'none' });
  });
  await check('repeated mounts and active resize unmount clean observers and drag listeners', async () => {
    const original = await page.evaluate(() => ({ ...window.fixtureObservers }));
    const listeners = await page.evaluate(() => ({ ...window.fixtureListeners }));
    for (let i = 0; i < 10; i++) { await page.locator('#mount').click(); await page.locator('#mount').click(); await body.waitFor(); }
    assert.deepEqual(await page.evaluate(() => window.fixtureObservers), original);
    assert.deepEqual(await page.evaluate(() => window.fixtureListeners), listeners);
    const handle = await page.getByRole('separator', { name: 'Resize Name', exact: true }).boundingBox();
    await page.mouse.move(handle.x + 1, handle.y + 2); await page.mouse.down();
    assert.equal(await page.evaluate(() => window.fixtureListeners.mousemove), (listeners.mousemove ?? 0) + 1);
    await page.locator('#mount').dispatchEvent('click'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.fixtureObservers), { resize: 0, mutation: 0 });
    result.listenerCleanup = { initial: listeners, actual: await page.evaluate(() => window.fixtureListeners), details: await page.evaluate(() => window.fixtureListenerDetails()) };
    save();
    assert.equal(await page.evaluate(() => window.fixtureListeners.mousemove), listeners.mousemove ?? 0);
    assert.equal(await page.evaluate(() => window.fixtureListeners.mouseup), listeners.mouseup ?? 0);
    assert.equal(await page.evaluate(() => window.fixtureListeners.resize), 0);
    await page.locator('#mount').click(); await body.waitFor();
  });
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(evidence, `${result.name}.png`), fullPage: false });
  await page.close();
}
try {
  for (const [name, engine, options] of [['chrome', chromium, { channel: 'chrome' }], ['edge', chromium, { channel: 'msedge' }], ['firefox', firefox, {}], ['webkit', webkit, {}]]) {
    if (process.env.TABLE_TEST_ENGINES && !process.env.TABLE_TEST_ENGINES.split(',').includes(name)) continue;
    const result = { name, checks: [], status: 'starting' }; report.browsers.push(result); save();
    let browser;
    try { browser = await engine.launch({ ...options, headless: true, timeout: 15000 }); }
    catch (error) { result.status = 'unavailable'; result.reason = error.message.split('\n')[0]; save(); continue; }
    try { result.version = browser.version(); await exercise(browser, result); result.status = 'passed'; }
    catch (error) { result.status = 'failed'; result.error = error.stack; process.exitCode = 1; }
    finally { await browser.close(); save(); }
  }
} finally { clearTimeout(deadline); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); save(); }
console.log(JSON.stringify(report, null, 2));
