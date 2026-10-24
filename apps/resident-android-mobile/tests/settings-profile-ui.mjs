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
const iconGlyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const iconFont = fs.readFileSync(require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')).toString('base64');
const out =
  process.env.TEST_ARTIFACTS_DIR ??
  path.resolve(app, '../../tmp/family-attendance-phase3-20261022/settings-ui');
fs.mkdirSync(out, { recursive: true });
// Actual Settings/Profile and preference providers; native APIs and remote records are synthetic.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({accessibilityViewIsModal,accessibilityActions,onAccessibilityAction,pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const KeyboardAvoidingView=({behavior,...p})=><View {...p}/>;
    export const Modal=({visible,onRequestClose,children})=>{React.useEffect(()=>{if(!visible)return;const fn=e=>{if(e.key==='Escape')onRequestClose?.()};document.addEventListener('keydown',fn,true);return()=>document.removeEventListener('keydown',fn,true)},[visible,onRequestClose]);return visible?<div role="dialog" style={{position:'fixed',inset:0,display:'flex',zIndex:10}}>{children}</div>:null};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-busy={accessibilityState?.busy} aria-checked={accessibilityState?.checked}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const Alert={alert:(...args)=>window.fixture.alerts.push(args)};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(event,fn)=>{window.fixture.listeners.add(fn);return{remove:()=>window.fixture.listeners.delete(fn)}}};`,
  'expo-router': `import React from 'react';export const useFocusEffect=fn=>React.useEffect(fn,[fn]);export const router={back:()=>window.fixture.routes.push('back'),push:r=>window.fixture.routes.push(r)};export const useRouter=()=>router;export const Link=({href,children})=>React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});`,
  'react-native-safe-area-context': `import {View} from 'react-native';export const SafeAreaView=View;const insets={top:0,left:0,right:0,bottom:0};export const useSafeAreaInsets=()=>window.fixture.insets??insets;`,
  '@expo/vector-icons': `import React from 'react';const glyphs=${JSON.stringify(iconGlyphs)};export const Ionicons=({name,size,color})=><span aria-hidden="true" data-icon={name} style={{display:'inline-block',fontFamily:'FixtureIonicons',fontWeight:400,fontSize:size,lineHeight:size+'px',color,flexShrink:0,verticalAlign:'middle'}}>{String.fromCodePoint(glyphs[name]??0)}</span>;Ionicons.glyphMap=glyphs;`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=(v,o)=>{window.fixture.durations.push(o?.duration);return v};export const withSpring=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  'react-native-svg': `import React from 'react';const el=t=>({children,...p})=>React.createElement(t,p,children);export default el('svg');export const Defs=el('defs'),LinearGradient=el('linearGradient'),Rect=el('rect'),Stop=el('stop');`,
  '@react-native-async-storage/async-storage': `export default {getItem:async k=>window.fixture.device[k]??null,setItem:async(k,v)=>{window.fixture.device[k]=v}};`,
  '@/hooks/use-auth': `export const useAuth=()=>window.fixture.auth;`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fixture.profile,isLoading:window.fixture.loading,error:window.fixture.profileError,refetch:()=>{window.fixture.refetches++;window.fixture.profile={...window.fixture.profile};window.renderFixture()}});export const useProfileData=useProfile;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>100;`,
  '@barangayan/shared': `export {idVerificationState} from '${shared}/lib/service-catalog.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID,isValidFontId} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {EMAIL_REGEX,EMPLOYMENT_STATUSES,EMPLOYMENT_STATUSES_WITH_OCCUPATION,MOBILE_NUMBER_REGEX,NAME_REGEX,SEXES} from '${shared}/schemas/auth.ts';`,
  '@/lib/push-notifications': `export const registerPushToken=async()=>window.fixture.push.push('register');export const unregisterPushToken=async()=>window.fixture.push.push('unregister');`,
  '@/lib/google-auth': `export const clearGoogleReauthentication=async()=>{window.fixture.google='none'};export const googleReauthentication=async()=>window.fixture.google;export const startGoogleAuth=async()=>{window.fixture.googleStarts++};`,
  '@/lib/image-upload': `export const imageExtension=()=> 'jpg';export const pickImageAsset=async()=>{if(window.fixture.pickerError)throw Error('Synthetic picker failure');return window.fixture.picked};export const readImageBytes=async()=>{if(window.fixture.photoError)throw Error('Synthetic photo failure');return new Uint8Array([1])};`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export const Image=Object.assign(({style})=><View style={style}/>,{clearDiskCache:async()=>{}});`,
  'expo-constants': `export default {expoConfig:{version:'1.0.0-fixture'}};`,
  'expo-sharing': `export const isAvailableAsync=async()=>true;export const shareAsync=async(uri,opts)=>window.fixture.shares.push({uri,opts});`,
  'expo-file-system/legacy': `export const cacheDirectory='file://synthetic/';export const EncodingType={UTF8:'utf8'};export const writeAsStringAsync=async()=>{};export const copyAsync=async()=>{};`,
  'expo-print': `export const printToFileAsync=async()=>({uri:'file://synthetic/report.pdf'});`,
  '@/lib/supabase': `export const supabase={from:table=>{let update;const q={abortSignal:()=>q,select:()=>q,single:()=>q,update:v=>{update=v;return q},eq:()=>q,then:(resolve,reject)=>{const f=window.fixture;f.writes.push({table,update});return new Promise(r=>setTimeout(r,f.delay)).then(()=>{if(f.writeError)return{error:{message:f.writeError}};f.profile={...f.profile,...update};return{data:{id:f.profile.id},error:null}}).then(resolve,reject)} };return q},rpc:(name,args)=>({abortSignal:()=>({then:(resolve,reject)=>Promise.resolve().then(()=>{const f=window.fixture;f.rosterWrites??=[];f.rosterWrites.push({name,args});if(f.rosterConflict||JSON.stringify(args.p_expected)!==JSON.stringify(f.profile.household_members))return{data:null,error:{code:'PT409',message:'resident_household_changed'}};f.profile={...f.profile,household_members:args.p_members};return{data:args.p_members,error:null}}).then(resolve,reject)})}),storage:{from:()=>({upload:async()=>({error:window.fixture.photoError?{message:'Synthetic photo failure'}:null}),getPublicUrl:()=>({data:{publicUrl:'https://example.invalid/synthetic.jpg'}})})},functions:{invoke:async name=>{window.fixture.invokes.push(name);return window.fixture.exportError?{error:Error('Synthetic export failure')}:{data:{profile:{synthetic:true}},error:null}}},auth:{signInWithPassword:async()=>({data:{user:window.fixture.auth.session.user},error:null})}};`,
};
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Settings from '${root}/app/(app)/settings/index';import Profile from '${root}/app/(app)/settings/profile';import {ThemePreferenceProvider} from '${root}/hooks/use-theme-preference';import {FontPreferenceProvider} from '${root}/hooks/use-font-preference';import {NotificationPreferencesProvider} from '${root}/hooks/use-notification-preferences';
const id='11111111-1111-4111-8111-111111111111';
const profile={id,first_name:'Synthetic',middle_name:'',last_name:'Resident',suffix:'',full_name:'Synthetic Resident',email:'resident@example.invalid',mobile_number:'09171234567',sex:'male',birth_date:'1990-01-02',house_no:'1',street:'Synthetic Street',city:'Synthetic City',province:'Synthetic Province',employment_status:'employed',occupation:'Tester',household_members:[],avatar_url:null,barangays:{name:'Synthetic Barangay',barangay_localities:{display_name:'Synthetic Barangay'}},accent_color:'#0F6E5B',theme_preference:'light',font_preference:'system',custom_accent_colors:[],email_verification_status:'verified'};
const auth={session:{user:{id,email:profile.email}},setup:{state:'ready',status:{passwordSet:true,hasGoogleIdentity:false,profileComplete:true}},refreshCompletion:async()=>{},logout:async()=>{window.fixture.logouts++;window.fixture.auth.session=null;window.fixture.profile=null;window.renderFixture()}};
window.fixture={screen:'settings',profile,auth,loading:false,profileError:null,reduced:false,device:{},writes:[],alerts:[],routes:[],durations:[],push:[],invokes:[],shares:[],listeners:new Set(),delay:200,refetches:0,google:'none',googleStarts:0,logouts:0,picked:null};
const root=createRoot(document.getElementById('root'));let generation=0;window.renderFixture=()=>root.render(<ThemePreferenceProvider key={generation}><FontPreferenceProvider><NotificationPreferencesProvider>{window.fixture.screen==='profile'?<Profile/>:window.fixture.screen==='settings'?<Settings/>:null}</NotificationPreferencesProvider></FontPreferenceProvider></ThemePreferenceProvider>);window.resetFixture=()=>{generation++;window.renderFixture()};window.renderFixture();`,loader:'jsx',resolveDir:app},outfile:path.join(out,'bundle.js'),bundle:true,format:'iife',jsx:'automatic',define:{__DEV__:'false',global:'globalThis','process.env.NODE_ENV':'"production"'},plugins:[{name:'native-adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:app}));}}]});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'});
const errors=[],passed=[];let page;
try {
  page=await browser.newPage({viewport:{width:400,height:844}});
  page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({content:`@font-face{font-family:FixtureIonicons;src:url(data:font/ttf;base64,${iconFont}) format('truetype')}`});
  await page.addScriptTag({path:path.join(out,'bundle.js')});
  const button=name=>page.getByRole('button',{name,exact:true});
  const settle=async()=>page.waitForTimeout(360);
  const go=async screen=>{await page.evaluate(screen=>{window.fixture.screen=screen;window.renderFixture()},screen);await settle()};
  await button('Add a custom color').waitFor();
  assert.equal(await page.getByRole('button',{name:/^Accent color #/}).count(),20);
  for(const name of ['System Default','Inter','Arial','Helvetica','Segoe UI','Verdana','Tahoma','Trebuchet MS','Georgia','Times New Roman'])assert.equal(await button(name).count(),1);
  await page.getByRole('tab',{name:'Dark',exact:true}).click();await settle();
  assert.equal(await page.evaluate(()=>window.fixture.device['resident-android-theme-v1']),'dark');
  await button('Accent color #2563EB').click();await button('Georgia').click();await settle();
  assert.equal(await page.evaluate(()=>window.fixture.profile.accent_color),'#2563EB');assert.equal(await page.evaluate(()=>window.fixture.profile.font_preference),'georgia');
  await page.screenshot({path:path.join(out,'settings-dark.png')});passed.push('20 presets/10 fonts and real preference providers persist theme/accent/font');
  await button('Add a custom color').click();await page.getByRole('textbox',{name:'Hex color'}).fill('#FFFFFF');await button('Save Color').click();await settle();
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await button('Custom color #FFFFFF').count(),1);
  await button('Add a custom color').click();await page.getByRole('textbox',{name:'Hex color'}).fill('#FFFFFF');await button('Save Color').click();await page.getByText('That color is already saved.').waitFor();await button('Cancel').click();await settle();
  await button('Add a custom color').click();await page.getByRole('textbox',{name:'Hex color'}).fill('#123');assert.equal(await button('Save Color').isDisabled(),true);await page.keyboard.press('Escape');await settle();
  passed.push('extreme custom color accepted; duplicate and invalid hex recover; Cancel/Back dismiss');
  const before=await page.evaluate(()=>window.fixture.invokes.length);await button('Download My Data').click();assert.equal(await page.evaluate(()=>window.fixture.invokes.length),before);
  assert.deepEqual(await page.evaluate(()=>window.fixture.alerts.at(-1)[2].map(x=>x.text)),['Cancel','PDF (readable)','JSON (raw data)']);
  await page.evaluate(()=>window.fixture.alerts.at(-1)[2][1].onPress());await settle();
  assert.equal(await page.evaluate(()=>window.fixture.shares.at(-1).opts.mimeType),'application/pdf');
  await button('Download My Data').click();await page.evaluate(()=>window.fixture.alerts.at(-1)[2][2].onPress());await settle();assert.equal(await page.evaluate(()=>window.fixture.shares.at(-1).opts.mimeType),'application/json');
  await button('Delete My Account').click();assert.equal(await page.evaluate(()=>window.fixture.invokes.filter(x=>x==='delete-my-account').length),0);
  await page.evaluate(()=>window.fixture.alerts.at(-1)[2][1].onPress());await settle();await button('Cancel').click();await settle();assert.equal(await page.evaluate(()=>window.fixture.invokes.filter(x=>x==='delete-my-account').length),0);
  passed.push('format chooser makes no request; PDF/JSON adapters used; password deletion cancellation makes no delete request');
  await go('profile');
  for(const title of ['Personal Information','Contact','Address','Household Information'])await page.getByText(title,{exact:true}).waitFor();
  assert.equal(await button('Save Changes').isDisabled(),true);
  // Reference presentation, using the real preference providers and local editors.
  const originalProfile=await page.evaluate(()=>window.fixture.profile);
  const writesBeforePresentation=await page.evaluate(()=>window.fixture.writes.length);
  await page.setViewportSize({width:400,height:800});
  await page.evaluate(()=>{
    window.fixture.insets={top:32,left:0,right:0,bottom:0};
    window.fixture.profile={...window.fixture.profile,first_name:'James',middle_name:'Floyd',last_name:'White',suffix:'Jr',full_name:'James Floyd White Jr',birth_date:'2001-02-02',email:'white@example.invalid',house_no:'A1',street:'Gen Luna Ave',city:'San Mateo',province:'Rizal',employment_status:'student',occupation:'',theme_preference:'light',accent_color:'#306B5B',font_preference:'system',household_members:[{id:'22222222-2222-4222-8222-222222222222',name:'Juan White',relation:'Parent',role:'Head of Family'}],barangays:{name:'Ampid 1',barangay_localities:{display_name:'Ampid 1'}}};
    window.resetFixture();
  });await settle();
  await page.screenshot({path:path.join(out,'profile-reference-light.png')});
  assert.match(await page.getByRole('textbox',{name:'First Name',exact:true}).evaluate(el=>getComputedStyle(el).fontFamily),/sans-serif/);
  await button('Edit Employment Status').click();await settle();
  assert.equal(await page.getByRole('radio',{name:'Student',exact:true}).getAttribute('aria-checked'),'true');
  await page.screenshot({path:path.join(out,'profile-employment.png')});
  await page.getByRole('radio',{name:'Self-employed',exact:true}).click();await settle();
  await page.getByRole('textbox',{name:'Occupation',exact:true}).waitFor();
  await button('Edit Employment Status').click();await page.getByRole('radio',{name:'Student',exact:true}).click();await settle();
  assert.equal(await page.getByRole('textbox',{name:'Occupation',exact:true}).count(),0);
  await button('Edit family member Juan White').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'profile-address-household.png')});
  await button('Add household member').click();await settle();
  assert.equal(await button('Add Member').isDisabled(),true);
  await page.screenshot({path:path.join(out,'profile-add-family.png')});
  await button('More relation options').click();
  await page.getByRole('radio',{name:'Relation: Other',exact:true}).click();
  await page.getByRole('radio',{name:'Role: Student',exact:true}).click();
  await page.getByRole('textbox',{name:'Household member full name'}).fill('Maria White');
  await button('Add Member').click();await settle();
  await button('Edit family member Maria White').click();await settle();
  assert.equal(await page.getByRole('radio',{name:'Relation: Other',exact:true}).getAttribute('aria-checked'),'true');
  const otherBounds=await page.getByRole('radio',{name:'Relation: Other',exact:true}).boundingBox();assert.ok(otherBounds.x>=0&&otherBounds.x+otherBounds.width<=400,'saved relation is visible when reopening the editor');
  await page.getByRole('textbox',{name:'Household member full name'}).fill('Maria Updated');
  await button('Update').click();await settle();
  await button('Edit family member Maria Updated').click();await button('Remove').click();await settle();
  assert.equal(await button('Edit family member Maria Updated').count(),0);
  await button('Edit family member Juan White').click();await settle();
  await page.screenshot({path:path.join(out,'profile-edit-family.png')});
  await page.keyboard.press('Escape');await settle();
  assert.equal(await page.evaluate(()=>window.fixture.writes.length),writesBeforePresentation,'member edits remain local until Save Changes');
  assert.equal(await page.evaluate(()=>window.fixture.profile.household_members.length),1);
  for(const width of [320,360,412]){
    await page.setViewportSize({width,height:640});await button('Add household member').click();await settle();
    const action=await button('Add Member').boundingBox();assert.ok(action.y>=0&&action.y+action.height<=640);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.keyboard.press('Escape');await settle();
  }
  await page.setViewportSize({width:400,height:800});
  await page.evaluate(()=>{window.fixture.profile={...window.fixture.profile,theme_preference:'dark',accent_color:'#2563EB',font_preference:'georgia'};window.resetFixture()});await settle();
  await page.screenshot({path:path.join(out,'profile-reference-dark.png')});
  assert.equal(await page.getByRole('heading',{name:'Profile',exact:true}).evaluate(el=>getComputedStyle(el).fontFamily),'serif');
  await button('Edit Employment Status').click();await settle();await page.screenshot({path:path.join(out,'profile-employment-dark.png')});await page.keyboard.press('Escape');await settle();
  await page.evaluate(()=>{window.fixture.reduced=true;for(const fn of window.fixture.listeners)fn(true)});
  const motionStart=await page.evaluate(()=>window.fixture.durations.length);
  await button('Add household member').click();await settle();await page.keyboard.press('Escape');await settle();
  assert.ok((await page.evaluate(start=>window.fixture.durations.slice(start),motionStart)).every(duration=>duration<=100));
  await page.evaluate(profile=>{window.fixture.profile=profile;window.fixture.insets=null;window.fixture.reduced=false;window.resetFixture()},originalProfile);await settle();
  passed.push('reference layouts, numeric date, radio selections, occupation visibility, horizontal relation options, local family add/edit/remove, pinned actions at narrow widths, font/theme synchronization and reduced-motion profile sheets');
  await page.getByRole('textbox',{name:'First Name',exact:true}).fill('Draft');
  await page.evaluate(()=>{window.fixture.picked={uri:'synthetic://photo'};});await button('Change profile photo').click();await settle();
  assert.equal(await page.getByRole('textbox',{name:'First Name',exact:true}).inputValue(),'Draft');
  assert.equal(await page.evaluate(()=>window.fixture.writes.filter(x=>x.update.avatar_url).length),1);
  assert.equal(await page.evaluate(()=>window.fixture.writes.filter(x=>'first_name' in x.update).length),0);
  await button('Add household member').click();await page.getByRole('textbox',{name:'Household member full name'}).fill('Synthetic Child');await button('Add Member').click();await settle();
  assert.equal(await page.evaluate(()=>window.fixture.writes.filter(x=>'household_members' in x.update).length),0);
  await button('Save Changes').evaluate(el=>{for(let i=0;i<5;i++)el.click()});await settle();
  assert.equal(await page.evaluate(()=>window.fixture.writes.filter(x=>'first_name' in x.update).length),1);assert.equal(await page.evaluate(()=>window.fixture.profile.household_members.length),1);
  passed.push('avatar saves immediately without erasing dirty fields; household stays local until explicit save; five synchronous taps cause one profile write');
  const rosterWrite=await page.evaluate(()=>window.fixture.rosterWrites[0]);assert.equal(rosterWrite.name,'save_resident_household_if_unchanged');assert.deepEqual(rosterWrite.args.p_expected,[]);assert.equal(rosterWrite.args.p_members.length,1);
  assert.equal(await page.evaluate(()=>window.fixture.writes.some(write=>'household_members' in write.update)),false);

  await page.getByRole('textbox',{name:'Email',exact:true}).fill('invalid');await button('Save Changes').click();await page.getByText('Enter a valid email address',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('changed@example.invalid');await page.evaluate(()=>window.fixture.writeError='Synthetic save denied');await button('Save Changes').click();await settle();await page.getByText('Could not save your profile details. Reconnect and try again.',{exact:true}).waitFor();assert.equal(await button('Save Changes').isEnabled(),true);
  await page.evaluate(()=>{window.fixture.writeError=null;window.fixture.pickerError=true});await button('Change profile photo').click();await settle();assert.equal(await page.evaluate(()=>window.fixture.alerts.at(-1)[1]),'Synthetic picker failure');
  assert.equal(await page.getByRole('textbox',{name:'Email',exact:true}).inputValue(),'changed@example.invalid');
  passed.push('invalid/save error/photo picker error preserve inputs and recovery');
  assert.equal(await page.evaluate(()=>window.fixture.rosterWrites.length),1,'demographic-only saves do not rewrite the family roster');
  await page.evaluate(()=>{window.fixture.rosterConflict=true});await button('Add household member').click();await page.getByRole('textbox',{name:'Household member full name'}).fill('Stale Child');await button('Add Member').click();await settle();
  const countBefore=await page.evaluate(()=>window.fixture.writes.length);await button('Save Changes').click();await settle();await page.getByText(/Your family list changed elsewhere/).waitFor();assert.equal(await page.evaluate(()=>window.fixture.writes.length),countBefore);
  await page.evaluate(()=>{window.fixture.rosterConflict=false});await button('Reload Profile').click();await settle();assert.equal(await page.getByText('Stale Child',{exact:true}).count(),0);
  passed.push('Settings conditional roster write preserves snapshot, never writes JSON directly, rejects stale save before demographic write and explicitly reloads');

  for(let i=0;i<5;i++){await button('Edit Sex').click();await button('Close Sex').click();await settle()}
  await button('Edit Employment Status').click();await button('Close Employment Status').click();await settle();
  await button('Edit Date of Birth').click();await button('Close').click();await settle();
  for(const width of [320,360,400,412]){await page.setViewportSize({width,height:640});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
  await page.screenshot({path:path.join(out,'profile-compact.png')});
  passed.push('five option-sheet open/close cycles, employment and birthday dismissal, compact widths have no document overflow');
  const memberRecord=await page.evaluate(()=>window.fixture.profile.household_members[0]);
  await page.evaluate(()=>{window.fixture.profile={...window.fixture.profile,household_members:[{id:'bad-record'}]};window.resetFixture()});await settle();await page.getByRole('textbox',{name:'First Name',exact:true}).fill('Preserve');assert.equal(await button('Save Changes').isDisabled(),true);await page.getByText('Your saved household details are unavailable. Reopen Profile or contact barangay staff before saving.',{exact:true}).waitFor();
  await page.evaluate(member=>{window.fixture.profile={...window.fixture.profile,household_members:[member]};window.resetFixture()},memberRecord);await settle();
  passed.push('malformed household data cannot be silently overwritten by a profile save');
  await go('settings');await page.evaluate(()=>{window.fixture.profile={...window.fixture.profile,custom_accent_colors:Array.from({length:10},(_,i)=>'#12345'+i)};window.resetFixture()});await settle();await button('Add a custom color').click();await page.getByRole('textbox',{name:'Hex color'}).fill('#ABCDEF');await button('Save Color').click();await page.getByText('You can save up to 10 custom colors. Remove one to add another.').waitFor();await button('Cancel').click();await settle();passed.push('custom color cap displays recoverable feedback');
  await page.getByRole('switch',{name:'Push Notifications',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>window.fixture.push.at(-1)),'unregister');
  const smsWrites=await page.evaluate(()=>window.fixture.writes.length);await page.getByRole('switch',{name:'SMS Notifications — local preference only',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>window.fixture.writes.length),smsWrites);
  passed.push('push retains unregister side effect; SMS remains local without a remote write');
  await page.evaluate(()=>{window.fixture.google='fresh';window.fixture.auth.setup={state:'ready',status:{passwordSet:false,hasGoogleIdentity:true,profileComplete:true}};window.resetFixture()});await settle();await page.getByText('Permanently Delete Account?',{exact:true}).waitFor();await button('Cancel').click();await settle();assert.equal(await page.evaluate(()=>window.fixture.invokes.filter(x=>x==='delete-my-account').length),0);assert.equal(await page.evaluate(()=>window.fixture.google),'none');
  passed.push('Google-confirmed deletion Cancel consumes confirmation without a delete request');
  await page.evaluate(()=>{window.fixture.reduced=true;for(const fn of window.fixture.listeners)fn(true)});await button('Add a custom color').click();await settle();await page.screenshot({path:path.join(out,'custom-color-reduced.png')});await page.keyboard.press('Escape');await settle();
  await button('Logout').click();await settle();assert.equal(await page.evaluate(()=>window.fixture.logouts),1);await button('Login').waitFor();assert.equal(await page.evaluate(()=>window.fixture.device['resident-android-theme-v1']),'dark');assert.equal(await button('Accent color #0F6E5B').getAttribute('aria-selected'),'true');
  passed.push('reduced-motion dismissal works; logout keeps device dark mode and resets account accent');
  const listeners=await page.evaluate(()=>window.fixture.listeners.size);await go('none');assert.equal(await page.evaluate(()=>window.fixture.listeners.size),0);assert.ok(listeners>0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors,native:false},null,2));console.log(JSON.stringify({passed,errors},null,2));
} catch(error) {fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,errors,error:String(error)},null,2));if(page){fs.writeFileSync(path.join(out,'failure.html'),await page.content());await page.screenshot({path:path.join(out,'failure.png')});}throw error;} finally {await browser.close()}
