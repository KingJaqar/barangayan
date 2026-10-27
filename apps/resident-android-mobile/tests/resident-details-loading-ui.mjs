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
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-profile-load-fix-20261025/ui');
fs.mkdirSync(out, { recursive: true });

// Real form, validators, locality reader and input primitive; only native/device/network boundaries are synthetic.
const mocks = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';export const KeyboardAvoidingView=({behavior,...p})=><R.View {...p}/>;`,
  'react-native-safe-area-context': `import React from 'react';import {View} from 'react-native-web';export const SafeAreaView=({edges,...p})=><View {...p}/>;export const useSafeAreaInsets=()=>({top:0,left:0,right:0,bottom:0});`,
  '@expo/vector-icons': `export const Ionicons=()=>null;`,
  '@barangayan/shared': `export * from '${shared}/lib/resident-auth.ts';export * from '${shared}/lib/resident-account-setup.ts';export * from '${shared}/schemas/auth.ts';export * from '${shared}/constants/theme-fonts.ts';export * from '${shared}/constants/theme-colors.ts';`,
  '@/hooks/use-auth': `export const useAuth=()=>({...window.fixture.auth,logout:async()=>{window.fixture.logouts++;}});`,
  '@/hooks/use-profile': `export const useProfile=()=>({refetch:()=>{window.fixture.refreshes++;}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'system'});`,
  '@/hooks/use-theme': `import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>Colors[window.fixture.mode];`,
  './auth-header': `import React from 'react';export const AuthHeader=({title,onBack})=><header><button onClick={onBack}>Go back</button><h1>{title}</h1></header>;`,
  './primary-button': `import React from 'react';export const PrimaryButton=({label,accessibilityLabel,onPress,disabled,loading})=><button aria-label={accessibilityLabel??label} disabled={disabled||loading} onClick={onPress}>{label}</button>;`,
  './birthday-calendar-modal': `export const BirthdayCalendarModal=()=>null;export const isoToLocalDate=iso=>new Date(iso+'T12:00:00');export const dateToIso=date=>date.toISOString().slice(0,10);`,
  './registration-map': `import React from 'react';export const RegistrationMap=()=> <div>Optional registration map</div>;`,
  '@/lib/supabase': `export const supabase={rpc:()=>{throw Error('Unexpected profile mutation');},from:table=>{
    const filters=[];let signal;
    const query={select:()=>query,eq:(column,value)=>{filters.push({column,value});return query;},abortSignal:value=>{signal=value;window.fixture.signals.push(value);return query;},maybeSingle:()=>{
      const f=window.fixture;f.reads.push({table,filters:[...filters]});
      const failure=table==='profiles'?f.profileError:table==='barangay_localities'?f.localityError:f.boundaryError;
      const source=table==='profiles'?f.profile:table==='barangay_localities'?f.localities:f.barangays;
      const data=table==='profiles'?source:source.filter(row=>filters.every(filter=>row[filter.column]===filter.value));
      const multiple=Array.isArray(data)&&data.length>1;
      const result={data:failure||multiple?null:Array.isArray(data)?data[0]??null:data,error:failure??(multiple?{code:'PGRST116'}:null),status:failure?.status??(multiple?406:200)};
      const snapshot=JSON.parse(JSON.stringify(result));const delay=f.delay,ignoreAbort=f.ignoreAbort;
      return new Promise(resolve=>{let timer;const finish=value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve(value);};const abort=()=>finish({data:null,error:{code:'',message:'aborted'},status:0});
        timer=setTimeout(()=>finish(snapshot),delay);if(!ignoreAbort){signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();}
      });
    }};return query;
  }};`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ResidentDetailsForm} from '${root}/components/resident-details-form.tsx';
    const root=createRoot(document.getElementById('root'));let generation=0;
    window.resetFixture=(overrides={})=>{generation++;window.fixture={mode:'light',required:false,auth:{session:{user:{id:'resident-one',email:'test@example.invalid',user_metadata:{full_name:'Suggested Resident'}}}},
      profile:{id:'resident-one',role:'resident',deleted_at:null,barangay_id:'own',first_name:'Saved',last_name:'Resident',mobile_number:'09171234567',house_no:'1',street:'Main',sex:'female',employment_status:'student',birth_date:'2000-01-01'},
      localities:[{barangay_id:'own',display_name:'Own Barangay',city:'Own City',province:'Own Province',resident_registration_enabled:false},{barangay_id:'new',display_name:'New Barangay',city:'New City',province:'New Province',resident_registration_enabled:true}],
      barangays:[{id:'own',boundary:null},{id:'new',boundary:null}],profileError:null,localityError:null,boundaryError:null,delay:10,ignoreAbort:false,reads:[],signals:[],logouts:0,refreshes:0,...overrides};window.renderForm();};
    window.renderForm=()=>root.render(<ResidentDetailsForm key={generation} required={window.fixture.required} onSaved={async()=>{}} onSkip={()=>{}} onBack={()=>{}}/>);
    window.unmountForm=()=>root.render(null);window.resetFixture();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'loading-boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, a => {
      if (a.path in mocks) return { path: a.path, namespace: 'fixture' };
      if (!a.path.startsWith('@/')) return;
      const base = path.join(root, a.path.slice(2));
      const resolved = [base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file));
      if (!resolved) throw new Error('Unresolved test source: ' + a.path);
      return { path: resolved };
    });
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : fs.existsSync('C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe') ? { executablePath: 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' } : {}) });
const errors = [], passed = [];
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
const button = name => page.getByRole('button', { name, exact: true });
const text = name => page.getByRole('textbox', { name, exact: true });
try {
  await page.setContent('<html><body><div id="root"></div></body></html>');await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  await button('Confirm personal details').waitFor();
  assert.equal(await text('First Name').inputValue(), 'Saved');
  assert.equal(await text('City').inputValue(), 'Own City');
  assert.equal(await text('City').isEditable(), false);assert.equal(await text('Email Address').isEditable(), false);
  assert.deepEqual(await page.evaluate(()=>window.fixture.reads.map(r=>r.table)), ['profiles','barangay_localities','barangays']);
  passed.push('eligible resident reads their own locality, not the enabled signup locality; locked fields remain readonly');

  await page.evaluate(()=>window.resetFixture({profile:{...window.fixture.profile,role:'admin'}}));
  await page.getByRole('alert').filter({hasText:'This account cannot continue resident setup.'}).waitFor();
  assert.equal(await button('Reload and review current profile').count(),0);assert.equal(await button('Confirm personal details').count(),0);
  assert.equal(await text('First Name').count(),0);assert.deepEqual(await page.evaluate(()=>window.fixture.reads.map(r=>r.table)),['profiles']);
  await button('Back to Home').waitFor();await button('Sign out').waitFor();
  passed.push('admin receives accurate nonretryable account restriction; no locality read, editable form, save or misleading retry');

  await page.evaluate(()=>window.resetFixture({profile:{...window.fixture.profile,role:'resident',deleted_at:'2026-01-01'}}));
  await page.getByRole('alert').filter({hasText:'This account cannot continue resident setup.'}).waitFor();assert.equal(await button('Confirm personal details').count(),0);
  await page.evaluate(()=>window.resetFixture({auth:{session:null}}));await page.getByRole('alert').filter({hasText:'Your session has ended.'}).waitFor();
  assert.equal(await button('Reload and review current profile').count(),0);assert.equal(await page.evaluate(()=>window.fixture.reads.length),0);
  passed.push('deleted and signed-out identities fail closed without an endless loading/retry state');

  await page.evaluate(()=>window.resetFixture({profileError:{code:'PGRST301',status:401}}));await page.getByRole('alert').filter({hasText:'Your session has ended.'}).waitFor();
  assert.equal(await button('Reload and review current profile').count(),0);
  await page.evaluate(()=>window.resetFixture({profileError:{code:'503',status:503},delay:250}));await page.getByText('Loading your profile…',{exact:true}).waitFor();
  assert.equal(await button('Reload and review current profile').count(),0);await page.getByRole('alert').filter({hasText:'Unable to load your profile.'}).waitFor();await button('Reload and review current profile').waitFor();
  await page.evaluate(()=>{window.fixture.profileError=null;window.fixture.delay=10;});await button('Reload and review current profile').click();await button('Confirm personal details').waitFor();
  passed.push('401 requests fresh sign-in; transient profile failure exposes a working retry only after loading finishes');

  await page.evaluate(()=>window.resetFixture({profile:null,required:true}));await button('Next').waitFor();assert.equal(await text('City').inputValue(),'New City');assert.equal(await text('First Name').inputValue(),'Suggested');
  await page.evaluate(()=>window.resetFixture({localities:[]}));await page.getByRole('alert').filter({hasText:'Registration details are not configured'}).waitFor();assert.equal(await button('Reload and review current profile').count(),0);
  await page.evaluate(()=>window.resetFixture({boundaryError:{code:'503',status:503}}));await page.getByRole('alert').filter({hasText:'Unable to load the registration boundary.'}).waitFor();await button('Reload and review current profile').waitFor();
  passed.push('new profile uses configured signup locality; missing configuration and boundary transport errors stay distinct');

  await page.evaluate(()=>window.resetFixture({delay:300,ignoreAbort:true}));await page.getByText('Loading your profile…',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.auth.session.user.id='resident-two';window.fixture.profile={...window.fixture.profile,id:'resident-two',first_name:'Current'};window.fixture.delay=10;window.renderForm();});
  await button('Confirm personal details').waitFor();await page.waitForTimeout(400);assert.equal(await text('First Name').inputValue(),'Current');
  await page.evaluate(()=>window.resetFixture({delay:300}));await page.getByText('Loading your profile…',{exact:true}).waitFor();await page.evaluate(()=>window.unmountForm());assert.equal(await page.evaluate(()=>window.fixture.signals.every(s=>s.aborted)),true);
  passed.push('late prior-account response cannot replace the current draft; unmount cancels pending reads');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors,native:false},null,2));console.log(JSON.stringify({passed,errors},null,2));
} catch(error) {fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,errors,error:String(error)},null,2));await page.screenshot({path:path.join(out,'failure.png')});throw error;} finally {await browser.close();}
