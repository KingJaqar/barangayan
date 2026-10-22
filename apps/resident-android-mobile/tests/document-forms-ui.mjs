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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-documents-'));
fs.mkdirSync(out, { recursive: true });

// Actual React components and shared validation/submission code, with local-only
// platform, account, picker and transport adapters. This does not certify Android.
const mocks = {
  'react-native': `import React from 'react';import {Animated as A,View as V,Image as I,Pressable as P} from 'react-native-web';export * from 'react-native-web';
    export const Animated={...A,timing:(value,options)=>{window.fixture.motions.push(options.duration);return A.timing(value,{...options,useNativeDriver:false});},View:React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><A.View {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>)};
    export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...props},ref)=><V {...props} ref={ref} aria-hidden={accessibilityElementsHidden||importantForAccessibility==='no-hide-descendants'||undefined}/>);
    export const Image=React.forwardRef(({contentFit,...props},ref)=><I {...props} ref={ref} resizeMode={contentFit??props.resizeMode}/>);
    export const Pressable=React.forwardRef(({accessibilityState,...props},ref)=><P {...props} ref={ref} aria-expanded={accessibilityState?.expanded} aria-busy={accessibilityState?.busy}/>);`,
  '@barangayan/shared': `export * from '${shared}/lib/service-catalog.ts';export * from '${shared}/lib/resident-submission.ts';export * from '${shared}/lib/service-request-validation.ts';export * from '${shared}/schemas/service-foundations.ts';export * from '${shared}/schemas/request-form.ts';export {formatCentavosAsPHP} from '${shared}/lib/format.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {DEFAULT_FONT_ID,FONT_OPTIONS} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const Link=({href,children})=>React.cloneElement(children,{onPress:()=>window.fixture.routes.push(href)});export const router={push:href=>window.fixture.routes.push(href),replace:href=>window.fixture.routes.push(href),back:()=>window.fixture.routes.push('back')};export const useRouter=()=>router;export const useLocalSearchParams=()=>({documentId:window.fixture.doc.id});export const usePathname=()=>'/services/request/'+window.fixture.doc.id;export const useFocusEffect=fn=>useEffect(fn,[fn]);`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session,needsCompletion:false});`,
  '@/hooks/use-profile': `const refetch=()=>{window.fixture.refreshes++;};export const useProfile=()=>({profile:window.fixture.profile,isLoading:window.fixture.loading,error:null,refetch});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.fontId});`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reducedMotion;`,
  '@/lib/supporting-upload': `export async function pickSupportingFile(){window.fixture.picks++;if(window.fixture.pickError)throw Error(window.fixture.pickError);return window.fixture.file?{name:'Synthetic evidence.pdf',mimeType:'application/pdf',bytes:new Uint8Array([1,2,3])}:null;}`,
  '@/lib/image-upload': `export const displayName=p=>p.name;export const imageExtension=()=> 'jpg';export const isWithinSizeLimit=(p,max)=>p.size<=max;export async function pickImageAsset(){window.fixture.picks++;return window.fixture.file?{name:'Synthetic ID.jpg',mimeType:'image/jpeg',size:3,uri:window.fixture.image}:null;}export async function readImageBytes(){return new Uint8Array([1,2,3]);}`,
  '@/lib/supabase': `export const supabase={auth:{getUser:async()=>({data:{user:window.fixture.session.user},error:null})},from(table){const q={select(){return q},eq(){return q},is(){return q},maybeSingle(){return Promise.resolve({data:window.fixture.doc,error:window.fixture.loadError?{}:null})},single(){window.fixture.queries.push(table);return Promise.resolve({data:table==='id_submissions'?{id:'approved',decision:'verified',front_path:'front',back_path:null,id_type:'Synthetic ID',version:2}:{id:'server-request',reference_number:'SYNTHETIC'},error:window.fixture.idError&&table==='id_submissions'?{}:null})}};return q;},storage:{from(){return {createSignedUrl:async()=>({data:{signedUrl:window.fixture.image},error:null}),upload:async()=>{window.fixture.uploads++;return {error:null}}}}},rpc(name,args){window.fixture.submits.push({name,args});return new Promise(resolve=>{const done=()=>resolve(window.fixture.submitError?{data:null,error:{code:'22023',message:'Synthetic validation error'}}:{data:'server-request',error:null});if(window.fixture.hold)window.fixture.pending.push(done);else done();});}};`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View} from 'react-native';export default {View,createAnimatedComponent:component=>component};export const useSharedValue=value=>useRef({value}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=value=>value;export const withRepeat=value=>value;export const cancelAnimation=()=>{};export {Easing} from 'react-native-web';`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;`,
  'expo-image': `export {Image} from 'react-native';`,
  'react-native-svg': `import React from 'react';export default function Svg({accessible,...props}){return <svg {...props}/>;}export const Path=props=><path {...props}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Guide from '${root}/app/(app)/services/[documentId].tsx';import Request from '${root}/app/(app)/services/request/[documentId].tsx';
    const charter={officeDivision:'Synthetic office',classification:'Simple',transactionType:'G2C',whoMayAvail:'RESIDENTS',checklistOfRequirements:'4. Stored first requirement\\n9. Stored second requirement',whereToSecureRequirements:'Synthetic source',clientSteps:'2. Stored first step\\n7. Stored final step',agencyActions:'3. Stored agency action',feesToBePaid:'Stored fee wording',processingTime:'Stored grouped durations; no individual assignments',personResponsible:null};
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    window.fixture={screen:'guide',session:{user:{id:'resident'}},profile:{id:'resident',full_name:'Synthetic Resident',mobile_number:'09000000000',id_verification_status:'verified',approved_id_submission_id:'approved',current_id_submission_id:'approved',id_repair_required:false},loading:false,mode:'light',accent:'#0F6E5B',fontId:'system',reducedMotion:true,image,doc:{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic document',description:'Synthetic description',contract_version:2,service_kind:'indigency',charter,purposes:[{code:'purpose',label:'Catalog purpose wording',requiresExplanation:false},{code:'other',label:'Other catalog wording',requiresExplanation:true}],requirement_rules:{dtiRequired:false,hoaRequired:false,lessorForRenter:true,personalAppearance:true},pricing_mode:'fixed',processing_target_minutes:15,fee_centavos:10000,requirements:['Stored visible requirement']},refreshes:0,picks:0,queries:[],routes:[],motions:[],uploads:0,submits:[],pending:[],hold:false,file:false};
    const root=createRoot(document.getElementById('root'));let generation=0;window.renderDocuments=()=>root.render(window.fixture.screen==='guide'?<Guide key={generation}/>:<Request key={generation}/>);window.resetDocuments=()=>{generation++;window.renderDocuments();};window.unmountDocuments=()=>root.render(null);window.renderDocuments();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const options = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.channel = 'chrome';
const browser = await chromium.launch(options);
const passed = [];
const errors = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error','warning'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out,'bundle.js') });
  await page.getByText('Synthetic description',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.doc.contract_version=1;window.fixture.doc.processing_target_hours=72;window.resetDocuments();});
  await page.getByText('Stored visible requirement',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.doc.contract_version=2;window.resetDocuments();});
  for (const text of ['Synthetic office','Stored first requirement','Stored second requirement','Stored first step','Stored final step','Stored fee wording','Stored grouped durations; no individual assignments']) await page.getByText(text,{exact:true}).waitFor();
  const agency = page.getByRole('button',{name:'Agency Actions',exact:true});
  for (let cycle=0;cycle<5;cycle++) { await agency.click(); await page.getByText('Stored agency action',{exact:true}).waitFor({state:'visible'}); await agency.click(); assert.equal(await agency.getAttribute('aria-expanded'),'false'); }
  await page.getByRole('button',{name:'Person Responsible',exact:true}).click();
  await page.getByText('Not specified in the source charter',{exact:true}).waitFor({state:'visible'});
  for (const width of [320,360,400,412]) {
    await page.setViewportSize({width,height:640});
    await page.evaluate(()=>{window.fixture.mode='dark';window.fixture.accent='#FFFFFE';window.fixture.fontId='georgia';window.renderDocuments();});
    assert.ok(await agency.isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.screenshot({path:path.join(out,'guide-dark-412.png')});
  passed.push('Guide preserves all charter content/stored numbering, independent accordions, null personnel and four widths with dark/custom accent/font');

  await page.evaluate(()=>{window.fixture.screen='request';window.fixture.loading=false;window.resetDocuments();});
  const refresh=page.getByRole('button',{name:'Refresh verification',exact:true});
  await refresh.waitFor();
  await page.evaluate(()=>{window.fixture.loading=false;window.renderDocuments();});
  const submit=page.getByRole('button',{name:'Submit request',exact:true});
  await page.waitForFunction(()=>document.querySelector('[aria-label="Submit request"]')?.getAttribute('aria-disabled')!=='true');
  await submit.click();
  await page.getByText('Choose a purpose for your request.',{exact:false}).first().waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.submits.length),0);
  await page.getByRole('button',{name:'Choose a purpose',exact:true}).click();
  await page.getByRole('button',{name:'Other catalog wording',exact:true}).click();
  await page.getByLabel('Explain your purpose',{exact:true}).fill('Preserved explanation');
  await page.getByLabel('Additional notes (optional)',{exact:true}).fill('Preserved notes');
  const idPanel = page.getByText('Approved profile ID',{exact:true}).locator('..').locator('..');
  const beforeRefresh = await idPanel.boundingBox();
  await refresh.click();
  await page.evaluate(()=>{window.fixture.loading=true;window.renderDocuments();});
  await page.getByRole('button',{name:'Refreshing verification…',exact:true}).waitFor();
  const whileRefreshing = await idPanel.boundingBox();
  assert.equal(whileRefreshing.height,beforeRefresh.height);
  await page.evaluate(()=>{window.fixture.loading=false;window.renderDocuments();});
  await refresh.waitFor();
  assert.equal(await page.getByLabel('Explain your purpose',{exact:true}).inputValue(),'Preserved explanation');
  assert.equal(await page.getByLabel('Additional notes (optional)',{exact:true}).inputValue(),'Preserved notes');
  await page.getByRole('switch',{name:'I am a renter',exact:true}).click();
  const lessor=page.getByRole('button',{name:'Choose Lessor endorsement',exact:true});
  await lessor.click();
  assert.equal(await page.getByRole('button',{name:'Remove Lessor endorsement',exact:true}).count(),0);
  await page.evaluate(()=>{window.fixture.pickError='Could not read the file. Please pick it again from your device.';});
  await lessor.click();
  await page.getByRole('alert').filter({hasText:'Could not read the file'}).waitFor();
  await page.evaluate(()=>{window.fixture.pickError=null;window.fixture.file=true;});
  await lessor.click();
  await page.getByRole('button',{name:'Remove Lessor endorsement',exact:true}).waitFor();
  await page.getByRole('switch',{name:'I am a renter',exact:true}).click();
  assert.equal(await lessor.count(),0);
  await page.getByRole('switch',{name:'I understand personal appearance at the Barangay Hall is required',exact:true}).click();
  await page.evaluate(()=>{window.fixture.hold=true;});
  await submit.evaluate(element=>{for(let tap=0;tap<5;tap++)element.click();});
  await page.waitForFunction(()=>window.fixture.submits.length===1);
  assert.equal(await submit.isEnabled(),false);
  await page.evaluate(()=>{window.fixture.pending.splice(0).forEach(done=>done());});
  await page.waitForFunction(()=>window.fixture.routes.includes('/services/payment/server-request'));
  passed.push('Current form validates intentionally, keeps drafts through refresh, handles picker cancel/error, removes renter evidence and submits once');

  for (const kind of ['business','first_time_job_seeker','certified_true_copy','general']) {
    await page.evaluate(kind=>{window.fixture.loading=false;window.fixture.doc.service_kind=kind;window.fixture.doc.requirement_rules={dtiRequired:kind==='business',hoaRequired:false,lessorForRenter:kind==='first_time_job_seeker',personalAppearance:false};window.fixture.doc.pricing_mode=kind==='business'?'assessment':kind==='certified_true_copy'?'per_page':'fixed';window.resetDocuments();},kind);
    await refresh.waitFor();
    await page.evaluate(()=>{window.fixture.loading=false;window.renderDocuments();});
    if (kind==='business') { await page.getByLabel('Business name',{exact:true}).fill('Synthetic business'); await page.getByLabel('Establishment address',{exact:true}).fill('Synthetic address'); await page.getByRole('button',{name:'Choose DTI registration',exact:true}).waitFor(); }
    if (kind==='certified_true_copy') { await page.getByLabel('Number of copies',{exact:true}).fill('1000'); await page.getByLabel('Total pages across all copies',{exact:true}).fill('1000000'); assert.equal(await page.getByLabel('Total pages across all copies',{exact:true}).inputValue(),'1000000'); }
    if (kind==='first_time_job_seeker') await page.getByRole('switch',{name:'I am a renter',exact:true}).waitFor();
    if (kind==='general') assert.equal(await page.getByRole('switch',{name:'I am a renter',exact:true}).count(),0);
  }
  await page.screenshot({path:path.join(out,'form-dark-general.png')});
  passed.push('Business/DTI, residency, general and full-range CTC fields remain available');
  await page.evaluate(()=>{window.fixture.doc.contract_version=1;window.fixture.hold=true;window.fixture.submits=[];window.fixture.uploads=0;window.fixture.loading=false;window.resetDocuments();});
  await page.getByLabel('Purpose of Request',{exact:true}).fill('Legacy purpose');
  await page.getByRole('button',{name:'Upload a valid ID image',exact:true}).click();
  const legacySubmit=page.getByRole('button',{name:'Proceed to Payment →',exact:true});
  await legacySubmit.evaluate(element=>{for(let tap=0;tap<5;tap++)element.click();});
  await page.waitForFunction(()=>window.fixture.submits.length===1);
  assert.equal(await legacySubmit.isEnabled(),false);
  assert.equal(await page.evaluate(()=>window.fixture.uploads),1);
  await page.evaluate(()=>{window.fixture.pending.splice(0).forEach(done=>done());});
  await page.waitForFunction(()=>document.querySelector('[aria-label="Proceed to Payment →"]')?.getAttribute('aria-busy')!=='true');
  passed.push('Legacy image branch submits one upload/attempt and retains payment destination');
  await page.evaluate(()=>{window.fixture.screen='guide';window.fixture.doc.contract_version=2;window.fixture.profile.id_verification_status='pending';window.resetDocuments();});
  await page.getByRole('button',{name:'Verify Valid ID',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixture.routes.at(-1)),'/settings/valid-id');
  await page.evaluate(()=>{window.fixture.session=null;window.resetDocuments();});
  await page.getByRole('button',{name:'Log In to Request',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixture.routes.at(-1)),'/(auth)/login');
  passed.push('Guide keeps verification and guest login gates/destinations');
  await page.evaluate(()=>window.unmountDocuments());
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors,native:false},null,2));
  console.log(JSON.stringify({passed,errors,native:false},null,2));
} catch (failure) {
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,errors,body:await page?.locator('body').innerText()},null,2));
  throw failure;
} finally { await browser.close(); }
