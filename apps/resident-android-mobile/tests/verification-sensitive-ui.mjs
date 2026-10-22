import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const src = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-android-magicpatterns-phase-14-20261021/ui');
fs.mkdirSync(out, { recursive: true });

// Real screen controllers/primitives/schemas. Only device and remote boundaries are synthetic.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityViewIsModal,accessibilityActions,onAccessibilityAction,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const KeyboardAvoidingView=({behavior,...p})=><View {...p}/>;
    export const Modal=({visible,onRequestClose,children})=>{React.useEffect(()=>{if(!visible)return;const fn=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();onRequestClose?.()}};document.addEventListener('keydown',fn,true);return()=>document.removeEventListener('keydown',fn,true)},[visible,onRequestClose]);return visible?<div role="dialog" style={{position:'fixed',inset:0,display:'flex',zIndex:10}}>{children}</div>:null};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy} aria-checked={accessibilityState?.checked}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const BackHandler={addEventListener:(event,fn)=>{window.fixture.backs.add(fn);return{remove:()=>window.fixture.backs.delete(fn)}}};
    export const Alert={alert:(...args)=>window.fixture.alerts.push(args)};
    export const Linking={openSettings:async()=>{window.fixture.permissionSettings++}};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(event,fn)=>{window.fixture.listeners.add(fn);return{remove:()=>window.fixture.listeners.delete(fn)}}};`,
  'expo-router': `import React from 'react';export const useFocusEffect=fn=>React.useEffect(fn,[fn]);const router={back:()=>window.fixture.routes.push('back'),canGoBack:()=>true,replace:r=>window.fixture.routes.push(r),dismissTo:r=>window.fixture.routes.push(r)};export const useRouter=()=>router;export const Link=({href,children})=>React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});`,
  'react-native-safe-area-context': `import {View} from 'react-native';export const SafeAreaView=View;const insets={top:0,left:0,right:0,bottom:24};export const useSafeAreaInsets=()=>insets;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={};`,
  'react-native-reanimated': `import {useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=(v,o)=>{window.fixture.durations.push(o?.duration);return v};export const cancelAnimation=()=>{};export {Easing};`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export const Image=({source,contentFit,...p})=><View {...p} data-fit={contentFit} data-photo={source?.uri}/>;`,
  'expo-camera': `import React from 'react';import {View} from 'react-native';export const CameraView=React.forwardRef(({onCameraReady,onMountError,facing,...p},ref)=>{React.useEffect(()=>{onCameraReady()},[]);React.useImperativeHandle(ref,()=>({takePictureAsync:async()=>({base64:'AQID',uri:'synthetic-camera.jpg'})}));return <View {...p}/>});export const useCameraPermissions=()=>[window.fixture.permission,async()=>window.fixture.permission];`,
  'expo-crypto': `export const randomUUID=()=>String(++window.fixture.ids);`,
  'expo-location': `export const Accuracy={Balanced:3};export const requestForegroundPermissionsAsync=async()=>({status:window.fixture.gpsPermission});export const getCurrentPositionAsync=async()=>{window.fixture.gpsCalls++;if(window.fixture.gpsError)throw new Error('unavailable');return {coords:window.fixture.gps}};`,
  '@/hooks/use-auth': `export const useAuth=()=>window.fixture.auth;`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,isLoading:window.fixture.loading,error:window.fixture.profileError,refetch:()=>{window.fixture.refetches++;window.renderFixture()}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@/hooks/use-theme': `import {Colors} from '${src}/constants/theme';import {getResidentTheme} from '${src}/constants/resident-theme';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/components/resident-details-form': `import React from 'react';import {View} from 'react-native';export const FormSection=({children})=><View>{children}</View>;`,
  '@/components/google-button': `import React from 'react';import {PrimaryButton} from '${src}/components/primary-button';export const GoogleButton=({label,onComplete,disabled})=><PrimaryButton accessibilityRole="button" accessibilityLabel={label} label={label} disabled={disabled} onPress={()=>{window.fixture.googleStarts++;onComplete?.()}}/>;`,
  '@/components/map-view': `import React from 'react';export const AMPID_I_SAN_MATEO_CENTER={lat:2,lng:2};export const MapView=({picker,onPickerMoved,onPickerRejected,onMapError})=>{window.fixture.move=onPickerMoved;return <div style={{height:'100%',background:'#ddd'}}><button disabled={!picker.enabled} onClick={()=>onPickerMoved({lat:3,lng:3})}>Move pin inside</button><button disabled={!picker.enabled} onClick={()=>onPickerRejected({lat:8,lng:8})}>Move pin outside</button><button onClick={onMapError}>Fail map</button></div>};`,
  '@/lib/google-auth': `export const googleReauthentication=async()=>window.fixture.google;export const clearGoogleReauthentication=async()=>{window.fixture.googleClears++};`,
  '@/lib/valid-id': `export const extractIdDetails=async()=>{window.fixture.ocrCalls++;if(window.fixture.ocrError)throw new Error(window.fixture.ocrError);return {fullName:'Synthetic Resident',idNumber:'',birthDate:'',address:''}};`,
  '@/lib/image-upload': `export const ACCEPTED_IMAGE_MIME_TYPES=['image/jpeg','image/png','image/webp'];export const imageExtension=()=> 'jpg';export const pickImageAsset=async()=>window.fixture.picked;export const readImageBytes=async()=>new Uint8Array([1,2,3]);`,
  '@/lib/supabase': `export const supabase={storage:{from:()=>({upload:async(...args)=>{window.fixture.uploads.push(args);if(window.fixture.uploadError)return {error:new Error('upload')};return {error:null}}})},from:()=>({update:values=>({eq:async(column,id)=>{window.fixture.writes.push({values,id});await new Promise(r=>setTimeout(r,window.fixture.delay));if(window.fixture.saveError)throw new Error('offline');return {error:null}}})}),auth:{signInWithPassword:async input=>{window.fixture.reauths.push(input);return {data:{user:{id:window.fixture.reauthOwner??window.fixture.auth.session.user.id}},error:window.fixture.passwordError?{message:window.fixture.passwordError}:null}},updateUser:async values=>{window.fixture.passwordWrites.push(values);await new Promise(r=>setTimeout(r,window.fixture.delay));return {error:null}}}};`,
  '@supabase/supabase-js': `export const createClient=()=>({auth:{signInWithPassword:async()=>({data:{user:{id:window.fixture.auth.session.user.id}},error:null}),signOut:async()=>{}}});`,
  '@barangayan/shared': `export {ACCENT_COLORS} from '${shared}/constants/theme-colors';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts';export {ID_TYPES,OTHER_ID_TYPE_PREFIX} from '${shared}/constants/id-verification';export {idConfirmedDetailsSchema} from '${shared}/schemas/service-foundations';export {idVerificationState} from '${shared}/lib/service-catalog';export {changePasswordSchema,PASSWORD_COMPLEXITY_REGEX} from '${shared}/schemas/auth';export {residentPasswordStepSchema,residentSetupFailure} from '${shared}/lib/resident-account-setup';export {isPointInPolygon} from '${shared}/lib/point-in-polygon';
    export const getResidentAccountSetupStatus=async()=>window.fixture.auth.setup.status;
    export const publishIdEvidence=async(client,input)=>{window.fixture.publications.push(input);await new Promise(r=>setTimeout(r,window.fixture.delay));if(window.fixture.publishError)throw new Error('Submission failed');return input};
    export const reverseGeocode=point=>new Promise(resolve=>window.fixture.geocodes.push({point,resolve}));
    export const residentEmailVerification=async(client,owner,action,code)=>{window.fixture.emails.push({owner,action,code});await new Promise(r=>setTimeout(r,window.fixture.delay));if(window.fixture.emailError)throw new Error(window.fixture.emailError);return action==='send'?'pending':'verified'};`,
};

