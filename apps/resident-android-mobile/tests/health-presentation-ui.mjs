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
const out =
  process.env.TEST_ARTIFACTS_DIR ??
  path.resolve(app, '../../tmp/resident-android-magicpatterns-phase-12-20261020/ui');
fs.mkdirSync(out, { recursive: true });
// Actual Health routes, medical hook, schemas, theme and motion. Only data/native APIs are synthetic.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityViewIsModal,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const KeyboardAvoidingView=({behavior,...p})=><View {...p}/>;
    export const Modal=({visible,onRequestClose,children})=>{React.useEffect(()=>{if(!visible)return;const fn=e=>{if(e.key==='Escape')onRequestClose?.()};document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn)},[visible,onRequestClose]);return visible?<div role="dialog" style={{position:'fixed',inset:0,display:'flex',zIndex:10}}>{children}</div>:null};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy} aria-checked={accessibilityState?.checked}/>);
    export const ScrollView=React.forwardRef(({onScroll,onMomentumScrollEnd,onScrollEndDrag,...p},r)=><R.ScrollView {...p} ref={r} onScroll={e=>{onScroll?.(e);onMomentumScrollEnd?.(e)}}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const Alert={alert:(...args)=>window.fixture.alerts.push(args)};
    export const RefreshControl=({children,style,...p})=>{const ref=React.useRef(p);ref.current=p;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(event,fn)=>{window.fixture.listeners.add(fn);return{remove:()=>window.fixture.listeners.delete(fn)}}};`,
  'expo-router': `import React from 'react';export const useIsFocused=()=>true;export const useFocusEffect=fn=>{const [focused,setFocused]=React.useState(true);React.useEffect(()=>{const listener=e=>setFocused(e.detail);window.addEventListener('health-focus',listener);return()=>window.removeEventListener('health-focus',listener)},[]);React.useEffect(()=>focused?fn():undefined,[fn,focused])};export const useLocalSearchParams=()=>window.fixture.params;export const usePathname=()=>'/health/register';export const router={back:()=>window.fixture.routes.push('back'),push:r=>window.fixture.routes.push(r),replace:r=>window.fixture.routes.push(r),setParams:p=>Object.assign(window.fixture.params,p)};export const useRouter=()=>router;`,
  'react-native-safe-area-context': `import {View} from 'react-native';export const SafeAreaView=View;const insets={top:0,left:0,right:0,bottom:0};export const useSafeAreaInsets=()=>insets;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={};`,
  'react-native-reanimated': `import {useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const withSpring=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:window.fixture.mode,accentColor:window.fixture.accent});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>100;`,
  '@barangayan/shared': `export {DRIVE_TYPES,DRIVE_TYPE_CONFIG} from '${shared}/constants/drive-types.ts';export {residentDriveRegistrationResultSchema,driveRegistrationSchema,RESIDENT_DRIVE_REGISTRATION_COLUMNS} from '${shared}/schemas/drive-registration.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:window.fixture.needsCompletion});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,isLoading:window.fixture.profileLoading,error:null,refetch:()=>window.renderFixture()});export const useProfileData=useProfile;`,
  '@/lib/supabase': `export const supabase={from:table=>{const filters=[];let columns='';const q={select:c=>{columns=c;return q},eq:(k,v)=>{filters.push([k,v]);return q},is:()=>q,order:()=>q,gte:(k,v)=>{filters.push(['gte',v]);return q},lte:()=>q,single:()=>q,abortSignal:()=>q,then:(resolve,reject)=>{
    const f=window.fixture;f.reads.push({table,filters,columns});let data=null,error=null;
    if(table==='profiles')data={barangay_id:f.profile.barangay_id};
    if(table==='medical_drives'){
      if(filters.some(([k])=>k==='id')){data=f.drive;error=f.driveError?{message:'Synthetic drive load failure'}:null}
      else{data=columns==='drive_date, type'?f.drives.map(d=>({drive_date:d.drive_date,type:d.type})):f.drives;error=f.listError?{message:'Synthetic list failure'}:null}
    }
    if(table==='drive_registrations'){data=f.registrations;error=f.regError?{message:'Synthetic registrations failure'}:null}
    const response=f.holdReads?new Promise(yes=>(f.pendingReads??=[]).push(()=>yes({data,error}))):Promise.resolve({data,error});return response.then(resolve,reject);
  }};return q},channel:()=>{const c={on:()=>c,subscribe:()=>{window.fixture.channels.add(c);return c}};return c},removeChannel:c=>window.fixture.channels.delete(c),rpc:async(name,args)=>{const f=window.fixture;f.writes.push({name,args});await new Promise(r=>setTimeout(r,f.delay));return {data:f.response,error:f.rpcError?{message:f.rpcError}:null}}};`,
  './guest-auth-callout-screen': `import React from 'react';import {Text} from 'react-native';export const GuestAuthCalloutScreen=()=> <Text>Log In Required</Text>;`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export const Image=({style})=><View style={style}/>;`,
};
await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Health from '${root}/app/(app)/health/index';import Register from '${root}/app/(app)/health/register';
  const today=new Date(),pad=n=>String(n).padStart(2,'0'),date=today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
  const drive={id:'33333333-3333-4333-8333-333333333333',barangay_id:'22222222-2222-4222-8222-222222222222',title:'Synthetic Dental Drive',type:'dental',drive_date:date,time_start:'08:00:00',time_end:'15:00:00',location:'Synthetic Covered Court',eligible_criteria:'Stored eligibility text',stock_label:'Remaining Slots',stock_unit:'slots',stock_total:60,stock_remaining:45,is_active:true};
  window.fixture={screen:'list',mode:'light',accent:'#0F6E5B',font:'system',reduced:false,needsCompletion:false,session:{user:{id:'11111111-1111-4111-8111-111111111111'}},profile:{id:'11111111-1111-4111-8111-111111111111',barangay_id:drive.barangay_id,full_name:'Synthetic Resident',birth_date:'1990-01-02',home_address:'Synthetic address',household_members:[{id:'44444444-4444-4444-8444-444444444444',name:'Synthetic Member',relation:'Child',role:'Member'}]},params:{driveId:drive.id},drive,drives:[drive],registrations:[],reads:[],writes:[],routes:[],alerts:[],durations:[],channels:new Set(),listeners:new Set(),delay:400,response:{registration_id:'55555555-5555-4555-8555-555555555555',applicant_number:'DEN-20261020-0046',status:'pending'}};
  const root=createRoot(document.getElementById('root'));let generation=0;window.renderFixture=()=>root.render(window.fixture.screen==='form'?<Register key={generation}/>:<Health key={generation}/>);window.resetFixture=()=>{generation++;window.renderFixture()};window.renderFixture();`,
    resolveDir: app,
    loader: 'jsx',
  },
  outfile: path.join(out, 'bundle.js'),
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'native-adapters',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) =>
          a.path in mocks ? { path: a.path, namespace: 'fixture' } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({
          contents: mocks[a.path],
          loader: 'jsx',
          resolveDir: app,
        }));
      },
    },
  ],
});
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
});
const errors = [],
  passed = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 400, height: 844 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  await page.setContent(
    '<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const button = (n) => page.getByRole('button', { name: n, exact: true });
  const render = (patch = {}, reset = false) =>
    page.evaluate(
      ({ patch, reset }) => {
        Object.assign(window.fixture, patch);
        reset ? window.resetFixture() : window.renderFixture();
      },
      { patch, reset },
    );
  await page.getByText('Synthetic Dental Drive', { exact: true }).waitFor();
  await page.getByText('Synthetic Dental Drive', { exact: true }).evaluate(node => { window.retainedDriveNode=node; });
  await page.evaluate(() => { window.fixture.holdReads=true;window.dispatchEvent(new CustomEvent('health-focus',{detail:false})); });
  await page.waitForTimeout(30);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('health-focus',{detail:true})));
  await page.getByText('Refreshing medical drives…',{exact:true}).waitFor();
  assert.equal(await page.getByText('Synthetic Dental Drive',{exact:true}).isVisible(),true);
  assert.equal(await page.getByText('Synthetic Dental Drive',{exact:true}).evaluate(node=>node===window.retainedDriveNode),true);
  await page.evaluate(() => {window.fixture.holdReads=false;window.fixture.pendingReads.splice(0).forEach(resolve=>resolve())});
  await page.getByText('Refreshing medical drives…',{exact:true}).waitFor({state:'detached'});
  passed.push('actual Health screen keeps warm drive rows visible through deferred focus refresh');
  await page.screenshot({ path: path.join(out, 'active-drives-light.png') });
  await render({ drives: [] }, true);
  const emptyDrives = page.getByText('No medical drives on this date.', { exact: true });
  await emptyDrives.waitFor();
  await page.evaluate(()=>{window.fixture.listError=true;window.dispatchEvent(new CustomEvent('health-focus',{detail:false}))});
  await page.waitForTimeout(30);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('health-focus',{detail:true})));
  await button('Retry drives').waitFor();
  assert.equal(await emptyDrives.isVisible(),true,'A failed background refresh keeps the loaded empty state');
  await render({listError:false});await button('Retry drives').click();await button('Retry drives').waitFor({state:'hidden'});
  if(await button('Retry calendar').count()){await button('Retry calendar').click();await button('Retry calendar').waitFor({state:'hidden'});}
  passed.push('loaded empty drives remain visible beside a background refresh error and recover through retry');
  for (const width of [320, 400]) {
    await page.setViewportSize({ width, height: 740 });
    await page.screenshot({ path: path.join(out, `empty-drives-${width}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const calendar = await page.getByRole('button', { name: /Open month and year picker/ })
      .locator('..').locator('..').boundingBox();
    assert.ok(calendar.height <= 340, 'full calendar stays compact even in a six-week month');
    const empty = await emptyDrives.boundingBox();
    assert.ok(empty.y + empty.height < 640, 'drive summary remains above the reserved bottom navigation area');
  }
  await button('Next month').click();
  await button('Previous month').click();
  const calendarAnimations = await page.evaluate(() => window.fixture.durations.filter(d => d === 160).length);
  assert.ok(calendarAnimations > 0);
  await render({ mode: 'dark', accent: '#ffff00', font: 'georgia' });
  assert.equal(await page.evaluate(() => window.fixture.durations.filter(d => d === 160).length), calendarAnimations);
  await page.screenshot({ path: path.join(out, 'empty-drives-dark.png') });
  await page.evaluate(() => window.fixture.listeners.forEach(fn => fn(true)));
  await button('Next month').click();
  await button('Previous month').click();
  assert.equal(await page.evaluate(() => window.fixture.durations.filter(d => d === 160).length), calendarAnimations);
  await page.evaluate(() => {
    const f = window.fixture;
    f.drives = [f.drive]; f.mode = 'light'; f.accent = '#0F6E5B'; f.font = 'system';
    window.resetFixture();
  });
  await page.setViewportSize({ width: 400, height: 844 });
  await page.getByText('Synthetic Dental Drive', { exact: true }).waitFor();
  passed.push('compact full calendar and empty summary; theme changes do not replay motion; reduced motion disables grid animation');
  assert.equal(await page.evaluate(() => window.pullControls.size), 1, 'the drives list is the only pull scroller');
  const listReads = await page.evaluate(() => window.fixture.reads.length);
  await page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  await page.waitForFunction(n => window.fixture.reads.slice(n).some(r => r.table === 'medical_drives'), listReads);
  await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  assert.equal(await page.getByText('Synthetic Dental Drive', { exact: true }).count(), 1, 'rows stay on screen through a pull');
  passed.push('pulling the day list reloads drives and clears the spinner');
  const reads = await page.evaluate(() => window.fixture.reads.length);
  await button('Hide calendar').click();
  await button('Show calendar').click();
  assert.equal(await page.evaluate(() => window.fixture.reads.length), reads);
  await button('Next month').click();
  await page.waitForFunction(() => window.fixture.reads.some((r) => r.filters.some(([k]) => k === 'gte')));
  const monthPicker = page.getByRole('button', { name: /Open month and year picker/ });
  await monthPicker.click();
  await button('Next year').click();
  const year = new Date().getFullYear() + 1;
  await button('February ' + year).click();
  await button('Show all drives for February').click();
  await page.waitForFunction(() =>
    window.fixture.reads.some((r) => r.filters.some(([k, v]) => k === 'gte' && v.endsWith('-02-01'))),
  );
  await button('Dental Care').click();
  await page.waitForFunction(() =>
    window.fixture.reads.some((r) => r.filters.some(([k, v]) => k === 'type' && v === 'dental')),
  );
  passed.push('calendar visibility is local; month/year jump, month-wide and category queries retained');
  const monthReads = await page.evaluate(() => window.fixture.reads.length);
  await page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  await page.waitForFunction(n => window.fixture.reads.slice(n).some(r => r.table === 'medical_drives' && r.filters.some(([k, v]) => k === 'gte' && v.endsWith('-02-01'))), monthReads);
  await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  passed.push('pulling the month view reloads the month drives and clears the spinner');
  await button('Register').click();
  assert.equal(
    await page.evaluate(() => window.fixture.routes.at(-1).params.driveId),
    '33333333-3333-4333-8333-333333333333',
  );
  // Replace fixture registrations with complete authoritative records.
  await page.evaluate(() => {
    const f = window.fixture;
    f.registrations = ['pending', 'confirmed', 'attended', 'cancelled'].map((status, i) => ({
      id: String(i),
      drive_id: f.drive.id,
      drive: f.drive,
      status,
      applicant_number: 'DEN-SERVER-' + i,
      age: 36,
      is_pwd: false,
      created_at: '2026-10-20T08:00:00Z',
    }));
    window.resetFixture();
  });
  await page.getByRole('tab', { name: 'My Registrations', exact: true }).click();
  await page.getByText('DEN-SERVER-0', { exact: true }).waitFor();
  const retainedRegistration=page.getByRole('button',{name:'View details for Synthetic Dental Drive',exact:true}).first();
  await retainedRegistration.evaluate(node=>{window.retainedRegistrationNode=node});
  await page.evaluate(()=>{window.fixture.holdReads=true;window.dispatchEvent(new CustomEvent('health-focus',{detail:false}))});
  await page.waitForTimeout(30);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('health-focus',{detail:true})));
  await page.getByText('Refreshing registrations…',{exact:true}).waitFor();
  assert.equal(await retainedRegistration.evaluate(node=>node===window.retainedRegistrationNode),true);
  assert.equal(await page.getByRole('button',{name:'View details for Synthetic Dental Drive',exact:true}).count(),4);
  await page.evaluate(()=>{window.fixture.holdReads=false;window.fixture.pendingReads.splice(0).forEach(resolve=>resolve())});
  await page.getByText('Refreshing registrations…',{exact:true}).waitFor({state:'detached'});
  passed.push('actual registrations keep all warm rows and their mounted identity during deferred focus refresh');
  assert.equal(await page.evaluate(() => window.pullControls.size), 1, 'the registrations list is the only pull scroller');
  const registrationReads = await page.evaluate(() => window.fixture.reads.length);
  await page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  await page.waitForFunction(n => window.fixture.reads.slice(n).some(r => r.table === 'drive_registrations'), registrationReads);
  await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  assert.equal(await page.getByRole('button', { name: 'View details for Synthetic Dental Drive', exact: true }).count(), 4);
  passed.push('pulling My Registrations reloads them, keeps all rows and clears the spinner');
  for (const status of ['Pending', 'Confirmed', 'Attended', 'Cancelled']) {
    await button(status).click();
    assert.equal(await page.getByRole('button', { name: /View details for/ }).count(), 1);
  }
  await button('All').click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole('button', { name: 'View details for Synthetic Dental Drive', exact: true })
      .first()
      .click();
    await page.getByRole('dialog').getByText('DEN-SERVER-0', { exact: true }).waitFor();
    await button('Close').click();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  }
  assert.ok(
    await page.evaluate(
      () => window.fixture.durations.includes(280) && window.fixture.durations.includes(200),
    ),
  );
  passed.push(
    'four registration status filters; authoritative detail, pinned Close and five retained M04 exits',
  );
  await render({ regError: true }, true);
  await page.getByRole('tab', { name: 'My Registrations', exact: true }).click();
  await button('Retry registrations').waitFor();
  await render({ regError: false });
  await button('Retry registrations').click();
  await button('Retry registrations').waitFor({ state: 'hidden' });
  await render({ listError: true }, true);
  await button('Retry drives').waitFor();
  await render({ listError: false });
  await button('Retry drives').click();
  await button('Retry drives').waitFor({ state: 'hidden' });
  await render({ listError: true, drives: [] }, true);
  await page.getByRole('button', { name: /Show all drives for/ }).click();
  await page
    .getByText('Could not load this month’s medical drives. Please try again.', { exact: true })
    .waitFor();
  assert.equal(await page.getByText(/No active medical drives in/).count(), 0);
  await page.evaluate(() => {
    window.fixture.listError = false;
    window.fixture.drives = [window.fixture.drive];
  });
  await button('Retry drives').click();
  await button('Retry drives').waitFor({ state: 'hidden' });
  passed.push('date/month/registrations errors remain visible with user-driven retry');
  for (const width of [320, 360, 400, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await render({ mode: 'dark', accent: '#ffff00', font: 'georgia' });
    await page.screenshot({ path: path.join(out, 'list-' + width + '.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  passed.push('compact width, dark mode, extreme accent and selected serif list renders');

  await render({ screen: 'form', mode: 'light', accent: '#0F6E5B', font: 'system' }, true);
  await button('Submit Registration').waitFor();
  assert.equal(await button('Submit Registration').isDisabled(), true);
  assert.equal(await page.getByText('Dose History', { exact: true }).count(), 0);
  await page.getByRole('switch', { name: 'Person with Disability (PWD)?', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Hypertension', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Diabetes', exact: true }).click();
  await page.getByRole('checkbox', { name: 'None', exact: true }).click();
  assert.equal(
    await page.getByRole('checkbox', { name: 'Hypertension', exact: true }).getAttribute('aria-checked'),
    'false',
  );
  await page.getByRole('checkbox', { name: 'Immunocompromised', exact: true }).click();
  assert.equal(
    await page.getByRole('checkbox', { name: 'None', exact: true }).getAttribute('aria-checked'),
    'false',
  );
  await button('Change registrant').click();
  await page.getByRole('radio', { name: 'Synthetic Member', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.getByRole('textbox', { name: 'Age', exact: true }).fill('7');
  await button('Change registrant').click();
  await page.getByRole('radio', { name: 'Synthetic Resident', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(await page.getByRole('textbox', { name: 'Age', exact: true }).count(), 0);
  const consent = page.getByRole('checkbox', { name: 'I understand and consent', exact: true });
  await consent.scrollIntoViewIfNeeded();
  const beforeConsent = await consent.evaluate((el) => {
    let p = el.parentElement;
    while (
      p &&
      !(p.scrollHeight > p.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(p).overflowY))
    )
      p = p.parentElement;
    window.fixture.scrollElement = p;
    return p?.scrollTop ?? 0;
  });
  await consent.click();
  assert.equal(await page.evaluate(() => window.fixture.scrollElement?.scrollTop ?? 0), beforeConsent);
  passed.push(
    'member/self switching, age reset, None/multiple comorbidities and consent retain scroll/form identity',
  );
  await page.evaluate(() => {
    window.fixture.delay = 500;
    window.fixture.writes = [];
  });
  await button('Submit Registration').evaluate((el) => {
    for (let i = 0; i < 5; i++) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.getByText('Registration submitted!', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 1);
  assert.deepEqual(await page.evaluate(() => window.fixture.writes[0].args.p_comorbidities), [
    'Immunocompromised',
  ]);
  assert.equal(await page.evaluate(() => window.fixture.writes[0].args.p_is_pwd), true);
  assert.equal(await page.evaluate(() => window.fixture.writes[0].args.p_prior_dose_date), undefined);
  await page.getByText('DEN-20261020-0046', { exact: true }).waitFor();
  await page.getByText('Pending', { exact: true }).waitFor();
  assert.equal(await page.getByText('Registration Confirmed!', { exact: true }).count(), 0);
  const successAnimations = await page.evaluate(
    () => window.fixture.durations.filter((d) => d === 240).length,
  );
  await render({ mode: 'dark', accent: '#ffffff', font: 'georgia' });
  assert.equal(
    await page.evaluate(() => window.fixture.durations.filter((d) => d === 240).length),
    successAnimations,
  );
  await page.screenshot({ path: path.join(out, 'submitted-dark.png') });
  await button('Done').click();
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), 'back');
  passed.push(
    'five rapid submit events dispatch one RPC; exact server number/Pending status; success motion does not replay on theme',
  );
  for (const message of [
    'Already registered for this drive',
    'No remaining slots for this drive',
    'Synthetic server failure',
  ]) {
    await render({ rpcError: message }, true);
    await consent.click();
    await button('Submit Registration').click();
    await page.getByText(message, { exact: true }).waitFor();
    assert.equal(await consent.getAttribute('aria-checked'), 'true');
    assert.equal(await button('Submit Registration').isEnabled(), true);
  }
  await page.evaluate(() => {
    const f = window.fixture;
    f.drive = { ...f.drive, type: 'vaccination', title: 'Synthetic Vaccination Drive' };
    f.rpcError = null;
    f.writes = [];
    window.resetFixture();
  });
  await page.getByText('Dose History', { exact: true }).waitFor();
  await page.getByRole('radio', { name: '2nd Dose', exact: true }).click();
  await page.getByRole('textbox', { name: 'Previous dose date', exact: true }).fill('2025-02-30');
  await consent.click();
  await button('Submit Registration').click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
  await page.getByRole('textbox', { name: 'Previous dose date', exact: true }).fill('2999-01-01');
  await button('Submit Registration').click();
  await page.getByText('The previous dose date cannot be in the future.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
  await page.getByRole('textbox', { name: 'Previous dose date', exact: true }).fill('2025-02-28');
  await button('Submit Registration').click();
  await page.getByText('Registration submitted!', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes[0].args.p_prior_dose_date), '2025-02-28');
  passed.push(
    'stock/duplicate/server errors preserve consent and retry; vaccination-only dose date validates and sends actual date',
  );
  const validResponse = await page.evaluate(() => window.fixture.response);
  await render({ response: { applicant_number: 'unconfirmed' } }, true);
  await consent.click();
  await button('Submit Registration').click();
  await page
    .getByText(
      'The registration response could not be confirmed. Check My Registrations before trying again.',
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.getByText('Registration submitted!', { exact: true }).count(), 0);
  await render({ response: validResponse }, true);
  await page.evaluate(() => {
    window.fixture.drive = { ...window.fixture.drive, stock_remaining: 0 };
    window.resetFixture();
  });
  await button('No Slots Available').waitFor();
  assert.equal(await button('No Slots Available').isDisabled(), true);
  await page.evaluate(() => {
    window.fixture.drive = { ...window.fixture.drive, stock_remaining: 45 };
    window.fixture.savedProfile = window.fixture.profile;
    window.fixture.profile = null;
    window.resetFixture();
  });
  await button('Retry profile').waitFor();
  await page.evaluate(() => {
    window.fixture.profile = window.fixture.savedProfile;
    window.renderFixture();
  });
  await button('Submit Registration').waitFor();
  passed.push(
    'malformed server result cannot show success; full stock and missing profile have explicit safe states',
  );
  await render({ driveError: true }, true);
  await button('Retry drive details').waitFor();
  await render({ driveError: false });
  await button('Retry drive details').click();
  await button('Submit Registration').waitFor();
  await render({ params: {} }, true);
  await page.getByText('This medical drive link is missing its identifier.', { exact: true }).waitFor();
  await render({ params: { driveId: '33333333-3333-4333-8333-333333333333' }, session: null }, true);
  await page.getByText('Log In Required', { exact: true }).waitFor();
  passed.push('missing drive ID, failed drive fetch/retry and actual guest gate remain recoverable');
  await page.evaluate(() => {
    const f = window.fixture;
    f.session = { user: { id: f.profile.id } };
    f.drive = { ...f.drive, type: 'dental' };
    f.reduced = true;
    window.resetFixture();
  });
  for (const width of [320, 360, 400, 412]) {
    await page.setViewportSize({ width, height: 640 });
    await render({ mode: 'dark', accent: width === 320 ? '#ffff00' : '#000000', font: 'georgia' });
    await button('Submit Registration').waitFor();
    await consent.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'form-' + width + '.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const chip = await page.getByRole('checkbox', { name: 'Immunocompromised', exact: true }).boundingBox();
    assert.ok(chip.width <= width - 40);
  }
  for (let i = 0; i < 5; i++) {
    await button('Change registrant').click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  }
  await render({ screen: 'list' }, true);
  await page.getByText('Medical drives', { exact: true }).waitFor();
  await page.waitForFunction(() => window.fixture.channels.size === 2);
  assert.equal(await page.evaluate(() => window.fixture.channels.size), 2);
  passed.push(
    'compact short-height dark/serif/extreme-accent form; reduced-motion picker Back cycles; channel ownership after navigation',
  );
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') });
  fs.writeFileSync(
    path.join(out, 'failure.json'),
    JSON.stringify({ message: error.message, passed, errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
