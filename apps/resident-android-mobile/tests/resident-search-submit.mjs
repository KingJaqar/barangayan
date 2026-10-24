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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-submit-'));
fs.mkdirSync(out, { recursive: true });

// Real header, entry screen, provider, session and history store; navigation uses the installed Expo tab reducer.
// Storage is an isolated in-page fixture seeded with an over-limit save; no real account data is touched.
const mocks = {
  'expo-router': `import {TabRouter} from '${tabRouter}';
    const tabs=TabRouter({initialRouteName:'home',backBehavior:'history'});
    const options={routeNames:['home','services','search','explore'],routeParamList:{},routeGetIdList:{}};
    export const usePathname=()=>window.fx.path;
    window.dispatch=action=>{const next=tabs.getStateForAction(window.fx.navigation,action,options);if(!next)throw Error('Unhandled '+action.type);window.fx.navigation=next;window.fx.path='/'+next.routes[next.index].name;window.refresh?.();};
    window.fx.navigation=tabs.getInitialState(options);
    // Explore subscribes to its tab navigation's state; these flows never open a stack result.
    export const useNavigation=()=>window.fx.navigationStub??={addListener:()=>()=>{},goBack:()=>{}};
    export const router={navigate:href=>{window.fx.transitions++;window.dispatch({type:'NAVIGATE',payload:{name:String(href).slice(1)}})},push:href=>{window.fx.opened=href},replace:href=>{window.fx.transitions++;window.dispatch({type:'REPLACE',payload:{name:href.slice(1)}})},back:()=>{window.fx.transitions++;window.dispatch({type:'GO_BACK'})},canGoBack:()=>window.fx.navigation.history.length>1};`,
  '@react-native-async-storage/async-storage': `export default {getItem:async key=>{if(window.fx.failReads)throw Error('read');return window.fx.storage.get(key)??null},setItem:async(key,value)=>{if(window.fx.failWrites)throw Error('write');window.fx.writes++;window.fx.storage.set(key,value)}};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fx.user?{user:{id:window.fx.user}}:null});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fx.user?{barangay_id:'b1'}:null,isLoading:false,error:null});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/lib/resident-search': `export {normalizeSearchQuery,isSearchableQuery,SEARCH_DEADLINE_MS,SEARCH_SOURCES,searchCategories} from '${src}/lib/resident-search.ts';export async function queryResidentSearch(){window.fx.requests++;return []}export async function queryResidentSearchPage(){window.fx.requests++;return {results:[],more:false}}`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${src}/constants/resident-theme.ts';export const useTheme=()=>({background:'#fff',backgroundElement:'#f1f2f6',backgroundSelected:'#e5e7eb',primary:'#127261',text:'#20242a',textSecondary:'#656971',resident:getResidentTheme('light','#0F6E5B')});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'sans-serif'});`,
  '@/constants/fonts': `export const getMobileFontFamily=id=>id;`,
  '@/hooks/use-unread-counts': `export const useUnreadCounts=()=>({announcementsUnreadCount:0});`,
  '@/hooks/use-emergency-map-header': `export const useEmergencyMapHeader=()=>({active:false});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/components/themed-text': `import React from 'react';import {Text} from 'react-native-web';export const ThemedText=({type,themeColor,...props})=><Text {...props}/>;`,
  '@/components/notification-bell': `export const NotificationBell=()=>null;`,
  'expo-image': `export {View as Image} from 'react-native-web';`,
  '@expo/vector-icons': `export const Ionicons=()=>null;`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
  'react-native-reanimated': `import {useRef} from 'react';export {Easing} from 'react-native-web';import {View} from 'react-native-web';export default {View};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withSpring=value=>value;export const cancelAnimation=()=>{};`,
  'react-native': `import React from 'react';import {View as WebView} from 'react-native-web';export * from 'react-native-web';export const View=({accessibilityElementsHidden,importantForAccessibility,...props})=><WebView {...props} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>;export const Keyboard={dismiss:()=>{window.fx.dismissals++;document.activeElement?.blur()}};export const BackHandler={addEventListener:()=>({remove:()=>{}})};`,
};
const seed = JSON.stringify(Array.from({ length: 12 }, (_, i) => `Saved ${i}`));
await build({ stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';window.fx={path:'/home',user:'u1',storage:new Map([['resident_search_history_v1:u1',${JSON.stringify(seed)}]]),writes:0,transitions:0,dismissals:0,requests:0,failReads:false,failWrites:false};const{ResidentSearchProvider,useSearchDraft}=await import('${src}/hooks/use-resident-search.tsx');const{ResidentHeader}=await import('${src}/components/resident-header.tsx');const{default:Search}=await import('${src}/app/(app)/search.tsx');const{default:Explore}=await import('${src}/app/(app)/explore.tsx');function Inner(){window.draft=useSearchDraft();return <div style={{width:360}}><ResidentHeader/>{window.fx.path==='/search'?<Search/>:window.fx.path==='/explore'?<Explore/>:null}</div>}function App(){const[,render]=useState(0);window.refresh=()=>render(v=>v+1);return <ResidentSearchProvider><Inner/></ResidentSearchProvider>}const root=createRoot(document.getElementById('root'));window.unmount=()=>root.unmount();root.render(<App/>);`, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'esm', outfile: path.join(out, 'bundle.js'), jsx: 'automatic', loader: { '.png': 'dataurl' }, define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
} }] });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
try {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js'), type: 'module' });
  await page.waitForFunction(() => window.draft);
  const at = pathname => page.waitForFunction(pathname => window.fx.path === pathname, pathname);
  const input = page.getByPlaceholder('Search Barangayan');
  const submit = page.getByRole('button', { name: 'Submit search', exact: true });
  const snapshot = () => page.evaluate(() => ({ path: window.fx.path, writes: window.fx.writes, transitions: window.fx.transitions, dismissals: window.fx.dismissals, submission: window.draft.submission, submitted: window.draft.submittedQuery, history: window.draft.history, saved: JSON.parse(window.fx.storage.get('resident_search_history_v1:' + window.fx.user) ?? '[]'), focused: document.activeElement?.tagName === 'INPUT' }));
  const settle = () => page.waitForTimeout(150);
  const backToEntry = async () => { await page.getByRole('button', { name: 'Back from search', exact: true }).click(); await at('/search'); };
  async function expectOneSubmit(label, action, query) {
    const before = await snapshot();
    await action();
    await at('/explore');
    await page.waitForFunction(writes => window.fx.writes > writes, before.writes);
    await settle();
    const after = await snapshot();
    assert.deepEqual([after.transitions - before.transitions, after.writes - before.writes, after.submission - before.submission, after.dismissals - before.dismissals], [1, 1, 1, 1], `${label}: one transition, save, submission and keyboard dismissal`);
    assert.equal(after.submitted, query, label);
    assert.equal(after.history[0], query, label);
    assert.deepEqual(after.saved, after.history, `${label}: persisted history matches`);
    assert.equal(after.focused, false, `${label}: keyboard closed`);
    assert.equal(await submit.count(), 0, 'Search submit is an entry-only control');
    return after;
  }

  // Empty entry: hydration migrates the 12-item save to the 10 newest, then Recent precedes Suggested.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await at('/search');
  await page.waitForFunction(() => window.draft.history.length === 10);
  const migrated = await snapshot();
  assert.deepEqual(migrated.saved, Array.from({ length: 10 }, (_, i) => `Saved ${i}`));
  assert.equal(migrated.writes, 1, 'Over-limit save trimmed once on load');
  assert.deepEqual((await page.getByRole('heading').allTextContents()).filter(Boolean).slice(0, 2), ['Recent searches', 'Suggested searches']);
  assert.equal(await page.getByRole('button', { name: /^Search again for / }).count(), 10);
  assert.equal(await page.getByRole('button', { name: 'Clear search', exact: true }).count(), 0, 'X appears only with text');
  assert.equal(await submit.isDisabled(), true);

  // Invalid input: whitespace and punctuation emit nothing from the button or keyboard.
  const quiet = await snapshot();
  for (const value of ['   ', '?!', ' .,- ']) {
    await input.fill(value);
    assert.equal(await submit.isDisabled(), true, `Search disabled for ${JSON.stringify(value)}`);
    await submit.click({ force: true });
    await input.press('Enter');
  }
  await settle();
  const afterInvalid = await snapshot();
  assert.deepEqual([afterInvalid.path, afterInvalid.transitions, afterInvalid.writes, afterInvalid.submission], ['/search', quiet.transitions, quiet.writes, quiet.submission]);

  // Typed entry: matching suggestions only, with Search immediately right of X.
  await input.fill('saved');
  await page.getByText('Suggestions', { exact: true }).waitFor();
  assert.equal(await page.getByText('Recent searches', { exact: true }).count(), 0);
  const labels = await page.getByRole('button', { name: /^Search for / }).allTextContents();
  assert.ok(labels.length > 0 && labels.every(label => label.toLowerCase().includes('saved')), `Typed suggestions match: ${labels}`);
  const clear = await page.getByRole('button', { name: 'Clear search', exact: true }).boundingBox();
  const search = await submit.boundingBox();
  assert.ok(clear && search && Math.abs(search.x - (clear.x + clear.width)) <= 1 && Math.abs((search.y + search.height / 2) - (clear.y + clear.height / 2)) <= 1, `Search sits immediately right of X: ${JSON.stringify({ clear, search })}`);
  assert.equal(await page.evaluate(() => { const [x, s] = ['Clear search', 'Submit search'].map(name => document.querySelector(`[aria-label="${name}"]`)); return Boolean(x.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); }), true);
  assert.equal(await submit.isDisabled(), false);
  await page.screenshot({ path: path.join(out, 'typed-entry.png') });

  // The four valid submission paths share one path.
  await input.fill('  Clearance   form ');
  await expectOneSubmit('keyboard Search', () => input.press('Enter'), 'Clearance form');
  await backToEntry();
  assert.equal(await input.inputValue(), 'Clearance form', 'Back from Explore edits the submitted query');
  await input.fill('Medical drives');
  await expectOneSubmit('visible Search button', () => submit.click(), 'Medical drives');
  await backToEntry();
  // A double press still submits once. Its second tap may land on Explore's field, which (Phase 5) reopens the entry to edit.
  const double = await snapshot();
  await submit.dblclick();
  await page.waitForFunction(writes => window.fx.writes > writes, double.writes);
  await settle();
  const afterDouble = await snapshot();
  const edited = afterDouble.path === '/search';
  assert.deepEqual([afterDouble.transitions - double.transitions, afterDouble.writes - double.writes, afterDouble.submission - double.submission], [edited ? 2 : 1, 1, 1], 'Double press submits once');
  // On Explore the field and X take the Submit button's place: the field reopens the query, X an empty entry.
  if (edited) assert.ok(['Medical drives', ''].includes(await input.inputValue()), 'An edit tap opens the entry with the query or empty');
  else await backToEntry();
  if (await input.inputValue()) await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  const promoted = await expectOneSubmit('recent query', () => page.getByRole('button', { name: 'Search again for Clearance form', exact: true }).click(), 'Clearance form');
  assert.deepEqual(promoted.history.slice(0, 3), ['Clearance form', 'Medical drives', 'Saved 0'], 'Selecting a recent query promotes it without duplicating');
  assert.equal(promoted.history.length, 10);
  await backToEntry();
  await input.fill('emergency');
  const suggested = await expectOneSubmit('suggestion', () => page.getByRole('button', { name: 'Search for Emergency hotlines', exact: true }).click(), 'Emergency hotlines');
  assert.deepEqual(suggested.history.slice(0, 3), ['Emergency hotlines', 'Clearance form', 'Medical drives']);
  assert.equal(suggested.history.length, 10);

  // Storage failure keeps search usable and shows actionable history feedback.
  await backToEntry();
  await page.evaluate(() => { window.fx.failWrites = true; });
  const failing = await snapshot();
  await input.fill('water interruption');
  await input.press('Enter');
  await at('/explore');
  assert.equal((await snapshot()).submitted, 'water interruption');
  await backToEntry();
  await page.getByText('Recent searches could not be updated. Please try again.', { exact: true }).waitFor();
  assert.deepEqual((await snapshot()).history, failing.history, 'Failed save leaves the saved list shown');
  await page.evaluate(() => { window.fx.failWrites = false; window.fx.failReads = true; window.fx.user = 'u2'; window.refresh(); });
  await page.getByText('Recent searches could not be loaded.', { exact: true }).waitFor();
  await page.evaluate(() => { window.fx.failReads = false; });
  await page.getByRole('button', { name: 'Try loading recent searches again', exact: true }).click();
  await page.waitForFunction(() => window.draft.historyError === null);
  assert.deepEqual((await snapshot()).history, [], 'Accounts stay isolated');

  // Guests can search, but nothing is written.
  await page.evaluate(() => { window.fx.user = null; window.refresh(); });
  await page.waitForFunction(() => window.draft.history.length === 0 && window.draft.query === '');
  const guest = await snapshot();
  await input.fill('guest query');
  await submit.click();
  await at('/explore');
  await settle();
  assert.equal((await snapshot()).writes, guest.writes, 'Guest submissions are not saved');
  assert.equal(await page.evaluate(() => window.fx.storage.has('resident_search_history_v1:null')), false);

  await page.evaluate(() => window.unmount());
  assert.deepEqual(errors, []);
  const results = { passed: ['over-limit save migrated to 10 newest on hydration', 'empty entry lists Recent then Suggested; X hidden and Search disabled', 'whitespace/punctuation input emits no transition, save or submission from button or keyboard', 'typed entry shows only matching suggestions; Search immediately right of X', 'keyboard, visible button, recent and suggestion each emit one transition, save, submission and keyboard dismissal', 'double press submits once; duplicate selection promotes; persisted history stays at 10', 'save failure keeps search usable with feedback; load failure offers Try again; accounts isolated', 'guest submissions navigate without writes', 'no console errors or warnings'], errors, nativeVerified: false };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
