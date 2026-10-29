import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { verifyRequestTrackingNavigation } from './request-tracking-navigation.mjs';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-home-'));
fs.mkdirSync(out, { recursive: true });
const workspaceOnly = process.env.RESIDENT_HOME_TEST_VFS === '1';

// Optional workspace-only reads avoid the native bundler's Windows ancestor-directory
// enumeration. Package resolution still uses the installed versions; no permission is broadened.
function resolveFixtureSource(args) {
  let file;
  if (args.path.startsWith('@/')) file = path.join(app, 'src', args.path.slice(2));
  else if (path.isAbsolute(args.path)) file = args.path;
  else if (args.path.startsWith('.')) file = path.resolve(path.dirname(args.importer), args.path);
  else {
    const owner = path.isAbsolute(args.importer) ? args.importer : path.join(app, 'package.json');
    file = (args.path === 'react' || args.path.startsWith('react/') || args.path.startsWith('react-dom'))
      ? require.resolve(args.path) : createRequire(owner).resolve(args.path);
  }
  const candidates = [file, ...['.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'].map(extension => file + extension)];
  const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) throw new Error(`Fixture source not found: ${args.path}`);
  const resolved = fs.realpathSync(found);
  if (!resolved.toLowerCase().startsWith(path.resolve(app, '../..').toLowerCase() + path.sep)) throw new Error(`Fixture source outside workspace: ${resolved}`);
  return { path: resolved, namespace: 'workspace-source' };
}

