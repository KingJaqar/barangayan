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
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-hidden-work-'));
fs.mkdirSync(out, { recursive: true });
// Actual card, foreground/clock stores, route hooks and clearance provider. Only
// navigation/native events, transport and the solver boundary are controlled here.
const mocks = {
  'expo-router': `import React,{createContext,useContext} from 'react';export const Focus=createContext(false),Path=createContext('/home');export const useIsFocused=()=>useContext(Focus);export const usePathname=()=>useContext(Path);`,
  'react-native': `export * from 'react-native-web';export const AppState={get currentState(){return window.fx.appState},addEventListener:(_,fn)=>{window.fx.appListeners.add(fn);return{remove:()=>window.fx.appListeners.delete(fn)}}};export const Keyboard={isVisible:()=>window.fx.keyboard,addListener:(name,fn)=>{window.fx.keyboardListeners[name]=fn;return{remove:()=>delete window.fx.keyboardListeners[name]}}};`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:24,bottom:24,left:0,right:0});`,
  'react-native-reanimated': `import {useRef} from 'react';export {Easing} from 'react-native-web';export const useSharedValue=v=>useRef({value:v}).current;export const withTiming=v=>v;export const cancelAnimation=()=>{};`,
  '@expo/vector-icons': `export const Ionicons=()=>null;`,
  '@barangayan/shared': `export * from '${shared}/lib/agency-sla.ts';`,
  '@/components/themed-text': `export {Text as ThemedText} from 'react-native-web';`,
  '@/components/services/tracking-reveal': `export const TrackingReveal=({children})=>children;`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${src}/constants/resident-theme.ts';export const useTheme=()=>({resident:getResidentTheme(window.fx.mode,window.fx.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fx.userId?{user:{id:window.fx.userId}}:null});`,
  '@/lib/supabase': `export const supabase={rpc:(name,args)=>({abortSignal:signal=>{const f=window.fx;const call={id:args.p_request_id,user:f.userId,signal};f.slaCalls.push(call);const data={request:{...f.request},pauses:[],evaluated_at:f.at};const reply=()=>({data:f.malformed?{}:data,error:f.failure?{}:null});return f.hold?new Promise(resolve=>f.slaPending.push({call,resolve:()=>resolve(reply())})):Promise.resolve(reply())}})};`,
  '@/lib/offline-routing': `export const avoidedEdgeIds=rows=>rows.map(r=>r.id);export const localRoutingInputs=(graph,snapshot)=>{window.fx.compilations++;return snapshot===null?{ok:false,problem:'no_conditions'}:{ok:true,conditions:snapshot,centers:[]}};`,
  '@barangayan/shared/src/lib/evacuation-routing': `export const ROUTING_PROFILES={'ampid-fine':{}};export const planEvacuationRouteAsync=(input,options)=>new Promise((resolve,reject)=>window.fx.localJobs.push({input,options,resolve:()=>resolve(window.routeResult(input.request.origin.revision)),reject}));`,
  '@barangayan/shared/src/lib/connected-route-client': `export const CONNECTED_ROUTE_DEADLINE_MS=10000;export const requestConnectedRoute=call=>new Promise(resolve=>window.fx.connectedCalls.push({call,resolve:outcome=>resolve(outcome??{kind:'route',result:window.routeResult(call.request.origin.revision),service:{}})}));`,
};
await build({
  stdin: { contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {Focus,Path} from 'expo-router';import {AgencySlaStatus} from '${src}/components/services/agency-sla-status.tsx';
    import {useResidentRoute} from '${src}/hooks/use-resident-route.ts';import {useAppForeground} from '${src}/hooks/use-app-foreground.ts';
    import {FloatingTabLayoutProvider,useFloatingTabLayout} from '${src}/hooks/use-floating-tab-layout.tsx';import {useFloatingTabInset} from '${src}/hooks/use-floating-tab-inset.ts';
    window.routeResult=revision=>({status:'outside_coverage',provenance:{originRevision:revision},warnings:[]});
    function Routes(){const foreground=useAppForeground();window.fx.routeState=useResidentRoute({...window.fx.routeOptions,active:window.fx.routeActive&&foreground});return <div data-testid="route">{JSON.stringify(window.fx.routeState)}</div>}
    function Clearance({ignore=false}){const inset=useFloatingTabInset(ignore);window.fx.commits[ignore?'visibleBar':'normal']++;return <div data-testid={ignore?'visibleBar':'normal'}>{inset}</div>}
    function LayoutControls(){window.fx.layout=useFloatingTabLayout();return null}
    const stableClearance=<><Clearance/><Clearance ignore/><LayoutControls/></>;
    function App(){const [n,render]=useState(0);window.render=()=>render(v=>v+1);const f=window.fx;
      return <><Focus.Provider value={f.section==='compact'}><div data-testid="compact">{Array.from({length:f.count},(_,i)=><AgencySlaStatus key={i} requestId={'request-'+i} compact active={f.cardsActive!==false}/>)}</div></Focus.Provider>
      <Focus.Provider value={f.section==='full'}><div data-testid="full"><AgencySlaStatus requestId={f.fullId}/></div></Focus.Provider>
      <Routes/><Path.Provider value={f.path}><FloatingTabLayoutProvider>{stableClearance}</FloatingTabLayoutProvider></Path.Provider></>}
    const root=createRoot(document.getElementById('root'));window.unmount=()=>root.unmount();root.render(<App/>);`, resolveDir: app, loader: 'tsx' },
  bundle: true, format: 'iife', outfile: path.join(out, 'bundle.js'), jsx: 'automatic',
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_OS': '"web"', 'process.env.EXPO_PUBLIC_SUPABASE_URL': '"https://fixture.invalid"', 'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': '"fixture"' },
  plugins: [{ name: 'ownership-fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage();
const errors = [], passed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
try {
  const clockStart = new Date('2026-10-23T00:15:00Z');
  await page.clock.install({time: clockStart});
  await page.clock.pauseAt(clockStart);
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    window.fx = { section: 'compact', count: 6, fullId: 'request-0', userId: 'account-a', mode: 'light', accent: '#0F6E5B', appState: 'active',
      appListeners: new Set(), keyboardListeners: {}, keyboard: false, path: '/home', commits: { normal: 0, visibleBar: 0 },
      slaCalls: [], slaPending: [], hold: false, failure: false, malformed: false, at: '2026-10-23T00:15:00Z',
      request: { timing_model: 'agency_minutes_v1', sla_state: 'running', target_minutes_snapshot: 30, created_at: '2026-10-23T00:00:00Z', accepted_at: '2026-10-23T00:00:00Z', ready_at: null, released_at: null, cancelled_at: null },
      routeActive: false, compilations: 0, localJobs: [], connectedCalls: [],
      routeOptions: { pack: { graph: { version: 'graph-a' } }, conditions: { snapshot: { revision: 1 } }, avoidance: [], origin: { lat: 14.68, lng: 121.11, accuracyMeters: 5, revision: 1 }, centerId: 'center-a', originEdgeId: null, internetUnreachable: false },
      intervals: new Map(),
    };
    const start = window.setInterval, stop = window.clearInterval;
    window.setInterval = (fn, ms, ...args) => { const id = start(fn, ms, ...args); window.fx.intervals.set(id, ms); return id; };
    window.clearInterval = id => { window.fx.intervals.delete(id); return stop(id); };
    window.appState = state => { window.fx.appState = state; window.fx.appListeners.forEach(fn => fn(state)); };
  });
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const patch = async values => { await page.evaluate(values => { Object.assign(window.fx, values); window.render(); }, values); await page.waitForFunction(() => !!window.fx.routeState); };
  const counts = () => page.evaluate(() => ({ calls: window.fx.slaCalls.length, intervals: [...window.fx.intervals.values()], listeners: window.fx.appListeners.size }));
  await page.waitForFunction(() => document.querySelector('[data-testid="compact"]')?.textContent.includes('Est.'));
  assert.deepEqual(await counts(), { calls: 6, intervals: [15000,15000,15000,15000,15000,15000,1000], listeners: 1 });
  assert.equal(await page.evaluate(() => window.fx.compilations), 0);
  await patch({ section: 'home' });
  await page.waitForFunction(() => window.fx.intervals.size === 0);
  const hidden = await counts();
  await page.clock.runFor(32000);
  assert.deepEqual(await counts(), hidden);
  passed.push('six compact + retained full: one visible tick, zero hidden intervals/RPCs for two polling periods');

  await patch({ userId: 'account-b' });
  await page.waitForFunction(() => !document.querySelector('[data-testid="compact"]').textContent.includes('On Track'));
  assert.equal((await counts()).calls, 6);
  await patch({ section: 'full' });
  await page.waitForFunction(() => document.querySelector('[data-testid="full"]').textContent.includes('On Track'));
  assert.equal((await counts()).calls, 7);
  assert.deepEqual((await counts()).intervals, [15000,1000]);
  passed.push('account scope clears retained clocks; full tracking resumes one owner without compact duplicate requests');

  await patch({ hold: true });
  await page.clock.runFor(15000);
  await page.waitForFunction(() => window.fx.slaPending.length === 1);
  await page.evaluate(() => window.appState('background'));
  await page.waitForFunction(() => window.fx.intervals.size === 0);
  assert.equal(await page.evaluate(() => window.fx.slaPending[0].call.signal.aborted), true);
  const background = await counts();
  await page.clock.runFor(32000);
  assert.deepEqual(await counts(), background);
  await page.evaluate(() => { window.fx.at = '2026-10-23T00:19:00Z'; window.appState('active'); });
  await page.waitForFunction(() => window.fx.slaPending.length === 2);
  await page.evaluate(() => window.fx.slaPending[1].resolve());
  await page.waitForFunction(() => document.querySelector('[data-testid="full"]').textContent.includes('19 min'));
  await page.evaluate(() => window.fx.slaPending[0].resolve());
  assert.ok((await page.getByTestId('full').textContent()).includes('19 min'));
  passed.push('background aborts transport and clears clocks/polls; return catches up once; late pre-background response ignored');

  await patch({ fullId: 'request-new' });
  await page.waitForFunction(() => document.querySelector('[data-testid="full"]').textContent.includes('Loading processing clock'));
  await page.evaluate(() => window.fx.slaPending.at(-1).resolve());
  await page.waitForFunction(() => document.querySelector('[data-testid="full"]').textContent.includes('On Track'));
  await patch({ hold: false, malformed: true, fullId: 'request-malformed' });
  await page.getByRole('alert').waitFor();
  await patch({ malformed: false });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="full"]').textContent.includes('On Track'));
  passed.push('request replacement clears previous clock; malformed reply shows retry and recovers');

  await patch({ section: 'home', routeActive: true });
  await page.clock.runFor(1);
  await page.waitForFunction(() => window.fx.localJobs.length === 1 && window.fx.connectedCalls.length === 1);
  await page.evaluate(() => { const f=window.fx; f.routeOptions={...f.routeOptions,origin:{...f.routeOptions.origin,revision:2},centerId:'center-b'};window.render(); });
  await page.clock.runFor(1);
  await page.waitForFunction(() => window.fx.localJobs.length === 2);
  assert.equal(await page.evaluate(() => window.fx.localJobs[0].options.cancel.aborted && window.fx.connectedCalls[0].call.signal.aborted), true);
  await page.evaluate(() => { window.fx.localJobs[0].resolve(); window.fx.connectedCalls[0].resolve(); });
  assert.equal(await page.evaluate(() => window.fx.routeState.route.status), 'computing');
  await patch({ routeActive: false });
  await page.waitForFunction(() => window.fx.localJobs[1].options.cancel.aborted);
  const routeHidden = await page.evaluate(() => [window.fx.compilations,window.fx.localJobs.length,window.fx.connectedCalls.length]);
  await page.evaluate(() => { const f=window.fx;f.routeOptions={...f.routeOptions,conditions:{snapshot:{revision:2}},origin:{...f.routeOptions.origin,revision:3}};window.render(); });
  await page.clock.runFor(60000);
  assert.deepEqual(await page.evaluate(() => [window.fx.compilations,window.fx.localJobs.length,window.fx.connectedCalls.length]), routeHidden);
  await patch({ routeActive: true });
  await page.clock.runFor(1);
  await page.waitForFunction(() => window.fx.localJobs.length === 3 && window.fx.connectedCalls.length === 3);
  await page.evaluate(() => {window.fx.localJobs[2].resolve();window.fx.connectedCalls[2].resolve();});
  await page.waitForFunction(() => window.fx.routeState.mode === 'connected');
  assert.equal(await page.evaluate(() => window.fx.routeState.route.result.provenance.originRevision), 3);
  await page.evaluate(() => {window.fx.localJobs[1].resolve();window.fx.connectedCalls[1].resolve();});
  assert.equal(await page.evaluate(() => window.fx.routeState.route.result.provenance.originRevision), 3);
  await page.evaluate(() => window.appState('background'));
  await page.waitForFunction(() => window.fx.connectedCalls[2].call.signal.aborted);
  const routeBackground = await page.evaluate(() => window.fx.connectedCalls.length);
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => window.fx.connectedCalls.length), routeBackground);
  await page.evaluate(() => window.appState('active'));
  await page.clock.runFor(1);
  await page.waitForFunction(previous => window.fx.connectedCalls.length === previous + 1, routeBackground);
  await page.evaluate(() => window.fx.connectedCalls.at(-1).resolve({kind:'failure',failure:{reason:'timeout'}}));
  await page.waitForFunction(() => window.fx.routeState.connectedFailure?.reason === 'timeout');
  const failedCallCount = await page.evaluate(() => window.fx.connectedCalls.length);
  await page.clock.runFor(59999);
  assert.equal(await page.evaluate(() => window.fx.connectedCalls.length), failedCallCount);
  await page.clock.runFor(1);
  await page.waitForFunction(previous => window.fx.connectedCalls.length === previous + 1, failedCallCount);
  await page.evaluate(() => {window.fx.localJobs.at(-1).reject(new Error('Synthetic solver failure'));});
  // A completed route for the same inputs may stay visible until a failed recomputation settles.
  await page.waitForFunction(() => window.fx.routeState.route.status === 'failed');
  passed.push('connected timeout uses existing bounded backoff; solver rejection becomes an explicit failure state');
  passed.push('routing blur/background cancels local and connected work; hidden input changes do no preparation; current inputs resume once and reject obsolete results');

  const before = await page.evaluate(() => ({...window.fx.commits}));
  for (const next of ['/services','/drrm','/maps','/health','/reports','/home']) await patch({path:next});
  assert.deepEqual(await page.evaluate(() => window.fx.commits), before);
  await patch({ path: '/settings/profile' });
  await page.waitForFunction(() => document.querySelector('[data-testid="normal"]').textContent === '0');
  await patch({ path: '/maps' });
  await page.waitForFunction(() => document.querySelector('[data-testid="normal"]').textContent !== '0');
  const visibleCommits = await page.evaluate(() => window.fx.commits.visibleBar);
  await page.evaluate(() => window.fx.layout.setMapNavHidden(true));
  await page.waitForFunction(() => document.querySelector('[data-testid="normal"]').textContent === '0');
  assert.equal(await page.evaluate(() => window.fx.commits.visibleBar), visibleCommits);
  passed.push('six root pathname changes produce zero clearance consumer commits; nested route and map-hide update only affected scalar consumers');
  await patch({routeActive:false,section:'home'});
  await page.waitForFunction(()=>window.fx.intervals.size===0);
  for(let i=0;i<10;i++){
    await patch({section:'compact'});
    await page.waitForFunction(()=>window.fx.intervals.size===7);
    const visibleCalls = (await counts()).calls;
    await page.clock.runFor(15000);
    await page.waitForFunction(previous => window.fx.slaCalls.length === previous + 6, visibleCalls);
    assert.deepEqual((await counts()).intervals.sort((a, b) => a - b), [1000,15000,15000,15000,15000,15000,15000]);
    await patch({section:'home'});
    await page.waitForFunction(()=>window.fx.intervals.size===0);
    const quiet = await counts();
    await page.clock.runFor(45000);
    assert.deepEqual(await counts(), quiet);
  }
  assert.equal(await page.evaluate(()=>window.fx.appListeners.size),1);
  passed.push('ten-minute virtual lifecycle: each visible poll refreshes six distinct requests once, every hidden 45-second window stays idle, no timer/listener growth (not native heap/timing evidence)');
  await page.evaluate(()=>{window.fx.request={...window.fx.request,sla_state:'cancelled',cancelled_at:window.fx.at};window.fx.fullId='cancelled-request';window.fx.section='full';window.render()});
  await page.waitForFunction(()=>document.querySelector('[data-testid="full"]').textContent.includes('Cancelled'));
  assert.deepEqual((await counts()).intervals,[15000]);
  passed.push('ten hide/show loops retain one foreground listener and zero hidden timers; cancelled clock has no visible tick');
  await patch({section:'compact',cardsActive:false,hold:false,malformed:false});
  await page.waitForFunction(()=>window.fx.intervals.size===0);
  const collapsedCalls=(await counts()).calls;
  await page.clock.runFor(32000);
  assert.equal((await counts()).calls,collapsedCalls,'Retained collapsed cards must not poll');
  await patch({cardsActive:true});
  await page.waitForFunction(previous=>window.fx.slaCalls.length===previous+6,collapsedCalls);
  await patch({cardsActive:false});
  await page.waitForFunction(()=>window.fx.intervals.size===0);
  passed.push('retained collapsed request sections pause all six clocks/polls; reopening refreshes once per card');
  await page.evaluate(() => window.unmount());
  assert.deepEqual(await counts(), { calls: (await counts()).calls, intervals: [], listeners: 0 });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed,errors,nativePerformanceVerified:false},null,2));
  console.log(JSON.stringify({passed,errors,nativePerformanceVerified:false}));
} catch (error) {
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,errors,body:await page.locator('body').innerText()},null,2));
  throw error;
} finally { await browser.close(); }
