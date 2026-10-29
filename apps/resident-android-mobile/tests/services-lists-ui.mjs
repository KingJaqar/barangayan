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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-services-lists-'));
fs.mkdirSync(out, { recursive: true });

// Real screen, lists, status/fee contracts, text, panels, chips and overflow controls.
// Data/session/router and native animation adapters are explicit synthetic fixtures.
const mocks = {
  'react-native': `import React from 'react';import {Pressable as WebPressable,View as WebView} from 'react-native-web';export * from 'react-native-web';export const Pressable=React.forwardRef(({accessibilityState,...props},ref)=><WebPressable {...props} ref={ref} aria-selected={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded} aria-busy={accessibilityState?.busy}/>);export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><WebView {...props} ref={node=>{if(node)node.testOnLayout=props.onLayout;if(typeof ref==='function')ref(node);else if(ref)ref.current=node}} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>);`,
  '@barangayan/shared': `export * from '${shared}/lib/service-catalog.ts';export * from '${shared}/lib/request-status.ts';export * from '${shared}/lib/format.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const useRouter=()=>({push:href=>window.fixture.routes.push(href)});export const useLocalSearchParams=()=>({});export const useFocusEffect=fn=>useEffect(fn,[fn]);export const Link=({href,children})=>{if(Array.isArray(children.props.style))throw new Error('Expo Router v57 Slot rejects child style arrays');return React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:false});`,
  '@/hooks/use-profile': `export const useProfile=()=>window.fixture.profileState;`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reducedMotion??true;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  './agency-sla-status': `import React from 'react';import {Text} from 'react-native';export const AgencySlaStatus=({requestId})=><Text>Agency processing clock: {requestId}</Text>;`,
  '@/lib/supabase': String.raw`export const supabase={from(table){let kind=table==='document_types'?'catalog':'requests',filters=[],orders=[],take=Infinity,options={};const query={select(columns,o={}){options=o;if(columns.includes('payments('))kind='logs';return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},in(k,v){filters.push(r=>v.includes(r[k]));return query;},not(k,op,v){const values=v.slice(1,-1).split(',');filters.push(r=>!values.includes(r[k]));return query;},or(expression){const m=expression.match(/^(created_at|updated_at)\.lt\.([^,]+),and\([^,]+,id\.lt\.([^)]+)\)$/);if(!m)throw Error('Invalid cursor');filters.push(r=>r[m[1]]<m[2]||r[m[1]]===m[2]&&r.id<m[3]);return query;},limit(n){take=n;return query;},abortSignal(){return query;},order(k,o={}){orders.push([k,o]);return query;},then(done,fail){window.fixture.queries.push(kind);let data=structuredClone(kind==='catalog'?window.fixture.documents:window.fixture.requests).filter(r=>filters.every(f=>f(r)));const count=data.length;data.sort((a,b)=>{for(const [k,o]of orders){if(a[k]!==b[k])return (a[k]<b[k]?-1:1)*(o.ascending===false?-1:1)}return 0});return Promise.resolve({data:window.fixture.fail[kind]?null:data.slice(0,take),count:options.count?count:null,error:window.fixture.fail[kind]?{}:null}).then(result=>window.fixture.holdRequests&&kind==='requests'?new Promise(resolve=>window.fixture.pendingRequests.push(()=>resolve(result))):result).then(done,fail);}};return query;},channel(name){const f=window.fixture;f.topics??=new Set();if(name.startsWith("my-service-requests-")&&f.topics.has(name))throw Error("Request channel reused during async removal");f.topics.add(name);const channel={name,on(event,filter,callback){channel.callback=callback;return channel;},subscribe(){window.fixture.channels.set(name,channel);return channel;}};return channel;},removeChannel(channel){window.fixture.channels.delete(channel.name);return new Promise(resolve=>setTimeout(()=>{window.fixture.topics.delete(channel.name);resolve()},40));}};`,
  'react-native-reanimated': `import React,{useRef,useReducer} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const useSharedValue=initial=>{const [,render]=useReducer(n=>n+1,0);const ref=useRef(null);if(!ref.current){let value=initial;ref.current={get value(){return value},set value(next){if(!Object.is(value,next)){value=next;render()}}}}return ref.current};export const useAnimatedStyle=fn=>fn();export const withTiming=(value,config)=>{window.fixture.motionRuns?.push(config);return value};export const withSpring=value=>value;export const cancelAnimation=()=>{};export const interpolateColor=(value,input,output)=>output[value>=.5?1:0];export {Easing} from 'react-native-web';`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size,style})=><View dataSet={{icon:name}} style={[{width:size,height:size,flexShrink:0},style]}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Services from '${root}/app/(app)/services/index.tsx';
    const profile={id:'synthetic-resident',id_verification_status:'verified',approved_id_submission_id:'synthetic-id',current_id_submission_id:'synthetic-id',id_repair_required:false};
    const documents=[{id:'fixed',name:'Certificate of Indigency',service_kind:'indigency',pricing_mode:'fixed',contract_version:2,processing_target_minutes:15,fee_centavos:10000},{id:'business',name:'Issuance of Barangay Clearance for Business Establishments',service_kind:'business',pricing_mode:'assessment',contract_version:2,processing_target_minutes:15,fee_centavos:0},{id:'pages',name:'Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)',service_kind:'certified_true_copy',pricing_mode:'per_page',contract_version:2,processing_target_minutes:15,fee_centavos:1000},{id:'free',name:'Free legacy service',pricing_mode:'fixed',contract_version:1,processing_target_hours:24,fee_centavos:0}];
    documents.forEach(doc=>{doc.is_active=true});const statuses=[['submitted','unpaid'],['submitted','paid'],['submitted','waived'],['in_progress','paid'],['ready_for_pickup','paid'],['completed','paid'],['cancelled','unpaid']];
    const requests=statuses.map(([status,payment_status],index)=>({id:'request-'+index,resident_id:'synthetic-resident',status,payment_status,reference_number:'SYNTHETIC-'+index,created_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-19T00:00:00Z',document_types:{name:'Service '+index,processing_target_hours:24,fee_centavos:10000},timing_model:index===6?'legacy':'agency_minutes_v1',contract_version:2,fee_assessment_state:index===0?'page_count_required':'assessed',assessed_amount_centavos:index===0?null:index===2?0:10000,payments:index===1?[{status:'paid',document_fee_centavos:7500,amount_centavos:7500}]:[]}));
    window.fixture={session:{user:{id:'synthetic-resident'}},profileState:{profile,isLoading:false,error:null,refetch:()=>{window.fixture.retries++;}},mode:'light',accent:'#0F6E5B',fontId:'system',documents,requests,fail:{},channels:new Map(),queries:[],routes:[],retries:0};
    const root=createRoot(document.getElementById('root'));let generation=0;window.renderServices=()=>root.render(<Services key={generation}/>);window.resetServices=()=>{generation++;window.renderServices();};window.refreshLists=()=>{for(const channel of window.fixture.channels.values())channel.callback();};window.renderServices();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { global: 'globalThis', __DEV__: 'false', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_PUBLIC_QRPH_SETTLEMENT_READY': '"false"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const browserOptions = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!browserOptions.executablePath && !fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
const browser = await chromium.launch(browserOptions);
const passed = [];
const errors = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  // Filter chips may carry a live count ("Active 2"), so match the label plus an optional number.
  const tab = name => page.getByRole('tab', { name: /^(All|Active|Pickup|History|Paid|Processing|Pending Payment|Certificates|Clearances|Business|Records)$/.test(name) ? new RegExp('^' + name + '( [0-9]+)?$') : name, exact: true });
  const requestRows = () => page.getByRole('button', { name: /^Service \d+$/ });
  await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).waitFor();
  assert.equal(await page.getByText('Available Documents', { exact: true }).count(), 0);
  await page.getByText('No payment required', { exact: true }).waitFor();
  await page.getByText('₱10.00 per page', { exact: true }).waitFor();
  await page.getByText('Varies', { exact: true }).waitFor();
  assert.equal(await page.getByText('See Attached Tax Code (depends on the kind of transaction)', { exact: true }).count(), 0, 'The long tax-code text belongs on the detail screen');
  await page.getByText('~15 min', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('15 minutes of agency processing').count(), 0);
  assert.equal(await page.getByRole('button', { name: /^(Certificate of Indigency|Issuance of Barangay Clearance.*|Reproduction.*|Free legacy service)$/ }).count(), 4);
  await tab('Business').click();
  assert.equal(await page.getByRole('button', { name: /^(Certificate of Indigency|Issuance of Barangay Clearance.*|Reproduction.*|Free legacy service)$/ }).count(), 1);
  await tab('Records').click();
  await page.getByRole('button', { name: /^Reproduction/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).count(), 0);
  // Keyboard activation avoids the overflow chevron covering a partly scrolled chip.
  await tab('All').press('Enter');
  await page.getByRole('button', { name: 'Free legacy service', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^(Certificate of Indigency|Issuance of Barangay Clearance.*|Reproduction.*|Free legacy service)$/ }).count(), 4);
  await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).click();
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/services/fixed');
  await page.screenshot({ path: path.join(out, 'documents-light.png') });
  const verifiedStatus=page.getByRole('button', { name: 'Show ID verification status', exact: true });
  await verifiedStatus.waitFor();
  const documentTop=(await page.getByRole('button',{name:'Certificate of Indigency',exact:true}).boundingBox()).y;
  assert.equal(await page.getByText('Valid ID verified', { exact: true }).count(), 0);
  await verifiedStatus.click();
  await page.getByText('Valid ID verified',{exact:true}).waitFor();
  assert.equal((await page.getByRole('button',{name:'Certificate of Indigency',exact:true}).boundingBox()).y,documentTop,'Opening verification does not shift the document list');
  await page.getByRole('button',{name:'Dismiss ID verification status',exact:true}).click({position:{x:5,y:5}});
  await page.getByText('Valid ID verified',{exact:true}).waitFor({state:'hidden'});
  await page.evaluate(() => { window.fixture.profileState.isLoading=true;window.renderServices(); });
  await page.getByRole('button', { name: 'Show ID verification status', exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.profileState.isLoading=false;window.renderServices(); });
  assert.equal(await page.getByText('Valid ID verified',{exact:true}).count(),0,'Background refresh does not open a verification row');
  passed.push('Catalog wording, free/fixed/per-page/assessment fees and guide destination');

  await tab('Requests').click();
  await requestRows().first().waitFor();
  await verifiedStatus.click();
  await page.getByText('Valid ID verified',{exact:true}).waitFor();
  assert.equal(await tab('Requests').getAttribute('aria-selected'),'true','The verification icon does not activate the Documents tab');
  await page.keyboard.press('Escape');
  await page.getByText('Valid ID verified',{exact:true}).waitFor({state:'hidden'});
  // "All" is five overlapping sections of open work: Active 4, Pickup 1, Pending 1, Paid 2, Processing 1.
  assert.equal(await requestRows().count(), 9);
  for (const title of ['Active Requests, 4', 'Pickup Requests, 1', 'Pending Payment, 1', 'Paid, 2', 'Processing, 1'])
    await page.getByRole('button', { name: title, exact: true }).waitFor();
  // Open sections use natural layout; a transient zero measurement cannot hide cards.
  const activeBody = page.getByRole('button', { name: 'Active Requests, 4', exact: true }).locator('..').locator(':scope > div').last();
  const activeContent = activeBody.locator(':scope > div');
  await page.waitForFunction(() => document.querySelector('[aria-label="Active Requests, 4"]').nextElementSibling.clientHeight > 0);
  await activeContent.getByRole('button', { name: 'Service 0', exact: true }).evaluate(node => { window.retainedRequestCard = node; });
  assert.ok((await activeBody.boundingBox()).height > 0, 'Expanded requests must be visible');
  await page.getByText('Pending Payment', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Previous timing model').count(), 0);
  assert.equal(await page.getByText('00:00:00').count(), 0);
  // Collapsing hides cards from interaction while retaining their mounted views.
  await page.getByRole('button', { name: 'Active Requests, 4', exact: true }).click();
  assert.equal(await requestRows().count(), 5);
  assert.equal(await page.evaluate(() => window.retainedRequestCard.isConnected), true, 'Collapsed cards stay mounted');
  await page.getByRole('button', { name: 'Active Requests, 4', exact: true }).click();
  assert.equal(await requestRows().count(), 9);
  assert.ok((await activeBody.boundingBox()).height > 0, 'Reopening restores visible cards');
  await page.evaluate(() => { window.fixture.reducedMotion=false;window.renderServices(); });
  const activeHeader = page.getByRole('button', { name: 'Active Requests, 4', exact: true });
  // Rapid taps must synchronously match the requested state, including when
  // system animations are enabled. No pending transition may remove reopened rows.
  for (let tap = 0; tap < 4; tap++) {
    await activeHeader.click();
    assert.equal(await activeHeader.getAttribute('aria-expanded'), String(tap % 2 !== 0));
    assert.equal(await requestRows().count(), tap % 2 === 0 ? 5 : 9);
  }
  await page.waitForFunction(() => {
    const header=document.querySelector('[aria-label="Active Requests, 4"]');
    return header.getAttribute('aria-expanded')==='true' && header.nextElementSibling?.clientHeight>0;
  });
  assert.equal(await requestRows().count(), 9);
  assert.ok((await activeBody.boundingBox()).height > 0);

  // Stable card identity removes remount work from repeated disclosure taps.
  assert.equal(await activeContent.getByRole('button', { name: 'Service 0', exact: true }).evaluate(node => node === window.retainedRequestCard), true);
  const expandedHeight = (await activeBody.boundingBox()).height;
  await activeContent.evaluate(node => node.testOnLayout({ nativeEvent: { layout: { height: 0 } } }));
  assert.equal((await activeBody.boundingBox()).height, expandedHeight, 'A transient zero measurement cannot hide retained cards');
  await page.evaluate(() => { window.fixture.reducedMotion=true;window.renderServices(); });
  passed.push('Retained card identity, UI-thread slide/fade adapter, zero-layout protection and rapid reversal');
  assert.equal(await page.getByText('My Requests', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Valid ID Verified', { exact: true }).count(), 0);
  // A complete overview paints a first-time filter immediately, even with its
  // network response held. Late replies cannot overwrite a newer selection.
  const requestChannel = await page.evaluate(() => [...window.fixture.channels.keys()]);
  await page.evaluate(() => { window.fixture.holdRequests=true;window.fixture.pendingRequests=[]; });
  await tab('Active').click();
  await page.waitForFunction(() => window.fixture.pendingRequests.length === 1);
  assert.equal(await requestRows().count(),4,'First Active view reuses loaded overview rows');
  assert.equal(await page.evaluate(()=>window.retainedRequestCard.isConnected),true,'All → Active keeps the existing active card tree');
  const statusTabs=tab('Pending Payment').locator('..');
  assert.equal(await statusTabs.getByRole('tab',{name:'All',exact:true}).innerText(),'All','The status All tab has no count');
  for(const [name,icon] of [['Pending Payment','time-outline'],['Paid','checkmark-circle-outline'],['Processing','sync-outline']])
    assert.equal(await tab(name).locator(`[data-icon="${icon}"]`).count(),1);
  assert.equal((await tab('Pending Payment').innerText()).trim(),'1','Pending Payment shows its count as a badge');
  for(const name of ['Paid','Processing'])assert.equal((await tab(name).innerText()).trim(),'','Other status tabs contain only an icon');
  await page.screenshot({path:path.join(out,'request-status-icon-tabs.png')});
  await tab('Pickup').press('Enter');
  await page.waitForFunction(() => window.fixture.pendingRequests.length === 2);
  assert.equal(await requestRows().count(),1,'First Pickup view reuses loaded overview rows');
  await page.getByRole('tablist',{name:'request filters',exact:true}).getByRole('tab',{name:'All',exact:true}).press('Enter');
  await page.evaluate(() => { window.fixture.holdRequests=false;window.fixture.pendingRequests.splice(0).forEach(reply=>reply()); });
  assert.equal(await requestRows().count(),9,'Late filter replies cannot replace the overview');
  assert.deepEqual(await page.evaluate(() => [...window.fixture.channels.keys()]),requestChannel,'Filter switches retain one realtime connection');
  await tab('Active').click();
  assert.equal(await requestRows().count(), 4);
  await tab('Pending Payment').click();
  assert.equal(await requestRows().count(), 1);
  await tab('Paid').click();
  assert.equal(await requestRows().count(), 2, 'Paid includes waived fees');
  await tab('Processing').click();
  assert.equal(await requestRows().count(), 1);
  await requestRows().click();
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/services/requests/request-3');
  const queries = await page.evaluate(() => window.fixture.queries.length);
  for (let visit = 0; visit < 5; visit++) {
    await page.evaluate(() => { window.fixture.profileState.isLoading=true;window.renderServices(); });
    assert.equal(await tab('Processing').getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByText('Checking ID verification…', { exact: true }).count(), 0);
    await page.evaluate(() => { window.fixture.profileState.isLoading=false;window.renderServices(); });
  }
  assert.equal(await page.evaluate(() => window.fixture.queries.length), queries, 'Profile refresh must not reload requests');
  await page.evaluate(() => window.refreshLists());
  assert.equal(await tab('Processing').getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => window.fixture.channels.size), 1);
  await tab('Pickup').click();
  assert.equal(await requestRows().count(), 1);
  await tab('History').click();
  assert.equal(await requestRows().count(), 2);
  assert.equal(await page.getByText('Previous timing model').count(), 0, 'Internal timing label is never shown to residents');
  assert.equal(await page.getByText('00:00:00').count(), 0);
  await page.getByText(/^Cancelled /).first().waitFor();
  await page.getByText(/^Completed /).first().waitFor();
  await tab('Active').click();
  assert.equal(await requestRows().count(), 4, 'Leaving Active clears its subfilter');
  await page.screenshot({ path: path.join(out, 'requests-active-light.png') });
  passed.push('All filters/statuses, paid/waived mapping, tracking route, legacy/SLA branches, refresh and channel stability');

  const filterVisits=[['All',9],['Pickup',1],['History',2],['Active',4],['Pending Payment',1],['Paid',2],['Processing',1]];
  const visitFilters=async()=>{
    for(const [name,count] of filterVisits){
      await (name==='All'?page.getByRole('tablist',{name:'request filters',exact:true}).getByRole('tab',{name:'All',exact:true}):tab(name)).press('Enter');
      assert.equal(await requestRows().count(),count);
    }
  };
  await visitFilters();
  const cachedQueries=await page.evaluate(()=>window.fixture.queries.length);
  for(let cycle=0;cycle<3;cycle++)await visitFilters();
  assert.equal(await page.evaluate(()=>window.fixture.queries.length),cachedQueries,'21 warm filter switches perform zero reads');
  assert.deepEqual(await page.evaluate(()=>[...window.fixture.channels.keys()]),requestChannel,'Warm switches do not reconnect realtime');
  const filterContent=page.getByTestId('request-filter-content');
  await filterContent.evaluate(node=>{window.retainedFilterContent=node;});
  await page.evaluate(()=>{window.fixture.reducedMotion=false;window.renderServices();});
  await filterContent.evaluate(()=>{window.fixture.motionRuns=[];});
  await tab('Paid').press('Enter');
  assert.equal(await requestRows().count(),2);
  assert.equal(await filterContent.evaluate(node=>node===window.retainedFilterContent),true,'Filter motion must not remount the content host');
  assert.ok(await page.evaluate(()=>window.fixture.motionRuns.some(run=>run.duration===160)),'Filter changes reuse the section motion duration');
  await page.evaluate(()=>{window.fixture.profileState.isLoading=true;window.renderServices();});
  await filterContent.evaluate(()=>{window.fixture.motionRuns=[];});
  await page.evaluate(()=>{window.fixture.profileState.isLoading=false;window.renderServices();});
  assert.equal(await page.evaluate(()=>window.fixture.motionRuns.length),0,'Background profile refresh must not replay filter motion');
  await page.evaluate(()=>{window.fixture.reducedMotion=true;window.renderServices();});
  await filterContent.evaluate(()=>{window.fixture.motionRuns=[];});
  await tab('Processing').press('Enter');
  assert.equal(await requestRows().count(),1);
  assert.equal(await page.evaluate(()=>window.fixture.motionRuns.length),0,'Reduced motion switches filters instantly');
  passed.push('Filter switches share the 160ms section motion, retain the content host, skip refresh replays and honor reduced motion');
  // Inactive cached filters must refresh after a live request update.
  await page.evaluate(()=>{window.fixture.requests[0].payment_status='paid';window.refreshLists();});
  await tab('Pending Payment').press('Enter');
  await page.getByText('No requests here yet',{exact:true}).waitFor();
  assert.equal((await tab('Pending Payment').innerText()).trim(),'','The pending badge disappears at zero');
  await page.evaluate(()=>{window.fixture.requests[0].payment_status='unpaid';window.refreshLists();});
  await requestRows().first().waitFor();
  passed.push('Held first reads reuse overview, obsolete replies stay isolated, 21 cached switches make zero reads/reconnects, live updates refresh inactive filters');

  // Refresh retains the mounted scroller and its offset, including while verification is checked.
  // Active also has an All subfilter. Select the top-level overview explicitly.
  await page.getByRole('tablist', { name: 'request filters', exact: true }).getByRole('tab', { name: 'All', exact: true }).press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[aria-label^="Service "]').length === 9);
  await page.evaluate(() => {
    const row=Array.from(document.querySelectorAll('[role=button]')).find(el=>el.getAttribute('aria-label')==='Service 0');
    let scroll=row.parentElement;
    while(scroll && !(scroll.scrollHeight>scroll.clientHeight && getComputedStyle(scroll).overflowY==='auto'))scroll=scroll.parentElement;
    if(!scroll)throw new Error('Requests vertical scroller missing');
    window.requestScroller=scroll;scroll.scrollTop=60;
  });
  await page.evaluate(() => { window.fixture.profileState.isLoading=true;window.renderServices();window.refreshLists(); });
  assert.equal(await page.evaluate(() => window.requestScroller.isConnected), true);
  assert.equal(await page.evaluate(() => window.requestScroller.scrollTop), 60);
  await page.evaluate(() => { window.fixture.profileState.isLoading=false;window.renderServices(); });
  passed.push('Real Requests scroller survives profile/data refresh with unchanged scroll offset');

  const preferenceQueries = await page.evaluate(() => window.fixture.queries.length);
  for (const [width, mode, accent, fontId] of [[320,'dark','#ffffff','georgia'],[400,'light','#2563eb','system'],[360,'dark','#c2410c','tahoma'],[412,'light','#000000','times-new-roman']]) {
    await page.setViewportSize({ width, height: 640 });
    await page.evaluate(({mode,accent,fontId}) => { Object.assign(window.fixture,{mode,accent,fontId});window.renderServices(); }, {mode,accent,fontId});
    assert.equal(await requestRows().count(), 9);
    assert.equal(await page.evaluate(() => window.requestScroller.isConnected), true);
    assert.equal(await page.evaluate(() => window.fixture.channels.size), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, `requests-${width}-${mode}.png`) });
  }
  assert.equal(await page.evaluate(() => window.fixture.queries.length), preferenceQueries);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { window.requestScroller.scrollTop=0; });
  const rightArrow=page.getByRole('button',{name:'Scroll request filters right',exact:true});
  await rightArrow.waitFor();
  // Badged chips are wider, so the strip may need a few nudges to reach its end.
  for (let nudge = 0; nudge < 5 && await rightArrow.isVisible(); nudge++) { await rightArrow.click(); await page.waitForTimeout(100); }
  await rightArrow.waitFor({state:'hidden'});
  const leftArrow=page.getByRole('button',{name:'Scroll request filters left',exact:true});
  for (let nudge = 0; nudge < 5 && await leftArrow.isVisible(); nudge++) { await leftArrow.click(); await page.waitForTimeout(100); }
  await leftArrow.waitFor({state:'hidden'});
  passed.push('320/360/400/412 widths, light/dark/custom accents and preference refresh preserve rows/scroller/queries; overflow arrows stop at both edges');

  await tab('Logs').click();
  await page.getByText('₱75.00', { exact: true }).waitFor();
  assert.equal(await page.getByText('Recent activity', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Latest updates on your requests', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Valid ID Verified', { exact: true }).count(), 0);
  await page.getByText('Free', { exact: true }).waitFor();
  await page.getByText('October 2026', { exact: true }).waitFor();
  assert.equal(await page.getByText('₱100.00', { exact: true }).count(), 3, 'A cancelled entry shows no price');
  await page.getByText('₱10.00 per page — enter total pages to continue', { exact: true }).waitFor();
  assert.equal(await requestRows().count(), 0, 'Logs must remain noninteractive');
  await page.screenshot({ path: path.join(out, 'logs-light.png') });
  await tab('Requests').click();
  await page.getByRole('button', { name: 'Start a new document request', exact: true }).click();
  await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).waitFor();
  passed.push('Logs preserve ledger/free/unknown fees and noninteractive rows; New request opens Documents');

  // Needs-action requests sort first and answer "what do I do now?" with one line and a Pay now button.
  await tab('Requests').click();
  await page.evaluate(() => {
    const base = window.fixture.requests[0];
    const make = (id, name, status, payment_status, extra = {}) => ({ ...base, id, reference_number: id, status, payment_status, payment_method: null, sla_state: 'running', fee_assessment_state: 'assessed', assessed_amount_centavos: 10000, document_types: { name, processing_target_hours: 24, fee_centavos: 10000 }, ...extra });
    window.fixture.requests = [make('ok', 'Paid first', 'in_progress', 'paid'), make('pay', 'Pay me', 'submitted', 'unpaid'), make('req', 'Needs papers', 'in_progress', 'paid', { sla_state: 'paused' })];
    window.refreshLists();
  });
  await page.getByText('Pay ₱100.00 to continue', { exact: true }).first().waitFor();
  await page.getByText('Requirements needed. Open to review.', { exact: true }).first().waitFor();
  await page.getByText('Requirements Needed', { exact: true }).first().waitFor();
  const order = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label="Pay me"],[aria-label="Needs papers"],[aria-label="Paid first"]')).map(el => el.getAttribute('aria-label')));
  assert.equal(order[0] === 'Paid first', false, 'Rows needing action are pinned above routine ones');
  await page.getByRole('button', { name: 'Pay ₱100.00 for Pay me', exact: true }).first().click();
  assert.ok((await page.evaluate(() => window.fixture.routes)).includes('/services/payment/pay'));
  passed.push('Pinned needs-action rows, single status pill, next-step line and Pay now route');

  await tab('Requests').click();
  await page.evaluate(() => { window.fixture.requests=[];window.refreshLists(); });
  await page.getByText('Nothing open right now', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.fail.requests=true;window.refreshLists(); });
  await page.getByText('Could not load your requests. Reconnect and retry.', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.fail.requests=false; });
  await page.getByRole('button', { name: 'Retry requests', exact: true }).click();
  await page.getByText('Nothing open right now', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.profileState.error='Could not refresh your profile.';window.renderServices(); });
  const retriesBefore = await page.evaluate(() => window.fixture.retries);
  await page.getByRole('button', { name: 'Retry verification check', exact: true }).click();
  assert.equal(await page.evaluate(() => window.fixture.retries), retriesBefore + 1);
  await page.evaluate(() => { window.fixture.profileState.error=null;window.fixture.profileState.profile=null;window.fixture.profileState.isLoading=true;window.renderServices(); });
  await page.getByText('Checking ID verification…', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.profileState.isLoading=false;window.fixture.profileState.profile={id_verification_status:'pending'};window.renderServices(); });
  await page.getByText('Your ID is awaiting verification. Requests are available after approval.', { exact: true }).waitFor();
  passed.push('Empty/error/retry and checking/pending/verification-error guidance stay reachable');

  await page.evaluate(() => { window.fixture.session=null;window.resetServices(); });
  await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).waitFor();
  assert.equal(await tab('Requests').count(), 0);
  assert.equal(await tab('Logs').count(), 0);
  assert.equal(await page.evaluate(() => window.fixture.channels.size), 1, 'Only the public catalog channel remains');
  await page.evaluate(() => { window.fixture.fail.catalog=true;window.refreshLists(); });
  await page.getByRole('button', { name: 'Retry catalog', exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.fail.catalog=false; });
  await page.getByRole('button', { name: 'Retry catalog', exact: true }).click();
  await page.getByRole('button', { name: 'Certificate of Indigency', exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.documents=[];window.refreshLists(); });
  await page.getByText('No documents available yet', { exact: true }).waitFor();
  passed.push('Guest has only Documents, with public catalog error/retry/empty and channel cleanup');

  await page.evaluate(() => {
    window.fixture.session={user:{id:'synthetic-resident'}};
    window.fixture.requests=Array.from({length:63},(_,i)=>({id:'00000000-0000-4000-8000-'+String(63-i).padStart(12,'0'),resident_id:'synthetic-resident',status:i%2?'completed':'submitted',payment_status:i%3?'paid':'waived',reference_number:'LARGE-'+i,created_at:'2026-10-23T00:00:00.123456+00:00',updated_at:'2026-10-23T00:00:00.123456+00:00',document_types:{name:'Large service '+i,fee_centavos:10000,processing_target_hours:24},timing_model:'legacy',contract_version:2,fee_assessment_state:'assessed',assessed_amount_centavos:10000,payments:[]}));
    window.resetServices();
  });
  await tab('Requests').click();
  await tab('Active').click();
  const largeRows=()=>page.getByRole('button',{name:/^Large service /});
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Large service "]').length===25);
  await page.getByRole('button',{name:'Load older requests',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Large service "]').length===32);
  assert.equal(await page.getByRole('button',{name:'Load older requests',exact:true}).count(),0);
  assert.equal(new Set(await largeRows().allTextContents()).size,32);
  await tab('History').click();
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Large service "]').length===25);
  await page.getByRole('button',{name:'Load older requests',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Large service "]').length===31);
  await tab('Logs').click();
  await page.getByRole('button',{name:'Load older activity',exact:true}).waitFor();
  await page.getByRole('button',{name:'Load older activity',exact:true}).click();
  await page.getByText('Large service 49',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Load older activity',exact:true}).click();
  await page.getByText('Large service 62',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Load older activity',exact:true}).count(),0);
  await page.evaluate(()=>{window.fixture.session={user:{id:'different-resident'}};window.renderServices()});
  await page.getByText('No activity yet',{exact:true}).waitFor();
  assert.equal(await page.getByText('Large service 62',{exact:true}).count(),0);
  passed.push('63-row tied-date request/activity pages, complete 31-row History filter, no duplicates and account replacement clears private rows');

  // Match the reported screen: 23 pending requests in both overlapping sections.
  await page.evaluate(() => {
    window.fixture.requests=window.fixture.requests.slice(0,23).map(row=>({...row,status:'submitted',payment_status:'unpaid',payment_method:'pickup'}));
    window.fixture.session={user:{id:'synthetic-resident'}};
    window.fixture.reducedMotion=false;
    window.resetServices();
  });
  await tab('Requests').click();
  await page.getByRole('button',{name:'Active Requests, 23',exact:true}).waitFor();
  const overviewRows=()=>page.getByRole('button',{name:/^Large service /});
  assert.equal(await overviewRows().count(),46);
  const overviewQueries=await page.evaluate(()=>window.fixture.queries.length);
  const disclosure=title=>page.getByRole('button',{name:title+', 23',exact:true});
  for(const title of ['Active Requests','Pending Payment']) {
    // DOM activation avoids scrolling across a 23-row section between taps.
    await disclosure(title).evaluate(node=>node.click());
    assert.equal(await disclosure(title).getAttribute('aria-expanded'),'false');
  }
  assert.equal(await overviewRows().count(),0);
  for(const title of ['Active Requests','Pending Payment']) {
    await disclosure(title).evaluate(node=>node.click());
    assert.equal(await disclosure(title).getAttribute('aria-expanded'),'true');
    const body=disclosure(title).locator('..').locator(':scope > div').last();
    await body.evaluate(node => new Promise(resolve => {
      const check=()=>node.clientHeight>0?resolve():requestAnimationFrame(check);check();
    }));
    assert.ok((await body.boundingBox()).height>1000,'All 23 request cards must fit without clipping');
  }
  assert.equal(await overviewRows().count(),46);
  assert.equal(await page.evaluate(()=>window.fixture.queries.length),overviewQueries,'Disclosure taps must not reload requests');
  await page.screenshot({path:path.join(out,'requests-23-pending-expanded.png')});
  passed.push('Reported 23-request All overview: both sections visible, collapse/reopen restores 46 cards without refetching');
  await page.evaluate(()=>{window.fixture.session={user:{id:'replacement-resident'}};window.renderServices();});
  await page.getByText('Nothing open right now',{exact:true}).waitFor();
  assert.equal(await overviewRows().count(),0,'An account change clears every cached private request window');

  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, errors, adapters: ['Synthetic Supabase/session/profile data', 'React Native Web layout', 'Immediate reduced-motion Reanimated adapter', 'SLA child stub; actual SLA covered by shared contracts'] }, null, 2));
  console.log(JSON.stringify({ passed, errors }));
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(out, 'failure.png') });
    fs.writeFileSync(path.join(out, 'failure.html'), await page.content());
    fs.writeFileSync(path.join(out, 'failure-console.json'), JSON.stringify(errors));
  }
  throw error;
} finally { await browser.close(); }
