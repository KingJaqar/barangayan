import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-shell-'));
fs.mkdirSync(out, { recursive: true });

// Real shell/header/inset components; navigation, account and native animation are
// local fixtures. This verifies React lifecycle, not native routing or motion timing.
const mocks = {
  'expo-router': `import React,{useEffect} from 'react';import {useFloatingTabInset} from '${root}/hooks/use-floating-tab-inset.ts';import {useEmergencyMapHeader} from '${root}/hooks/use-emergency-map-header.tsx';
    export const usePathname=()=>window.fx.path;
    export const router={navigate:path=>window.navigate(path),replace:path=>window.navigate(path),canGoBack:()=>true,back:()=>window.navigate(window.fx.returnTo??'/home')};
    export const useRouter=()=>router;
    const names=['home','services','drrm','maps','health','reports','settings','announcements','search'];
    export function Tabs({tabBar}){const {setActive}=useEmergencyMapHeader();const active=window.fx.isMap&&window.fx.path==='/drrm';useEffect(()=>{setActive(!!active);return()=>setActive(false)},[active,setActive]);const inset=useFloatingTabInset();const routes=names.map(name=>({name,key:name}));const state={routes,index:names.indexOf(window.fx.path.split('/')[1])};return <><div data-testid="inset">{inset}</div>{tabBar({state,navigation:{emit:event=>{window.fx.events.push(event);return {defaultPrevented:window.fx.prevent===event.target}},navigate:name=>window.navigate('/'+name)}})}</>}
    Tabs.Screen=()=>null;`,
  'react-native': `import React from 'react';import {Pressable as WebPressable,View as WebView} from 'react-native-web';export * from 'react-native-web';export const Pressable=({accessibilityState,...props})=><WebPressable {...props} aria-selected={accessibilityState?.selected}/>;export const View=({accessibilityElementsHidden,importantForAccessibility,...props})=><WebView {...props} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>;export const Keyboard={isVisible:()=>window.fx.keyboard,dismiss:()=>window.keyboard(false),addListener:(event,fn)=>{const listeners=window.fx.listeners[event]??=new Set();listeners.add(fn);return {remove:()=>listeners.delete(fn)}}};`,
  'react-native-reanimated': `import {useRef} from 'react';import {View,Text} from 'react-native';export default {View,Text};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const cancelAnimation=()=>{};export const interpolateColor=(value,range,colors)=>colors[value>=0.5?1:0];export {Easing} from 'react-native-web';`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:24,bottom:24,left:0,right:0});`,
  'expo-status-bar': `export const StatusBar=()=>null;`,
  'expo-image': `export {View as Image} from 'react-native-web';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native-web';export const Ionicons=({size})=><View style={{width:size,height:size}}/>;`,
  '@/components/drrm-tab-icon': `import React from 'react';import {View} from 'react-native-web';export const DrrmTabIcon=()=> <View style={{width:24,height:24}}/>;`,
  '@/constants/theme': `export const Fonts={gideonRoman:'serif',mono:'monospace'};export const Spacing={half:2,one:4,two:8,three:16,four:24};export const Colors={light:{accentRed:'#93000A'}};`,
  '@/constants/fonts': `export const getMobileFontFamily=()=>window.fx.font;`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fx.font});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';export const useTheme=()=>({primary:window.fx.accent,background:'#fff',text:'#222',textSecondary:'#666',accentRed:'#93000A',accentOrange:'#C2410C',accentGreen:'#166534',resident:getResidentTheme(window.fx.mode,window.fx.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fx.reduced;`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:{user:{id:'fixture'}}});`,
  '@/hooks/use-unread-counts': `import {useEffect} from 'react';export const useUnreadCounts=()=>({activeReportsCount:7,resolvedUnreadCount:3,announcementsUnreadCount:2});export function UnreadCountsProvider({children}){useEffect(()=>{window.fx.unreadMounts++;return()=>window.fx.unreadUnmounts++},[]);return children}`,
  '@/hooks/use-resident-search': `import React,{createContext,useContext,useEffect} from 'react';import {useSearchSession} from '${root}/hooks/use-search-session.ts';const Context=createContext(null);export const useSearchDraft=()=>useContext(Context);export function ResidentSearchProvider({children}){const session=useSearchSession('fixture');useEffect(()=>{window.fx.searchMounts++;return()=>window.fx.searchUnmounts++},[]);return <Context.Provider value={{...session,rememberSearch:()=>{}}}>{children}</Context.Provider>}`,
};
await build({
  stdin: { contents: `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import AppLayout from '${root}/app/(app)/_layout.tsx';window.fx={path:'/home',mode:'light',accent:'#0F6E5B',font:'sans-serif',reduced:true,keyboard:false,listeners:{},events:[],unreadMounts:0,unreadUnmounts:0,searchMounts:0,searchUnmounts:0,focusCalls:0};const focus=HTMLInputElement.prototype.focus;HTMLInputElement.prototype.focus=function(...args){window.fx.focusCalls++;return focus.apply(this,args)};window.keyboard=visible=>{window.fx.keyboard=visible;for(const fn of window.fx.listeners[visible?'keyboardDidShow':'keyboardDidHide']??[])fn()};function App(){const[n,render]=useState(0);window.refresh=()=>render(v=>v+1);window.navigate=path=>{window.fx.path=path;window.refresh()};return <AppLayout/>}const tree=createRoot(document.getElementById('root'));window.unmount=()=>tree.unmount();tree.render(<App/>);`, resolveDir: app, loader: 'tsx' },
  bundle: true, format: 'iife', outfile: path.join(out, 'bundle.js'), jsx: 'automatic',
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  loader: { '.png': 'dataurl' },
  plugins: [{ name: 'shell-fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const browserOptions = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!browserOptions.executablePath && !fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
const browser = await chromium.launch(browserOptions);
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const primary = page.getByRole('tablist', { name: 'Primary navigation' });
  await primary.waitFor();
  // Measure actual pressable bounds: an oversized child icon is not a touch target.
  const headerBounds = [];
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 720 });
    const buttons = [];
    for (const name of ['Search', 'View announcements, 2 unread', 'Open settings']) {
      const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
      assert.ok(bounds && bounds.width >= 48 && bounds.height >= 48, `${name}: minimum 48px target at ${width}px`);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `${name}: fully inside viewport`);
      buttons.push(bounds);
    }
    assert.ok(buttons[0].x + buttons[0].width <= buttons[1].x && buttons[1].x + buttons[1].width <= buttons[2].x, 'Header touch targets do not overlap');
    headerBounds.push({ width, buttons });
  }
  fs.writeFileSync(path.join(out, 'header-targets.json'), JSON.stringify(headerBounds, null, 2));
  await page.setViewportSize({ width: 360, height: 640 });
  for (const name of ['Services', 'Emergency', 'Maps', 'Health', 'Reports', 'Home']) {
    await primary.getByRole('tab', { name: new RegExp(`^${name}(,|$)`) }).click();
    await page.waitForFunction(name => [...document.querySelectorAll('[role="tab"]')].some(tab => tab.getAttribute('aria-label')?.startsWith(name) && tab.getAttribute('aria-selected') === 'true'), name);
    assert.equal(await primary.getByRole('tab', { selected: true }).count(), 1);
    assert.equal(await page.locator('input').count(), 0, `${name} must not retain a hidden header input`);
  }
  assert.equal(await page.evaluate(() => window.fx.focusCalls), 0, 'Normal tab navigation never requests keyboard focus');
  await page.evaluate(() => {
    for (const label of ['Services', 'Maps', 'Health', 'Reports']) {
      [...document.querySelectorAll('[role="tab"]')].find(tab => tab.getAttribute('aria-label')?.split(',')[0] === label).click();
    }
  });
  await page.waitForFunction(() => window.fx.path === '/reports');
  assert.equal(await primary.getByRole('tab', { selected: true }).getAttribute('aria-label'), 'Reports, 7 active reports, 3 unread resolved reports');
  await page.evaluate(() => { window.fx.prevent = 'services'; });
  await primary.getByRole('tab', { name: 'Services', exact: true }).click();
  assert.equal(await page.evaluate(() => window.fx.path), '/reports', 'Prevented tab press must not change destination or selection');
  assert.equal(await primary.getByRole('tab', { selected: true }).count(), 1);
  await page.evaluate(() => { window.fx.prevent = null; });
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.waitForFunction(() => window.fx.path === '/settings');
  assert.equal(await primary.getByRole('tab', { selected: true }).count(), 0);
  await page.getByRole('button', { name: 'View announcements, 2 unread', exact: true }).click();
  await page.waitForFunction(() => window.fx.path === '/announcements');
  assert.equal(await primary.getByRole('tab', { selected: true }).count(), 0);
  const inset = Number(await page.getByTestId('inset').textContent());
  assert.ok(inset > 88);
  await page.evaluate(() => window.keyboard(true));
  await primary.waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('inset').textContent(), '0');
  await page.evaluate(() => window.keyboard(false));
  await primary.waitFor();
  assert.equal(Number(await page.getByTestId('inset').textContent()), inset);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const input = page.getByPlaceholder('Search Barangayan', { exact: true });
  await input.fill('clearance');
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 720 });
    for (const name of ['Back from search', 'Clear search', 'Submit search']) {
      const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
      assert.ok(bounds && bounds.width >= 48 && bounds.height >= 48, `${name}: minimum 48px search target at ${width}px`);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `${name}: search target inside viewport`);
    }
  }
  await page.setViewportSize({ width: 360, height: 640 });
  await primary.waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('inset').textContent(), '0');
  const focuses = await page.evaluate(() => { document.querySelector('input').blur(); return window.fx.focusCalls; });
  await page.evaluate(() => { Object.assign(window.fx, {mode:'dark',accent:'#FFFFFF',font:'serif',reduced:false});window.refresh(); });
  await page.waitForFunction(() => document.querySelector('input').style.fontFamily === 'serif');
  assert.equal(await page.evaluate(() => window.fx.focusCalls), focuses, 'Appearance changes must not refocus Search');
  await page.getByRole('button', { name: 'Back from search', exact: true }).click();
  await primary.waitFor();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  assert.equal(await input.inputValue(), 'clearance');
  await page.waitForFunction(() => document.activeElement===document.querySelector('input'));
  await page.evaluate(() => { window.keyboard(true);window.navigate('/services'); });
  await primary.waitFor();
  assert.equal(await page.locator('input').count(), 0, 'Leaving Search removes the native input from Services');
  assert.equal(await page.evaluate(() => window.fx.keyboard), false, 'Leaving Search dismisses its keyboard');
  const serviceFocuses=await page.evaluate(() => window.fx.focusCalls);
  await page.evaluate(() => { window.refresh(); });
  assert.equal(await page.evaluate(() => window.fx.focusCalls), serviceFocuses, 'Refreshing Services must not refocus hidden search');
  await page.getByRole('button', { name:'Search', exact:true }).click();
  assert.equal(await input.inputValue(), 'clearance', 'The draft survives removal of the search input');
  await page.clock.install();
  await page.clock.fastForward(16_000);assert.equal(await page.evaluate(()=>window.fx.path),'/search','Other header searches retain their existing behavior');
  await page.evaluate(()=>{window.fx.isMap=true;window.fx.returnTo='/drrm';window.navigate('/drrm')});
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('button',{name:'Collapse header search',exact:true}).waitFor();
  await input.fill('evacuation');await page.clock.fastForward(14_000);await input.press('End');await page.clock.fastForward(14_000);
  assert.equal(await page.evaluate(()=>window.fx.path),'/search','Header interaction restarts the 15-second timer');
  await page.clock.fastForward(1_100);await page.getByRole('button',{name:'Search',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fx.path),'/drrm');
  await page.getByRole('button',{name:'Search',exact:true}).click();assert.equal(await input.inputValue(),'evacuation');
  await page.getByRole('button',{name:'Collapse header search',exact:true}).click();await page.getByRole('button',{name:'Search',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fx.path),'/drrm','Search icon immediately closes the field and returns to map');
  for (const route of ['/services/request/clearance', '/settings/profile', '/home/emergency-info/scan']) {
    await page.evaluate(route => window.navigate(route), route);
    assert.equal(await primary.count(), 0);
    assert.equal(await page.getByTestId('inset').textContent(), '0');
  }
  await page.evaluate(() => window.navigate('/home'));
  await primary.waitFor();
  await page.screenshot({ path: path.join(out, 'shell-dark-extreme.png') });
  assert.deepEqual(await page.evaluate(() => [window.fx.unreadMounts,window.fx.searchMounts,window.fx.unreadUnmounts,window.fx.searchUnmounts]), [1,1,0,0]);
  assert.deepEqual(await page.evaluate(() => Object.values(window.fx.listeners).map(set=>set.size)), [1,1]);
  await page.evaluate(() => window.unmount());
  assert.deepEqual(await page.evaluate(() => Object.values(window.fx.listeners).map(set=>set.size)), [0,0]);
  assert.deepEqual(errors, []);
  const result = { passed: ['six navigation actions and selected states without a hidden input or automatic keyboard focus', 'rapid accepted presses end on the last destination; prevented press preserves selection (synthetic navigation)', 'Settings/Announcements have no primary selection', 'keyboard removes/restores bar and measured clearance', 'Leaving Search for Services removes the input and dismisses the keyboard without losing the draft', 'Search/detail routes have no bar or phantom inset', 'appearance changes do not refocus Search', 'Search draft survives return', 'map header search idle collapse, interaction reset, icon collapse and query preservation; other header searches unchanged', 'providers remain mounted once', 'one keyboard listener pair, cleaned on unmount'], errors, nativeMotionVerified: false };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
