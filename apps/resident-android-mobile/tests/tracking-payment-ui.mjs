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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-payment-'));
fs.mkdirSync(out, { recursive: true });

// Actual components/controllers/contracts, isolated transport and native adapters.
// Synthetic browser evidence supplements Android; it cannot certify native behavior.
const mocks = {
  '@/global.css': '',
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...p}){return <svg {...p}/>};export const Path=p=><path {...p}/>;`,
  'expo-media-library': 'export const Asset={};export const Album={};export const requestPermissionsAsync=()=>{throw Error("Native permission unavailable")};',
  'expo-file-system': 'export const File=class {};export const Paths={};',
  'expo-file-system/legacy': 'export const cacheDirectory="synthetic://";export const copyAsync=async()=>{};',
  'expo-print': 'export const printToFileAsync=async()=>{throw Error("Synthetic print failure")};',
  'expo-sharing': 'export const isAvailableAsync=async()=>false;export const shareAsync=async()=>{};',
  'react-native': `import React from 'react';import {Animated as A,View as V,Image as I} from 'react-native-web';export * from 'react-native-web';
    export const View=React.forwardRef(({accessibilityViewIsModal,accessibilityElementsHidden,importantForAccessibility,...p},ref)=><V {...p} ref={ref}/>);
    export const Image=React.forwardRef(({contentFit,...p},ref)=><I {...p} ref={ref} resizeMode={contentFit??p.resizeMode}/>);
    export const Animated={...A,timing:(v,o)=>{window.fixture.motions.push(o.duration);return A.timing(v,{...o,useNativeDriver:false})},loop:()=>{let active=false;return {start(){if(!active){window.fixture.loops++;active=true}},stop(){if(active){window.fixture.loops--;active=false}}}}};
    export const AppState={currentState:'active',addEventListener(name,fn){window.fixture.appListeners.push(fn);return {remove(){window.fixture.appListeners=window.fixture.appListeners.filter(x=>x!==fn)}}}};
    export const Alert={alert:(title,message,buttons)=>{window.fixture.alerts.push({title,message});window.fixture.alertButtons=buttons??[]}};
    export const RefreshControl=({children,style,...props})=>{const ref=React.useRef(props);ref.current=props;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};`,
  '@barangayan/shared': `export * from '${shared}/lib/format.ts';export * from '${shared}/lib/service-catalog.ts';export * from '${shared}/lib/agency-sla.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {DEFAULT_FONT_ID,FONT_OPTIONS} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import {useEffect} from 'react';const router={push:v=>window.fixture.routes.push(v),replace:v=>window.fixture.routes.push(v),back:()=>window.fixture.routes.push('back')};export const useRouter=()=>router;export const useIsFocused=()=>true;export const useLocalSearchParams=()=>({requestId:'synthetic-request'});export const useFocusEffect=fn=>useEffect(()=>{const close=fn();window.fixture.blur=close;window.fixture.focus=fn;return close},[fn]);`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:{user:{id:'synthetic-resident'}}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reduced;`,
  '@/constants/payment': `export let PAYMENT_SETTLEMENT_READY=true;window.fixture.setSettlement=v=>PAYMENT_SETTLEMENT_READY=v;`,
  '@/lib/supabase': `export const supabase={
    from(table){const q={select(columns){q.columns=columns;return q},eq(){return q},order(){return q},limit(){return q},single(){window.fixture.queries.push(table);return Promise.resolve({data:window.fixture.queryError?null:structuredClone(window.fixture.request),error:window.fixture.queryError?{message:'Synthetic load failure'}:null})},maybeSingle(){if(!q.columns?.includes('service_requests!inner'))window.fixture.pendingReads++;return Promise.resolve({data:window.fixture.receiptError?null:table==='payments'?(q.columns?.includes('service_requests!inner')?window.fixture.receipt:window.fixture.pendingPayment):null,error:window.fixture.receiptError?{}:null})}};return q},
    rpc(name,args){if(name==='service_request_sla_tracking')return {abortSignal:()=>Promise.resolve({data:{request:window.fixture.request,pauses:window.fixture.slaPauses??[],evaluated_at:window.fixture.slaAt??'2026-10-19T00:15:00Z'},error:window.fixture.slaError?{}:null})};window.fixture.mutations.push({name,args});const result=()=>({data:null,error:window.fixture.rpcError?{message:'Synthetic action failed'}:null});return window.fixture.hold?new Promise(resolve=>window.fixture.waiting.push(()=>resolve(result()))):Promise.resolve(result())},
    functions:{invoke(name,args){const f=window.fixture;f.calls.push({name,args});if(name==='create-payment-source')return Promise.resolve({data:f.provider,error:null});if(name==='cancel-payment')return f.hold?new Promise(resolve=>f.waiting.push(()=>resolve({data:{status:f.cancelStatus},error:null}))):Promise.resolve({data:{status:f.cancelStatus},error:null});return Promise.resolve({data:{status:'pending'},error:null})}},
    channel(){const channel={on(event,filter,fn){window.fixture.channels.push({channel,filter,fn});return channel},subscribe(){return channel}};return channel},removeChannel(channel){window.fixture.channels=window.fixture.channels.filter(x=>x.channel!==channel);return Promise.resolve('ok')}
  };`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View,Easing} from 'react-native';export default {View,createAnimatedComponent:c=>c};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const withRepeat=v=>v;export const withSequence=(...v)=>v.at(-1);export const cancelAnimation=()=>{};export {Easing};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'expo-constants': `export const ExecutionEnvironment={StoreClient:'store'};export default {executionEnvironment:'store'};`,
  'react-native-view-shot': `export const captureRef=async()=>{throw Error('Native capture unavailable in synthetic fixture')};`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
};

