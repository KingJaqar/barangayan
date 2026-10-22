import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-android-magicpatterns-phase-9-20261020/ui');
fs.mkdirSync(out, { recursive: true });

// Real Phase9 components, theme/font primitives and reduced-motion hook.
// Only native/platform APIs are adapted. No network, live records or actual dialer.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityElementsHidden,importantForAccessibility,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null],'aria-hidden':accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-expanded={accessibilityState?.expanded} aria-busy={accessibilityState?.busy} aria-selected={accessibilityState?.selected}/>);
    export const ScrollView=React.forwardRef(({onScroll,onMomentumScrollEnd,onScrollEndDrag,...p},r)=><R.ScrollView {...p} ref={r} onScroll={e=>{onScroll?.(e);onMomentumScrollEnd?.(e)}}/>);
    export const Linking={openURL:async url=>{window.fixture.calls.push(url);if(window.fixture.callFailure)throw Error('Synthetic missing dialer');if(window.fixture.holdCall)await new Promise(resolve=>window.fixture.resolveCall=resolve);}};
    export const Keyboard={dismiss:()=>window.fixture.keyboardDismissals++};
    export const Platform={...R.Platform,OS:'android',select:options=>options.android??options.default};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(event,fn)=>{window.fixture.listeners.add(fn);return {remove:()=>window.fixture.listeners.delete(fn)}}};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size,name})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={'shield-outline':1,'flame-outline':2,'home-outline':3};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:window.fixture.mode,accentColor:window.fixture.accent});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@barangayan/shared': `export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ScrollView,View} from 'react-native';
    import {HubContent} from '${root}/components/drrm/hub-content';import {AlertsContent} from '${root}/components/drrm/alerts-content';import {useTheme} from '${root}/hooks/use-theme';
    function Surface({children}){const theme=useTheme();return <ScrollView style={{flex:1,backgroundColor:theme.background}} contentContainerStyle={{padding:20,paddingBottom:100}} keyboardShouldPersistTaps="handled"><View>{children}</View></ScrollView>}
    window.fixture={screen:'hub',mode:'light',accent:'#0F6E5B',font:'system',reduced:false,listeners:new Set(),durations:[],calls:[],keyboardDismissals:0,
      guidelines:[{id:'g1',title:'Synthetic managed guideline',icon:'shield-outline',icon_color:'#2563EB',icon_bg:'#E7EEFC',body:'Fallback body',content:['First managed step','Second managed step']},{id:'g2',title:'Synthetic second guideline',icon:'bad-icon',icon_color:'#D93A3A',icon_bg:'#FEE2E2',body:'Stored body fallback',content:null}],
      hotlines:[{id:'h1',title:'Synthetic hotline',icon:'flame-outline',icon_color:'#FFFFFF',icon_bg:'#F59E0B',content:[{label:'Synthetic number',number:'0000'}]},{id:'h2',title:'Missing number',icon:'bad-icon',icon_color:'#2563EB',icon_bg:'#E7EEFC',content:[null,'invalid']}],
      alerts:[{id:'a1',title:'Leap alert',body:'Stored leap body',published_at:new Date(2026,9,20,12).toISOString()},{id:'a2',title:'Future alert',body:'Stored future body',published_at:new Date(2038,9,20,12).toISOString()},{id:'a3',title:'Another leap year',body:'Stored old body',published_at:new Date(2020,1,29,12).toISOString()}],loading:false,error:null,offline:false,retries:0};
    const root=createRoot(document.getElementById('root'));let generation=0;
    window.renderDrrm=()=>{const f=window.fixture;const common={isLoading:f.loading,isOffline:f.offline,error:f.error,refetch:()=>{f.retries++;f.loading=false;f.error=null;f.offline=false;window.renderDrrm()}};
      root.render(<Surface key={generation}>
        {f.screen==='hub'?<HubContent guidelinesSource={{...common,guidelines:f.guidelines}} hotlinesSource={{...common,hotlines:f.hotlines}}/>:<AlertsContent {...common} alerts={f.alerts}/>}
      </Surface>);};
    window.resetDrrm=()=>{generation++;window.renderDrrm()};window.unmountDrrm=()=>root.render(null);window.renderDrrm();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'native-adapters', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const options = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.executablePath = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const browser = await chromium.launch(options);