await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import Id from '${src}/app/(app)/settings/valid-id';import Password from '${src}/app/(app)/settings/change-password';import Email from '${src}/app/(app)/settings/email-verification';import Location from '${src}/app/(app)/settings/location-verification';import {AuthHeader} from '${src}/components/auth-header';import {ResidentPasswordStep} from '${src}/components/resident-password-step';
const profile={id:'synthetic',email:'resident@example.invalid',id_verification_status:null,approved_id_submission_id:null,current_id_submission_id:null,id_repair_required:false,verified_location:{lat:2,lng:2},verified_location_address:'Saved synthetic address',barangays:{name:'Synthetic Barangay',boundary:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]]]}}};
const fixture={screen:'id',profile,auth:{session:{user:{id:profile.id,email:profile.email}},setup:{state:'ready',status:{passwordSet:true,hasGoogleIdentity:false}},refreshCompletion:async()=>{window.fixture.refreshes++},setPasswordRecovery:v=>{window.fixture.recovery=v}},font:'system',mode:'light',accent:'#0F6E5B',reduced:false,loading:false,profileError:null,permission:{granted:true,canAskAgain:true},gpsPermission:'granted',gps:{latitude:2,lng:2,longitude:2},gpsCalls:0,google:'none',googleStarts:0,googleClears:0,ids:0,delay:180,uploads:[],publications:[],passwordWrites:[],reauths:[],writes:[],emails:[],geocodes:[],alerts:[],routes:[],durations:[],listeners:new Set(),backs:new Set(),permissionSettings:0,refetches:0,refreshes:0};
window.fixture=fixture;const root=createRoot(document.getElementById('root'));let generation=0;function Setup(){const [draft,setDraft]=React.useState({password:'',confirmPassword:'',uncertain:false});return <ResidentPasswordStep required draft={draft} onDraftChange={setDraft} onSaved={async()=>{}} onSkip={()=>{}} onBack={()=>{}}/>}
window.renderFixture=()=>root.render(<React.Fragment key={generation}>{fixture.screen==='id'?<Id/>:fixture.screen==='password'?<Password/>:fixture.screen==='email'?<Email/>:fixture.screen==='location'?<Location/>:fixture.screen==='setup'?<Setup/>:fixture.screen==='auth'?<AuthHeader title="Sign in"/>:null}</React.Fragment>);window.resetFixture=()=>{generation++;window.renderFixture()};window.renderFixture();`, loader: 'jsx', resolveDir: app },
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
  const settle = () => page.waitForTimeout(350);
  const set = async changes => { await page.evaluate(changes => { Object.assign(window.fixture, changes); window.renderFixture(); }, changes); await settle(); };
  const reset = async screen => { await page.evaluate(screen => { window.fixture.screen = screen; window.resetFixture(); }, screen); await settle(); };
  const back = async () => { await page.evaluate(() => [...window.fixture.backs].at(-1)?.()); await settle(); };

  await button('Continue').waitFor();
  assert.equal(await button('Continue').isDisabled(), true);
  await button('Select ID type').click();
  await page.getByRole('radio', { name: 'Other', exact: true }).click(); await settle();
  await page.getByRole('textbox', { name: 'Specify ID type', exact: true }).fill('Synthetic ID');
  await button('Continue').click(); await button('Upload a photo').waitFor();
  await button('Upload a photo').click(); assert.equal(await page.evaluate(() => window.fixture.uploads.length), 0);
  await set({ picked: { uri: 'synthetic.jpg', mimeType: 'application/pdf', size: 3, name: 'synthetic.pdf' } });
  await button('Upload a photo').click(); await page.getByText('Choose a JPG, PNG, or WebP photo.', { exact: true }).waitFor();
  await set({ picked: { uri: 'synthetic.jpg', mimeType: 'image/jpeg', size: 6 * 1024 * 1024, name: 'synthetic.jpg' } });
  await button('Upload a photo').click(); await page.getByText('Choose a photo no larger than 5 MB.', { exact: true }).waitFor();
  await set({ picked: { uri: 'synthetic.jpg', mimeType: 'image/jpeg', size: 3, name: 'synthetic.jpg' }, ocrError: 'Cannot read photo' });
  await button('Upload a photo').click(); await button('Enter details manually').waitFor();
  await button('Enter details manually').click(); await button('Continue').click();
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Synthetic Resident');
  await button('Date of birth (if shown)').click(); await page.keyboard.press('Escape'); await settle();
  await page.getByRole('textbox', { name: 'Address (if shown)', exact: true }).fill('Corrected synthetic address');
  await button('Continue').click(); await button('Submit').waitFor();
  await back(); assert.equal(await page.getByRole('textbox', { name: 'Address (if shown)', exact: true }).inputValue(), 'Corrected synthetic address');
  await button('Continue').click(); await set({ publishError: true });
  await button('Submit').click(); await page.getByText('Submission failed', { exact: true }).waitFor();
  await set({ publishError: false, delay: 600 });
  await page.evaluate(() => { const el = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent === 'Submit'); for (let i = 0; i < 5; i++) el.click(); });
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  const publications = await page.evaluate(() => window.fixture.publications);
  assert.equal(publications.length, 2); assert.equal(publications[0].submissionId, publications[1].submissionId);
  assert.equal(publications[1].confirmedDetails.address, 'Corrected synthetic address');
  await button('Submit a replacement ID').click(); await button('Continue').waitFor(); assert.equal(await button('Continue').isDisabled(), true);
  passed.push('ID image-only/size/cancel, OCR manual correction, date cancellation, Back draft, failed publication/retry stable ID and rapid-submit lock');

  for (let i = 0; i < 5; i++) {
    await button('Select ID type').click(); await back(); assert.equal(await page.getByRole('dialog').count(), 0);
  }
  await button('Select ID type').click(); await page.getByRole('radio', { name: 'Other', exact: true }).click(); await settle();
  await page.getByRole('textbox', { name: 'Specify ID type', exact: true }).fill('Synthetic camera ID'); await button('Continue').click();
  await set({ permission: { granted: false, canAskAgain: false } }); await button('Take a photo').click();
  await page.getByText('Allow camera access to take an ID photo, or upload an existing photo.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  await set({ permission: { granted: true, canAskAgain: true }, ocrError: null });
  await button('Take a photo').click(); await button('Cancel').click(); await settle(); assert.equal(await page.getByRole('dialog').count(), 0);
  await button('Take a photo').click(); await button('Take photo').click(); await button('Upload a different photo').waitFor();
  await button('Continue').click(); assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).inputValue(), 'Synthetic Resident');
  passed.push('five picker/Back cycles and synthetic camera deny/cancel/ready/capture with actual OCR-success rendering');

  await page.evaluate(() => { Object.assign(window.fixture.profile, { id_verification_status: 'verified', approved_id_submission_id: 'approved', current_id_submission_id: 'approved' }); });
  await reset('id'); await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'id-verified.png') });
  await button('Back to Settings').click(); assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/settings');
  passed.push('authoritative ID verified status and replacement/Settings navigation');

  await reset('email'); await button('Send code').waitFor(); await button('Send code').click();
  await page.getByRole('textbox', { name: 'Email Code', exact: true }).fill('123456');
  await set({ emailError: 'The code has expired. Please request a new code.' }); await button('Verify email').click();
  await page.getByText('The code has expired. Please request a new code.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Email Code', exact: true }).inputValue(), '123456');
  assert.equal(await page.getByRole('button', { name: /^Resend in/ }).isDisabled(), true);
  await set({ emailError: null }); await button('Verify email').click(); await page.getByText('Your email is verified.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.emails.filter(e => e.action === 'send').length), 1);
  await page.evaluate(() => { window.fixture.auth.session.user.email = 'different@example.invalid'; });
  await reset('email'); assert.equal(await button('Send code').count(), 0);
  await page.getByText('Save your sign-in email in Profile before verifying it.', { exact: true }).waitFor();
  passed.push('email send/OTP/expired feedback/input retention/cooldown/real response callback/address mismatch');

  await page.evaluate(() => { window.fixture.auth.session.user.email = window.fixture.profile.email; });
  await reset('password');
  await page.getByRole('textbox', { name: 'Current Password', exact: true }).fill('SyntheticOld!1');
  await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('short');
  await page.getByText('Password must be at least 8 characters', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('SyntheticNew!2');
  await page.getByRole('textbox', { name: 'Confirm New Password', exact: true }).fill('SyntheticNew!2');
  await page.getByRole('button', { name: 'Show password', exact: true }).nth(1).click();
  await set({ passwordError: 'Invalid login credentials', delay: 180 }); await button('Update Password').click();
  await page.getByText('Current password is incorrect', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.passwordWrites.length), 0);
  await set({ passwordError: null, reauthOwner: 'different' }); await button('Update Password').click();
  await page.getByText('The account changed. Sign in to your own account and try again.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.passwordWrites.length), 0);
  await set({ reauthOwner: null, delay: 600 });
  await page.evaluate(() => { const el = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent === 'Update Password'); for (let i = 0; i < 5; i++) el.click(); });
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.evaluate(() => window.fixture.passwordWrites.length), 1);
  await button('OK').click(); await settle();
  assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), '/settings');
  passed.push('password complexity/eyes, incorrect old credential and wrong-owner guards, rapid-write lock and success acknowledgement');

  await page.evaluate(() => { window.fixture.auth.setup.status.passwordSet = null; }); await reset('password');
  await page.getByText(/Your account has an existing password we cannot confirm/).waitFor();
  await button('Recover password by email').click(); assert.equal(await page.evaluate(() => window.fixture.recovery), true);
  await page.evaluate(() => { window.fixture.auth.setup.status.passwordSet = false; }); await reset('password');
  assert.equal(await button('Recover password by email').count(), 1);
  await page.evaluate(() => { window.fixture.auth.setup.status.hasGoogleIdentity = true; }); await set({ google: 'mismatch' }); await reset('password');
  await page.getByText('Your Google confirmation expired or did not match this account. Confirm with Google again.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Password', exact: true }).count(), 0);
  await set({ google: 'fresh' }); await button('Confirm with Google').click(); await page.getByRole('textbox', { name: 'Password', exact: true }).waitFor();
  await button('Cancel').click(); assert.equal(await page.evaluate(() => window.fixture.routes.at(-1)), 'back');
  passed.push('legacy manage/recover-only and Google mismatch/fresh gate/first-password cancellation');

  await reset('location'); await button('Move pin outside').click();
  await page.getByText("Please pin a location inside Synthetic Barangay's boundary.", { exact: true }).waitFor();
  await button('Move pin inside').click();
  await button('Move pin inside').click();
  await page.evaluate(() => { const requests = window.fixture.geocodes; requests.at(-1).resolve('Latest detected address'); requests.at(-2).resolve('Older detected address'); }); await settle();
  assert.equal(await page.getByRole('textbox', { name: 'Detected Address', exact: true }).inputValue(), 'Latest detected address');
  await button('Move pin inside').click();
  await page.getByRole('textbox', { name: 'Detected Address', exact: true }).fill('Manual synthetic address');
  await page.evaluate(() => window.fixture.geocodes.at(-1).resolve('Obsolete response')); await settle();
  assert.equal(await page.getByRole('textbox', { name: 'Detected Address', exact: true }).inputValue(), 'Manual synthetic address');
  await set({ saveError: true }); await button('Save My Location').click();
  await page.waitForFunction(() => window.fixture.alerts.at(-1)?.[0] === 'Location not saved');
  assert.equal(await page.evaluate(() => window.fixture.alerts.at(-1)[0]), 'Location not saved');
  await set({ saveError: false, delay: 600 });
  await page.evaluate(() => { const el = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent === 'Save My Location'); for (let i = 0; i < 5; i++) el.click(); });
  await button('Location Saved ✓').waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 2);
  assert.equal(await page.evaluate(() => window.fixture.writes.at(-1).values.verified_location_address), 'Manual synthetic address');
  await button('Fail map').click(); await button('Retry map').click(); await settle(); assert.equal(await button('Retry map').count(), 0);
  await set({ gpsPermission: 'denied' }); await button('Detect Your Location').click(); await settle();
  assert.equal(await page.evaluate(() => window.fixture.alerts.at(-1)[0]), 'Location Permission Needed');
  await page.evaluate(() => { window.fixture.profile.verified_location = { lat: 8, lng: 8 }; }); await reset('location');
  assert.equal(await button('Save My Location').isDisabled(), true);
  passed.push('location rejection/manual address versus late geocode/save error/rapid write lock/map retry/GPS denial/outside saved-point gate');

  await page.evaluate(() => { window.fixture.profile.verified_location = { lat: 2, lng: 2 }; });
  for (const [mode, accent, font, width] of [['light', '#FFFFFF', 'georgia', 320], ['dark', '#000000', 'arial', 360], ['dark', '#2563EB', 'system', 412]]) {
    await page.setViewportSize({ width, height: 640 }); await set({ mode, accent, font, reduced: true });
    await page.evaluate(() => { window.fixture.auth.setup.status.passwordSet = true; window.fixture.auth.setup.status.hasGoogleIdentity = false; });
    for (const screen of ['id', 'email', 'location', 'password']) {
      await reset(screen);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(out, screen + '-' + mode + '-' + width + '.png') });
    }
  }
  await reset('setup'); await page.getByText('Create account', { exact: true }).waitFor(); await page.getByText('Sign out', { exact: true }).waitFor();
  await reset('auth'); await page.getByText('Sign in', { exact: true }).waitFor();
  await reset('none');
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), 0);
  assert.equal(await page.evaluate(() => window.fixture.backs.size), 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  passed.push('compact/light/dark/extreme accents/fonts and reduced-motion variants; default setup/auth controls; listener cleanup and zero captured diagnostics');
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, errors, limitations: 'Synthetic browser adapters; no native/WebView/camera/backend/delivery/fidelity/performance acceptance.' }, null, 2));
  console.log(JSON.stringify({ groups: passed.length, passed, errors }));
} finally {
  await browser.close();
}
