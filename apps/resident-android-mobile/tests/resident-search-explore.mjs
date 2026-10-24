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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-explore-'));
fs.mkdirSync(out, { recursive: true });

// Real header, entry, Explore, provider, session and result controller (src/lib/search-results.ts).
// Only the page query is a fixture: a fixed ordered dataset per source with controllable holds and failures.
const mocks = {
  'expo-router': `import {TabRouter} from '${tabRouter}';
    const tabs=TabRouter({initialRouteName:'home',backBehavior:'history'});
    const options={routeNames:['home','services','announcements','health','reports','settings','search','explore'],routeParamList:{},routeGetIdList:{}};
    export const usePathname=()=>window.fx.path;
    window.dispatch=action=>{const next=tabs.getStateForAction(window.fx.navigation,action,options);if(!next)throw Error('Unhandled '+action.type);window.fx.navigation=next;window.fx.path='/'+next.routes[next.index].name;window.refresh?.();};
    window.fx.navigation=tabs.getInitialState(options);
    // Explore's tab navigation: 'state' listeners receive emitted tab states; goBack is the tab router's GO_BACK.
    const listeners=new Set();
    const navigation={addListener:(type,listener)=>{if(type!=='state')return()=>{};listeners.add(listener);return()=>{listeners.delete(listener)}},goBack:()=>{window.fx.goBacks++;window.fx.transitions++;window.dispatch({type:'GO_BACK'})}};
    window.emitNav=state=>{for(const listener of [...listeners])listener({data:{state}})};
    window.navListeners=()=>listeners.size;
    export const useNavigation=()=>navigation;
    const go=href=>{if(window.fx.followPush){window.fx.transitions++;window.dispatch({type:'NAVIGATE',payload:{name:(typeof href==='object'?href.pathname:href).split('/')[1]}})}};
    export const router={navigate:href=>{if(typeof href==='object'){window.fx.opened.push(href);go(href);return}window.fx.transitions++;window.dispatch({type:'NAVIGATE',payload:{name:String(href).slice(1)}})},push:(href,options)=>{window.fx.opened.push(href);window.fx.pushOptions.push(options);go(href)},replace:href=>{window.fx.transitions++;window.dispatch({type:'REPLACE',payload:{name:href.slice(1)}})},back:()=>{window.fx.transitions++;window.dispatch({type:'GO_BACK'})},canGoBack:()=>window.fx.navigation.history.length>1};`,
  '@react-native-async-storage/async-storage': `export default {getItem:async()=>null,setItem:async()=>{}};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fx.user?{user:{id:window.fx.user}}:null});`,
  // `refreshing` models a foreground/realtime profile refresh: isLoading flips, the first load is long done.
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fx.user?{barangay_id:'b1'}:null,isLoading:Boolean(window.fx.user&&window.fx.refreshing),isInitialLoading:false,error:null});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/lib/resident-search': `import {SearchError} from '${src}/lib/resident-search.ts';
    export {normalizeSearchQuery,isSearchableQuery,SEARCH_DEADLINE_MS,SEARCH_SOURCES,searchCategories,SearchError} from '${src}/lib/resident-search.ts';
    export async function queryResidentSearch(){return []}
    export function queryResidentSearchPage(client,scope,category,query,offset,signal){
      const n=query==='nothing'?0:window.fx.sizes[category];
      const results=Array.from({length:Math.max(0,Math.min(20,n-offset))},(_,i)=>({id:category+'-'+(offset+i),category,title:category+' '+(offset+i),preview:'Preview '+(offset+i),date:category==='health'?'2026-11-'+String(10+offset+i).padStart(2,'0'):''}));
      return new Promise((resolve,reject)=>{
        const call={category,offset,query,scope,signal,settle:()=>{const failure=window.fx.fail[category+':'+offset]??window.fx.fail[category];failure?reject(new SearchError(failure)):resolve({results,more:offset+20<n})}};
        window.fx.calls.push(call);
        if(!window.fx.hold)setTimeout(call.settle,10);
      });
    }`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${src}/constants/resident-theme.ts';export const useTheme=()=>({background:window.fx.mode==='dark'?'#000000':'#ffffff',backgroundElement:'#f1f2f6',primary:window.fx.accent,text:'#20242a',textSecondary:'#656971',resident:getResidentTheme(window.fx.mode,window.fx.accent)});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'sans-serif'});`,
  '@/constants/fonts': `export const getMobileFontFamily=id=>id;`,
  '@/hooks/use-unread-counts': `export const useUnreadCounts=()=>({announcementsUnreadCount:0});`,
  '@/hooks/use-emergency-map-header': `export const useEmergencyMapHeader=()=>({active:false});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/components/themed-text': `import React from 'react';import {Text} from 'react-native-web';export const ThemedText=({type,themeColor,style,...props})=><Text {...props} style={[{fontSize:type==='smallBold'||type==='small'?14*window.fx.textScale:16*window.fx.textScale,lineHeight:20*window.fx.textScale},style]}/>;`,
  '@/components/notification-bell': `export const NotificationBell=()=>null;`,
  'expo-image': `export {View as Image} from 'react-native-web';`,
  '@expo/vector-icons': `export const Ionicons=()=>null;`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
  'react-native-reanimated': `import {useRef} from 'react';export {Easing} from 'react-native-web';import {View} from 'react-native-web';export default {View};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withSpring=value=>value;export const cancelAnimation=()=>{};`,
  // react-native-web 0.21 ignores accessibilityState; mirror selection the way the other UI harnesses do.
  'react-native': `import React from 'react';import * as R from 'react-native-web';import {View as WebView} from 'react-native-web';export * from 'react-native-web';export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected}/>);export const View=({accessibilityElementsHidden,importantForAccessibility,...props})=><WebView {...props} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>;export const Keyboard={dismiss:()=>{document.activeElement?.blur()}};
    // Android Back: the newest listener runs first; returning true consumes the press, false falls through to the tab router.
    export const BackHandler={addEventListener:(type,listener)=>{window.fx.backs.add(listener);return{remove:()=>{window.fx.backs.delete(listener)}}}};
    window.hardwareBack=()=>{if([...window.fx.backs].reverse().some(listener=>listener()))return true;window.dispatch({type:'GO_BACK'});return false};`,
};
await build({ stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';window.fx={path:'/home',user:'u1',mode:'light',accent:'#0F6E5B',textScale:1,transitions:0,opened:[],pushOptions:[],goBacks:0,backs:new Set(),keepMounted:false,followPush:false,refreshing:false,calls:[],hold:false,fail:{},sizes:{documents:2,announcements:45,health:4,help:0,requests:1,reports:21}};const{ResidentSearchProvider,useSearchDraft}=await import('${src}/hooks/use-resident-search.tsx');const{ResidentHeader}=await import('${src}/components/resident-header.tsx');const{default:Search}=await import('${src}/app/(app)/search.tsx');const{default:Explore}=await import('${src}/app/(app)/explore.tsx');function Inner(){window.draft=useSearchDraft();const explore=window.fx.path==='/explore';if(explore)window.fx.exploreVisited=true;const kept=window.fx.keepMounted&&window.fx.exploreVisited;return <div style={{width:'100%',height:'100vh',display:'flex',flexDirection:'column'}}><ResidentHeader/>{window.fx.path==='/search'?<Search/>:null}{kept?<div style={explore?{flex:1,minHeight:0,display:'flex',flexDirection:'column'}:{position:'absolute',top:0,bottom:0,left:0,right:0,visibility:'hidden',display:'flex',flexDirection:'column'}}><Explore/></div>:explore?<Explore/>:null}</div>}function App(){const[,render]=useState(0);window.refresh=()=>render(v=>v+1);return <ResidentSearchProvider><Inner/></ResidentSearchProvider>}const root=createRoot(document.getElementById('root'));window.unmount=()=>root.unmount();root.render(<App/>);`, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'esm', outfile: path.join(out, 'bundle.js'), jsx: 'automatic', loader: { '.png': 'dataurl' }, define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
} }] });

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
// Tall viewport so the virtualized list renders every loaded row for exact counts; layout checks resize to 360 x 640.
const page = await browser.newPage({ viewport: { width: 360, height: 4000 } });
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
const passed = [];
try {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js'), type: 'module' });
  await page.waitForFunction(() => window.draft);
  const at = pathname => page.waitForFunction(pathname => window.fx.path === pathname, pathname);
  const input = page.getByPlaceholder('Search Barangayan');
  const calls = () => page.evaluate(() => window.fx.calls.map(({ category, offset, query }) => ({ category, offset, query })));
  // Tabs scrolled under an edge chevron are reached the way a resident would: through that chevron.
  const clickTab = async name => {
    const tab = page.getByRole('tab', { name, exact: true });
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = await tab.evaluate(node => {
        const box = node.getBoundingClientRect();
        for (const button of document.querySelectorAll('[aria-label^="Scroll search categories "]')) {
          const edge = button.getBoundingClientRect();
          if (box.left < edge.right && box.right > edge.left) return button.getAttribute('aria-label').endsWith('left') ? 'left' : 'right';
        }
        return null;
      });
      if (!side) break;
      await page.getByRole('button', { name: `Scroll search categories ${side}`, exact: true }).click();
      await page.waitForTimeout(400);
    }
    await tab.click();
  };
  const tabs = () => page.getByRole('tab').evaluateAll(nodes => nodes.map(node => [node.getAttribute('aria-label'), node.getAttribute('aria-selected') === 'true']));
  const rows = source => page.getByRole('button', { name: new RegExp(`, ${source}$`) }).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label').split(',')[0]));
  // The virtualized list renders in batches; wait for the expected row count before reading it.
  const loaded = (source, count) => page.waitForFunction(([source, count]) => document.querySelectorAll(`[aria-label$=", ${source}"]`).length === count, [source, count]);
  const settle = () => page.waitForTimeout(80);
  const submit = async query => {
    if (await page.evaluate(() => window.fx.path) !== '/search') {
      await page.getByRole('button', { name: 'Back from search', exact: true }).click();
      await at('/search');
    }
    await page.evaluate(() => { window.fx.calls = []; });
    await input.fill(query);
    await input.press('Enter');
    await at('/explore');
  };

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await at('/search');
  assert.equal(await page.getByText('Searching…').count(), 0, 'Entry no longer renders result status');

  // Loading: held first pages show a live Searching state; the header keeps the submitted query and the keyboard stays closed.
  await page.evaluate(() => { window.fx.hold = true; });
  await submit('  clearance   form ');
  await page.getByText('Searching…', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), 'clearance form');
  assert.equal(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false, 'Explore starts with the keyboard closed');
  assert.deepEqual((await calls()).map(call => [call.category, call.offset, call.query]), ['documents', 'announcements', 'health', 'help', 'requests', 'reports'].map(category => [category, 0, 'clearance form']), 'One first page per eligible source');
  assert.deepEqual(await tabs(), [['All', true], ['Documents & services', false], ['Announcements', false], ['Medical drives', false], ['Help articles', false], ['My requests', false], ['My reports', false]]);
  await page.evaluate(() => { window.fx.hold = false; for (const call of window.fx.calls) call.settle(); });
  passed.push('loading state, submitted query in header, keyboard closed, one first page per eligible source');

  // All: up to three previews per nonempty source, empty sources omitted, See all for each section.
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  assert.equal(await page.getByText('Searching…').count(), 0);
  // Sections render in batches; wait for every preview before reading them.
  for (const [source, count] of [['Documents & services', 2], ['Announcements', 3], ['Medical drives', 3], ['My requests', 1], ['My reports', 3]]) await loaded(source, count);
  assert.deepEqual(await rows('Documents & services'), ['documents 0', 'documents 1']);
  assert.deepEqual(await rows('Announcements'), ['announcements 0', 'announcements 1', 'announcements 2']);
  assert.deepEqual(await rows('Medical drives'), ['health 0', 'health 1', 'health 2']);
  assert.deepEqual(await rows('My requests'), ['requests 0']);
  assert.deepEqual(await rows('My reports'), ['reports 0', 'reports 1', 'reports 2']);
  assert.equal(await page.getByRole('heading', { name: 'Help articles' }).count(), 0, 'Empty sources are omitted');
  assert.deepEqual((await page.getByRole('heading').allTextContents()).filter(Boolean), ['Documents & services', 'Announcements', 'Medical drives', 'My requests', 'My reports']);
  assert.equal(await page.getByRole('button', { name: /^See all / }).count(), 5);
  assert.equal(await page.getByText('Load more', { exact: true }).count(), 0, 'All shows previews only');
  passed.push('All caps previews at 3 per nonempty source in source order with See all');

  // See all and the category tab select the same state; Load more pages through 45 rows once each, then stops.
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).click();
  assert.deepEqual((await tabs()).find(([, selected]) => selected), ['Announcements', true]);
  await loaded('Announcements', 20);
  const seeAll = await rows('Announcements');
  assert.deepEqual(seeAll, Array.from({ length: 20 }, (_, i) => `announcements ${i}`));
  await clickTab('All');
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  await clickTab('Announcements');
  await loaded('Announcements', 20);
  assert.deepEqual(await rows('Announcements'), seeAll, 'Tab and See all agree');
  assert.equal((await calls()).length, 6, 'Switching views reuses loaded pages');
  const loadMore = page.getByRole('button', { name: 'Load more Announcements', exact: true });
  await loadMore.click();
  await loaded('Announcements', 40);
  await loadMore.click();
  await page.getByText('No more results', { exact: true }).waitFor();
  await loaded('Announcements', 45);
  assert.deepEqual(await rows('Announcements'), Array.from({ length: 45 }, (_, i) => `announcements ${i}`), 'Every ordered ID once');
  assert.equal(await loadMore.count(), 0, 'Load more disappears at exhaustion');
  assert.deepEqual((await calls()).slice(6).map(call => [call.category, call.offset]), [['announcements', 20], ['announcements', 40]]);
  passed.push('See all and tab select the same state; Load more crosses 20 and stops at 45 with one request per page');

  // A held page shows Loading more, and repeated presses cannot start a second request.
  await clickTab('My reports');
  await page.evaluate(() => { window.fx.hold = true; });
  await page.getByRole('button', { name: 'Load more My reports', exact: true }).click();
  await page.getByText('Loading more…', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Load more My reports', exact: true }).count(), 0);
  assert.equal((await calls()).filter(call => call.category === 'reports').length, 2);
  await page.evaluate(() => { window.fx.hold = false; window.fx.calls.at(-1).settle(); });
  await page.getByText('No more results', { exact: true }).waitFor();
  await loaded('My reports', 21);
  passed.push('one in-flight page per category with a Loading more state');

  // A failed later page keeps loaded rows and offers an explicit retry that continues from the same offset.
  await submit('second pass');
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  assert.deepEqual((await tabs()).find(([, selected]) => selected), ['All', true], 'A new submission resets to All');
  await page.evaluate(() => { window.fx.fail['announcements:20'] = 'offline'; });
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).click();
  await page.getByRole('button', { name: 'Load more Announcements', exact: true }).click();
  await page.getByText('More results could not be loaded. You appear to be offline. Check your connection and try again.', { exact: true }).waitFor();
  await loaded('Announcements', 20);
  await page.waitForTimeout(100);
  assert.equal((await calls()).filter(call => call.category === 'announcements').length, 2, 'No automatic retry');
  await page.evaluate(() => { delete window.fx.fail['announcements:20']; });
  await page.getByRole('button', { name: 'Try loading more Announcements again', exact: true }).click();
  await loaded('Announcements', 40);
  assert.deepEqual((await calls()).filter(call => call.category === 'announcements').map(call => call.offset), [0, 20, 20]);
  passed.push('failed page keeps rows, shows actionable text, no automatic retry, explicit retry resumes');

  // Partial source failure keeps successful sources and retries only failed ones.
  await page.evaluate(() => { window.fx.fail = { help: 'timeout', health: 'denied' }; window.fx.sizes.help = 3; });
  await submit('partial');
  await page.getByText('Medical drives, Help articles could not be searched. Results may be incomplete.', { exact: true }).waitFor();
  assert.deepEqual(await rows('Announcements'), ['announcements 0', 'announcements 1', 'announcements 2']);
  assert.equal(await page.getByText(/denied|timeout|unavailable|\d{3}|PGRST/).count(), 0, 'No raw failure codes');
  await page.evaluate(() => { window.fx.fail = {}; window.fx.calls = []; });
  await page.getByRole('button', { name: 'Try the unavailable sources again', exact: true }).click();
  await page.getByRole('button', { name: 'See all Help articles', exact: true }).waitFor();
  assert.deepEqual((await calls()).map(call => call.category).sort(), ['health', 'help']);
  assert.equal(await page.getByText(/could not be searched/).count(), 0);
  passed.push('partial failure keeps successes; Try again re-requests only failed sources');

  // Every source failing, then an empty result set.
  await page.evaluate(() => { window.fx.fail = Object.fromEntries(['documents', 'announcements', 'health', 'help', 'requests', 'reports'].map(category => [category, 'offline'])); });
  await submit('offline');
  await page.getByText('You appear to be offline. Check your connection and try again.', { exact: true }).waitFor();
  assert.deepEqual((await page.getByRole('heading').allTextContents()).filter(Boolean), []);
  await page.evaluate(() => { window.fx.fail = {}; });
  await page.getByRole('button', { name: 'Try searching again', exact: true }).click();
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  await submit('nothing');
  await page.getByText('No results for “nothing”. Try different words.', { exact: true }).waitFor();
  await clickTab('Announcements');
  await page.getByText('No announcements match “nothing”.', { exact: true }).waitFor();
  passed.push('all-failed state with retry; empty All and empty category states');

  // Results open their own content: identifier routes, announcement ID and drive date.
  await submit('open');
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  await page.evaluate(() => { window.fx.opened = []; });
  for (const name of ['documents 1, Documents & services', 'requests 0, My requests', 'reports 2, My reports', 'announcements 1, Announcements', 'health 2, Medical drives']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.evaluate(() => { window.fx.sizes.help = 2; });
  await submit('help');
  await page.getByRole('button', { name: 'help 1, Help articles', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fx.opened), ['/services/documents-1', '/services/requests/requests-0', '/reports/reports-2',
    { pathname: '/announcements', params: { announcementId: 'announcements-1' } }, { pathname: '/health', params: { searchDate: '2026-11-12' } }, '/settings/help/help-1']);
  assert.deepEqual(await page.evaluate(() => window.fx.pushOptions), Array(4).fill({ withAnchor: true }), 'Stack results open anchored on their tab index');
  passed.push('all six result types open their content with the matching identifier or date');

  // Phase 5 — return, edit, Back. Explore stays mounted while hidden, like a native tab screen, and pushes really navigate.
  const nav = () => page.evaluate(() => ({ path: window.fx.path, history: window.fx.navigation.history.map(item => item.key.split('-')[0]), transitions: window.fx.transitions, goBacks: window.fx.goBacks, backs: window.fx.backs.size }));
  const emit = (tab, routes) => page.evaluate(([tab, routes]) => window.emitNav({ index: 0, routes: [{ key: tab, name: tab, state: { index: routes.length - 1, routes } }] }), [tab, routes]);
  const anchor = { key: 'anchor', name: 'index' };
  // The tab lands first, then its stack pushes the detail above the anchor; popping it leaves the anchor on top.
  const openAndReturn = async (name, tab, param) => {
    await page.getByRole('button', { name, exact: true }).click();
    await at('/' + tab);
    await emit(tab, [anchor]);
    await emit(tab, [anchor, { key: 'detail', name: 'detail', params: param }]);
    await emit(tab, [anchor]);
    await at('/explore');
  };
  await page.evaluate(() => { window.fx.keepMounted = true; window.fx.followPush = true; window.fx.opened = []; window.fx.pushOptions = []; });
  await submit('restore');
  await page.getByRole('button', { name: 'See all My reports', exact: true }).waitFor();
  await clickTab('My reports');
  await loaded('My reports', 20);
  await page.getByRole('button', { name: 'Load more My reports', exact: true }).click();
  await loaded('My reports', 21);
  const restoreCalls = (await calls()).length;
  const restoreRows = await rows('My reports');
  const atExplore = await nav();
  for (const [name, tab, param] of [['reports 20, My reports', 'reports', { incidentId: 'reports-20' }], ['reports 3, My reports', 'reports', { incidentId: 'reports-3' }]]) {
    const goBacks = (await nav()).goBacks;
    await openAndReturn(name, tab, param);
    assert.equal((await nav()).goBacks - goBacks, 1, 'One return per popped detail');
    assert.deepEqual((await tabs()).find(([, selected]) => selected), ['My reports', true], 'Category restored');
    await loaded('My reports', 21);
    assert.deepEqual(await rows('My reports'), restoreRows, 'Loaded IDs restored');
    assert.equal(await input.inputValue(), 'restore', 'Query restored');
    assert.deepEqual((await nav()).history, atExplore.history, 'No extra retained route');
  }
  assert.equal((await calls()).length, restoreCalls, 'Returning makes no request');
  // Covered by a stack detail, the list is resized (native: the shared header hides; here: display none) and its
  // offset near the end is clamped or lost; the return puts the offset back.
  const listScroll = (update) => page.evaluate(update => {
    let node = document.querySelector('[aria-label="reports 0, My reports"]') ?? document.querySelector('[aria-label$=", My reports"]');
    while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) node = node.parentElement;
    if (update) node.scrollTop = node.scrollHeight;
    return { top: Math.round(node.scrollTop), atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 1 };
  }, update);
  await page.setViewportSize({ width: 360, height: 640 });
  await settle();
  // Virtualized cells keep arriving after a scroll; repeat until the offset really is the end.
  let end = await listScroll(true);
  for (let attempt = 0; attempt < 10 && !(end.atEnd && end.top > 0); attempt++) { await settle(); end = await listScroll(true); }
  await settle();
  const bottom = (await listScroll(false)).top;
  assert.ok(end.atEnd && bottom > 0, `List scrolled to its end (${bottom})`);
  // Android keeps the clamp it applies while the list is taller; Chrome restores the old offset on its own, so
  // commit the clamped offset (and its scroll event) while covered, as Android does.
  await page.getByRole('button', { name: 'reports 20, My reports', exact: true }).click();
  await at('/reports');
  await emit('reports', [anchor]);
  await emit('reports', [anchor, { key: 'detail', name: 'detail', params: { incidentId: 'reports-20' } }]);
  await settle();
  const clamped = await page.evaluate(() => {
    let node = document.querySelector('[aria-label$=", My reports"]');
    while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) node = node.parentElement;
    const top = node.scrollTop;
    node.scrollTop = top - 1;
    node.scrollTop = top;
    return Math.round(top);
  });
  assert.ok(clamped < bottom, `Covered list clamps its offset (${clamped} < ${bottom})`);
  await settle();
  await emit('reports', [anchor]);
  await at('/explore');
  await settle();
  assert.equal((await listScroll(false)).top, bottom, 'Offset near the end restored after a stack return');
  await page.setViewportSize({ width: 360, height: 4000 });
  await settle();
  // Tab-screen results (announcements, drives) return through the tab history; the header claims Back only while searching.
  await clickTab('All');
  await page.getByRole('button', { name: 'announcements 1, Announcements', exact: true }).click();
  await at('/announcements');
  assert.equal((await nav()).backs, 0, 'No search Back handler outside search');
  assert.equal(await page.evaluate(() => window.hardwareBack()), false);
  await at('/explore');
  assert.deepEqual((await tabs()).find(([, selected]) => selected), ['All', true]);
  assert.equal((await calls()).length, restoreCalls);
  passed.push('stack and tab results return to Explore with query, category, loaded IDs and an end-of-list offset; one goBack, no request, no extra route');

  // A detail that is not simply popped (moved on, replaced) never pulls the resident back to Explore.
  await clickTab('My reports');
  await loaded('My reports', 21);
  const goBacksBefore = (await nav()).goBacks;
  await page.getByRole('button', { name: 'reports 4, My reports', exact: true }).click();
  await at('/reports');
  await emit('reports', [anchor, { key: 'detail', name: 'detail', params: { incidentId: 'reports-4' } }]);
  await emit('reports', [anchor, { key: 'next', name: 'other' }]);
  await emit('reports', [anchor]);
  await page.evaluate(() => window.dispatch({ type: 'GO_BACK' }));
  await at('/explore');
  await page.getByRole('button', { name: 'reports 5, My reports', exact: true }).click();
  await at('/reports');
  await emit('reports', [anchor, { key: 'detail', name: 'detail', params: { incidentId: 'reports-5' } }]);
  await page.evaluate(() => window.emitNav({ index: 0, routes: [{ key: 'home', name: 'home' }] }));
  await emit('reports', [anchor]);
  await page.evaluate(() => window.dispatch({ type: 'GO_BACK' }));
  await at('/explore');
  assert.equal((await nav()).goBacks, goBacksBefore, 'Replaced or abandoned details do not trigger a return');
  passed.push('replaced or abandoned details never trigger a return');

  // Foreground/realtime profile refreshes keep the same results instance.
  await page.evaluate(() => { window.fx.refreshing = true; window.refresh(); });
  await settle();
  await page.evaluate(() => { window.fx.refreshing = false; window.refresh(); });
  await settle();
  await loaded('My reports', 21);
  assert.equal((await calls()).length, restoreCalls, 'A profile refresh does not restart the search');
  passed.push('profile refresh (resume) keeps results, category and pages');

  // Focusing Explore's field edits in the entry with the submitted query; Search replaces the session.
  await input.click();
  await at('/search');
  assert.equal(await input.inputValue(), 'restore');
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'INPUT', 'Entry keeps the keyboard for editing');
  assert.deepEqual((await nav()).history, atExplore.history.slice(0, -1), 'Editing pops Explore rather than stacking the entry');
  assert.equal(await page.getByRole('tab').count(), 0, 'Entry shows suggestions, not results');
  await page.evaluate(() => { window.fx.calls = []; });
  await input.fill('restore again');
  await input.press('Enter');
  await at('/explore');
  await page.getByRole('button', { name: 'See all My reports', exact: true }).waitFor();
  assert.deepEqual((await tabs()).find(([, selected]) => selected), ['All', true], 'A new submission starts at All');
  assert.deepEqual((await calls()).map(call => [call.offset, call.query]), Array(6).fill([0, 'restore again']), 'New results: one first page per source');
  assert.deepEqual((await nav()).history, atExplore.history);
  // X opens an empty entry.
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await at('/search');
  assert.equal(await input.inputValue(), '');
  await page.getByRole('heading', { name: 'Suggested searches' }).waitFor();
  await input.fill('restore');
  await input.press('Enter');
  await at('/explore');
  passed.push('focus edits in entry with the query; Search replaces results; X opens an empty entry; no duplicate routes');

  // Android Back: Explore → entry (query kept) → origin, clearing the session; ten edit/submit/open/back cycles stay bounded.
  for (let cycle = 0; cycle < 10; cycle++) {
    const start = await nav();
    await page.evaluate(() => { window.fx.calls = []; });
    await input.click();
    await at('/search');
    await input.press('Enter');
    await at('/explore');
    await page.getByRole('button', { name: 'See all My reports', exact: true }).waitFor();
    await openAndReturn('reports 0, My reports', 'reports', { incidentId: 'reports-0' });
    assert.equal(await page.evaluate(() => window.hardwareBack()), true);
    await at('/search');
    assert.equal(await input.inputValue(), 'restore', 'Back keeps the query in the entry');
    await input.press('Enter');
    await at('/explore');
    await page.getByRole('button', { name: 'See all My reports', exact: true }).waitFor();
    const end = await nav();
    assert.deepEqual(end.history, start.history, `cycle ${cycle}: history returns to its start`);
    assert.equal(end.transitions - start.transitions, 6, `cycle ${cycle}: edit, submit, open, return, Back, submit`);
    assert.equal((await calls()).length, 12, `cycle ${cycle}: two submissions, six first pages each`);
    assert.equal(end.backs, 1, `cycle ${cycle}: one Back handler while searching`);
  }
  // Leaving search mid-request aborts the obsolete pages.
  await page.evaluate(() => { window.fx.hold = true; window.fx.calls = []; });
  await input.click();
  await at('/search');
  await input.press('Enter');
  await at('/explore');
  await page.getByText('Searching…', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.hardwareBack()), true);
  await at('/search');
  assert.equal(await page.evaluate(() => window.hardwareBack()), true);
  await at('/home');
  assert.equal(await page.evaluate(() => window.draft.submittedQuery), null, 'Leaving search clears the submitted session');
  assert.deepEqual(await page.evaluate(() => window.fx.calls.map(call => call.signal.aborted)), Array(6).fill(true), 'Pending pages are aborted');
  await page.evaluate(() => { window.fx.hold = false; for (const call of window.fx.calls) call.settle(); });
  assert.equal((await nav()).backs, 0, 'Back handler removed after leaving search');
  // Opening a result in the origin's own tab moves that tab to the end of the tab history; Back still returns to the origin.
  await page.evaluate(() => window.dispatch({ type: 'NAVIGATE', payload: { name: 'services' } }));
  await at('/services');
  const beforeSearch = (await nav()).history;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await at('/search');
  await input.fill('restore');
  await input.press('Enter');
  await at('/explore');
  await openAndReturn('documents 0, Documents & services', 'services', { documentId: 'documents-0' });
  assert.equal(await page.evaluate(() => window.hardwareBack()), true);
  await at('/search');
  assert.equal(await page.evaluate(() => window.hardwareBack()), true);
  await at('/services');
  assert.deepEqual((await nav()).history, beforeSearch, 'Back lands on the origin and leaves no search entry in history');
  passed.push('origin survives a result opened in its own tab');
  await page.evaluate(() => { window.fx.keepMounted = false; window.fx.followPush = false; window.fx.exploreVisited = false; window.refresh(); });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await at('/search');
  await input.fill('restore');
  await input.press('Enter');
  await at('/explore');
  passed.push('Android Back Explore → entry → origin; ten edit/submit/open/return/Back cycles with bounded history, transitions and requests');

  // Guests see only public sources and make no personal-source requests.
  await page.getByRole('button', { name: 'Back from search', exact: true }).click();
  await at('/search');
  await page.evaluate(() => { window.fx.user = null; window.refresh(); });
  await page.waitForFunction(() => window.draft.query === '');
  await submit('guest');
  await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
  assert.deepEqual((await tabs()).map(([name]) => name), ['All', 'Documents & services', 'Announcements', 'Medical drives', 'Help articles']);
  assert.deepEqual((await calls()).map(call => call.category), ['documents', 'announcements', 'health', 'help']);
  passed.push('guest tabs and requests exclude personal sources');

  // Small display, both themes and larger text: controls stay inside the viewport, have labels and meet 44 dp.
  await page.evaluate(() => { window.fx.user = 'u1'; window.refresh(); });
  await page.setViewportSize({ width: 360, height: 640 });
  for (const [mode, textScale] of [['light', 1], ['dark', 1], ['light', 1.3], ['dark', 1.3]]) {
    await page.evaluate(([mode, textScale]) => { window.fx.mode = mode; window.fx.textScale = textScale; window.fx.accent = mode === 'dark' ? '#F59E0B' : '#0F6E5B'; }, [mode, textScale]);
    await submit('layout');
    await page.getByRole('button', { name: 'See all Announcements', exact: true }).waitFor();
    await settle();
    const audit = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('[role="button"],[role="tab"]')].filter(node => !node.closest('[aria-hidden="true"]'));
      return controls.map(node => { const box = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label') ?? '', width: box.width, height: box.height, left: box.left, right: box.right, text: node.textContent }; })
        .filter(control => control.width > 0);
    });
    for (const control of audit) {
      assert.ok(control.label, `Control has a label: ${control.text}`);
      assert.ok(control.height >= 44 && control.width >= 44, `${mode} x${textScale}: ${control.label} is at least 44 dp (${control.width} x ${control.height})`);
    }
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `${mode} x${textScale}: no horizontal page overflow`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('[aria-label$=", Announcements"] div[dir="auto"]')].filter(node => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflow !== 'hidden').length);
    assert.equal(clipped, 0, `${mode} x${textScale}: result text wraps or truncates inside rows`);
    const colors = await page.evaluate(() => { const row = document.querySelector('[aria-label="announcements 0, Announcements"] div[dir="auto"]'); return { text: getComputedStyle(row).color, background: getComputedStyle(document.querySelector('#root > div > div:last-child') ?? document.body).backgroundColor }; });
    assert.notEqual(colors.text, colors.background);
    await page.screenshot({ path: path.join(out, `explore-${mode}-x${textScale}.png`) });
  }
  passed.push('360 x 640 light/dark at 1.0 and 1.3 text: labelled 44 dp controls, no overflow, themed colors');

  // See all on the last section selects a tab that starts outside the narrow tab row; the row scrolls it into view.
  const selectedTabInView = () => page.evaluate(() => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    let row = tab.parentElement;
    while (row && !['auto', 'scroll'].includes(getComputedStyle(row).overflowX)) row = row.parentElement;
    const [box, frame] = [tab.getBoundingClientRect(), row.getBoundingClientRect()];
    return { label: tab.getAttribute('aria-label'), inView: box.left >= frame.left && box.right <= frame.right };
  });
  await submit('layout');
  // My reports is the last nonempty section of this fixture, so its tab sits at the far end of the row.
  const lastSeeAll = page.getByRole('button', { name: 'See all My reports', exact: true });
  await lastSeeAll.waitFor();
  const lastLabel = (await lastSeeAll.getAttribute('aria-label')).slice('See all '.length);
  const lastTab = await page.getByRole('tab', { name: lastLabel, exact: true }).evaluate(node => node.getBoundingClientRect().right);
  assert.ok(lastTab > 360, `${lastLabel} tab starts outside the 360 dp row (${lastTab})`);
  await lastSeeAll.click();
  await page.waitForFunction(label => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab?.getAttribute('aria-label') === label && tab.getBoundingClientRect().right <= window.innerWidth;
  }, lastLabel, { timeout: 5000 }).catch(() => {});
  assert.deepEqual(await selectedTabInView(), { label: lastLabel, inView: true }, 'See all scrolls its selected tab into view');
  passed.push('See all scrolls an off-screen category tab into view');

  await page.evaluate(() => window.unmount());
  assert.deepEqual(await page.evaluate(() => [window.navListeners(), window.fx.backs.size]), [0, 0], 'No navigation or Back listener outlives the screens');
  assert.deepEqual(errors, []);
  passed.push('no console errors or warnings');
  const results = { passed, errors, nativeVerified: false };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
