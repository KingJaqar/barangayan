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
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-pull-refresh-emergency-'));
fs.mkdirSync(out, { recursive: true });

// Part 1 bundles the real Emergency Info screen, Hub/Alerts/Scan/Family content and the real pull-refresh primitive.
// Part 2 bundles the four real emergency hooks. Data, session, router and native adapters are synthetic and the native
// RefreshControl is a recording fixture, so this proves wiring (which sources each tab reloads, whether a pull waits
// for them), not the touch gesture.
const reactNative = `import React from 'react';import {Animated as WebAnimated,Pressable as WebPressable,View as WebView} from 'react-native-web';export * from 'react-native-web';export const Animated={...WebAnimated,timing:(value,config)=>WebAnimated.timing(value,{...config,useNativeDriver:false}),spring:(value,config)=>WebAnimated.spring(value,{...config,useNativeDriver:false})};export const Pressable=React.forwardRef(({accessibilityState,...props},ref)=><WebPressable {...props} ref={ref} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy} aria-expanded={accessibilityState?.expanded}/>);export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,accessibilityViewIsModal,...props},ref)=><WebView {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>);export const RefreshControl=({children,style,...p})=>{const ref=React.useRef(p);ref.current=p;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};`;
const nothing = name => `import React from 'react';export const ${name}=()=>null;`;
const source = (hook, name, key, extra = '') => `export const ${hook}=()=>({${key}:window.fixture.${key},isLoading:false,loading:false,error:null,isOffline:false,refetch:window.run('${name}')${extra}});`;
const screenMocks = {
  'react-native': reactNative,
  '@barangayan/shared': `export {qrStepItemSchema} from '${shared}/schemas/emergency-qr.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `export const useIsFocused=()=>true;export const useLocalSearchParams=()=>({});`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,isLoading:false,error:null,refetch:window.run('profile')});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'system'});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors.light,resident:getResidentTheme('light','#0F6E5B')});`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:'light',accentColor:'#0F6E5B'});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  '@/hooks/use-emergency-guidelines': source('useEmergencyGuidelines', 'guidelines', 'guidelines'),
  '@/hooks/use-emergency-hotlines': source('useEmergencyHotlines', 'hotlines', 'hotlines'),
  '@/hooks/use-emergency-announcements': `export const useEmergencyAnnouncements=()=>({items:window.fixture.alerts,loading:false,error:null,isOffline:false,refetch:window.run('alerts')});`,
  '@/hooks/use-emergency-qr-content': source('useEmergencyQrContent', 'qr', 'content'),
  '@/hooks/use-profile-household-members': `export const useProfileHouseholdMembers=()=>({members:[],isLoading:false,error:null,saveError:null,needsReload:false,refetch:window.run('members'),addMember:async()=>null,updateMember:async()=>null,removeMember:async()=>false});`,
  '@/hooks/use-household-attendance': `export const useHouseholdAttendance=()=>({attendance:null,loading:false,error:null,refetch:window.run('attendance')});`,
  '@/hooks/use-evacuation-centers': `export const useEvacuationCenters=()=>({centers:[],isLoading:false,error:null,refetch:async()=>{}});`,
  '@/hooks/use-device-location': `export const useDeviceLocation=()=>({state:{origin:null}});`,
  '@/components/evacuation-centers-panel': `import React from 'react';import {Text} from 'react-native';export const CentersContent=()=><Text>Synthetic centers panel</Text>;`,
  '@/components/guest-auth-callout': `import React from 'react';import {Text} from 'react-native';export const GuestAuthCallout=({message})=><Text>{message}</Text>;`,
  '@/components/family-member-modal': nothing('FamilyMemberModal'),
  '@/components/household-qr-modal': nothing('HouseholdQrModal'),
  '@/components/qr-scanner-overlay': nothing('QrScannerOverlay'),
  '@/components/qr-permission-modal': nothing('QrPermissionModal'),
  '@/components/qr-show-modal': nothing('QrShowModal'),
  '@/components/drrm/household-code': nothing('HouseholdCode'),
  'react-native-reanimated': `import React,{useRef} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const FadeIn={duration:()=>undefined};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withSpring=value=>value;export const cancelAnimation=()=>{};export const interpolateColor=(value,input,output)=>output[value>=.5?1:0];export const Easing={bezier:()=>undefined};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size,style})=><View style={[{width:size,height:size,flexShrink:0},style]}/>;Ionicons.glyphMap={};`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';`,
};

const hookMocks = {
  'react-native': reactNative,
  '@barangayan/shared': `export const ANNOUNCEMENT_CATEGORY_META={};`,
  '@/lib/emergency-cache': `export const getCachedData=async()=>null;export const setCachedData=async()=>{};`,
  '@/lib/realtime-channel': `export const uniqueChannelName=name=>name;`,
  '@/lib/supabase': String.raw`export const supabase={from(table){const query={select(){return query;},eq(){return query;},is(){return query;},order(){return query;},then(done,fail){const f=window.fixture;f.requests.push(table);return (async()=>{if(f.hold)await new Promise(r=>f.waiters.push(r));return f.fail?{data:null,error:{message:'Synthetic failure'}}:{data:structuredClone(f.rows[table]),error:null};})().then(done,fail);}};return query;},channel(){const channel={on(){return channel;},subscribe(){return channel;}};return channel;},removeChannel(){}};`,
};

