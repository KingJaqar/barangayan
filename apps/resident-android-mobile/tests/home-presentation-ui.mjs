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
    export const AccessibilityInfo={sendAccessibilityEvent:(target,event)=>window.fixture.focusEvents.push(event)};`,
  '@barangayan/shared': `export * from '${shared}/lib/request-status.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const useRouter=()=>({push:href=>window.fixture.routes.push(href)});export const useFocusEffect=fn=>useEffect(()=>window.fixture.focused?fn():undefined,[fn,window.fixture.focused]);export const Link=({href,children})=>React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:window.fixture.needsCompletion});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reducedMotion;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  '@/lib/supabase': `export const supabase={from(table){const query={table,select(columns){query.columns=columns;return query},eq(column,value){query.filter=[column,value];return query},order(column,options){query.order=[column,options];return query},limit(count){query.limit=count;return query},then(done,fail){const f=window.fixture;f.queries.push({table,columns:query.columns,filter:query.filter,limit:query.limit,order:query.order});const data=structuredClone((table==='announcements'?f.announcements:f.requests.filter(item=>item.resident_id===query.filter?.[1])).slice(0,query.limit));const error=f.fail[table]?{}:null;return new Promise((resolve,reject)=>{const settle=()=>f.reject[table]?reject(Error('Synthetic transport error')):resolve({data:error?null:data,error});if(f.hold)f.waiting.push(settle);else settle();}).then(done,fail);}};return query;}};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const cancelAnimation=()=>{};export const Easing={bezier:()=>undefined};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Home from '${root}/app/(app)/home/index.tsx';
    const requests=['submitted','in_progress','ready_for_pickup'].map((status,index)=>({id:'request-'+index,resident_id:'synthetic-resident',reference_number:'SYNTHETIC-'+index,status,payment_status:index===0?'unpaid':'paid',created_at:'2026-10-18T01:00:00Z',status_history:index===1?[{status:'in_progress',at:'2026-10-19T02:00:00Z'}]:null,document_types:{name:index===2?'Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)':'Service '+index}}));
    window.fixture={session:{user:{id:'synthetic-resident'}},profile:{full_name:'Test Resident',avatar_url:null,barangays:{name:'Synthetic barangay'}},needsCompletion:false,requests,announcements:[{id:'news',title:'Synthetic community advisory with a long title for full text coverage',category:'general',published_at:'2026-10-18T02:00:00Z'}],mode:'light',accent:'#0F6E5B',fontId:'system',reducedMotion:true,focused:true,listeners:new Set(),motions:[],focusEvents:[],queries:[],routes:[],fail:{},reject:{},hold:false,waiting:[]};
    const root=createRoot(document.getElementById('root'));let generation=0;window.renderHome=()=>root.render(<Home key={generation}/>);window.resetHome=()=>{generation++;window.renderHome();};window.unmountHome=()=>root.render(null);window.renderHome();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
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
  const cards = () => page.getByRole('button', { name: /reference SYNTHETIC-/ });
  const right = () => page.getByRole('button', { name: 'Scroll requests right', exact: true });
  const left = () => page.getByRole('button', { name: 'Scroll requests left', exact: true });
  const close = () => page.getByRole('button', { name: 'Close request summary', exact: true });
  await cards().first().waitFor();
  assert.equal(await cards().count(), 3);
  assert.deepEqual(await page.evaluate(() => window.fixture.queries.map(q => [q.table,q.limit,q.filter,q.columns])), [
    ['announcements',1,undefined,'*'],['service_requests',3,['resident_id','synthetic-resident'],'*, document_types(name)'],
  ]);
  await right().waitFor();
  assert.equal(await left().count(), 0);
  await right().click();
  await left().waitFor();
  await right().click();
  await right().waitFor({ state: 'detached' });
  await left().click();
  await right().waitFor();
  assert.equal(await page.getByRole('button', { name: /Scroll announcements/ }).count(), 0);
  passed.push('Actual latest-three/latest-one query shapes and measured chevrons at both boundaries');

  await cards().nth(1).click();
  await close().waitFor();
  await page.getByRole('dialog').getByLabel('Processing, current stage', { exact: true }).waitFor();
  assert.equal(await page.getByText('Pending', { exact: true }).count(), 2);
  await page.screenshot({ path: path.join(out, 'summary-light.png') });
  await close().click();
  await close().waitFor({ state: 'detached' });
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
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/home/requests/request-0');
  passed.push(...verifyRequestTrackingNavigation(await page.evaluate(() => window.fixture.routes.at(-1))));
  assert.equal(await page.evaluate(() => window.fixture.queries.length), queries);
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), 1);
  assert.ok(await page.evaluate(() => window.fixture.focusEvents.length > 1), 'Close returns accessibility focus to a request');
  passed.push('Loaded history, five backdrop cycles, close/Escape, focus return and one tracking navigation without queries');

  for (const [name,route] of [['Documents','/services'],['Report','/reports'],['Emergency','/drrm'],['Maps','/maps'],['Health','/health'],['View all requests','/services'],['View all announcements','/announcements']]) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), route);
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
  assert.equal(await page.getByText('Not recorded',{exact:true}).count(),3);
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
  await page.evaluate(() => {window.fixture.requests[0].document_types.name='Long document title '.repeat(12);window.resetHome();});
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
  await page.getByText('Your requests will appear here. Tap Documents to request a document.',{exact:true}).waitFor();
  await page.getByText('No announcements yet.',{exact:true}).waitFor();
  assert.equal(await right().count(), 0);
  await page.evaluate(() => {window.fixture.session=null;window.resetHome();});
  await page.getByText('Log in to see your requests.',{exact:true}).waitFor();
  assert.equal(await cards().count(), 0);
  passed.push('Profile-completion, authenticated empty and guest states');

  await page.evaluate(() => {window.fixture.session={user:{id:'synthetic-resident'}};window.fixture.fail={service_requests:true,announcements:true};window.resetHome();});
  await page.getByText('Your requests could not be loaded. Please try again.',{exact:true}).waitFor();
  await page.getByText('Announcements could not be loaded. Please try again.',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.fail={};});
  // The first response removes its own retry control; resolve the remaining control afresh.
  await page.getByRole('button',{name:'Try again',exact:true}).first().click();
  await page.getByRole('button',{name:'Try again',exact:true}).first().click();
  await page.getByText('No announcements yet.',{exact:true}).waitFor();
  await page.getByText('Your requests will appear here. Tap Documents to request a document.',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.reject={service_requests:true};window.resetHome();});
  await page.getByText('Your requests could not be loaded. Please try again.',{exact:true}).waitFor();
  passed.push('Visible database/transport failures and explicit independent retry recovery');

  await page.evaluate(() => {window.fixture.reject={};window.fixture.hold=true;window.fixture.requests=[{id:'stale',resident_id:'synthetic-resident',reference_number:'STALE',status:'submitted',payment_status:'unpaid',created_at:'2026-10-18T00:00:00Z',status_history:null,document_types:{name:'Stale private request'}}];window.resetHome();});
  await page.getByText('Loading your requests…',{exact:true}).waitFor();
  await page.evaluate(() => {window.fixture.session={user:{id:'different-resident'}};window.renderHome();});
  await page.waitForFunction(() => window.fixture.waiting.length===3);
  await page.evaluate(() => {window.fixture.hold=false;window.fixture.waiting.splice(0).forEach(resolve=>resolve());});
  await page.getByText('Your requests will appear here. Tap Documents to request a document.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Stale private request',{exact:true}).count(),0);
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
  if(page)await page.screenshot({path:path.join(out,'failure.png')});
  throw error;
} finally {await browser.close();}