const errors = [], passed = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 400, height: 844 } });
  await page.clock.install({ time: new Date(2026, 9, 20, 12) });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const render = async (patch = {}, reset = false) => page.evaluate(({ patch, reset }) => { Object.assign(window.fixture, patch); reset ? window.resetDrrm() : window.renderDrrm(); }, { patch, reset });
  const button = name => page.getByRole('button', { name, exact: true });
  const guideline = button('Synthetic managed guideline guidelines');
  await guideline.waitFor();
  await guideline.click();
  await page.getByText('First managed step', { exact: true }).waitFor();
  await page.waitForFunction(() => {const e=[...document.querySelectorAll('*')].find(e=>e.textContent==='First managed step');return e&&e.getBoundingClientRect().height>0});
  await button('Synthetic second guideline guidelines').click();
  assert.equal(await guideline.getAttribute('aria-expanded'), 'false');
  assert.equal(await button('Synthetic second guideline guidelines').getAttribute('aria-expanded'), 'true');
  await page.getByText('Stored body fallback', { exact: true }).waitFor();
  assert.ok((await page.evaluate(() => window.fixture.durations)).includes(200));
  assert.ok((await page.evaluate(() => window.fixture.durations)).includes(160));
  assert.equal(await button('Call Missing number').isDisabled(), true);
  await render({ callFailure: true });
  await button('Call Synthetic hotline').click();
  await page.getByText(/Could not open the phone app/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), ['tel:0000']);
  await render({ callFailure: false, holdCall: true });
  await button('Call Synthetic hotline').click();
  for (let i = 0; i < 4; i++) await button('Call Synthetic hotline').dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 2);
  await page.evaluate(() => {window.fixture.resolveCall();window.fixture.holdCall=false});
  passed.push('managed steps/body fallback, single-open state, unknown icons/JSON, missing dial number, one dispatch while pending and visible dialer failure');

  await render({ error: 'Synthetic failure', offline: true });
  await page.getByText('Unable to refresh guidelines. Showing available offline information.').waitFor();
  assert.equal(await page.getByText('Offline', { exact: true }).count(), 2);
  assert.equal(await page.getByText('Synthetic hotline', { exact: true }).count(), 1);
  await button('Retry').first().click();
  assert.equal(await page.evaluate(() => window.fixture.retries), 1);
  await page.screenshot({ path: path.join(out, 'hub-light.png'), fullPage: true });
  const listeners = await page.evaluate(() => window.fixture.listeners.size);
  for (let i = 0; i < 5; i++) { await guideline.click(); await button('Synthetic second guideline guidelines').click(); }
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), listeners);
  await render({ mode: 'dark', accent: '#FFFFFF', font: 'georgia' });
  assert.match(await page.getByText('Synthetic managed guideline', { exact: true }).evaluate(e => getComputedStyle(e).fontFamily), /serif/);
  await page.screenshot({ path: path.join(out, 'hub-dark-serif.png'), fullPage: true });
  passed.push('offline data retained with error/retry; repeated accordion changes keep listener count stable; dark/custom/font render');

  await render({ guidelines: [], hotlines: [], loading: true });
  await page.getByText('Loading guidelines…', { exact: true }).waitFor();
  await page.getByText('Loading hotlines…', { exact: true }).waitFor();
  await render({ loading: false });
  await page.getByText('No guidelines available.', { exact: true }).waitFor();
  await page.getByText('No hotlines available.', { exact: true }).waitFor();
  await render({ error: 'Synthetic failure' });
  await page.getByText('Unable to load guidelines.', { exact: true }).waitFor();
  await page.getByText('Unable to load hotlines.', { exact: true }).waitFor();
  passed.push('Hub loading, empty and unavailable sources remain separately visible');

  await render({ screen: 'alerts', error: null, offline: false, mode: 'light', accent: '#0F6E5B', font: 'system' });
  await page.getByText('Showing 3 of 3 alerts', { exact: true }).waitFor();
  await button('Filter by specific date').click();
  await page.getByTestId('alert-year-wheel').evaluate(e => { e.scrollTop=44; e.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(180);
  // Changes are drafts until Apply, and closing the picker discards that draft.
  await page.getByText('Showing 3 of 3 alerts', { exact: true }).waitFor();
  await button('Filter by specific date').click();
  await button('Filter by specific date').click();
  assert.equal(await page.getByRole('textbox', { name: 'Filter year', exact: true }).count(), 0);
  assert.equal(await page.getByTestId('alert-year-wheel').evaluate(e => e.scrollTop), 0);
  await page.getByTestId('alert-year-wheel').evaluate(e => { e.scrollTop=44; e.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(180);
  await button('Apply date filter').click();
  await page.getByText('Showing 1 of 3 alerts', { exact: true }).waitFor();
  await page.getByText('Any month · Any day · 2026', { exact: true }).waitFor();
  await button('Last Week').click();
  await page.getByText('Showing 1 of 3 alerts', { exact: true }).waitFor();
  await button('Clear date filter').click();
  assert.equal(await button('Last Week').getAttribute('aria-selected'), 'true');
  await button('All').click();
  await page.getByText('Showing 3 of 3 alerts', { exact: true }).waitFor();
  passed.push('date drafts/apply/collapse, independent period AND date, applied summary and clear without period reset');

  await button('Filter by specific date').click();
  // Exercise actual native-scroll callbacks through their scrollable RN Web surface.
  const scrollWheel = async (label, index) => {
    const wheel = page.getByTestId(`alert-${label}-wheel`);
    await wheel.evaluate((e, index) => {e.scrollTop=index*44;e.dispatchEvent(new Event('scroll'));}, index);
    await page.waitForTimeout(180);
  };
  await scrollWheel('month', 2);
  await scrollWheel('day', 29);
  await button('Apply date filter').click();
  await page.getByText('Feb · 29 · Any year', { exact: true }).waitFor();
  await page.getByText('Showing 1 of 3 alerts', { exact: true }).waitFor();
  await button('Filter by specific date').click();
  await scrollWheel('year', 1);
  assert.equal(await page.getByRole('textbox').count(), 0);
  assert.equal(await page.getByTestId('alert-year-wheel').innerText(), '\nAny\n2026'.trim());
  await button('Apply date filter').click();
  await page.getByText('No emergency alerts match your filter.', { exact: true }).waitFor();
  await button('Filter by specific date').click();
  // Let the expanding panel settle before clicking an action that moves with it.
  await page.waitForFunction(() => {
    const panel = document.querySelector('[aria-label="Filter by specific date"]').nextElementSibling;
    return panel.firstElementChild && Math.abs(panel.getBoundingClientRect().height - panel.firstElementChild.getBoundingClientRect().height) < 1;
  });
  await button('Clear').click();
  await page.getByText('Showing 3 of 3 alerts', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Filter by specific date"]').nextElementSibling.getBoundingClientRect().height === 0);
  await page.screenshot({ path: path.join(out, 'alerts-light.png'), fullPage: true });
  passed.push('scroll wheel month/day partial matching, timeline years from 2026, no typed-year input and Clear');

  await render({ error: 'Synthetic failure', offline: true });
  await page.getByText('Unable to refresh alerts. Showing available offline alerts.').waitFor();
  await page.getByText('Leap alert', { exact: true }).waitFor();
  await button('Retry').click();
  await render({ alerts: [], loading: true });
  await page.getByText('Loading emergency alerts…', { exact: true }).waitFor();
  await render({ loading: false });
  await page.getByText('No emergency alerts at this time.', { exact: true }).waitFor();
  await render({ error: 'Synthetic failure' });
  await page.getByText('Unable to load alerts.', { exact: true }).waitFor();
  passed.push('Alerts cached error/retry, loading, source-empty and filtered-empty feedback');

  await render({ error: null, mode: 'dark', font: 'georgia', accent: '#FFFFFF' });
  await page.evaluate(() => {window.fixture.reduced=true;window.fixture.listeners.forEach(fn=>fn(true));window.fixture.durations=[]});
  const alertListeners = await page.evaluate(() => window.fixture.listeners.size);
  for (let i = 0; i < 5; i++) { await button('Filter by specific date').click(); await button('Filter by specific date').click(); }
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), alertListeners);
  assert.ok((await page.evaluate(() => window.fixture.durations)).every(ms => ms === 0));
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 640 });
    await button('Filter by specific date').click();
    await page.getByTestId('alert-year-wheel').waitFor();
    assert.equal(await page.getByRole('textbox').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(out, `date-dark-${width}.png`), fullPage: true });
    await button('Filter by specific date').click();
  }
  await button('Filter by specific date').click();
  await page.clock.setSystemTime(new Date(2027, 0, 1));
  await page.clock.runFor(60_001);
  assert.equal(await page.getByTestId('alert-year-wheel').innerText(), 'Any\n2026\n2027');
  await button('Filter by specific date').click();
  await page.clock.setSystemTime(new Date(2029, 0, 1));
  await button('Filter by specific date').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="alert-year-wheel"]').textContent.includes('2029'));
  assert.equal(await page.getByTestId('alert-year-wheel').innerText(), 'Any\n2026\n2027\n2028\n2029');
  passed.push('open picker advances at New Year; reopening catches up through 2029 without typed or content-derived years');
  await page.evaluate(() => window.unmountDrrm());
  await page.waitForFunction(() => window.fixture.listeners.size === 0);
  assert.deepEqual(errors, []);
  passed.push('reduced motion removes geometry interpolation, five reversal cycles, compact widths and all owned accessibility listeners cleaned on unmount; no console errors/warnings');
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, errors, native: false }, null, 2));
  console.log(JSON.stringify({ passed, errors, out }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ passed, errors, body: await page?.locator('body').innerText() }, null, 2));
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
  throw error;
} finally { await browser.close(); }
