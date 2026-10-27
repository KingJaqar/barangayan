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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-pull-refresh-services-'));
fs.mkdirSync(out, { recursive: true });

// Real Services screen with its Documents, Logs and Requests lists and the real pull-refresh primitive.
// Data/session/router/native adapters are synthetic and the native RefreshControl is a recording fixture, so this
// proves wiring (which scroller owns the control, which sources a pull reloads), not the touch gesture.
const mocks = {
  'react-native': `import React from 'react';import {Pressable as WebPressable,View as WebView} from 'react-native-web';export * from 'react-native-web';export const Pressable=React.forwardRef(({accessibilityState,...props},ref)=><WebPressable {...props} ref={ref} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy}/>);export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><WebView {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>);export const RefreshControl=({children,style,...p})=>{const ref=React.useRef(p);ref.current=p;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};`,
  '@barangayan/shared': `export * from '${shared}/lib/service-catalog.ts';export * from '${shared}/lib/request-status.ts';export * from '${shared}/lib/format.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const useRouter=()=>({push:href=>window.fixture.routes.push(href)});export const useLocalSearchParams=()=>({});export const useFocusEffect=fn=>useEffect(fn,[fn]);export const Link=({href,children})=>{if(Array.isArray(children.props.style))throw new Error('Expo Router v57 Slot rejects child style arrays');return React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:false});`,
  '@/hooks/use-profile': `export const useProfile=()=>window.fixture.profileState;`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>true;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  './agency-sla-status': `import React from 'react';import {Text} from 'react-native';export const AgencySlaStatus=({requestId})=><Text>Agency processing clock: {requestId}</Text>;`,
  '@/lib/supabase': String.raw`export const supabase={from(table){let kind=table==='document_types'?'catalog':'requests',filters=[],orders=[],take=Infinity,options={};const query={select(columns,o={}){options=o;if(columns.includes('payments('))kind='logs';return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},in(k,v){filters.push(r=>v.includes(r[k]));return query;},not(k,op,v){const values=v.slice(1,-1).split(',');filters.push(r=>!values.includes(r[k]));return query;},or(expression){const m=expression.match(/^(created_at|updated_at)\.lt\.([^,]+),and\([^,]+,id\.lt\.([^)]+)\)$/);if(!m)throw Error('Invalid cursor');filters.push(r=>r[m[1]]<m[2]||r[m[1]]===m[2]&&r.id<m[3]);return query;},limit(n){take=n;return query;},abortSignal(){return query;},order(k,o={}){orders.push([k,o]);return query;},then(done,fail){window.fixture.queries.push(kind);let data=structuredClone(kind==='catalog'?window.fixture.documents:window.fixture.requests).filter(r=>filters.every(f=>f(r)));const count=data.length;data.sort((a,b)=>{for(const [k,o]of orders){if(a[k]!==b[k])return (a[k]<b[k]?-1:1)*(o.ascending===false?-1:1)}return 0});return Promise.resolve({data:window.fixture.fail[kind]?null:data.slice(0,take),count:options.count?count:null,error:window.fixture.fail[kind]?{}:null}).then(done,fail);}};return query;},channel(name){const f=window.fixture;f.topics??=new Set();if(name.startsWith("my-service-requests-")&&f.topics.has(name))throw Error("Request channel reused during async removal");f.topics.add(name);const channel={name,on(event,filter,callback){channel.callback=callback;return channel;},subscribe(){window.fixture.channels.set(name,channel);return channel;}};return channel;},removeChannel(channel){window.fixture.channels.delete(channel.name);return new Promise(resolve=>setTimeout(()=>{window.fixture.topics.delete(channel.name);resolve()},40));}};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withSpring=value=>value;export const cancelAnimation=()=>{};export const interpolateColor=(value,input,output)=>output[value>=.5?1:0];export const Easing={bezier:()=>undefined};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size,style})=><View style={[{width:size,height:size,flexShrink:0},style]}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Services from '${root}/app/(app)/services/index.tsx';
    const profile={id:'synthetic-resident',id_verification_status:'verified',approved_id_submission_id:'synthetic-id',current_id_submission_id:'synthetic-id',id_repair_required:false};
    const documents=[{id:'free',name:'Free legacy service',contract_version:1,processing_target_hours:24,fee_centavos:0,is_active:true}];
    documents.forEach(doc=>{doc.is_active=true});const statuses=[['submitted','unpaid'],['submitted','paid'],['submitted','waived'],['in_progress','paid'],['ready_for_pickup','paid'],['completed','paid'],['cancelled','unpaid']];
    const requests=statuses.map(([status,payment_status],index)=>({id:'request-'+index,resident_id:'synthetic-resident',status,payment_status,reference_number:'SYNTHETIC-'+index,created_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-19T00:00:00Z',document_types:{name:'Service '+index,processing_target_hours:24,fee_centavos:10000},timing_model:index===6?'legacy':'agency_minutes_v1',contract_version:2,fee_assessment_state:index===0?'page_count_required':'assessed',assessed_amount_centavos:index===0?null:index===2?0:10000,payments:index===1?[{status:'paid',document_fee_centavos:7500,amount_centavos:7500}]:[]}));
    window.fixture={session:{user:{id:'synthetic-resident'}},profileState:{profile,isLoading:false,error:null,refetch:()=>{window.fixture.retries++;}},mode:'light',accent:'#0F6E5B',fontId:'system',documents,requests,fail:{},channels:new Map(),queries:[],routes:[],retries:0};
    const root=createRoot(document.getElementById('root'));let generation=0;window.renderServices=()=>root.render(<Services key={generation}/>);window.resetServices=()=>{generation++;window.renderServices();};window.refreshLists=()=>{for(const channel of window.fixture.channels.values())channel.callback();};window.renderServices();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_PUBLIC_QRPH_SETTLEMENT_READY': '"false"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const browserOptions = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!browserOptions.executablePath && !fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
const browser = await chromium.launch(browserOptions);
const errors = [];
const passed = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const controls = () => page.evaluate(() => window.pullControls.size);
  const queries = () => page.evaluate(() => [...window.fixture.queries]);
  const reset = () => page.evaluate(() => { window.fixture.queries = []; window.fixture.retries = 0; });
  const pull = async kind => {
    await page.evaluate(() => [...window.pullControls][0].current.onRefresh());
    await page.waitForFunction(k => window.fixture.queries.includes(k), kind);
    await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  };

  await page.getByText('Free legacy service', { exact: true }).waitFor();
  assert.equal(await controls(), 1, 'the Services scroller owns the only control');
  await reset();
  await pull('catalog');
  assert.deepEqual([...new Set(await queries())], ['catalog'], 'a Documents pull reloads only the catalog');
  assert.equal(await page.evaluate(() => window.fixture.retries), 1, 'the profile is reloaded with it');
  passed.push('Documents pull reloads the catalog and the profile once');

  await page.evaluate(() => { window.fixture.documents.push({ id: 'added', name: 'Added synthetic service', contract_version: 1, processing_target_hours: 24, fee_centavos: 0, is_active: true }); });
  await pull('catalog');
  await page.getByText('Added synthetic service', { exact: true }).waitFor();
  passed.push('Documents pull shows a catalog change');

  await page.evaluate(() => { window.fixture.fail.catalog = true; });
  await reset();
  await pull('catalog');
  assert.equal(await page.getByText('Free legacy service', { exact: true }).count(), 1, 'a failed pull keeps the list');
  assert.equal(await page.getByText('Could not load the service catalog. Reconnect and retry.', { exact: true }).count(), 0, 'a failed pull adds no error view');
  await page.evaluate(() => { window.fixture.fail.catalog = false; });
  passed.push('failed Documents pull keeps the list and shows no error');

  await tab('Logs').click();
  await page.waitForFunction(() => window.fixture.queries.includes('logs'));
  await reset();
  assert.equal(await controls(), 1, 'Logs uses the Services scroller only');
  await pull('logs');
  assert.deepEqual([...new Set(await queries())], ['logs'], 'a Logs pull reloads activity, not the catalog');
  assert.equal(await page.evaluate(() => window.fixture.retries), 1);
  passed.push('Logs pull reloads activity and the profile, not the catalog');

  await tab('Requests').click();
  await page.getByRole('button', { name: /^Service \d+$/ }).first().waitFor();
  await reset();
  assert.equal(await controls(), 1, 'Requests owns its scroller, so the Services scroller is not mounted');
  await pull('requests');
  assert.deepEqual([...new Set(await queries())], ['requests'], 'a Requests pull reloads requests');
  assert.equal(await page.evaluate(() => window.fixture.retries), 1);
  assert.equal(await page.getByRole('button', { name: /^Service \d+$/ }).count(), 9, 'rows stay on screen through the pull (All shows overlapping open-work sections)');
  passed.push('Requests pull reloads the request list and the profile once');

  await tab('Documents').click();
  await page.getByText('Free legacy service', { exact: true }).waitFor();
  assert.equal(await controls(), 1);
  passed.push('segment switching leaves exactly one control mounted');
} finally {
  await browser.close();
}
console.log(JSON.stringify({ passed, errors }, null, 2));
if (errors.length) process.exitCode = 1;
