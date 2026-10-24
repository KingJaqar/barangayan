import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..'), repo = path.resolve(app, '../..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild'), { chromium } = require('playwright');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.join(repo, 'tmp/map-state-bridge');
fs.mkdirSync(out, { recursive: true });
// Real MapView and React effects; synthetic native transport. Leaflet interactions
// are covered separately by maps-presentation-ui and drrm-centers-ui.
const adapters = {
  'react-native': `import React from 'react';export const Platform={OS:'android'};export const StyleSheet={create:x=>x};export const View=({children})=><div>{children}</div>;export const Text=({children})=><span>{children}</span>;`,
  'react-native-webview': `import React,{useImperativeHandle}from'react';export const WebView=React.forwardRef((p,ref)=>{window.fixture.native=p;useImperativeHandle(ref,()=>({injectJavaScript(js){const data=js.match(/data: (.+) \\}/)[1];window.fixture.sent.push(JSON.parse(JSON.parse(data)))}}));return <div/>});`,
  '@/lib/navigation-diagnostics': `export const navigationDiagnosticsAvailable=false;export const mountDiagnosticOwner=()=>()=>{};export const recordNavigationDiagnostic=()=>{};`,
  '@/components/leaflet-assets': `export const LEAFLET_CSS='',LEAFLET_JS='',LEAFLET_LICENSE='';`,
  '@barangayan/shared': `export {isPointInPolygon} from '${path.join(repo, 'packages/shared/src/lib/point-in-polygon.ts').replaceAll('\\', '/')}';`,
};
await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{MapView}from'./src/components/map-view';const root=createRoot(document.getElementById('root'));let key=0;window.render=(props,remount=false)=>flushSync(()=>root.render(<MapView key={remount?++key:key} {...props} ref={handle=>window.fixture.handle=handle} onMapReady={()=>window.fixture.ready++} onMapError={()=>window.fixture.errors++} onMarkerTap={id=>window.fixture.selected=id}/>));`, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(out, 'bundle.js'), plugins: [{ name: 'native-transport', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (Object.hasOwn(adapters, a.path)) return { path: a.path, namespace: 'adapter' }; if (a.path.startsWith('@/')) return { path: path.join(app, 'src', a.path.slice(2)) + '.ts' }; }); b.onLoad({ filter: /.*/, namespace: 'adapter' }, a => ({ contents: adapters[a.path], loader: 'tsx', resolveDir: app })); } }] });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' });
const page = await browser.newPage(), issues = [], results = {};
page.on('pageerror', e => issues.push(e.message));
page.on('console', m => { if (['warning', 'error'].includes(m.type())) issues.push(m.text()); });
try {
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => { window.fixture = { sent: [], ready: 0, errors: 0 }; });
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const props = {
    markers: [{ id: 'one', kind: 'flood', label: 'First', position: { lat: 14.68, lng: 121.12 } }],
    kindColors: { flood: '#ffcc00', fire: '#ff0000' },
    boundary: { type: 'Polygon', coordinates: [[[121.11, 14.67], [121.13, 14.67], [121.13, 14.69], [121.11, 14.67]]] },
    presentation: { selectedMarkerId: null, padding: { top: 100, bottom: 80 }, attributionBottom: 0, reducedMotion: true, surface: '#fff', text: '#000', border: '#ddd', fontFamily: 'serif' },
  };
  const render = (p, remount = false) => page.evaluate(({ p, remount }) => window.render(p, remount), { p, remount });
  const message = type => page.evaluate(type => window.fixture.native.onMessage({ nativeEvent: { data: JSON.stringify({ type }) } }), type);
  const counts = () => page.evaluate(() => Object.fromEntries(['SET_MARKERS', 'SET_BOUNDARY', 'SET_PRESENTATION'].map(type => [type, window.fixture.sent.filter(m => m.type === type).length])));
  const baseline = process.env.MAP_BRIDGE_BASELINE === '1';
  await render(props);
  assert.deepEqual(await counts(), { SET_MARKERS: 0, SET_BOUNDARY: 0, SET_PRESENTATION: 0 });
  const latest = { ...props, markers: [{ ...props.markers[0], label: 'Latest before ready' }] };
  await render(latest); await message('MAP_READY');
  assert.equal(await page.evaluate(() => window.fixture.sent.find(m => m.type === 'SET_MARKERS').payload.markers[0].label), 'Latest before ready');
  assert.deepEqual(await counts(), { SET_MARKERS: 1, SET_BOUNDARY: 1, SET_PRESENTATION: 1 });
  for (let i = 0; i < 10; i++) await render({ ...latest, kindColors: { fire: '#ff0000', flood: '#ffcc00' } });
  results.equalContentAfterTenRenders = await counts();
  if (!baseline) assert.deepEqual(results.equalContentAfterTenRenders, { SET_MARKERS: 1, SET_BOUNDARY: 1, SET_PRESENTATION: 1 });
  if (!baseline) {
    // Each field that affects a drawn marker must invalidate the retained payload.
    for (const change of [{ label: 'Renamed' }, { id: 'replacement' }, { kind: 'fire' }, { position: { lat: 14.681, lng: 121.121 } }]) {
      const before = await counts();
      await render({ ...latest, markers: [{ ...latest.markers[0], ...change }] });
      assert.equal((await counts()).SET_MARKERS, before.SET_MARKERS + 1);
    }
    await render(latest);
    const beforeTheme = await counts();
    await render({ ...latest, presentation: { ...latest.presentation, surface: '#111', text: '#fff', fontFamily: 'sans-serif' } });
    assert.equal((await counts()).SET_PRESENTATION, beforeTheme.SET_PRESENTATION + 1);
    assert.equal((await counts()).SET_MARKERS, beforeTheme.SET_MARKERS);
    await render(latest);
  }
  await message('MAP_READY');
  assert.equal(await page.evaluate(() => window.fixture.ready), 1);
  const beforeReset = await counts();
  await render({ ...latest, boundaryRefitKey: 1 });
  assert.equal((await counts()).SET_BOUNDARY, beforeReset.SET_BOUNDARY + 1);
  // Stateful payload changes still cross the bridge, including removals/empty data.
  await render({ ...latest, boundaryRefitKey: 1, kindColors: { flood: '#123456' } });
  await render({ markers: [], boundary: null, presentation: undefined });
  assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_BOUNDARY').at(-1).payload.geometry), null);
  assert.deepEqual(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_MARKERS').at(-1).payload.markers), []);
  assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_PRESENTATION').at(-1).payload), null);
  // Commands must remain repeatable, even when all state payloads are equal.
  await page.evaluate(() => { window.fixture.handle.zoomIn(); window.fixture.handle.zoomIn(); window.fixture.handle.fitBoundary(); window.fixture.handle.fitBoundary(); });
  assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'ZOOM').length), 2);
  assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'FIT_BOUNDARY').length), 2);
  await page.evaluate(() => window.fixture.native.onLoadStart?.());
  const beforeReload = await counts();
  const reloadProps = { ...latest, markers: [{ ...props.markers[0], label: 'Latest during reload' }], userLocation: { position: { lat: 14.681, lng: 121.121 }, accuracyMeters: 8, pending: false }, route: [{ lat: 14.68, lng: 121.12 }, { lat: 14.681, lng: 121.121 }], roadMarks: { closures: [], avoided: [], selected: null }, showTiles: false };
  await render(reloadProps);
  results.sentWhileReloading = (await counts()).SET_MARKERS - beforeReload.SET_MARKERS;
  if (!baseline) assert.deepEqual(await counts(), beforeReload);
  await message('MAP_READY');
  results.readyCallbacksAfterReload = await page.evaluate(() => window.fixture.ready);
  if (!baseline) {
    assert.equal(results.readyCallbacksAfterReload, 2);
    assert.equal((await counts()).SET_MARKERS, beforeReload.SET_MARKERS + 1);
    assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_MARKERS').at(-1).payload.markers[0].label), 'Latest during reload');
    assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_USER_LOCATION').at(-1).payload.accuracyMeters), 8);
    assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'DRAW_ROUTE').at(-1).payload.points.length), 2);
    assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_TILES').at(-1).payload.enabled), false);
    await page.evaluate(() => window.fixture.native.onRenderProcessGone());
    const afterFailure = await counts();
    await render(props); assert.deepEqual(await counts(), afterFailure);
    await message('MAP_READY'); assert.equal((await counts()).SET_MARKERS, afterFailure.SET_MARKERS + 1);
    const beforeTileError = await counts();
    await message('MAP_ERROR');
    await render(latest);
    assert.equal((await counts()).SET_MARKERS, beforeTileError.SET_MARKERS + 1);
    // Tile failure does not make a ready offline map stop accepting updates.
    await message('MAP_READY');
    assert.equal(await page.evaluate(() => window.fixture.errors), 2);
    await page.evaluate(() => window.fixture.native.onError());
    await render(props, true); await message('MAP_READY');
    assert.equal(await page.evaluate(() => window.fixture.sent.filter(m => m.type === 'SET_MARKERS').at(-1).payload.markers[0].label), 'First');
    await page.evaluate(() => window.fixture.native.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: 'one' } }) } }));
    assert.equal(await page.evaluate(() => window.fixture.selected), 'one');
    // A retained WebView must replay the current owner, including a signed-out
    // empty scope, after a document failure. Old private geometry must not return.
    await page.evaluate(() => window.fixture.native.onLoadStart());
    const beforeScopeChange = await counts();
    await render(latest);
    await render({ markers: [], boundary: null, presentation: undefined, route: null, userLocation: null });
    assert.deepEqual(await counts(), beforeScopeChange);
    const replayStart = await page.evaluate(() => window.fixture.sent.length);
    await message('MAP_READY');
    const replay = await page.evaluate(start => window.fixture.sent.slice(start), replayStart);
    assert.deepEqual(replay.find(m => m.type === 'SET_MARKERS').payload.markers, []);
    assert.equal(replay.some(m => m.type === 'SET_BOUNDARY' || m.type === 'DRAW_ROUTE' || m.type === 'SET_USER_LOCATION'), false);
    const emptyCounts = await counts();
    for (let i = 0; i < 30; i++) await render({ markers: [], boundary: null, presentation: undefined });
    assert.deepEqual(await counts(), emptyCounts);
    await render(latest);
    assert.equal((await counts()).SET_MARKERS, emptyCounts.SET_MARKERS + 1);
    assert.equal((await counts()).SET_BOUNDARY, emptyCounts.SET_BOUNDARY + 1);
    results.scopeReplacementDuringReload = 'empty latest scope replayed; thirty equal updates send nothing; next owner sends markers and boundary once';
  }
  assert.deepEqual(issues, []);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ baseline, results, issues }, null, 2));
  console.log(JSON.stringify({ baseline, results, issues }));
} finally { await browser.close(); }
