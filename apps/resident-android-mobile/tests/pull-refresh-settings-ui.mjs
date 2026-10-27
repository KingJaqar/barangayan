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
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-pull-refresh-settings-'));
fs.mkdirSync(out, { recursive: true });

// Real Valid ID, Manage Password (and Set Password), Email Verification and Location Verification screens with the real
// pull-refresh primitive. Device, auth and data adapters are synthetic and the native RefreshControl is a recording
// fixture, so this proves wiring (which scroller owns the control, what a pull reloads, what stays mounted), not the touch gesture.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityViewIsModal,accessibilityActions,onAccessibilityAction,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const RefreshControl=({children,style,...p})=>{const ref=React.useRef(p);ref.current=p;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>R.Animated.timing(v,{...o,useNativeDriver:false})};
    export const KeyboardAvoidingView=({behavior,...p})=><View {...p}/>;
    export const Modal=({visible,children})=>visible?<div role="dialog" style={{position:'fixed',inset:0,display:'flex',zIndex:10}}>{children}</div>:null;
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy} aria-checked={accessibilityState?.checked}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const BackHandler={addEventListener:()=>({remove:()=>{}})};
    export const Alert={alert:()=>{}};
    export const Linking={openSettings:async()=>{}};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove:()=>{}})};`,
  'expo-router': `import React from 'react';export const useFocusEffect=fn=>React.useEffect(fn,[fn]);const router={back:()=>{},canGoBack:()=>true,replace:()=>{},dismissTo:()=>{}};export const useRouter=()=>router;export const Link=({children})=>children;`,
  'react-native-safe-area-context': `import {View} from 'react-native';export const SafeAreaView=View;const insets={top:0,left:0,right:0,bottom:24};export const useSafeAreaInsets=()=>insets;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={};`,
  'react-native-reanimated': `import {useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export const Image=({source,contentFit,...p})=><View {...p}/>;`,
  'expo-camera': `import React from 'react';import {View} from 'react-native';export const CameraView=React.forwardRef((p,ref)=><View/>);export const useCameraPermissions=()=>[{granted:true,canAskAgain:true},async()=>({granted:true})];`,
  'expo-crypto': `export const randomUUID=()=>'id';`,
  'expo-location': `export const Accuracy={Balanced:3};export const requestForegroundPermissionsAsync=async()=>({status:'granted'});export const getCurrentPositionAsync=async()=>({coords:{latitude:2,longitude:2}});`,
  '@/hooks/use-auth': `export const useAuth=()=>window.fixture.auth;`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,isLoading:window.fixture.loading,isInitialLoading:window.fixture.initialLoading,error:window.fixture.profileError,
    refetch:async()=>{const f=window.fixture;f.refetches++;f.loading=true;window.renderFixture();await new Promise(r=>setTimeout(r,f.refetchDelay));
      if(f.nextError){f.profileError=f.nextError}else{f.profile={...f.profile,...f.nextProfile};f.profileError=null}f.nextProfile={};f.nextError=null;f.loading=false;window.renderFixture()}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'system'});`,
  '@/hooks/use-theme': `import {Colors} from '${src}/constants/theme';import {getResidentTheme} from '${src}/constants/resident-theme';export const useTheme=()=>({...Colors.light,primary:'#0F6E5B',resident:getResidentTheme('light','#0F6E5B')});`,
  '@/components/resident-details-form': `import React from 'react';import {View} from 'react-native';export const FormSection=({children})=><View>{children}</View>;`,
  '@/components/google-button': `import React from 'react';import {PrimaryButton} from '${src}/components/primary-button';export const GoogleButton=({label,onComplete})=><PrimaryButton accessibilityRole="button" accessibilityLabel={label} label={label} onPress={()=>onComplete?.()}/>;`,
  '@/components/map-view': `import React from 'react';export const AMPID_I_SAN_MATEO_CENTER={lat:2,lng:2};export const MapView=({picker,onPickerMoved})=>{return <div style={{height:'100%',background:'#ddd'}}><button disabled={!picker.enabled} onClick={()=>onPickerMoved({lat:3,lng:3})}>Move pin inside</button></div>};`,
  '@/lib/google-auth': `export const googleReauthentication=async()=>{window.fixture.googleChecks++;return window.fixture.google};export const clearGoogleReauthentication=async()=>{};`,
  '@/lib/valid-id': `export const extractIdDetails=async()=>({fullName:'',idNumber:'',birthDate:'',address:''});`,
  '@/lib/image-upload': `export const ACCEPTED_IMAGE_MIME_TYPES=['image/jpeg'];export const imageExtension=()=> 'jpg';export const pickImageAsset=async()=>null;export const readImageBytes=async()=>new Uint8Array([1]);`,
  '@/lib/supabase': `export const supabase={storage:{from:()=>({upload:async()=>({error:null})})},from:()=>({update:values=>({eq:async()=>{window.fixture.writes.push(values);return {error:null}}})}),auth:{signInWithPassword:async()=>({data:{user:{id:'synthetic'}},error:null}),updateUser:async()=>({error:null})}};`,
  '@supabase/supabase-js': `export const createClient=()=>({auth:{}});`,
  '@barangayan/shared': `export {ACCENT_COLORS} from '${shared}/constants/theme-colors';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts';export {ID_TYPES,OTHER_ID_TYPE_PREFIX} from '${shared}/constants/id-verification';export {idConfirmedDetailsSchema} from '${shared}/schemas/service-foundations';export {idVerificationState} from '${shared}/lib/service-catalog';export {changePasswordSchema,PASSWORD_COMPLEXITY_REGEX} from '${shared}/schemas/auth';export {residentPasswordStepSchema,residentSetupFailure} from '${shared}/lib/resident-account-setup';export {isPointInPolygon} from '${shared}/lib/point-in-polygon';
    export const getResidentAccountSetupStatus=async()=>({});
    export const publishIdEvidence=async(client,input)=>input;
    export const reverseGeocode=async()=>'Synthetic detected address';
    export const residentEmailVerification=async(client,owner,action)=>action==='send'?'pending':'verified';`,
};