const plugin = mocks => ({ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
} });
const common = { bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' }, define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' } };

await build({
  ...common,
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Screen from '${root}/app/(app)/home/emergency-info/index.tsx';
    window.fixture={session:{user:{id:'synthetic-resident'}},profile:{id:'synthetic-resident',barangay_id:'synthetic-barangay',full_name:'Synthetic Resident',last_name:'Resident',household_members:[]},
      guidelines:[{id:'g1',title:'Synthetic guideline',icon:'shield-outline',icon_color:'#2563EB',icon_bg:'#E7EEFC',body:'Body',content:['Step']}],hotlines:[],alerts:[],content:[],
      calls:[],hold:false,fail:{},waiters:[]};
    window.run=name=>async()=>{const f=window.fixture;f.calls.push(name);if(f.hold)await new Promise(r=>f.waiters.push(r));if(f.fail[name])throw Error('Synthetic '+name);};
    const root=createRoot(document.getElementById('root'));window.renderScreen=()=>root.render(<Screen/>);window.unmountScreen=()=>root.render(null);window.renderScreen();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'screen-bundle.js'),
  plugins: [plugin(screenMocks)],
});

await build({
  ...common,
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
    import {useEmergencyGuidelines} from '${root}/hooks/use-emergency-guidelines';import {useEmergencyHotlines} from '${root}/hooks/use-emergency-hotlines';
    import {useEmergencyAnnouncements} from '${root}/hooks/use-emergency-announcements';import {useEmergencyQrContent} from '${root}/hooks/use-emergency-qr-content';
    window.fixture={rows:{emergency_information:[{id:'old'}],announcements:[{id:'old'}],emergency_qr_content:[{id:'old'}]},requests:[],hold:false,fail:false,waiters:[]};
    function Probe(){const g=useEmergencyGuidelines('b');const h=useEmergencyHotlines('b');const a=useEmergencyAnnouncements();const q=useEmergencyQrContent('b');window.hooks={g,h,a,q};return null;}
    createRoot(document.getElementById('root')).render(<Probe/>);`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'hooks-bundle.js'),
  plugins: [plugin(hookMocks)],
});

const browserOptions = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!browserOptions.executablePath && !fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
const browser = await chromium.launch(browserOptions);
const errors = [];
const passed = [];
const shell = '<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>';
const watch = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
};
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 700 } });
  watch(page);
  await page.setContent(shell);
  await page.addScriptTag({ path: path.join(out, 'screen-bundle.js') });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const controls = () => page.evaluate(() => window.pullControls?.size ?? 0);
  const refreshing = () => page.evaluate(() => [...window.pullControls][0].current.refreshing);
  const calls = () => page.evaluate(() => [...window.fixture.calls].sort());
  const reset = () => page.evaluate(() => { window.fixture.calls = []; });
  const start = () => page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  const settled = () => page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  const pull = async () => { await reset(); await start(); await settled(); return calls(); };
  const release = () => page.evaluate(() => { window.fixture.hold = false; window.fixture.waiters.splice(0).forEach(r => r()); });

  await page.getByText('Synthetic guideline', { exact: true }).waitFor();
  assert.equal(await controls(), 1, 'the Hub scroller owns the only control');
  assert.deepEqual(await pull(), ['guidelines', 'hotlines'], 'a Hub pull reloads guidelines and hotlines only');
  assert.equal(await page.getByText('Synthetic guideline', { exact: true }).count(), 1, 'content stays on screen');
  passed.push('Hub pull reloads guidelines and hotlines, and nothing else');

  await page.evaluate(() => { window.fixture.fail.guidelines = true; });
  assert.deepEqual(await pull(), ['guidelines', 'hotlines'], 'one failing source does not stop the other');
  assert.equal(await refreshing(), false);
  await page.evaluate(() => { window.fixture.fail = {}; });
  passed.push('a rejected Hub source still lets the rest finish and the spinner end');

  await page.evaluate(() => { window.fixture.hold = true; });
  await reset();
  await start();
  await start();
  assert.equal(await refreshing(), true, 'the spinner shows while sources are loading');
  assert.deepEqual(await calls(), ['guidelines', 'hotlines'], 'a second pull in the same flight starts nothing');
  await release();
  await settled();
  passed.push('the spinner waits for the sources and a second pull in one flight is ignored');

  await tab('Alerts').click();
  assert.deepEqual(await pull(), ['alerts'], 'an Alerts pull reloads alerts only');
  assert.equal(await controls(), 1);
  passed.push('Alerts pull reloads the announcements source only');

  await tab('Scan').click();
  await page.getByText('QR Check-In Guide', { exact: true }).waitFor();
  assert.deepEqual(await pull(), ['qr'], 'a Scan pull reloads the QR instructions only');
  passed.push('Scan pull reloads the QR instructions only');

  await tab('Family').click();
  await page.getByText('Family Members', { exact: true }).waitFor();
  assert.deepEqual(await pull(), ['attendance', 'members'], 'a Family pull reloads members and attendance only');
  await page.evaluate(() => { window.fixture.hold = true; });
  await reset();
  await start();
  assert.equal(await refreshing(), true);
  await page.evaluate(() => { window.fixture.waiters.splice(0).forEach(r => r()); });
  await page.waitForFunction(() => window.fixture.calls.length === 2);
  assert.equal(await refreshing(), false, 'released sources end the pull');
  await release();
  passed.push('Family pull awaits members and attendance together');

  await tab('Alerts').click();
  assert.deepEqual(await pull(), ['alerts'], 'leaving Family unregisters its sources');
  passed.push('switching tabs leaves only the mounted tab\'s sources registered');

  await page.evaluate(() => { window.fixture.hold = true; });
  await reset();
  await start();
  await tab('Hub').click();
  await release();
  await settled();
  assert.deepEqual(await calls(), ['alerts'], 'a tab switch mid-pull neither adds nor repeats a source');
  passed.push('a tab switch mid-pull ends cleanly');

  await tab('Centers').click();
  await page.getByText('Synthetic centers panel', { exact: true }).waitFor();
  assert.equal(await controls(), 0, 'the Centers tab has no control');
  await tab('Hub').click();
  await page.getByText('Synthetic guideline', { exact: true }).waitFor();
  assert.equal(await controls(), 1);
  passed.push('Centers has no pull control and Hub gets exactly one back');

  await page.evaluate(() => { window.fixture.hold = true; });
  await reset();
  await start();
  await page.evaluate(() => window.unmountScreen());
  await release();
  await page.waitForTimeout(50);
  assert.equal(await controls(), 0);
  passed.push('unmounting mid-pull leaves no error');

  await page.evaluate(() => { window.fixture.session = null; window.renderScreen(); });
  await tab('Scan').click();
  await page.getByText(/to use QR scanning/).waitFor();
  assert.deepEqual(await pull(), [], 'a guest Scan pull reloads nothing and still ends');
  await tab('Family').click();
  await page.getByText(/to manage your household members/).waitFor();
  assert.deepEqual(await pull(), []);
  await tab('Hub').click();
  assert.deepEqual(await pull(), ['guidelines', 'hotlines'], 'public Hub content still reloads for guests');
  passed.push('guest tabs register nothing, Hub still reloads');
} finally {
  // Part 2 runs against fresh pages so a failure above still closes the browser.
}

try {
  const page = await browser.newPage();
  watch(page);
  await page.setContent(shell);
  await page.addScriptTag({ path: path.join(out, 'hooks-bundle.js') });
  await page.waitForFunction(() => window.hooks && !window.hooks.g.isLoading && !window.hooks.h.isLoading && !window.hooks.a.loading && !window.hooks.q.isLoading);
  const names = ['g', 'h', 'a', 'q'];
  const data = { g: 'guidelines', h: 'hotlines', a: 'items', q: 'content' };
  for (const key of names) {
    await page.evaluate(() => { window.fixture.hold = true; window.fixture.fail = false; window.fixture.rows = Object.fromEntries(Object.keys(window.fixture.rows).map(table => [table, [{ id: 'new' }]])); });
    const state = await page.evaluate(async ([key, field]) => {
      let done = false;
      const returned = window.hooks[key].refetch();
      const promise = Promise.resolve(returned).then(() => { done = true; });
      await new Promise(r => setTimeout(r, 40));
      const pendingWhileHeld = !done;
      window.fixture.hold = false;
      window.fixture.waiters.splice(0).forEach(r => r());
      await promise;
      await new Promise(r => setTimeout(r, 0));
      return { thenable: typeof returned?.then === 'function', pendingWhileHeld, id: window.hooks[key][field][0]?.id };
    }, [key, data[key]]);
    assert.deepEqual(state, { thenable: true, pendingWhileHeld: true, id: 'new' }, `${key} refetch resolves only after the response is applied`);
    await page.evaluate(() => { window.fixture.fail = true; });
    const failure = await page.evaluate(async key => { await window.hooks[key].refetch(); await new Promise(r => setTimeout(r, 0)); const h = window.hooks[key]; return { error: h.error, loading: h.isLoading ?? h.loading }; }, key);
    assert.deepEqual(failure, { error: 'Synthetic failure', loading: false }, `${key} refetch resolves on failure and keeps its error state`);
  }
  passed.push('all four emergency hooks return a promise that resolves after the response is applied, and also on failure');
} finally {
  await browser.close();
}
console.log(JSON.stringify({ passed, errors }, null, 2));
if (errors.length) process.exitCode = 1;