// Render the actual Home, summary, controls, text, theme and status logic. Only platform,
// preferences, navigation and network are synthetic adapters; this is not native qualification.
const mocks = {
  'react-native': `import React from 'react';import {Animated as WebAnimated,View as WebView,Pressable as WebPressable,Image as WebImage} from 'react-native-web';export * from 'react-native-web';
    export const Image=React.forwardRef(({source,contentFit,...props},ref)=><WebImage {...props} ref={ref} source={typeof source==='string'?{uri:source}:source} resizeMode={contentFit??props.resizeMode}/>);
    export const Animated={...WebAnimated,View:React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><WebAnimated.View {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>),timing:(value,options)=>{window.fixture.motions.push({to:options.toValue,duration:options.duration});return WebAnimated.timing(value,{...options,useNativeDriver:false});}};
    export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><WebView {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>);
    export const Pressable=React.forwardRef(({accessibilityState,...props},ref)=><WebPressable {...props} ref={ref} aria-busy={accessibilityState?.busy}/>);
    export const AppState={addEventListener:(event,callback)=>{window.fixture.listeners.add(callback);return {remove:()=>window.fixture.listeners.delete(callback)}}};
    export const AccessibilityInfo={sendAccessibilityEvent:(target,event)=>window.fixture.focusEvents.push(event)};
    export const RefreshControl=({children,style,...props})=>{const ref=React.useRef(props);ref.current=props;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};`,
  '@react-native-community/netinfo': `export const addEventListener=callback=>{(window.fixture.networkListeners??=new Set()).add(callback);callback({isConnected:true,isInternetReachable:true});return ()=>window.fixture.networkListeners.delete(callback)};`,
  '@barangayan/shared': `export {ANNOUNCEMENT_CATEGORY_META} from '${shared}/constants/announcement-categories.ts';export * from '${shared}/lib/request-status.ts';export {homeRequestAttention} from '${shared}/lib/home-request-priority.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const useRouter=()=>({push:href=>window.fixture.routes.push(href)});export const useFocusEffect=fn=>useEffect(()=>window.fixture.focused?fn():undefined,[fn,window.fixture.focused]);export const Link=({href,children})=>React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:window.fixture.needsCompletion});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,refetch:()=>{window.fixture.profileRefetches+=1;return Promise.resolve()}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reducedMotion;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  '@/lib/supabase': `import {homeRequestAttention} from '${shared}/lib/home-request-priority.ts';
    function response(table,query,data){const f=window.fixture;return {abortSignal(signal){query.signal=signal;return this},retry(enabled){query.retry=enabled;return this},then(done,fail){f.queries.push({...query,signal:undefined});const error=f.fail[table]?{}:null;return new Promise((resolve,reject)=>{const settle=()=>f.reject[table]?reject(Error('Synthetic transport error')):resolve({data:error?null:data,error,count:query.totalCount??data.length});if(f.hold)f.waiting.push(settle);else settle();}).then(done,fail)}}}
    export const supabase={rpc(name,args){const f=window.fixture;const priority=r=>r.next_action?0:['submitted','in_progress','ready_for_pickup'].includes(r.status)?1:r.status==='completed'?2:r.status==='cancelled'?3:4;const data=structuredClone(f.requests.filter(item=>item.resident_id===f.session?.user.id)).map(item=>({...item,next_action:homeRequestAttention(item,args.p_qrph_settlement_ready)})).sort((a,b)=>priority(a)-priority(b)||(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||b.id.localeCompare(a.id)).slice(0,3);return response('service_requests',{table:'service_requests',rpc:name,args},data)},from(table){const filters=[];const q={table,select(columns){q.columns=columns;return q},is(key,value){filters.push([key,'is',value]);return q},lte(key,value){filters.push([key,'lte',value]);return q},gt(key,value){filters.push([key,'gt',value]);return q},eq(key,value){filters.push([key,'eq',value]);q.filter=[key,value];return q},range(from,to){q.rangeBounds=[from,to];return q},abortSignal(signal){q.signal=signal;return q},retry(value){q.retry=value;return q},order(column,options){q.orders=[...(q.orders??[]),[column,options]];return q},limit(count){q.limit=count;return q},then(done,fail){let rows=structuredClone(window.fixture.announcements).filter(item=>filters.every(([key,op,value])=>op==='is'?item[key]==null:op==='eq'?item[key]===value:op==='lte'?Date.parse(item[key])<=Date.parse(value):Date.parse(item[key])>Date.parse(value)));rows.sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)||b.id.localeCompare(a.id));q.totalCount=rows.length;rows=q.rangeBounds?rows.slice(q.rangeBounds[0],q.rangeBounds[1]+1):rows.slice(0,q.limit);return response(q.filter?'alerts':table,q,rows).then(done,fail)}};return q}};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const cancelAnimation=()=>{};export const Easing={bezier:()=>undefined};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Home from '${root}/app/(app)/home/index.tsx';
    const requests=['submitted','in_progress','ready_for_pickup'].map((status,index)=>({id:'request-'+index,resident_id:'synthetic-resident',reference_number:'SYNTHETIC-'+index,status,payment_status:index===0?'unpaid':'paid',created_at:'2026-10-18T01:00:00Z',status_history:index===1?[{status:'in_progress',at:'2026-10-19T02:00:00Z'}]:null,document_name:'Service '+index,service_kind:'general',updated_at:'2026-10-'+(22-index)+'T01:00:00Z',cancelled_at:null,payment_method:'pickup',contract_version:2,fee_assessment_state:'assessed',assessed_amount_centavos:10000,legacy_fee_centavos:null,sla_state:'running',resolved_fee_centavos:10000,next_action:null}));
    window.fixture={session:{user:{id:'synthetic-resident'}},profile:{id:'synthetic-resident',barangay_id:'synthetic-barangay',full_name:'Test Resident',avatar_url:null,barangays:{name:'Synthetic barangay'}},needsCompletion:false,requests,announcements:[{id:'news',title:'Synthetic community advisory with a long title for full text coverage',category:'general',published_at:'2026-10-18T02:00:00Z'}],mode:'light',accent:'#0F6E5B',fontId:'system',reducedMotion:true,focused:true,listeners:new Set(),motions:[],focusEvents:[],queries:[],routes:[],profileRefetches:0,fail:{},reject:{},hold:false,waiting:[]};
    const root=createRoot(document.getElementById('root'));let generation=0;window.renderHome=()=>root.render(<Home key={generation}/>);window.resetHome=()=>{generation++;window.renderHome();};window.unmountHome=()=>root.render(null);window.renderHome();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_PUBLIC_QRPH_SETTLEMENT_READY': '"false"' },
  ...(workspaceOnly ? { tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } } } : {}),
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : workspaceOnly ? resolveFixtureSource(args) : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
    if (workspaceOnly) b.onLoad({ filter: /.*/, namespace: 'workspace-source' }, args => {
      const extension = path.extname(args.path);
      const loader = extension === '.tsx' ? 'tsx' : extension === '.ts' ? 'ts' : extension === '.json' ? 'json' : extension === '.css' ? 'empty' : /\.(png|jpe?g|webp)$/.test(extension) ? 'dataurl' : 'jsx';
      return { contents: loader === 'empty' ? '' : fs.readFileSync(args.path), loader, resolveDir: path.dirname(args.path) };
    });
  } }],
});