await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import Id from '${src}/app/(app)/settings/valid-id';import Password from '${src}/app/(app)/settings/change-password';import Email from '${src}/app/(app)/settings/email-verification';import Location from '${src}/app/(app)/settings/location-verification';
const profile={id:'synthetic',email:'resident@example.invalid',email_verification_status:'unverified',id_verification_status:'pending',approved_id_submission_id:null,current_id_submission_id:null,id_repair_required:false,verified_location:{lat:2,lng:2},verified_location_address:'Saved synthetic address',barangays:{name:'Synthetic Barangay',boundary:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]]]}}};
const fixture={screen:'id',profile,auth:{session:{user:{id:profile.id,email:profile.email}},setup:{state:'ready',status:{passwordSet:true,hasGoogleIdentity:false}},refreshCompletion:async()=>{window.fixture.refreshes++},setPasswordRecovery:()=>{}},loading:false,initialLoading:false,profileError:null,refetchDelay:300,nextProfile:{},nextError:null,refetches:0,refreshes:0,google:'none',googleChecks:0,writes:[]};
window.fixture=fixture;const root=createRoot(document.getElementById('root'));let generation=0;
window.renderFixture=()=>root.render(<React.Fragment key={generation}>{fixture.screen==='id'?<Id/>:fixture.screen==='password'?<Password/>:fixture.screen==='email'?<Email/>:<Location/>}</React.Fragment>);window.resetFixture=()=>{generation++;window.renderFixture()};window.renderFixture();`, loader: 'jsx', resolveDir: app },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'native-and-remote-boundaries', setup(b) { b.onResolve({ filter: /.*/ }, a => {
    const key = a.path.startsWith('.') && path.resolve(a.resolveDir, a.path).replaceAll('\\', '/') === src + '/components/resident-details-form' ? '@/components/resident-details-form' : a.path;
    return key in mocks ? { path: key, namespace: 'fixture' } : undefined;
  }); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: app })); } }],
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' });
const errors = [], passed = [];
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 844 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const button = name => page.getByRole('button', { name, exact: true });
  const settle = () => page.waitForTimeout(450);
  const set = async changes => { await page.evaluate(changes => { Object.assign(window.fixture, changes); window.renderFixture(); }, changes); await settle(); };
  const open = async (screen, changes = {}) => { await page.evaluate(([screen, changes]) => { Object.assign(window.fixture, { screen, loading: false, initialLoading: false, profileError: null, nextProfile: {}, nextError: null, refetches: 0, refreshes: 0, googleChecks: 0 }, changes); window.resetFixture(); }, [screen, changes]); await settle(); };
  const controls = () => page.evaluate(() => window.pullControls?.size ?? 0);
  const fixture = key => page.evaluate(key => window.fixture[key], key);
  const pull = () => page.evaluate(() => [...window.pullControls][0].current.onRefresh());
  const pulling = () => page.evaluate(() => [...window.pullControls][0].current.refreshing);

  // Valid ID: the status view owns the control; a refresh keeps it mounted and shows the existing checking text.
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  assert.equal(await controls(), 1, 'Valid ID status view mounts one control');
  await set({ nextProfile: { id_verification_status: 'verified', approved_id_submission_id: 'a', current_id_submission_id: 'a' } });
  await pull();
  await page.getByText('Checking verification status…', { exact: true }).waitFor();
  assert.equal(await controls(), 1, 'the scroller (and its control) stays mounted while the profile refreshes');
  assert.equal(await pulling(), true, 'the spinner shows during the refresh');
  await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  assert.equal(await fixture('refetches'), 1, 'one pull reads the profile once');
  assert.equal(await pulling(), false, 'the spinner ends when the profile settles');
  passed.push('Valid ID pull reloads the profile once, keeps the scroller mounted and shows the changed status');
  await set({ nextError: 'Verification unavailable.' });
  await pull();
  await page.getByText('Verification unavailable.', { exact: true }).waitFor();
  assert.equal(await pulling(), false);
  assert.equal(await controls(), 1, 'the existing error view keeps the control');
  passed.push('failed Valid ID pull shows the existing error view with its Try again button and the spinner ends');
  await open('id', { profile: { ...(await fixture('profile')), id_verification_status: null, approved_id_submission_id: null, current_id_submission_id: null } });
  await button('Continue').waitFor();
  assert.equal(await controls(), 0, 'the Valid ID form has no control');
  passed.push('Valid ID form steps stay free of pull-to-refresh');

  // Email verification: the form (and a half-typed code) survives a pull.
  await open('email');
  await button('Send code').click();
  const code = page.getByRole('textbox', { name: 'Email Code', exact: true });
  await code.waitFor();
  await code.fill('123');
  assert.equal(await controls(), 1);
  await set({ nextProfile: { email_verification_status: 'verified' } });
  await pull();
  await page.waitForTimeout(100);
  assert.equal(await controls(), 1, 'the email form is not replaced by the loading view during a pull');
  assert.equal(await code.inputValue(), '123', 'the typed code survives the pull');
  await page.getByText('Email verified', { exact: true }).waitFor();
  assert.equal(await fixture('refetches'), 1);
  passed.push('Email Verification pull keeps the form and typed code, then shows the verified status');
  await open('email', { initialLoading: true });
  await page.getByText('Loading your profile…', { exact: true }).waitFor();
  assert.equal(await controls(), 0, 'the first read still shows the loading view without a control');
  passed.push('Email Verification first load is unchanged');

  // Location Verification: the map, pin and unsaved address survive; saving stays blocked while the profile refreshes.
  await open('location');
  await button('Move pin inside').waitFor();
  await button('Move pin inside').click();
  await page.getByText('3.00000, 3.00000', { exact: true }).waitFor();
  assert.equal(await controls(), 1);
  await set({ nextProfile: { verified_location_address: 'Updated synthetic address' }, refetchDelay: 900 });
  await pull();
  await page.waitForTimeout(150);
  assert.equal(await button('Move pin inside').count(), 1, 'the map stays mounted while the profile refreshes');
  assert.equal(await page.getByText('3.00000, 3.00000', { exact: true }).count(), 1, 'the unsaved pin position survives');
  await button('Save My Location').click();
  assert.equal(await fixture('writes').then(w => w.length), 0, 'saving is blocked while the profile refreshes');
  await page.getByText('Updated synthetic address', { exact: true }).waitFor();
  assert.equal(await fixture('refetches'), 1);
  assert.equal(await pulling(), false);
  passed.push('Location Verification pull keeps the map and pin, blocks saving while refreshing, then shows the refreshed saved address');
  await button('Hide location details').click(); await settle();
  assert.equal(await controls(), 0, 'with the details sheet hidden there is no scroller');
  passed.push('Location Verification hidden sheet has no control');

  // Manage password: a pull re-checks the account's password status and keeps typed fields.
  await open('password');
  const field = page.getByRole('textbox').first();
  await field.waitFor();
  await field.fill('Typed-current-1!');
  assert.equal(await controls(), 1);
  await pull();
  await page.waitForTimeout(100);
  assert.equal(await fixture('refreshes'), 1, 'a pull refreshes the password status once');
  assert.equal(await field.inputValue(), 'Typed-current-1!', 'typed password fields survive');
  passed.push('Manage Password pull re-checks the password status once and keeps typed fields');
  await page.evaluate(() => { window.fixture.auth.setup = { state: 'ready', status: { passwordSet: false, hasGoogleIdentity: true } }; });
  await open('password');
  await button('Confirm with Google').waitFor();
  assert.equal(await controls(), 1, 'Set Password confirmation view mounts one control');
  const before = await fixture('googleChecks');
  await pull();
  await page.waitForTimeout(100);
  assert.equal(await fixture('googleChecks'), before + 1, 'a pull re-checks the Google confirmation once');
  passed.push('Set Password pull re-checks the Google confirmation once');

  console.log(JSON.stringify({ passed, errors }, null, 2));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
