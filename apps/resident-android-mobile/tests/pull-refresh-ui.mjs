import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const src = path.join(app, 'src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-pull-refresh-'));
fs.mkdirSync(out, { recursive: true });

// The real primitive with deferred handlers. React Native Web's RefreshControl is an inert stub, so the
// native control is a recording fixture: this proves logic and wiring, not the touch gesture.
const mocks = {
  'react-native': `import React from 'react';export function RefreshControl(props){window.control=props;window.controlRenders++;return <div data-testid="control">{props.children}</div>}`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${src}/constants/resident-theme.ts';export const useTheme=()=>({resident:getResidentTheme(window.scheme,window.accent)});`,
};
await build({
  stdin: { contents: `import React,{useMemo} from 'react';import {createRoot} from 'react-dom/client';
    import {PullRefreshControl,PullRefreshScope,usePullRefresh,useRegisterPullRefresh,PULL_REFRESH_CEILING_MS} from '${src}/components/pull-refresh.tsx';
    import {getResidentTheme} from '${src}/constants/resident-theme.ts';
    Object.assign(window,{getTheme:getResidentTheme,CEILING:PULL_REFRESH_CEILING_MS,scheme:'light',accent:'#0f6e5b',scoped:true,childTag:null,
      registerCalls:0,ownerRenders:0,controlRenders:0,calls:[],deferred:{},mode:{owner:'defer',child:'defer'},refreshingNow:null,onRefreshes:new Set()});
    window.defer=name=>new Promise((resolve,reject)=>{(window.deferred[name]??=[]).push({resolve,reject})});
    const run=name=>{window.calls.push(name);const mode=window.mode[name.split(':')[0]];if(mode==='void')return;if(mode==='throw')throw new Error(name);if(mode==='reject')return Promise.reject(new Error(name));return window.defer(name)};
    function Child({tag}){useRegisterPullRefresh(()=>run('child:'+tag));return null}
    function Owner(){
      window.ownerRenders++;
      const pull=usePullRefresh([()=>run('owner')]);
      window.onRefreshes.add(pull.onRefresh);
      window.refreshingNow=pull.refreshing;
      const register=useMemo(()=>handler=>{window.registerCalls++;return pull.register(handler)},[pull.register]);
      const body=<>{React.cloneElement(<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh}/>,{style:{flex:1}},<i data-testid="inner"/>)}{window.childTag?<Child tag={window.childTag}/>:null}</>;
      return window.scoped?<PullRefreshScope register={register}>{body}</PullRefreshScope>:body;
    }
    const root=createRoot(document.getElementById('root'));
    window.render=patch=>{Object.assign(window,patch);root.render(<Owner/>)};window.unmount=()=>root.unmount();window.render();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const errors = [];
const passed = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1_000); // only runFor moves time, so ceiling boundaries are exact
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  // Count live ceiling timers so a leaked or uncleared timer is visible.
  await page.evaluate(() => {
    window.timers = new Set();
    const set = window.setTimeout, clear = window.clearTimeout;
    window.setTimeout = (fn, ms, ...rest) => {
      const id = set(() => { window.timers.delete(id); fn(...rest); }, ms);
      if (ms === window.CEILING) window.timers.add(id);
      return id;
    };
    window.clearTimeout = id => { window.timers.delete(id); clear(id); };
  });
  const flush = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => { const c = new MessageChannel(); c.port1.onmessage = () => resolve(); c.port2.postMessage(0); }); });
  const render = async patch => { await page.evaluate(p => window.render(p), patch); await flush(); };
  const reset = async mode => { await page.evaluate(m => { window.calls.length = 0; window.deferred = {}; window.mode = m; }, mode ?? { owner: 'defer', child: 'defer' }); };
  const pull = async () => { await page.evaluate(() => window.control.onRefresh()); await flush(); };
  const settle = async (name, index, how = 'resolve') => { await page.evaluate(([n, i, h]) => window.deferred[n][i][h](h === 'reject' ? new Error(n) : undefined), [name, index, how]); await flush(); };
  const state = () => page.evaluate(() => ({ refreshing: window.refreshingNow, control: window.control.refreshing, calls: [...window.calls], timers: window.timers.size }));
  const advance = async ms => { await page.clock.runFor(ms); await flush(); };

  await render({ childTag: 'a' });
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: [], timers: 0 });

  // 1. Single flight
  await reset();
  await pull(); await pull(); await pull();
  assert.deepEqual(await state(), { refreshing: true, control: true, calls: ['owner', 'child:a'], timers: 1 });
  await settle('owner', 0);
  assert.equal((await state()).refreshing, true);
  await settle('child:a', 0);
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a'], timers: 0 });
  await pull();
  assert.deepEqual((await state()).calls, ['owner', 'child:a', 'owner', 'child:a']);
  await settle('owner', 1); await settle('child:a', 1);
  assert.equal((await state()).refreshing, false);
  passed.push('Overlapping pulls run once; the spinner holds until every handler settles, then the next pull runs again');

  // 2. Failures never block the rest or reach the gesture
  await reset({ owner: 'throw', child: 'defer' });
  await pull();
  assert.deepEqual(await state(), { refreshing: true, control: true, calls: ['owner', 'child:a'], timers: 1 });
  await settle('child:a', 0);
  assert.equal((await state()).refreshing, false);
  await reset({ owner: 'reject', child: 'defer' });
  await pull();
  assert.equal((await state()).refreshing, true);
  await settle('child:a', 0, 'reject');
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a'], timers: 0 });
  await reset({ owner: 'void', child: 'void' });
  await pull();
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a'], timers: 0 });
  passed.push('A throwing, rejecting or non-promise handler counts as done without blocking siblings or raising an unhandled rejection');

  // 3. Ceiling and timer hygiene
  await reset();
  await pull();
  await advance(19_999);
  assert.deepEqual(await state(), { refreshing: true, control: true, calls: ['owner', 'child:a'], timers: 1 });
  await advance(1);
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a'], timers: 0 });
  await pull();
  assert.equal((await state()).refreshing, true);
  await settle('owner', 0); await settle('child:a', 0);
  assert.equal((await state()).refreshing, true, 'late settlement of an abandoned flight must not end the new one');
  await settle('owner', 1); await settle('child:a', 1);
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a', 'owner', 'child:a'], timers: 0 });
  await reset();
  await pull();
  await advance(1_000);
  await settle('owner', 0); await settle('child:a', 0);
  assert.equal((await state()).timers, 0);
  await pull();
  await advance(19_500);
  assert.equal((await state()).refreshing, true, 'the first flight timer must not end the second');
  await advance(500);
  assert.deepEqual(await state(), { refreshing: false, control: false, calls: ['owner', 'child:a', 'owner', 'child:a'], timers: 0 });
  passed.push('A stuck handler ends the spinner at the 20 s ceiling; settled flights clear their timer and a stale flight cannot end a newer one');

  // 4. Registration follows the mounted child and keeps the latest handler
  await reset({ owner: 'void', child: 'void' });
  const before = await page.evaluate(() => window.registerCalls);
  await render({ childTag: 'b' });
  assert.equal(await page.evaluate(() => window.registerCalls), before);
  await pull();
  assert.deepEqual((await state()).calls, ['owner', 'child:b']);
  await reset({ owner: 'void', child: 'void' });
  await render({ childTag: null });
  await pull();
  assert.deepEqual((await state()).calls, ['owner']);
  await reset({ owner: 'void', child: 'void' });
  await render({ childTag: 'c' });
  assert.equal(await page.evaluate(() => window.registerCalls), before + 1);
  await pull();
  assert.deepEqual((await state()).calls, ['owner', 'child:c']);
  passed.push('A child registers once per mount, runs its latest handler, and stops refreshing after it unmounts');

  // 5. Loop guard: new handler arrays and idle time cause no registration, refresh or extra commits
  await reset();
  await page.evaluate(() => { window.onRefreshes.clear(); window.ownerRenders = 0; window.controlRenders = 0; window.registerCalls = 0; });
  for (let i = 0; i < 25; i++) await render({});
  await page.clock.runFor(60_000);
  await flush();
  assert.deepEqual(await page.evaluate(() => ({ owner: window.ownerRenders, control: window.controlRenders, register: window.registerCalls, identities: window.onRefreshes.size, calls: window.calls.length })),
    { owner: 25, control: 25, register: 0, identities: 1, calls: 0 });
  passed.push('A new handler array every render never re-registers, refreshes or adds commits; onRefresh identity is stable and idle time stays quiet');

  // 6. Without a scope the child hook is inert
  await reset({ owner: 'void', child: 'void' });
  await render({ scoped: false, childTag: 'z' });
  await pull();
  assert.deepEqual((await state()).calls, ['owner']);
  await render({ scoped: true, childTag: null });
  passed.push('useRegisterPullRefresh outside a PullRefreshScope does nothing');

  // 7. Theme tokens and prop forwarding
  for (const scheme of ['light', 'dark']) for (const accent of ['#0f6e5b', '#7a3cff']) {
    await render({ scheme, accent });
    const seen = await page.evaluate(() => ({ colors: window.control.colors, background: window.control.progressBackgroundColor, style: window.control.style,
      inner: !!document.querySelector('[data-testid=inner]'), expected: (t => ({ accent: t.accentText, card: t.card }))(window.getTheme(window.scheme, window.accent)) }));
    assert.deepEqual(seen.colors, [seen.expected.accent]);
    assert.equal(seen.background, seen.expected.card);
    assert.deepEqual(seen.style, { flex: 1 });
    assert.equal(seen.inner, true);
  }
  const cards = {};
  for (const scheme of ['light', 'dark']) { await render({ scheme }); cards[scheme] = await page.evaluate(() => window.control.progressBackgroundColor); }
  assert.notEqual(cards.light, cards.dark);
  passed.push('Spinner and circle follow the active theme and accent; ScrollView-injected style and children reach the control');

  // 8. Unmount mid-flight leaves no timer and no late update
  await reset();
  await render({ scheme: 'light', childTag: 'a' });
  await pull();
  assert.equal((await state()).timers, 1);
  await page.evaluate(() => window.unmount());
  await flush();
  assert.equal(await page.evaluate(() => window.timers.size), 0);
  await page.evaluate(() => { window.deferred.owner[0].resolve(); window.deferred['child:a'][0].reject(new Error('late')); });
  await page.clock.runFor(60_000);
  await flush();
  assert.equal(await page.evaluate(() => window.timers.size), 0);
  passed.push('Unmounting during a pull clears the ceiling timer; late settlement is harmless');

  assert.deepEqual(errors, []);
  const result = { passed, errors, ceilingMs: await page.evaluate(() => window.CEILING), scope: 'Real primitive with deferred handlers and a recording native control; no gesture or device claim' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