await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import {ResidentPaymentScreen} from '${root}/components/services/resident-payment-screen.tsx';
import Receipt from '${root}/app/(app)/services/payment/success.tsx';import Tracking from '${root}/components/services/request-tracking-screen.tsx';import Qr from '${root}/app/(app)/services/payment/qrph/[requestId].tsx';
import {usePaymongoSource} from '${root}/hooks/use-paymongo-source.ts';import {ActionSuccessModal} from '${root}/components/services/action-success-modal.tsx';
function Probe(){const p=usePaymongoSource('synthetic-request');return <><span id="status">{p.status}</span><span id="failure">{p.errorMessage}</span><button onClick={()=>void p.cancelPayment()}>Cancel probe</button></>}
const r=createRoot(document.getElementById('root'));let key=0;window.render=(remount=true)=>{if(remount)key++;const f=window.fixture;r.render(f.screen==='method'?<ResidentPaymentScreen key={key} requestId="synthetic-request" pickup={f.pickup}/>:f.screen==='receipt'?<Receipt key={key}/>:f.screen==='tracking'?<Tracking key={key}/>:f.screen==='probe'?<Probe key={key}/>:f.screen==='modal'?<ActionSuccessModal key={key} visible={f.visible} title="Recorded" message="Synthetic confirmation" onConfirm={()=>{f.visible=false;window.render(false)}}/>:<Qr key={key}/>)};`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', __DEV__: 'false' },
  plugins: [{ name: 'local-adapters', setup(b) {
    b.onResolve({filter: /.*/}, args => {
      if (Object.hasOwn(mocks,args.path)) return {path: args.path, namespace: 'adapter'};
      if (args.path.startsWith('@/assets/')) return {path: args.path, namespace: 'asset'};
      if (args.path.startsWith('@/')) return {path: path.join(app, 'src', args.path.slice(2)) + (fs.existsSync(path.join(app, 'src', args.path.slice(2)) + '.tsx') ? '.tsx' : '.ts')};
    });
    b.onLoad({filter: /.*/, namespace: 'adapter'}, args => ({contents: mocks[args.path],loader:'tsx',resolveDir:app}));
    b.onLoad({filter: /.*/, namespace: 'asset'}, () => ({contents:'export default {uri:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII="}',loader:'js'}));
  }}],
});

const options = {headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE};
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.channel='chrome';
const browser=await chromium.launch(options);
const errors=[]; const passed=[];
try {
  const page=await browser.newPage({viewport:{width:400,height:844}});
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.evaluate(()=>{window.fixture={screen:'method',mode:'light',accent:'#0F6E5B',fontId:'system',reduced:true,pickup:false,hold:false,waiting:[],mutations:[],queries:[],pendingReads:0,routes:[],calls:[],channels:[],appListeners:[],loops:0,motions:[],alerts:[],cancelStatus:'cancelled',visible:true,request:{id:'synthetic-request',reference_number:'SYNTHETIC-ONLY',created_at:'2026-10-19T00:00:00Z',status:'submitted',payment_status:'unpaid',payment_method:null,contract_version:2,fee_assessment_state:'assessed',assessed_amount_centavos:10000,document_types:{name:'Synthetic certificate with a long document name',fee_centavos:10000,service_kind:'indigency',processing_target_hours:24},payments:[],status_history:[],supporting_details:{},purpose_label:'Synthetic purpose',timing_model:'legacy'},provider:{paymentId:'synthetic-payment',paymentIntentId:'synthetic-intent',qrImageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',expiresAt:Date.now()+600000,documentFeeCentavos:10000,amountCentavos:10000}}});
  await page.addScriptTag({path:path.join(out,'bundle.js')});
  const render=async patch=>{await page.evaluate(p=>{Object.assign(window.fixture,p);window.render()},patch)};
  await render({});
  await page.getByRole('button',{name:/Pay at Pickup\./}).waitFor();
  await page.getByRole('button',{name:/Pay with QR PH\./}).click();
  await page.waitForFunction(()=>window.fixture.routes.includes('/services/payment/qrph/synthetic-request'));
  assert.equal(await page.evaluate(()=>window.fixture.mutations.filter(x=>x.name==='set_service_request_payment_method').length),1);
  await page.screenshot({path:path.join(out,'method-light.png')});
  await page.evaluate(()=>window.fixture.setSettlement(false));await render({});
  assert.equal(await page.getByRole('button',{name:/Pay with QR PH\./}).isDisabled(),true);
  await page.evaluate(()=>window.fixture.setSettlement(true));
  passed.push('method dispatch retains the existing RPC and route');
  await page.evaluate(()=>{window.fixture.request.document_types.service_kind='business'});await render({});
  assert.equal(await page.getByRole('button',{name:/Pay with QR PH\./}).isDisabled(),true);
  await page.evaluate(()=>{window.fixture.request.document_types.service_kind='indigency';window.fixture.request.fee_assessment_state='page_count_required'});await render({});
  await page.getByLabel('Total pages across all copies').fill('1000001');await page.getByRole('button',{name:'Continue to payment methods'}).click();
  await page.getByRole('alert').filter({hasText:'1,000,000'}).waitFor();
  passed.push('business QR eligibility and existing page limit remain enforced');
  await page.evaluate(()=>{window.fixture.request.fee_assessment_state='assessed';window.fixture.request.assessed_amount_centavos=10000;window.fixture.mutations=[]});await render({pickup:true,hold:true});
  await page.waitForFunction(()=>window.fixture.mutations.length===1);
  for(let i=0;i<5;i++)await page.evaluate(()=>window.render(false));
  assert.equal(await page.evaluate(()=>window.fixture.mutations.length),1);
  await page.evaluate(()=>{window.fixture.waiting.splice(0).forEach(fn=>fn())});
  await page.waitForFunction(()=>window.fixture.mutations.length===2);
  await page.evaluate(()=>{window.fixture.hold=false;window.fixture.waiting.splice(0).forEach(fn=>fn())});
  await page.getByText(/Your pickup payment has been recorded/).waitFor();
  await page.evaluate(()=>{window.fixture.mode='dark';window.fixture.accent='#ffff00';window.render(false)});
  assert.equal(await page.evaluate(()=>window.fixture.mutations.length),2);
  await page.screenshot({path:path.join(out,'pickup-dark.png')});
  passed.push('pickup confirmation follows both RPCs; rerender/theme changes do not repeat writes');
  await render({screen:'tracking',pickup:false});
  await page.getByRole('button',{name:'Choose payment method',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'tracking-dark.png')});
  await page.getByRole('button',{name:'Choose payment method',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixture.routes.at(-1)),'/services/payment/synthetic-request');
  for(const [status,payment] of [['completed','paid'],['cancelled','unpaid'],['submitted','waived'],['submitted','refunded']]){
    await page.evaluate(([s,p])=>{window.fixture.request.status=s;window.fixture.request.payment_status=p},[status,payment]);await render({});
    await page.getByRole('heading',{name:/Synthetic certificate/}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Choose payment method',exact:true}).count(),0);
  }
  await render({queryError:true});await page.getByRole('alert').filter({hasText:'Could not load this request'}).waitFor();
  await page.getByRole('button',{name:'Retry request',exact:true}).waitFor();
  passed.push('tracking routes, terminal/waived/refunded branches, and load error recovery');
  await page.evaluate(()=>{Object.assign(window.fixture.request,{timing_model:'agency_minutes_v1',sla_state:'running',target_minutes_snapshot:30,accepted_at:'2026-10-19T00:00:00Z',ready_at:null,released_at:null,cancelled_at:null})});
  await render({queryError:false});
  await page.getByText('Agency processing',{exact:true}).waitFor();
  await page.getByText('Resident wait',{exact:true}).waitFor();
  await page.getByText('Total turnaround',{exact:true}).waitFor();
  assert.equal(await page.getByText(/NaN/).count(),0);
  passed.push('tracking timing panel renders all three authoritative SLA values');
  const reads=()=>page.evaluate(()=>({request:window.fixture.queries.length,pending:window.fixture.pendingReads,channels:window.fixture.channels.length}));
  const pull=async()=>{await page.evaluate(()=>[...window.pullControls][0].current.onRefresh());await page.waitForFunction(()=>![...window.pullControls][0].current.refreshing)};
  assert.equal(await page.evaluate(()=>window.pullControls.size),1,'tracking mounts one pull scroller');
  const beforePull=await reads();
  await page.evaluate(()=>{window.fixture.request.reference_number='PULLED-REF'});
  await pull();
  await page.getByText('Ref #PULLED-REF').waitFor();
  assert.deepEqual(await reads(),{request:beforePull.request+1,pending:beforePull.pending+1,channels:beforePull.channels},'a pull re-reads the request and the pending payment once and opens no channel');
  await page.evaluate(()=>{window.fixture.request.reference_number='SYNTHETIC-ONLY';window.fixture.queryError=true});
  await pull();
  assert.equal(await page.getByText('Ref #PULLED-REF').count(),1,'a failed pull keeps the content');
  assert.equal(await page.getByRole('alert').filter({hasText:'Could not load this request'}).count(),0,'a failed pull adds no error view');
  assert.equal(await page.getByRole('button',{name:'Retry request',exact:true}).count(),0);
  await page.evaluate(()=>{window.fixture.queryError=false});
  passed.push('tracking pull re-reads request and pending payment once, shows new data, and keeps the screen through a failed pull');
  const trackingBaseline=await page.evaluate(()=>structuredClone(window.fixture.request));
  // The presentation keeps exact timing and request information available while
  // avoiding second-by-second clock labels in the overview.
  await page.evaluate(()=>Object.assign(window.fixture.request,{
    status:'submitted',payment_status:'unpaid',payment_method:'pickup',sla_state:'pre_processing',accepted_at:null,
    reference_number:'REQ-2026-0089',document_types:{name:'Certificate of Indigency',fee_centavos:10000,processing_target_hours:24},
    target_minutes_snapshot:15,created_at:'2026-10-19T00:00:00Z',
    purpose_label:'Medical assistance',purpose_explanation:'For ongoing medical treatment.',requester_notes:'Please notify me when ready.',
    supporting_details:{isRenter:false,personalAppearanceAcknowledged:true},
    status_history:[{status:'submitted',at:'2026-10-19T00:00:00Z',note:'Request submitted'}],
  }));
  await render({mode:'light',accent:'#0F6E5B',slaAt:'2026-10-22T00:09:17Z',fontId:'system'});
  await page.getByText('Not started',{exact:true}).waitFor();
  await page.getByText('3 days 9 min',{exact:true}).waitFor();
  assert.equal(await page.getByText('0m 0s',{exact:true}).count(),0);
  await page.screenshot({path:path.join(out,'tracking-light-overview.png')});
  await page.getByRole('button',{name:'Timing details',exact:true}).click();
  await page.getByText('3 days, 9 minutes, 17 seconds',{exact:true}).waitFor();
  await page.getByText('Processing starts at staff acceptance and ends at readiness. Turnaround ends at release.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Timing details',exact:true}).click();
  assert.equal(await page.getByText('3 days, 9 minutes, 17 seconds',{exact:true}).count(),0);
  await page.getByText('Completed',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'tracking-light-history.png')});
  for(const text of ['Medical assistance','For ongoing medical treatment.','Non-renter','Requirement acknowledged','Please notify me when ready.']) await page.getByText(text,{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Request details',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'tracking-light-details.png')});
  const presentationWrites=await page.evaluate(()=>window.fixture.mutations.length);
  for(const [mode,accent,fontId] of [['light','#ffff00','system'],['dark','#ffff00','system'],['dark','#8b5cf6','georgia']]){
    for(const width of [320,360,412]){
      await page.setViewportSize({width,height:844});await render({mode,accent,fontId,reduced:true});
      await page.getByText('Not started',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      // ScrollViews can clip overflowing descendants without growing the document.
      const clipped=await page.evaluate(()=>[...document.querySelectorAll('[dir="auto"]')].filter(el=>{
        const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1||el.scrollWidth>el.clientWidth+1);
      }).map(el=>el.textContent));
      assert.deepEqual(clipped,[],`${mode}/${fontId}/${width}: no clipped text`);
      if(width===360)await page.screenshot({path:path.join(out,`tracking-${mode}-${fontId}-360.png`)});
    }
  }
  assert.equal(await page.evaluate(()=>window.fixture.mutations.length),presentationWrites);
  await page.evaluate(()=>Object.assign(window.fixture.request,{status:'in_progress',sla_state:'paused',accepted_at:'2026-10-19T00:00:00Z'}));
  await render({mode:'light',accent:'#0F6E5B',fontId:'system',reduced:false,slaAt:'2026-10-19T00:30:00Z',slaPauses:[{started_at:'2026-10-19T00:10:00Z',resumed_at:null,reason:'Additional proof of residency'}]});
  await page.getByText(/Waiting for resident: Additional proof/).waitFor();
  await page.getByText('Paused while awaiting requirements',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Timing details',exact:true}).click();
  await page.getByText(/^Additional proof of residency ·/).waitFor();
  await page.screenshot({path:path.join(out,'tracking-paused-details.png')});
  const motionCount=await page.evaluate(()=>window.fixture.motions.length);
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>window.fixture.motions.length),motionCount,'clock ticks must not restart entry/disclosure animations');
  await page.evaluate(()=>Object.assign(window.fixture.request,{status:'completed',sla_state:'ready',ready_at:'2026-10-19T00:12:00Z',released_at:'2026-10-19T01:00:00Z'}));
  await render({slaPauses:[]});await page.getByText('Processing finished at readiness',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Cancel Request',exact:true}).count(),0);
  await page.evaluate(()=>Object.assign(window.fixture.request,{status:'cancelled',sla_state:'cancelled',ready_at:null,released_at:null,cancelled_at:'2026-10-19T00:12:00Z'}));
  await render({});await page.getByText('Stopped at cancellation',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Cancel Request',exact:true}).count(),0);
  await render({slaError:true});await page.getByRole('alert').filter({hasText:'Processing clock unavailable'}).waitFor();
  await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
  passed.push('readable long durations, exact disclosure, paused/terminal/error states, all submitted details, 320–412 widths, theme/font changes, and non-restarting motion');
  await page.evaluate(request=>{window.fixture.request=request;window.fixture.slaError=false;window.fixture.slaPauses=[]},trackingBaseline);
  await render({screen:'qr',queryError:false,reduced:false});
  await page.getByText('Waiting for payment...', {exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'qr-dark.png')});
  await page.waitForFunction(()=>window.fixture.loops===1);
  await page.evaluate(()=>window.fixture.blur());await page.waitForFunction(()=>window.fixture.loops===0);
  await page.evaluate(()=>window.fixture.focus());await page.waitForFunction(()=>window.fixture.loops===1);
  await page.evaluate(()=>window.fixture.appListeners.forEach(fn=>fn('background')));await page.waitForFunction(()=>window.fixture.loops===0);
  await page.evaluate(()=>window.fixture.appListeners.forEach(fn=>fn('active')));await page.waitForFunction(()=>window.fixture.loops===1);
  await page.evaluate(()=>{window.fixture.reduced=true;window.render(false)});await page.waitForFunction(()=>window.fixture.loops===0);
  await page.evaluate(()=>{window.fixture.provider.expiresAt=Date.now()-1000});await render({reduced:false});
  await page.getByText(/This QR code has expired/).waitFor();
  assert.equal(await page.getByText('Waiting for payment...', {exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.fixture.loops),0);
  passed.push('QR decoration stops on blur, background, reduced motion and real expiry');
  await page.evaluate(()=>{window.fixture.provider.expiresAt=undefined});await render({screen:'probe'});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='error');
  assert.match(await page.locator('#failure').innerText(),/incomplete details/);
  await page.evaluate(()=>{window.fixture.provider.expiresAt=Date.now()+600000});await render({hold:true,cancelStatus:'paid'});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='pending');
  await page.getByRole('button',{name:'Cancel probe'}).click();
  await page.evaluate(()=>{window.fixture.waiting.splice(0).forEach(fn=>fn())});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='paid');
  passed.push('actual provider hook rejects invented expiry and retains paid-during-cancel race');
  await page.evaluate(()=>{window.fixture.receipt={service_request_id:'synthetic-request',service_requests:{reference_number:'CONFIRMED-SYNTHETIC'},amount_centavos:12500,document_fee_centavos:12500,method:'qrph',paid_at:'2026-10-19T00:00:00Z',paymongo_payment_id:'provider-synthetic'}});
  await render({screen:'receipt',hold:false});
  await page.getByText('CONFIRMED-SYNTHETIC',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Download Receipt/}).click();
  await page.waitForFunction(()=>window.fixture.alerts.some(x=>x.title==='Download Failed'&&x.message==='Synthetic print failure'));
  await page.getByRole('button',{name:/Track My Request/}).click();
  assert.equal(await page.evaluate(()=>window.fixture.routes.at(-1)),'/services/requests/synthetic-request');
  await render({receiptError:true});await page.getByRole('alert').filter({hasText:'No confirmed payment receipt'}).waitFor();
  await page.getByRole('button',{name:'Return to request',exact:true}).waitFor();
  passed.push('receipt uses paid server data, preserves tracking destination, and reports native export failure');
  await render({screen:'modal',hold:false,visible:true,reduced:true});
  await page.getByRole('button',{name:'OK',exact:true}).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  await page.getByText('Synthetic confirmation').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.fixture.channels.length),0);
  passed.push('success acknowledgement closes and provider channels clean up');
  for(const width of [320,360,400,412]){
    await page.setViewportSize({width,height:700});await render({screen:'method',pickup:false});
    await page.getByRole('button',{name:/Pay at Pickup\./}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  passed.push('long content fits 320/360/400/412 widths in dark/extreme accent');
  await render({screen:'method',pickup:false});
  await page.getByRole('button',{name:/Pay at Pickup\./}).waitFor();
  assert.equal(await page.evaluate(()=>window.pullControls.size),1,'payment mounts one pull scroller');
  const paymentReads=await page.evaluate(()=>window.fixture.queries.length);
  await page.evaluate(()=>{window.fixture.request.document_types.name='Pulled certificate';[...window.pullControls][0].current.onRefresh()});
  await page.waitForFunction(()=>![...window.pullControls][0].current.refreshing);
  await page.getByText('Pulled certificate',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.queries.length),paymentReads+1,'a payment pull re-reads the request once');
  passed.push('payment pull re-reads the request once and shows new data');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({passed,errors},null,2));
} finally {await browser.close()}