const options = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.channel = 'chrome';
const browser = await chromium.launch(options);
const passed = [];
const errors = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const cards = () => page.getByRole('button', { name: /reference SYNTHETIC-/, includeHidden: true });
  const right = () => page.getByRole('button', { name: 'Scroll requests right', exact: true });
  const left = () => page.getByRole('button', { name: 'Scroll requests left', exact: true });
  const close = () => page.getByRole('button', { name: 'Close request summary', exact: true });
  await cards().first().waitFor();
  assert.equal(await cards().count(), 3);
  assert.deepEqual(await page.evaluate(() => window.fixture.queries.map(q => [q.table,typeof q.limit === 'number' ? q.limit : undefined,q.filter,q.columns])), [
    ['announcements',1,undefined,'*'],['announcements',undefined,['category','emergency'],'*'],['service_requests',undefined,undefined,undefined],
  ]);
  await right().waitFor();
  assert.equal(await left().isDisabled(), true);
  await right().click();
  await left().waitFor();
  await right().click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Scroll requests right"]')?.getAttribute('aria-disabled')==='true');
  await left().click();
  await right().waitFor();
  assert.equal(await page.getByRole('button', { name: /Scroll announcements/ }).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.fixture.queries.filter(q=>q.rpc).map(q=>[q.rpc,q.args,q.retry])), [['resident_home_requests',{p_qrph_settlement_ready:false},false]]);
  await page.getByText('2 of 3',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/reference SYNTHETIC-/}).count(),1,'Only the visible request is accessible');
  const control=await right().boundingBox();const card=await cards().nth(1).boundingBox();
  assert.ok(control && card && control.y>=card.y+card.height && control.width>=48 && control.height>=48);
  passed.push('Owner RPC/no resident argument/no retries; below-card controls, disabled edges and visible-only accessibility');

  const pulling = () => page.evaluate(() => [...window.pullControls][0].current.refreshing);
  const pullHome = async () => { await page.evaluate(() => [...window.pullControls][0].current.onRefresh()); await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing); };
  await pullHome();
  await page.getByText('2 of 3',{exact:true}).waitFor();
  await page.evaluate(() => { window.fixture.savedRequests=structuredClone(window.fixture.requests); window.fixture.requests[1].updated_at='2030-01-01T00:00:00Z'; });
  await pullHome();
  await page.getByText('1 of 3',{exact:true}).waitFor();
  await page.setViewportSize({width:412,height:640});
  await page.getByText('1 of 3',{exact:true}).waitFor();
  await page.getByRole('button',{name:/reference SYNTHETIC-2/}).waitFor();
  await right().click();
  await page.getByText('2 of 3',{exact:true}).waitFor();
  await right().click();
  await page.getByText('3 of 3',{exact:true}).waitFor();
  await page.getByRole('button',{name:/reference SYNTHETIC-0/}).waitFor();
  await page.evaluate(() => {window.fixture.requests=window.fixture.requests.filter(item=>item.id!=='request-0');});
  await pullHome();
  await page.getByText('1 of 2',{exact:true}).waitFor();
  await right().click();
  await page.getByText('2 of 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:/reference SYNTHETIC-1/}).click();
  await close().waitFor();
  await page.evaluate(() => {window.fixture.requests.find(item=>item.id==='request-1').document_name='Updated while open';});
  await pullHome();
  await page.getByRole('dialog').getByText('Updated while open',{exact:true}).waitFor();
  const routesBeforeRemoval=await page.evaluate(()=>window.fixture.routes.length);
  await page.evaluate(() => {window.fixture.requests=window.fixture.requests.filter(item=>item.id!=='request-1');});
  await pullHome();
  await close().waitFor({state:'detached'});
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')==='View all requests');
  assert.equal(await page.evaluate(()=>window.fixture.routes.length),routesBeforeRemoval,'Removing the selected request closes without navigating stale data');
  await page.evaluate(() => {window.fixture.requests=window.fixture.savedRequests;});
  await pullHome();
  await page.setViewportSize({width:360,height:640});
  passed.push('Unchanged refresh retains position; reorder/resize/removal restart with a matching full first card; open summaries update and removed selections close without navigation');
  assert.equal(await page.evaluate(() => window.pullControls.size), 1, 'Home mounts one pull scroller');
  await page.evaluate(() => { window.fixture.queries = []; window.fixture.profileRefetches = 0; });
  await pullHome();
  assert.deepEqual(await page.evaluate(() => window.fixture.queries.map(q => [q.table,typeof q.limit === 'number' ? q.limit : undefined,q.filter,q.columns])), [
    ['announcements',1,undefined,'*'],['announcements',undefined,['category','emergency'],'*'],['service_requests',undefined,undefined,undefined],
  ]);
  assert.equal(await page.evaluate(() => window.fixture.profileRefetches), 1);
  assert.equal(await cards().count(), 3);
  await page.evaluate(() => { window.fixture.requests[0].document_name = 'Pulled service'; window.fixture.announcements[0].title = 'Pulled advisory'; });
  await pullHome();
  await page.getByText('Pulled service', { exact: true }).waitFor();
  await page.getByText('Pulled advisory', { exact: true }).waitFor();
  assert.equal(await cards().count(), 3);
  await page.evaluate(() => { window.fixture.fail = { service_requests: true, announcements: true }; });
  await pullHome();
  await page.evaluate(() => { window.fixture.fail = {}; window.fixture.reject = { service_requests: true, announcements: true }; });
  await pullHome();
  await page.evaluate(() => { window.fixture.reject = {}; });
  assert.equal(await cards().count(), 3);
  assert.equal(await page.getByText('Pulled service', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Your requests could not be loaded. Please try again.',{exact:true}).count(), 1, 'failed request pull retains cards and exposes retry');
  await page.evaluate(() => { window.fixture.hold = true; window.fixture.queries = []; window.fixture.profileRefetches = 0; });
  await page.evaluate(() => { const control = [...window.pullControls][0].current; control.onRefresh(); control.onRefresh(); });
  await page.waitForFunction(() => window.fixture.waiting.length === 3);
  assert.equal(await pulling(), true);
  assert.deepEqual(await page.evaluate(() => [window.fixture.queries.length, window.fixture.profileRefetches]), [3, 1], 'a second pull during a flight starts nothing');
  await page.evaluate(() => { window.fixture.session = { user: { id: 'different-resident' } }; window.renderHome(); });
  await page.evaluate(() => { window.fixture.hold = false; window.fixture.waiting.splice(0).forEach(resolve => resolve()); });
  await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  await page.getByText('No requests yet').waitFor();
  assert.equal(await page.getByText('Pulled service', { exact: true }).count(), 0, 'a pull started for the previous account never writes after a switch');
  await page.evaluate(() => { window.fixture.hold = true; });
  await page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  await page.waitForFunction(() => window.fixture.waiting.length >= 1);
  await page.evaluate(() => window.unmountHome());
  await page.evaluate(() => { window.fixture.hold = false; window.fixture.waiting.splice(0).forEach(resolve => resolve()); });
  await page.evaluate(() => {
    window.fixture.session = { user: { id: 'synthetic-resident' } }; window.fixture.requests[0].document_name = 'Service 0';
    window.fixture.announcements[0].title = 'Synthetic community advisory with a long title for full text coverage';
    window.fixture.queries = []; window.fixture.waiting = []; window.resetHome();
  });
  await cards().first().waitFor();
  await page.evaluate(() => { window.fixture.queries = []; });
  passed.push('Pulling Home reloads announcements, requests and profile together, shows new data, keeps cards through failed pulls, runs one flight, ignores a previous account and unmounted pull');

  await right().click();
  await page.getByText('2 of 3',{exact:true}).waitFor();
  await right().click();
  await page.getByText('3 of 3',{exact:true}).waitFor();
  await page.getByRole('button',{name:/reference SYNTHETIC-1/}).click();
  await close().waitFor();
  await page.getByRole('dialog').getByLabel('Processing, current stage', { exact: true }).waitFor();
  assert.equal(await page.getByText('Pending', { exact: true }).count(), 2);
  await page.screenshot({ path: path.join(out, 'summary-light.png') });
  await close().click();
  await close().waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.includes('reference SYNTHETIC-1'));
  await left().click();
  await page.getByText('2 of 3',{exact:true}).waitFor();
  await left().click();
  await page.getByText('1 of 3',{exact:true}).waitFor();
  const queries = await page.evaluate(() => window.fixture.queries.length);
  for (let cycle = 0; cycle < 5; cycle++) {
    await cards().first().click();
    await close().waitFor();
    await page.getByRole('button', { name: 'Dismiss request summary', exact: true }).click({ position: { x: 5, y: 5 } });
    await close().waitFor({ state: 'detached' });
  }
  await cards().first().click();
  await close().waitFor();
  await page.keyboard.press('Escape');
  await close().waitFor({ state: 'detached' });
  await cards().first().click();
  await page.getByRole('button', { name: 'View full request', exact: true }).click();
  await close().waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/home/requests/request-2');
  passed.push(...verifyRequestTrackingNavigation(await page.evaluate(() => window.fixture.routes.at(-1))));
  assert.equal(await page.evaluate(() => window.fixture.queries.length), queries);
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), 2);
  assert.ok(await page.evaluate(() => window.fixture.focusEvents.length > 1), 'Close returns accessibility focus to a request');
  passed.push('Loaded history, five backdrop cycles, close/Escape, focus return and one tracking navigation without queries');

  assert.equal(await page.getByText(/Good morning|Good afternoon|Good evening/).count(),0,'Home has no greeting');
  for (const [name,route] of [['Services',{pathname:'/services',params:{segment:'documents'}}],['Reports','/reports'],['Emergency','/drrm'],['Maps','/maps'],['Health','/health'],['View all requests',{pathname:'/services',params:{segment:'requests'}}],['View all announcements','/announcements']]) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.fixture.routes.at(-1)), route);
  }
  await page.getByRole('button', { name: /^Read announcement:/ }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.routes.at(-1)), {pathname:'/announcements',params:{announcementId:'news'}});
  for (const [width,mode,accent,fontId] of [[320,'dark','#ffffff','georgia'],[400,'light','#2563eb','system'],[360,'dark','#c2410c','tahoma'],[412,'light','#000000','times-new-roman']]) {
    await page.setViewportSize({width,height:640});
    await page.evaluate(values => {Object.assign(window.fixture,values);window.renderHome();}, {mode,accent,fontId});
    assert.equal(await cards().count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({path:path.join(out,`home-${width}-${mode}.png`)});
  }
  assert.equal(await page.evaluate(() => window.fixture.queries.length), queries);
  passed.push('Five quick actions, See all/news destinations and 320/360/400/412 theme/font/extreme-accent layouts without reloads');

  await page.evaluate(() => {
    window.fixture.requests=window.fixture.requests.slice(0,1);
    window.fixture.requests[0].status='cancelled';
    window.resetHome();
  });
  await cards().first().waitFor();
  assert.equal(await cards().count(),1);
  await right().waitFor({state:'detached'});
  assert.equal(await left().count(),0);
  await cards().first().click();
  await close().waitFor();
  await page.getByRole('dialog').getByText('Cancelled',{exact:true}).waitFor();
  assert.equal(await page.getByText('Not recorded',{exact:true}).count(),0);
  await page.getByRole('dialog').getByText('Cancellation date unavailable',{exact:true}).waitFor();
  await close().click();
  await close().waitFor({state:'detached'});
  // Use real web Animated at normal durations to exercise cancellation and reopen ownership.
  await page.evaluate(() => {window.fixture.reducedMotion=false;window.renderHome();});
  await cards().first().click();
  await close().waitFor();
  await page.evaluate(() => {for(const listener of window.fixture.listeners)listener('background');});
  await close().waitFor({state:'detached'});
  const focusEventsAfterBackground=await page.evaluate(() => window.fixture.focusEvents.length);
  await page.evaluate(() => {for(const listener of window.fixture.listeners)listener('active');});
  await cards().first().click();
  await close().waitFor();
  await page.evaluate(() => {window.fixture.mode='light';window.fixture.fontId='georgia';window.renderHome();});
  await close().click();
  await close().waitFor({state:'detached'});
  assert.ok(await page.evaluate(() => window.fixture.focusEvents.length) > focusEventsAfterBackground);
  const motionDurations=await page.evaluate(() => window.fixture.motions.map(item=>item.duration));
  assert.ok(motionDurations.includes(280) && motionDurations.includes(200) && motionDurations.includes(100));
  passed.push('Single-card no-overflow/cancelled history and normal/reduced sheet targets, background close and theme change while open');

  await page.setViewportSize({width:320,height:320});
  await page.evaluate(() => {window.fixture.requests[0].document_name='Long document title '.repeat(12);window.resetHome();});
  await cards().first().click();
  await close().waitFor();
  const fullAction=page.getByRole('button',{name:'View full request',exact:true});
  await page.waitForFunction(() => {
    const controls=[...document.querySelectorAll('[role="button"]')].filter(node=>node.getAttribute('aria-label')==='Close request summary'||node.textContent==='View full request');
    return controls.length===2 && controls.every(node=>{const bounds=node.getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight;});
  },null,{timeout:2000});
  await page.screenshot({path:path.join(out,'summary-short-long-title.png')});
  for(const control of [close(),fullAction]) {
    const bounds=await control.boundingBox();
    assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=320,'Summary controls stay reachable on short screens with long titles');
  }
  await fullAction.click();
  await close().waitFor({state:'detached'});
  await page.setViewportSize({width:360,height:640});
  passed.push('Short 320px viewport and long summary title retain reachable Close and full-tracking controls');

  await page.evaluate(() => { window.fixture.needsCompletion=true;window.renderHome(); });
  await page.getByText(/Complete your profile before requesting/).waitFor();
  await page.evaluate(() => {window.fixture.requests=[];window.fixture.announcements=[];window.resetHome();});
  await page.getByText('No requests yet',{exact:true}).waitFor();
  await page.getByText('No announcements yet.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Request a document',exact:true}).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.routes.at(-1)),{pathname:'/services',params:{segment:'documents'}});
  assert.equal(await right().count(), 0);
  await page.evaluate(() => {window.fixture.session=null;window.resetHome();});
  await page.getByText('Log in to see your requests.',{exact:true}).waitFor();
  assert.equal(await cards().count(), 0);
  assert.equal(await page.getByText(/Good morning|Good afternoon|Good evening/).count(),0);
  for (const login of await page.getByRole('button',{name:'Log in',exact:true}).all()) {
    await login.click();
    assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)),'/(auth)/login');
    const bounds=await login.boundingBox();
    assert.ok(bounds.width>=48 && bounds.height>=48,'Both Home sign-in controls retain 48dp targets');
  }
  passed.push('Profile-completion, authenticated empty and guest states');

  await page.evaluate(() => {window.fixture.session={user:{id:'synthetic-resident'}};window.fixture.fail={service_requests:true,announcements:true};window.resetHome();});
  await page.getByText('Your requests could not be loaded. Please try again.',{exact:true}).waitFor();
  await page.getByText('Announcements could not be loaded. Please try again.',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.fail={};});
  // The first response removes its own retry control; resolve the remaining control afresh.
  await page.getByRole('button',{name:'Try again',exact:true}).first().click();
  await page.getByRole('button',{name:'Try again',exact:true}).first().click();
  await page.getByText('No announcements yet.',{exact:true}).waitFor();
  await page.getByText('No requests yet',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.reject={service_requests:true};window.resetHome();});
  await page.getByText('Your requests could not be loaded. Please try again.',{exact:true}).waitFor();
  passed.push('Visible database/transport failures and explicit independent retry recovery');

  await page.evaluate(() => {window.fixture.reject={};window.fixture.hold=true;window.fixture.requests=[{id:'stale',resident_id:'synthetic-resident',reference_number:'STALE',status:'submitted',payment_status:'unpaid',created_at:'2026-10-18T00:00:00Z',status_history:null,document_name:'Stale private request',updated_at:'2026-10-18T00:00:00Z',resolved_fee_centavos:null}];window.resetHome();});
  await page.getByText('Loading your requests…',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.session={user:{id:'different-resident'}};window.renderHome();});
  await page.waitForFunction(() => window.fixture.waiting.length===6);
  await page.evaluate(() => {window.fixture.hold=false;window.fixture.waiting.splice(0).forEach(resolve=>resolve());});
  await page.getByText('No requests yet',{exact:true}).waitFor();
  assert.equal(await page.getByText('Stale private request',{exact:true}).count(),0);

  await page.evaluate(() => {
    window.fixture.session={user:{id:'synthetic-resident'}};
    const now=Date.now();const base={category:'emergency',body:'<p>**Stay safe** &amp; follow [instructions](https://example.com).</p>',deleted_at:null,image_url:null,alert_expires_at:new Date(now+3600000).toISOString()};
    window.fixture.announcements=[{...base,id:'active-old',title:'Older active warning',published_at:new Date(now-7200000).toISOString()},
      {...base,id:'active-new',title:'Newer active warning',published_at:new Date(now-3600000).toISOString()},
      {...base,id:'routine',category:'general',alert_expires_at:null,title:'Newest routine notice',published_at:new Date(now-1000).toISOString()},
      {...base,id:'future',title:'Scheduled hidden',published_at:new Date(now+60000).toISOString()},
      {...base,id:'deleted',title:'Deleted hidden',deleted_at:new Date(now).toISOString(),published_at:new Date(now-500).toISOString()},
      {...base,id:'legacy',title:'Unknown lifetime',alert_expires_at:null,published_at:new Date(now-8000000).toISOString()}];window.resetHome();
  });
  await page.getByRole('button',{name:/View advisory: Older active warning/}).waitFor();
  await page.getByRole('button',{name:/View advisory: Newer active warning/}).waitFor();
  assert.equal(await page.getByText('Scheduled hidden',{exact:true}).count(),0);
  assert.equal(await page.getByText('Deleted hidden',{exact:true}).count(),0);
  await page.getByText('Newest routine notice',{exact:true}).waitFor();
  await page.getByText('View details',{exact:true}).waitFor();
  await page.getByRole('button',{name:/View advisory: Older active warning/}).click();
  assert.deepEqual(await page.evaluate(()=>window.fixture.routes.at(-1)),{pathname:'/announcements',params:{announcementId:'active-old'}});
  await page.evaluate(()=>{window.fixture.fail={alerts:true};window.fixture.announcements.find(item=>item.id==='routine').title='Successful news during alert failure';});
  await pullHome();
  await page.getByText('Successful news during alert failure',{exact:true}).waitFor();
  await page.getByText('Advisories could not be checked. Please try again.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Last-known emergency advisory',{exact:true}).count(),2);
  await page.evaluate(()=>{window.fixture.networkListeners.forEach(callback=>callback({isConnected:false,isInternetReachable:false}));});
  await page.getByText(/You’re offline/).waitFor();
  await page.evaluate(()=>{window.fixture.fail={};window.fixture.networkListeners.forEach(callback=>callback({isConnected:true,isInternetReachable:true}));window.fixture.announcements=window.fixture.announcements.filter(item=>item.id==='active-new');window.fixture.announcements[0].alert_expires_at=new Date(Date.now()+1800).toISOString();});
  await pullHome();
  await page.getByRole('button',{name:/View advisory: Newer active warning/}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[aria-label^="View advisory:"]'));
  await page.getByText('Expired',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.announcements[0].alert_expires_at=new Date(Date.now()+800).toISOString();});
  await pullHome();
  await page.getByRole('button',{name:/View advisory: Newer active warning/}).waitFor();
  await page.evaluate(()=>window.fixture.listeners.forEach(callback=>callback('background')));
  assert.equal(await page.evaluate(()=>window.fixture.networkListeners.size),0,'background releases connectivity listener');
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,900)));
  await page.evaluate(()=>window.fixture.listeners.forEach(callback=>callback('active')));
  await page.waitForFunction(()=>!document.querySelector('[aria-label^="View advisory:"]'));
  await page.getByText('Expired',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'expired-preview.png'),fullPage:true});
  passed.push('Independent active advisories despite newer routine post; deleted/future/unknown exclusion; exact detail ID; partial-success retained errors, truthful offline and focused expiry without a fetch');
  await page.evaluate(() => {window.fixture.focused=false;window.renderHome();});
  await page.waitForFunction(() => window.fixture.listeners.size===0);
  await page.evaluate(() => window.unmountHome());
  assert.equal(await page.evaluate(() => window.fixture.listeners.size),0);
  assert.deepEqual(errors,[]);
  passed.push('Loading state, late previous-account response isolation, focus/unmount listener cleanup and no console warnings/errors');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors,native:false},null,2));
  console.log(JSON.stringify({passed,errors,out},null,2));
} catch (error) {
  fs.writeFileSync(path.join(out,'failure-console.json'),JSON.stringify(errors,null,2));
  if(page)fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,active:document.activeElement?.outerHTML,queries:window.fixture.queries})),null,2));
  if(page)await page.screenshot({path:path.join(out,'failure.png')});
  throw error;
} finally {await browser.close();}
