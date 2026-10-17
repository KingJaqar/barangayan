// Browser regression checks against actual resident map components with synthetic markers.
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
const app = path.resolve(import.meta.dirname, '..');
const appRequire = createRequire(path.join(app, 'package.json'));
const output = path.resolve(app, '../../tmp/maps-ui');
fs.mkdirSync(output, { recursive: true });
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'map-fixture.jsx')], bundle: true, write: false, outdir: 'maps-preview',
  jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(appRequire.resolve('react/package.json')), 'react-dom': path.dirname(appRequire.resolve('react-dom/package.json')) },
  plugins: [{ name: 'next-link', setup(b) {
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
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><head><title>Resident map test</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const report = { checks: [], pageErrors: [], limitations: ['Actual components with synthetic map data; no authentication or database changes. Map tile network availability is not tested.'] };
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['geolocation'], geolocation: { latitude: 14.680291, longitude: 121.1187445 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const search = () => page.getByRole('combobox');
  const button = name => page.getByRole('button', { name, exact: true });
  await search().waitFor();
  assert.equal(await page.getByRole('link', { name: 'Report an incident', exact: true }).count(), 1);
  assert.equal(await page.getByText('Useful links', { exact: true }).count(), 0);
  await search().click();
  await page.getByText('Recent incidents · Select to view on map', { exact: true }).waitFor();
  assert.equal(await page.getByRole('option').count(), 6);
  await search().press('ArrowDown');
  await search().press('Enter');
  await page.locator('.leaflet-popup-content').getByText('Reported Damaged Street Light', { exact: true }).waitFor();
  await search().press('Escape');
  await search().click();
  assert.equal(await search().getAttribute('aria-expanded'), 'true');
  report.checks.push('Empty search recommends real incidents; keyboard selection works; clicking reopens recommendations');
  await search().fill('mabini light');
  assert.equal(await page.getByRole('option').count(), 2);
  await search().press('ArrowDown');
  assert.ok(await search().getAttribute('aria-activedescendant'));
  await search().press('Enter');
  await page.locator('.leaflet-popup-content').getByText('Reported Damaged Street Light', { exact: true }).waitFor();
  assert.equal(await search().getAttribute('aria-expanded'), 'false');
  // Leaflet briefly retains the previous popup while its fade-out completes.
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-popup-close-button').length === 1);
  await page.locator('.leaflet-popup-close-button').click();
  await search().click();
  await search().press('Enter');
  await page.locator('.leaflet-popup-content').getByText('Reported Damaged Street Light', { exact: true }).waitFor();
  report.checks.push('Multiword title/address/category search; keyboard selection opens map popup');
  await search().click();
  await search().press('Escape');
  assert.equal(await search().getAttribute('aria-expanded'), 'false');
  await search().fill('no-such-place');
  await page.getByText('No matches. Try another name, category or street.').waitFor();
  await button('Clear filters').click();
  assert.equal(await search().inputValue(), '');
  await button('Flooding').click();
  assert.equal(await button('Flooding').getAttribute('aria-pressed'), 'true');
  await search().fill('mabini');
  assert.equal(await page.getByRole('option').count(), 2);
  await page.getByRole('option').nth(1).click();
  await page.locator('.leaflet-popup-content').getByText('Second Flooding', { exact: true }).waitFor();
  await button('All categories').click();
  assert.equal(await button('Flooding').getAttribute('aria-pressed'), 'false');
  await button('Clear search').click();
  assert.equal(await search().inputValue(), '');
  assert.equal(await search().evaluate(el => el === document.activeElement), true);
  report.checks.push('Mouse selection, empty results, Escape, category filtering, All categories and clear controls');
  await search().fill('road');
  await page.getByRole('button', { name: /^Evacuation/ }).click();
  assert.equal(await search().inputValue(), '');
  await search().click();
  await page.getByText('Evacuation centers to explore · Select to view on map', { exact: true }).waitFor();
  assert.equal(await page.getByRole('option').count(), 1);
  await search().fill('ampid');
  await page.getByRole('option').click();
  await page.locator('.leaflet-popup-content').getByText('Ampid Evacuation Center', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^Incidents/ }).click();
  report.checks.push('Switching map view resets query; evacuation search selects and opens center details');
  for (const width of [1440, 1024, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
    const mapBounds = () => page.locator('.leaflet-container').boundingBox();
    const incidentsBounds = await mapBounds();
    await page.getByRole('button', { name: /^Evacuation/ }).click();
    assert.deepEqual(await mapBounds(), incidentsBounds, `${width}/${theme}: evacuation tab preserves map bounds`);
    await page.getByRole('button', { name: /^Incidents/ }).click();
    assert.deepEqual(await mapBounds(), incidentsBounds, `${width}/${theme}: incidents tab preserves map bounds`);
    await search().fill('street');
    await page.getByRole('option').first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${theme}: no page overflow`);
    const hit = await page.getByRole('option').first().evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)); });
    assert.equal(hit, true, `${width}/${theme}: suggestions above map`);
    await page.screenshot({ path: path.join(output, `maps-${width}-${theme}-search.png`), fullPage: true, animations: 'disabled' });
    await button('Clear search').click();
    await page.screenshot({ path: path.join(output, `maps-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
  }
  report.checks.push('Desktop, tablet and narrow layouts in light/dark; no horizontal overflow; suggestions visible above Leaflet');
  report.checks.push('Map position and dimensions stay identical when switching tabs at every tested width and theme');
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify(report, null, 2));
