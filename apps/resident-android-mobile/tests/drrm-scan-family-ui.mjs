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
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/family-attendance-phase3-20261022/ui');
fs.mkdirSync(out, { recursive: true });

// Real guide, scanner, sheets, household hook, validation, theme, font and motion.
// Only native APIs/data transport are synthetic; no live records, permission prompts or sharing.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityViewIsModal,accessibilityElementsHidden,importantForAccessibility,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const KeyboardAvoidingView=({behavior,...p})=><View {...p}/>;
    export const Modal=({visible,onShow,onRequestClose,children})=>{const show=React.useRef(onShow);show.current=onShow;React.useEffect(()=>{if(visible)show.current?.()},[visible]);React.useEffect(()=>{if(!visible)return;const fn=e=>{if(e.key==='Escape')onRequestClose?.()};document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn)},[visible,onRequestClose]);return visible?<div role="dialog" style={{position:'fixed',inset:0,display:'flex',zIndex:10}}>{children}</div>:null};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy}/>);
    export const ScrollView=React.forwardRef(({onScroll,onMomentumScrollEnd,onScrollEndDrag,...p},r)=><R.ScrollView {...p} ref={r} onScroll={e=>{onScroll?.(e);onMomentumScrollEnd?.(e)}}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const AppState={currentState:'active',addEventListener:(event,fn)=>{window.fixture.appListeners.add(fn);return{remove:()=>window.fixture.appListeners.delete(fn)}}};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(event,fn)=>{window.fixture.motionListeners.add(fn);return{remove:()=>window.fixture.motionListeners.delete(fn)}}};
    export const Share={share:async data=>{window.fixture.shares.push(data);if(window.fixture.shareFailure)throw Error('Synthetic share error');return {action:'dismissedAction'}}};`,
  'expo-router': `export const useIsFocused=()=>window.fixture.focused;export const router={back:()=>{},replace:url=>window.fixture.routes.push(url)};export const useRouter=()=>router;`,
  'react-native-safe-area-context': `import React from 'react';import {View} from 'react-native';export const SafeAreaProvider=View;export const SafeAreaView=View;const insets={top:0,left:0,right:0,bottom:0};export const useSafeAreaInsets=()=>insets;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={'information-circle-outline':1};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:window.fixture.mode,accentColor:window.fixture.accent});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@barangayan/shared': `export {householdQrPayloadSchema,householdAttendanceSchema,householdAttendanceErrorMessage} from '${shared}/schemas/household-attendance.ts';export {qrStepItemSchema,evacuationCenterQrPayloadSchema} from '${shared}/schemas/emergency-qr.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,refetch:()=>{const f=window.fixture;f.profileRefreshes++;f.profile={...f.profile,household_members:f.db};window.renderFixture()},isLoading:false,error:null});`,
  '@/hooks/use-emergency-qr-content': `export const useEmergencyQrContent=()=>({content:window.fixture.instructions,isLoading:window.fixture.loading,error:window.fixture.sourceError,isOffline:window.fixture.offline,refetch:()=>{window.fixture.retries++;window.fixture.sourceError=null;window.renderFixture()}});`,
  '@/hooks/use-evacuation-centers': `export const useEvacuationCenters=()=>({centers:window.fixture.centers.map(c=>({...c})),isLoading:window.fixture.centersLoading,error:window.fixture.centersError,refetch:()=>{window.fixture.retries++;window.fixture.centersError=null;window.renderFixture()}});`,
  '@/lib/supabase': `const request=work=>{let signal;const q={abortSignal:s=>{signal=s;return q},single:()=>q,then:(resolve,reject)=>Promise.resolve().then(()=>{if(signal?.aborted)throw Error('aborted');return work(signal)}).then(resolve,reject)};return q};
    export const supabase={from:table=>({select:columns=>({eq:(column,id)=>request(async signal=>{
      const f=window.fixture;f.reads.push({table,columns,column,id});
      if(f.holdRead)await new Promise(r=>f.resolveRead=r);
      return f.readFailure?{data:null,error:{message:'private diagnostic'}}:{data:{household_members:f.db},error:null};
    })})}),rpc:(name,args)=>request(async signal=>{
      const f=window.fixture;
      if(name==='get_my_household_attendance'){
        f.attendanceReads++;
        if(f.holdAttendance)await new Promise(r=>f.resolveAttendance=r);
        if(f.attendanceFailure)return{data:null,error:{message:'private attendance error'}};
        if(f.wrongAttendance)return{data:{household_profile_id:'99999999-9999-4999-8999-999999999999',people:[]},error:null};
        return{data:{household_profile_id:f.session.user.id,people:[{kind:'holder',member_id:null,name:f.profile.full_name,relation:null,role:null,current_stay:f.holderStay??null,latest_departure:f.departure??null},...f.db.filter(m=>m?.id).map(m=>({kind:'member',member_id:m.id,name:m.name,relation:m.relation,role:m.role??null,current_stay:f.memberStays?.[m.id]??null,latest_departure:null}))]},error:null};
      }
      f.writes.push({name,args});
      if(f.holdWrite)await new Promise(r=>f.resolveWrite=r);
      if(signal?.aborted)throw Error('aborted');
      if(f.writeFailure)return{data:null,error:{message:f.activeRemoval?'attendance_lifecycle_conflict':'resident_household_changed',code:'PT409'}};
      if(JSON.stringify(args.p_expected)!==JSON.stringify(f.db))return{data:null,error:{message:'resident_household_changed',code:'PT409'}};
      f.db=args.p_members;return{data:f.db,error:null};
    })};`,
  'expo-camera': `import React from 'react';import {View} from 'react-native';export const Camera={getCameraPermissionsAsync:async()=>{const f=window.fixture;if(f.permissionReadFailure)throw Error('Synthetic permission read error');return {granted:f.granted,status:f.granted?'granted':'denied',canAskAgain:f.canAskAgain}},requestCameraPermissionsAsync:async()=>{const f=window.fixture;f.permissionRequests++;if(f.permissionFailure)throw Error('Synthetic permission error');f.granted=f.grantResult;return{granted:f.granted,status:f.granted?'granted':'denied',canAskAgain:f.canAskAgain}}};export function CameraView(p){React.useEffect(()=>{const f=window.fixture;f.cameraMounts++;p.onCameraReady?.();return()=>{f.cameraUnmounts++}},[]);React.useEffect(()=>{window.fixture.camera=p});return <View accessibilityLabel="Synthetic live camera" style={p.style}/>}`,
  'expo-linking': `export const openSettings=async()=>{window.fixture.settingsOpens++;if(window.fixture.settingsFailure)throw Error('Synthetic settings failure')};`,
  'expo-constants': `export const ExecutionEnvironment={StoreClient:'storeClient'};export default {executionEnvironment:'bare'};`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export function Image({source,onLoadStart,onLoad,onError,style,accessibilityLabel}){React.useEffect(()=>{const f=window.fixture;f.images.push(source);onLoadStart?.();f.imageFailure?onError?.({error:'synthetic-image-error'}):onLoad?.()},[]);return <View accessibilityLabel={accessibilityLabel} style={style}/>}`,
  'react-native-qrcode-svg': `import React from 'react';export default function QRCode({value,size}){return <svg data-qr={value} width={size} height={size} aria-label="Synthetic rendered QR"/>}`,
  'react-native-view-shot': `export const captureRef=async()=>{window.fixture.captures++;if(window.fixture.captureFailure)throw Error('Synthetic capture failure');return 'file:///synthetic-code.png'};export const releaseCapture=uri=>window.fixture.released.push(uri);`,
  'expo-media-library': `export const requestPermissionsAsync=async()=>({status:window.fixture.mediaGranted?'granted':'denied'});export const Asset={create:async uri=>{window.fixture.assets.push(uri);return uri}};export const Album={create:async(name,assets)=>{window.fixture.albums.push({name,assets})}};`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ScrollView,View} from 'react-native';
    import {ScanFamilySheet} from '${root}/components/drrm/scan-family-sheet';import {QrGuideContent} from '${root}/components/qr-guide-content';import {FamilyContent} from '${root}/components/family-content';import {useTheme} from '${root}/hooks/use-theme';
    const owner='11111111-1111-4111-8111-111111111111',barangay='22222222-2222-4222-8222-222222222222';
    window.fixture={screen:'scan',mode:'light',accent:'#0F6E5B',font:'system',reduced:false,focused:true,session:{user:{id:owner},access_token:'synthetic-token'},profile:{id:owner,barangay_id:barangay,full_name:'Synthetic Resident',last_name:'Resident',household_members:[]},db:[],
      instructions:[{section:'why_scan',title:'Managed reason',body:'Managed check-in instructions',icon:'information-circle-outline',icon_color:'#2563EB',icon_bg:'#DBEAFE'},{section:'how_it_works',title:'Managed steps',body:'Managed introduction',content:[{step:1,title:'First managed step',desc:'First managed description'},{step:2,title:'Second managed step',desc:'Second managed description'}]}],
      centers:[{id:'33333333-3333-4333-8333-333333333333',barangay_id:barangay,name:'Zulu Center',address:'Stored address Z'},{id:'44444444-4444-4444-8444-444444444444',barangay_id:barangay,name:'Alpha Center',address:'Stored address A'}],
      appListeners:new Set(),motionListeners:new Set(),durations:[],routes:[],retries:0,profileRefreshes:0,attendanceReads:0,reads:[],writes:[],checkins:[],householdUpdates:0,cameraMounts:0,cameraUnmounts:0,permissionRequests:0,settingsOpens:0,shares:[],images:[],assets:[],albums:[],released:[],captures:0,granted:false,grantResult:false,canAskAgain:true,mediaGranted:false};
    const root=createRoot(document.getElementById('root'));let generation=0;
    function Surface(){const {resident}=useTheme();return <ScrollView style={{flex:1,backgroundColor:resident.card}} contentContainerStyle={{padding:20,paddingBottom:40}}>{window.fixture.screen==='scan'?<QrGuideContent/>:window.fixture.screen==='family'?<FamilyContent/>:window.fixture.screen==='motion'?<ScanFamilySheet visible={window.fixture.motionVisible} picker={window.fixture.motionPicker} slide title="Controlled motion" onClose={()=>{window.fixture.motionVisible=false;window.renderFixture()}}><View style={{height:200}}/></ScanFamilySheet>:null}</ScrollView>}
    window.renderFixture=()=>root.render(<Surface key={generation}/>);window.resetFixture=()=>{generation++;window.renderFixture()};window.renderFixture();`, resolveDir: app, loader: 'jsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_PUBLIC_SUPABASE_URL': '"https://synthetic.invalid"' },
  plugins: [{ name: 'native-adapters', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' });
const errors = [], passed = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 400, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const render = (patch = {}, reset = false) => page.evaluate(({patch,reset})=>{Object.assign(window.fixture,patch);reset?window.resetFixture():window.renderFixture()}, {patch,reset});
  const button = name => page.getByRole('button', {name,exact:true});
  const noDialogs = () => page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
  const close = async name => { await button(name).click(); await noDialogs(); };
  await page.getByText('First managed description',{exact:true}).waitFor();
  await render({sourceError:'Synthetic error',offline:true});
  await page.getByText('Unable to refresh instructions. Showing available information.').waitFor();
  await button('Retry').click();
  assert.equal(await page.evaluate(()=>window.fixture.retries),1);
  passed.push('managed guide content survives refresh error, offline badge and real Retry');

  await button('Scan QR code').click();await button('Grant Access').waitFor();await button('Grant Access').click();
  await page.getByText(/Camera access was denied/).waitFor();
  await render({canAskAgain:false});await close('Cancel');
  await button('Scan QR code').click();await button('Open Settings').waitFor();await button('Open Settings').click();
  assert.equal(await page.evaluate(()=>window.fixture.settingsOpens),1);
  await close('Cancel');
  await render({granted:true});await button('Scan QR code').click();await button('Close QR scanner').waitFor();
  await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.camera.onBarcodeScanned({data:'not-json'});window.fixture.camera.onBarcodeScanned({data:'not-json'})});
  await page.getByText('This is not a valid evacuation center check-in QR code.').waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.checkins.length),0);
  await close('Close scanner');
  passed.push('denied/permanent permission recovery, settings, schema-invalid scan and close');

  const payload={type:'EVACUATION_CENTER_CHECKIN',version:'1.0',center_id:'33333333-3333-4333-8333-333333333333',center_name:'Zulu Center',barangay_id:'22222222-2222-4222-8222-222222222222'};
  await button('Scan QR code').click();await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
  await page.evaluate(data=>{const fn=window.fixture.camera.onBarcodeScanned;for(let i=0;i<5;i++)fn({data:JSON.stringify(data)})}, {...payload,barangay_id:'55555555-5555-4555-8555-555555555555'});
  await page.getByText('This QR code belongs to a different barangay.').waitFor();assert.equal(await page.evaluate(()=>window.fixture.checkins.length),0);await close('Close scanner');
  await button('Scan QR code').click();await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
  await page.evaluate(data=>{const fn=window.fixture.camera.onBarcodeScanned;for(let i=0;i<8;i++)fn({data:JSON.stringify(data)})},payload);
  await page.getByText(/Ask barangay staff to scan your Family QR/).waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.checkins.length+window.fixture.householdUpdates+window.fixture.writes.length),0);
  await close('Close scanner');
  passed.push('wrong-barangay rejection and repeated native callbacks cause zero attendance or blanket writes');

  for(let i=0;i<2;i++){
    await button('Scan QR code').click();await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
    await page.evaluate(()=>{for(const fn of window.fixture.appListeners)fn('background')});await noDialogs();
    assert.equal(await page.evaluate(()=>window.fixture.cameraMounts-window.fixture.cameraUnmounts),0);
    await page.evaluate(()=>{for(const fn of window.fixture.appListeners)fn('active')});
  }
  await button('Scan QR code').click();await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.camera.onMountError({message:'synthetic failure'}));await button('Retry camera').waitFor();await button('Retry camera').click();await page.getByLabel('Synthetic live camera',{exact:true}).waitFor();
  await render({focused:false});await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.fixture.cameraMounts-window.fixture.cameraUnmounts),0);await render({focused:true});
  passed.push('camera mount-error retry, two background cycles and focus-loss release');

  await render({checkinFailure:false,granted:false,canAskAgain:true,permissionFailure:true});await button('Scan QR code').click();await button('Grant Access').waitFor();await button('Grant Access').click();
  await page.getByText('Could not open camera permissions. Please try again.').waitFor();await close('Cancel');await render({granted:true,permissionFailure:false});
  passed.push('permission API exception remains recoverable after attendance cutover');

  await button('Show QR code').click();await button('Select Evacuation Center').waitFor();
  const firstQr=await page.locator('[data-qr]').getAttribute('data-qr');assert.deepEqual(JSON.parse(firstQr).type,'EVACUATION_CENTER_CHECKIN');
  await render({mode:'dark',accent:'#FFFFFF'});assert.equal(await page.locator('[data-qr]').getAttribute('data-qr'),firstQr);
  await button('Select Evacuation Center').click();await page.getByRole('radio',{name:'Alpha Center',exact:true}).waitFor();
  assert.deepEqual(await page.getByRole('radio').allTextContents(),['Alpha CenterStored address A','Zulu CenterStored address Z']);
  await page.getByRole('radio',{name:'Alpha Center',exact:true}).click();await page.getByRole('radio').first().waitFor({state:'detached'});
  assert.equal(JSON.parse(await page.locator('[data-qr]').getAttribute('data-qr')).center_id,'44444444-4444-4444-8444-444444444444');
  await render({shareFailure:true});await button('Share QR Code').click();await page.getByText('Could not share the QR code. Please try again.').waitFor();
  await render({shareFailure:false});await button('Share QR Code').click();
  assert.equal(await page.evaluate(()=>window.fixture.shares.length),2);
  await button('Download QR').click();await page.getByText(/Photo access was denied/).waitFor();
  await render({mediaGranted:true,captureFailure:true});await button('Download QR').click();await page.getByText('Failed to save the QR code. Please try again.').waitFor();
  await render({captureFailure:false});await button('Download QR').click();await page.getByText('QR code saved to your photo gallery.').waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.albums.length),1);
  assert.deepEqual(await page.evaluate(()=>window.fixture.released),['file:///synthetic-code.png']);
  // Content stays intact until the exit finishes; removing it early shrinks the moving sheet.
  await button('Close Show QR Code').click();
  assert.equal(await page.locator('[data-qr]').count(),1);
  await noDialogs();
  passed.push('stable validated QR, alphabetical picker, selected payload, share failure/cancel and denied/failed/successful gallery adapters');

  const savedCenters=await page.evaluate(()=>window.fixture.centers);
  await render({centers:[],centersLoading:true});await button('Show QR code').click();await page.getByText('Loading centers…',{exact:true}).waitFor();assert.equal(await button('Share QR Code').isDisabled(),true);
  await render({centersLoading:false});await page.getByText('No evacuation centers available.').waitFor();
  await render({centersError:'Synthetic centers failure'});await page.getByText('Unable to load evacuation centers.').waitFor();await button('Retry').click();
  await render({centers:savedCenters});await page.locator('[data-qr]').waitFor();await close('Close Show QR Code');
  passed.push('center loading/empty/error/Retry retains truthful QR disabled state');

  await render({screen:'family',mode:'light',accent:'#0F6E5B'},true);await page.getByText('1 person',{exact:true}).waitFor();
  await page.getByText('Account holder (you)',{exact:true}).waitFor();
  await page.getByText('No recorded check-in',{exact:true}).waitFor();
  const stay={attendance_id:'88888888-8888-4888-8888-888888888888',center_id:'33333333-3333-4333-8333-333333333333',center_name:'Zulu Center',checked_in_at:'2026-10-21T20:00:00Z',checked_out_at:null};
  await render({holderStay:stay});await button('Refresh family').click();await page.getByText(/Checked in at Zulu Center/).waitFor();await page.getByText(/4:00/).waitFor();
  await render({holderStay:null,departure:{...stay,checked_out_at:'2026-10-21T21:00:00Z'}});await button('Refresh family').click();await page.getByText(/Departed/).waitFor();
  passed.push('holder-only household, authoritative arrival and departure, Manila timestamps and explicit refresh');
  await button('Add Family Member').click();await page.getByRole('textbox',{name:'Full Name'}).fill(' Synthetic Member ');
  await render({writeFailure:true});await button('Add Member').click();await page.getByText(/Your family list changed elsewhere/).first().waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Full Name'}).inputValue(),' Synthetic Member ');
  await render({writeFailure:false});await button('Reload family list').click();await noDialogs();await button('Add Family Member').click();await page.getByRole('textbox',{name:'Full Name'}).fill('Synthetic Member');
  await render({holdWrite:true});await button('Add Member').evaluate(el=>{el.click();el.click()});await page.waitForFunction(()=>window.fixture.writes.length===2);
  assert.equal(await button('Add Member').isDisabled(),true);await button('Close Add Family Member').click({force:true});assert.equal(await page.getByRole('textbox',{name:'Full Name'}).count(),1);
  await page.evaluate(()=>window.fixture.resolveWrite());await noDialogs();await button('Edit Synthetic Member').waitFor();
  const write=await page.evaluate(()=>window.fixture.writes.at(-1));assert.equal(write.name,'save_resident_household_if_unchanged');assert.deepEqual(write.args.p_expected,[]);assert.equal(write.args.p_members[0].name,'Synthetic Member');assert.match(write.args.p_members[0].id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  await render({holdWrite:false});await button('Edit Synthetic Member').click();await page.getByRole('textbox',{name:'Full Name'}).fill('Updated Member');await button('Update').click();await noDialogs();await button('Edit Updated Member').waitFor();
  passed.push('conditional add/rename, exact expected snapshot, stale-editor feedback/reload, busy double-save/close protection');
  await button('Edit Updated Member').click();await button('Remove').click();await render({writeFailure:true,activeRemoval:true});await button('Confirm Remove').click();await page.getByText(/This person is checked in/).first().waitFor();assert.equal(await page.evaluate(()=>window.fixture.db.length),1);
  await render({writeFailure:false,activeRemoval:false});await button('Reload family list').click();await noDialogs();await button('Edit Updated Member').click();await button('Remove').click();await button('Confirm Remove').click();await noDialogs();await page.getByText('1 person',{exact:true}).waitFor();
  await render({readFailure:true},true);await page.getByText('Unable to load family members. Reconnect and try again.',{exact:true}).waitFor();await render({readFailure:false});await page.getByRole('button',{name:'Retry',exact:true}).first().click();await button('Add Family Member').waitFor();
  await render({attendanceFailure:true});await button('Refresh family').click();await page.getByText('Could not load attendance. Reconnect and try again.').waitFor();await page.getByText('Attendance unavailable. Refresh to check.',{exact:true}).waitFor();
  await render({attendanceFailure:false});await button('Refresh family').click();await page.getByText(/Departed/).waitFor();
  await render({wrongAttendance:true});await button('Refresh family').click();await page.getByText('Could not load attendance. Reconnect and try again.').waitFor();await page.getByText('Attendance unavailable. Refresh to check.',{exact:true}).waitFor();
  await render({wrongAttendance:false});await button('Refresh family').click();await page.getByText(/Departed/).waitFor();
  const inlineQr=JSON.parse(await page.locator('[data-qr]').first().getAttribute('data-qr'));assert.deepEqual(inlineQr,{type:'household',version:'1.0',profileId:'11111111-1111-4111-8111-111111111111'});
  await button('Show My Code').click();await button('Close Synthetic Resident').waitFor();const codes=await page.locator('[data-qr]').evaluateAll(es=>es.map(e=>e.getAttribute('data-qr')));assert.equal(new Set(codes).size,1);assert.deepEqual(await page.evaluate(()=>window.fixture.images),[]);await close('Close Synthetic Resident');
  const counts=await page.evaluate(()=>({reads:window.fixture.reads.length,attendance:window.fixture.attendanceReads,writes:window.fixture.writes.length}));await page.waitForTimeout(500);await render({accent:'#123456'});await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>({reads:window.fixture.reads.length,attendance:window.fixture.attendanceReads,writes:window.fixture.writes.length})),counts);
  await render({focused:false});await render({focused:true});await page.waitForFunction(old=>window.fixture.attendanceReads===old+1,counts.attendance);
  await page.evaluate(()=>{for(const fn of window.fixture.appListeners)fn('active')});await page.waitForFunction(old=>window.fixture.attendanceReads===old+2,counts.attendance);
  passed.push('active removal guard, read/status errors and retry, local data-only normal/enlarged QR, stable idle counts and bounded focus/resume refresh');

  for(const width of [320,360,400,412])for(const mode of ['light','dark']){
    await page.setViewportSize({width,height:640});await render({mode,accent:mode==='dark'?'#FFFFFF':'#FFFF00',font:'georgia'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${width}/${mode} horizontal overflow`);
    await page.screenshot({path:path.join(out,`family-${width}-${mode}.png`),fullPage:true});
  }
  for(const font of ['system','inter','arial','helvetica','segoe-ui','verdana','tahoma','trebuchet-ms','georgia','times-new-roman']){
    await render({font,accent:'#2563EB'});await button('Add Family Member').click();await button('Add Member').waitFor();
    const input=page.getByRole('textbox',{name:'Full Name'});await input.fill('Synthetic long member name for selected font');
    assert.ok(await input.evaluate(e=>e.getBoundingClientRect().right<=window.innerWidth));await close('Close Add Family Member');
  }
  await page.evaluate(()=>{window.fixture.db={invalid:'not-an-array'};window.fixture.profile={...window.fixture.profile,household_members:window.fixture.db};window.renderFixture()});
  await page.getByText('Your family list could not be read. Reload it before editing.').waitFor();assert.equal(await button('Add Family Member').isDisabled(),true);
  await page.evaluate(()=>{window.fixture.db=[];window.fixture.profile={...window.fixture.profile,household_members:[]};window.renderFixture()});await button('Add Family Member').waitFor();
  await render({holdAttendance:true});await button('Refresh family').click();await page.waitForFunction(()=>typeof window.fixture.resolveAttendance==='function');
  await page.evaluate(()=>{const id='77777777-7777-4777-8777-777777777777';const late=window.fixture.resolveAttendance;window.fixture.holdAttendance=false;window.fixture.departure=null;window.fixture.db=[];window.fixture.profile={id,full_name:'Other Fixture',last_name:'Other',household_members:[]};window.fixture.session={user:{id},access_token:'other-synthetic-token'};window.renderFixture();late()});
  await page.getByText('1 person',{exact:true}).waitFor();assert.equal(await button('Edit Profile Changed').count(),0);
  passed.push('all ten offered fonts keep form reachable; malformed JSON blocks editing; account switch clears prior members');
  await page.evaluate(()=>{window.fixture.profile={...window.fixture.profile,barangay_id:'22222222-2222-4222-8222-222222222222'};window.renderFixture()});
  await render({screen:'scan',mode:'light',accent:'#0F6E5B',font:'system'},true);
  for(let i=0;i<5;i++){await button('Show QR code').click();await button('Close Show QR Code').waitFor();await close('Close Show QR Code')}
  const normalDurations=await page.evaluate(()=>window.fixture.durations);for(const duration of [300,240,200,140,180,160])assert.ok(normalDurations.includes(duration));
  await page.evaluate(()=>{window.fixture.reduced=true;window.fixture.durations=[];for(const fn of window.fixture.motionListeners)fn(true)});
  await button('Show QR code').click();await button('Close Show QR Code').waitFor();await close('Close Show QR Code');assert.ok((await page.evaluate(()=>window.fixture.durations)).every(value=>value<=100));
  // Reverse an exit before completion: the native Modal must stay mounted and return to rest.
  await render({screen:'motion',motionVisible:true,motionPicker:false,reduced:false},true);
  const panelTransform=()=>page.getByRole('dialog').locator('div').evaluateAll(elements=>elements.map(e=>getComputedStyle(e).transform).filter(t=>t!=='none'));
  await button('Close Controlled motion').waitFor();await page.waitForTimeout(350);
  const resting=await button('Close Controlled motion').boundingBox();
  await render({motionVisible:false});await page.waitForTimeout(70);
  await render({motionVisible:true});await page.waitForTimeout(350);
  assert.equal(await page.getByRole('dialog').count(),1);
  const reopened=await button('Close Controlled motion').boundingBox();
  assert.ok(Math.abs(resting.y-reopened.y)<1,'reopened sheet returns to its measured resting position');
  await render({motionVisible:false});await noDialogs();
  await render({motionVisible:true,motionPicker:true});await button('Close Controlled motion').waitFor();await page.waitForTimeout(240);
  assert.ok((await panelTransform()).every(value=>value==='matrix(1, 0, 0, 1, 0, 0)'),'center picker fades without a scale or translation');
  await render({motionVisible:false});await noDialogs();
  passed.push('interrupted slide exit reopens without stale unmount or position jump; picker uses opacity only');
  await render({screen:'none'},true);await page.waitForFunction(()=>window.fixture.motionListeners.size===0&&window.fixture.appListeners.size===0);
  assert.equal(await page.evaluate(()=>window.fixture.cameraMounts-window.fixture.cameraUnmounts),0);
  passed.push('320/360/400/412 light/dark/extreme accents/serif overflow; five sheet cycles; reduced motion <=100ms; resource cleanup');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({passed,errors},null,2));
} catch(error) {
  if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,errors,error:String(error)},null,2));
  throw error;
} finally { await browser.close(); }
