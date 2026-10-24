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
const tabRouter = require.resolve('expo-router/build/react-navigation/routers/TabRouter').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-session-'));
fs.mkdirSync(out, { recursive: true });

// The installed Expo tab reducer runs here; native rendering and the URL bridge are fixtures.
const mocks = {
  'expo-router': `import {TabRouter} from '${tabRouter}';
    const tabs=TabRouter({initialRouteName:'home',backBehavior:'history'});
    const options={routeNames:['home','services','drrm','maps','health','reports','settings','announcements','search','explore'],routeParamList:{},routeGetIdList:{}};
    export const usePathname=()=>window.fx.path;
    window.resetNavigation=path=>{window.fx.navigation=tabs.getInitialState(options);window.dispatch({type:'NAVIGATE',payload:{name:path.slice(1)}});};
    window.dispatch=action=>{const next=tabs.getStateForAction(window.fx.navigation,action,options);if(!next)throw Error('Unhandled '+action.type);window.fx.navigation=next;window.fx.path='/'+next.routes[next.index].name;window.refresh?.();};
    // Explore subscribes to its tab navigation's state; these flows never open a stack result.
    export const useNavigation=()=>window.fx.navigationStub??={addListener:()=>()=>{},goBack:()=>{}};
    export const router={navigate:href=>{window.fx.transitions++;window.dispatch({type:'NAVIGATE',payload:{name:href.slice(1)}})},replace:href=>{window.fx.transitions++;window.dispatch({type:'REPLACE',payload:{name:href.slice(1)}})},back:()=>{window.fx.transitions++;window.dispatch({type:'GO_BACK'})},canGoBack:()=>window.fx.navigation.history.length>1};`,
  '@react-native-async-storage/async-storage': `export default {getItem:async()=>null,setItem:async()=>{window.fx.writes++}};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fx.user?{user:{id:window.fx.user}}:null});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fx.tenant?{barangay_id:window.fx.tenant}:null,isLoading:false,error:null});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${src}/constants/resident-theme.ts';export const useTheme=()=>({background:window.fx.mode==='dark'?'#111':'#fff',resident:getResidentTheme(window.fx.mode,window.fx.accent)});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fx.font});`,
  '@/constants/fonts': `export const getMobileFontFamily=id=>id;`,
  '@/hooks/use-unread-counts': `export const useUnreadCounts=()=>({announcementsUnreadCount:0});`,
  '@/hooks/use-emergency-map-header': `export const useEmergencyMapHeader=()=>({active:window.fx.path==='/maps'});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/components/themed-text': `export {Text as ThemedText} from 'react-native-web';`,
  '@/components/notification-bell': `export const NotificationBell=()=>null;`,
  'expo-image': `export {View as Image} from 'react-native-web';`,
  '@expo/vector-icons': `export const Ionicons=()=>null;`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
  'react-native-reanimated': `import {useRef} from 'react';export {Easing} from 'react-native-web';import {View} from 'react-native-web';export default {View};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withSpring=value=>value;export const cancelAnimation=()=>{};`,
  'react-native': `import React from 'react';import {View as WebView} from 'react-native-web';export * from 'react-native-web';export const View=({accessibilityElementsHidden,importantForAccessibility,...props})=><WebView {...props} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>;export const Keyboard={dismiss:()=>document.activeElement?.blur()};export const BackHandler={addEventListener:()=>({remove:()=>{}})};`,
};
await build({ stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ResidentSearchProvider,useSearchDraft}from'${src}/hooks/use-resident-search.tsx';import{ResidentHeader}from'${src}/components/resident-header.tsx';import Explore from '${src}/app/(app)/explore.tsx';window.fx={path:'/home',user:'u1',tenant:'b1',mode:'light',accent:'#0F6E5B',font:'sans-serif',writes:0,transitions:0,focuses:0};window.resetNavigation('/home');const original=HTMLInputElement.prototype.focus;HTMLInputElement.prototype.focus=function(...args){window.fx.focuses++;return original.apply(this,args)};function Inner(){window.draft=useSearchDraft();return <><ResidentHeader/>{window.fx.path==='/explore'?<Explore/>:null}</>}function App(){const[n,render]=useState(0);window.refresh=()=>render(v=>v+1);return <ResidentSearchProvider><Inner/></ResidentSearchProvider>}const root=createRoot(document.getElementById('root'));window.unmount=()=>root.unmount();root.render(<App/>);`, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'iife', outfile: path.join(out, 'bundle.js'), jsx: 'automatic', loader: { '.png': 'dataurl' }, define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
} }] });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage();
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
try {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  await page.waitForFunction(() => window.draft);
  const at = pathname => page.waitForFunction(pathname => window.fx.path === pathname, pathname);
  const state = () => page.evaluate(() => ({query:window.draft.query,submitted:window.draft.submittedQuery,submission:window.draft.submission,origin:window.draft.origin,history:window.fx.navigation.history.length,transitions:window.fx.transitions}));
  for (const origin of ['/home', '/services', '/drrm', '/maps', '/health', '/reports', '/announcements', '/settings']) {
    await page.evaluate(origin => window.resetNavigation(origin), origin);
    const baseline = (await state()).history;
    for (let i = 0; i < 10; i++) {
      const { transitions: before, submission } = await state();
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await at('/search');
      await page.getByPlaceholder('Search Barangayan').fill('  clearance   today  ');
      assert.equal((await state()).submitted, null);
      await page.evaluate(() => { window.accepted=[window.draft.submitSearch(window.draft.query),window.draft.submitSearch('different query')]; });
      await at('/explore');
      assert.deepEqual(await page.evaluate(() => window.accepted), [true, false]);
      assert.equal((await state()).submitted, 'clearance today');
      assert.equal((await state()).origin, origin);
      assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'INPUT');
      const focuses = await page.evaluate(() => window.fx.focuses);
      await page.evaluate(() => { window.fx.mode='dark';window.fx.accent='#FFFFFF';window.fx.font='serif';window.refresh(); });
      await page.waitForFunction(() => document.querySelector('input').style.fontFamily === 'serif');
      assert.equal(await page.evaluate(() => window.fx.focuses), focuses);
      // Draft edits do not replace the captured submitted query.
      await page.evaluate(() => window.draft.setQuery('another draft'));
      await page.waitForFunction(() => window.draft.query === 'another draft');
      assert.equal((await state()).submitted, 'clearance today');
      await page.evaluate(() => { window.draft.editSearch();window.draft.editSearch(); });
      await at('/search');
      assert.equal((await state()).query, 'clearance today');
      await page.evaluate(() => window.draft.submitSearch('revised query'));
      await at('/explore');
      await page.getByRole('button', { name: 'Back from search', exact: true }).click();
      await at('/search');
      await page.getByRole('button', { name: 'Back from search', exact: true }).click();
      await at(origin);
      assert.equal((await state()).history, baseline, 'Cycle must remove both transient history items');
      // Search, submit, edit, resubmit, Back to entry, Back (pop + return to origin).
      assert.equal((await state()).transitions - before, 7);
      assert.equal((await state()).submission - submission, 2, 'Each accepted submit changes the submission key once');
      assert.equal((await state()).submitted, null);
    }
  }
  await page.evaluate(() => window.resetNavigation('/maps'));
  await page.getByRole('button', { name: 'Search', exact: true }).click();await at('/search');
  await page.evaluate(() => window.draft.submitSearch('map query'));await at('/explore');
  await page.clock.install();await page.clock.fastForward(16_000);
  assert.equal(await page.evaluate(() => window.fx.path), '/explore', 'Entry idle timer must stop on Explore');
  await page.clock.resume();
  await page.evaluate(() => { window.resetNavigation('/search');window.draft.setQuery('scope draft'); });
  assert.deepEqual(await page.evaluate(() => ['','  ','?!'].map(value=>window.draft.submitSearch(value))), [false,false,false]);
  await page.evaluate(() => window.draft.submitSearch('scope query'));
  await at('/explore');
  await page.evaluate(() => { window.fx.tenant='b2';window.refresh(); });
  await page.waitForFunction(() => window.draft.query==='' && window.draft.submittedQuery===null && window.draft.origin==='/home');
  await page.evaluate(() => window.draft.backFromSearch());await at('/search');
  await page.evaluate(() => window.draft.backFromSearch());await at('/home');
  await page.evaluate(() => { window.draft.setQuery('account draft');window.fx.user='u2';window.refresh(); });
  await page.waitForFunction(() => window.draft.query==='' && window.draft.submittedQuery===null);
  await page.evaluate(() => { window.resetNavigation('/search'); });
  await page.evaluate(() => { window.draft.openSearch('/maps');window.draft.backFromSearch();window.draft.backFromSearch(); });await at('/home');
  await page.evaluate(() => window.draft.openSearch('/unknown'));await at('/search');
  assert.equal((await state()).origin, '/home');
  await page.evaluate(() => window.draft.backFromSearch());await at('/home');
  // Two accepted submits per cycle plus the map and scope queries; rejected duplicates/invalid input save nothing.
  await page.waitForFunction(() => window.fx.writes >= 162);
  assert.equal(await page.evaluate(() => window.fx.writes), 162);
  const tabs = fs.readFileSync(path.join(app, 'src/components/app-tabs.tsx'), 'utf8');
  assert.match(tabs, /name="explore" options=\{\{ href: null \}\}/);
  await page.evaluate(() => window.unmount());
  assert.deepEqual(errors, []);
  const results = { passed: ['80 origin/open/submit/edit/resubmit/back cycles with installed Expo tab reducer', 'six transitions per cycle, history returns to baseline', 'normalized submitted snapshot, draft independence and duplicate-action guard', 'Explore header visible without autofocus or appearance refocus; entry idle timer stopped', 'invalid submissions, scope/account reset and Home fallback', 'hidden Explore registration; one history save per accepted submit'], errors, nativeVerified: false };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
