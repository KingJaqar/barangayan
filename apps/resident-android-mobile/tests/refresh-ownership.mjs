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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-refresh-'));
fs.mkdirSync(out, { recursive: true });
// Real providers/hooks and shared registration schema; deferred transport and
// native lifecycle are controlled boundaries, not native performance evidence.
const mocks = {
  '@barangayan/shared': `export {DRIVE_TYPE_CONFIG} from '${shared}/constants/drive-types';export {RESIDENT_DRIVE_REGISTRATION_COLUMNS,residentDriveRegistrationResultSchema} from '${shared}/schemas/drive-registration';`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.userId?{user:{id:window.fixture.userId}}:null});`,
  'react-native': `export const AppState={addEventListener:(_,fn)=>{window.nativeListeners.add(fn);return{remove:()=>window.nativeListeners.delete(fn)}}};`,
  '@react-native-async-storage/async-storage': `export default {getItem:async k=>window.storage.get(k)??null,setItem:async(k,v)=>{window.cacheWrites++;window.storage.set(k,v)},removeItem:async k=>{window.storage.delete(k)}};`,
  'expo-router': `import {useEffect,useState} from 'react';export const useFocusEffect=fn=>{const [focused,setFocused]=useState(window.fixture.focused);useEffect(()=>{const fn=e=>setFocused(e.detail);window.addEventListener('fixture-focus',fn);return()=>window.removeEventListener('fixture-focus',fn)},[]);useEffect(()=>focused?fn():undefined,[fn,focused])};`,
  '@/lib/supabase': `export const supabase={from:table=>{const filters=[];let columns='',signal;const q={select:c=>{columns=c;return q},eq:(k,v)=>{filters.push([k,v]);return q},is:()=>q,order:()=>q,gte:(k,v)=>{filters.push(['gte',v]);return q},lte:(k,v)=>{filters.push(['lte',v]);return q},abortSignal:s=>{signal=s;return q},maybeSingle:()=>q,then:(yes,no)=>new Promise(resolve=>{window.reads.push({table,filters,columns,signal,resolve,done:false})}).then(yes,no)};return q},channel:name=>{const c={name,on:(_,filter,callback)=>{c.filter=filter;c.event=callback;return c},subscribe:callback=>{c.status=callback;window.channels.add(c);queueMicrotask(()=>{if(window.channels.has(c))callback?.('SUBSCRIBED')});return c}};return c},removeChannel:c=>{window.channels.delete(c);return Promise.resolve()},rpc:async()=>{window.rpcCalls++;return {data:{registration_id:'55555555-5555-4555-8555-555555555555',applicant_number:'DEN-20261023-0001',status:'pending'},error:null}}};`,
};
await build({
  stdin: { contents: `import React,{memo} from 'react';import {createRoot} from 'react-dom/client';import {ProfileProvider,useProfile,useProfileData} from '${src}/hooks/use-profile';import {useMedicalDrives} from '${src}/hooks/use-medical-drives';
    window.fixture={userId:'A',focused:true,selectedDate:'2026-10-23',typeFilter:'all',calendarMonth:{year:2026,month:10},monthViewActive:false};window.storage=new Map();window.channels=new Set();window.nativeListeners=new Set();window.reads=[];window.dataCommits=0;window.cacheWrites=0;window.rpcCalls=0;
    const DataProbe=memo(()=>{window.dataCommits++;window.profileData=useProfileData();return null});
    function Probe(){window.profile=useProfile();window.health=useMedicalDrives(window.fixture);return <div>{window.health.drives.map(d=><p key={d.id}>{d.title}</p>)}</div>}
    function App(){return <ProfileProvider><DataProbe/><Probe/></ProfileProvider>}
    const root=createRoot(document.getElementById('root'));window.render=()=>root.render(<App/>);window.configure=patch=>{Object.assign(window.fixture,patch);window.render()};window.unmount=()=>root.unmount();window.focus=value=>{window.fixture.focused=value;window.dispatchEvent(new CustomEvent('fixture-focus',{detail:value}))};window.reply=(index,data,error=null)=>{const q=window.reads[index];if(q.done)throw Error('Already replied');q.done=true;q.resolve({data,error})};window.render();`, resolveDir: app, loader: 'jsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const errors = [];
const passed = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const profileRow = id => ({ id, barangay_id: `tenant-${id}`, full_name: `Resident ${id}`, id_verification_status: 'verified', approved_id_submission_id: 'approved', barangays: { name: 'Synthetic', boundary: { type: 'Polygon', coordinates: [[[0,0],[1,0],[0,0]]] }, barangay_localities: null } });
  const waitRead = async (table, filter, value) => {
    await page.waitForFunction(({table,filter,value}) => window.reads.some(q => !q.done && q.table === table && (!filter || q.filters.some(([k,v]) => k === filter && v === value))), {table,filter,value});
    return page.evaluate(({table,filter,value}) => window.reads.findIndex(q => !q.done && q.table === table && (!filter || q.filters.some(([k,v]) => k === filter && v === value))), {table,filter,value});
  };
  const reply = (index, data, error = null) => page.evaluate(({index,data,error}) => window.reply(index,data,error), {index,data,error});
  const settleHealth = () => page.evaluate(() => {
    window.reads.forEach((q,index) => {
      if (q.done || q.table === 'profiles') return;
      const date = q.filters.find(([k]) => k === 'drive_date')?.[1] ?? q.filters.find(([k]) => k === 'gte')?.[1] ?? '2026-10-23';
      const uid = q.filters.find(([k]) => k === 'user_id')?.[1];
      window.reply(index, q.table === 'drive_registrations' ? [{id:`reg-${uid}`,drive_id:'drive',user_id:uid,status:'pending'}] : q.columns === 'drive_date, type' ? [{drive_date:date,type:'dental'}] : [{id:'drive',title:`Drive ${date}`,drive_date:date}]);
    });
  });
  const a = await waitRead('profiles', 'id', 'A');
  assert.equal(await page.evaluate(() => window.reads.filter(q => q.table === 'profiles').length), 1);
  await reply(a, profileRow('A'));
  await page.waitForFunction(() => window.profile.profile?.id === 'A');
  await settleHealth();
  await page.waitForFunction(() => !window.health.loadingDrives && !window.health.loadingRegistrations);
  passed.push('Mount/subscription equivalent profile reads share one transport');

  await page.evaluate(() => { window.beforeCommits=window.dataCommits;window.beforeWrites=window.cacheWrites;window.beforeBoundary=window.profile.profile.barangays;window.profile.refetch(); });
  const preWrite = await waitRead('profiles');
  await page.evaluate(() => { window.profile.refetch();window.profile.refetch(); });
  assert.equal(await page.evaluate(() => window.dataCommits-window.beforeCommits), 0);
  await reply(preWrite, {...profileRow('A'),full_name:'obsolete'});
  const postWrite = await waitRead('profiles');
  assert.notEqual(await page.evaluate(() => window.profile.profile?.full_name), 'obsolete');
  await reply(postWrite, {...profileRow('A'),full_name:'latest'});
  await page.waitForFunction(() => window.profile.profile?.full_name === 'latest' && !window.profile.isLoading);
  assert.equal(await page.evaluate(() => window.beforeBoundary === window.profile.profile.barangays), true);
  assert.equal(await page.evaluate(() => window.dataCommits-window.beforeCommits), 1);
  await page.evaluate(() => {window.beforeCommits=window.dataCommits;window.beforeWrites=window.cacheWrites;window.profile.refetch()});
  await reply(await waitRead('profiles'), {...profileRow('A'),full_name:'latest'});
  await page.waitForFunction(() => !window.profile.isLoading);
  assert.equal(await page.evaluate(() => window.dataCommits-window.beforeCommits), 0);
  assert.equal(await page.evaluate(() => window.cacheWrites-window.beforeWrites), 0);
  await page.evaluate(() => {window.equalRefreshMetrics={dataConsumerCommits:window.dataCommits-window.beforeCommits,cacheWrites:window.cacheWrites-window.beforeWrites}});
  passed.push('Overlapping profile invalidations coalesce; old reply suppressed; equal profile/geometry and cache identity retained; data consumers have zero refresh-status commits');

  await page.evaluate(() => window.focus(false));
  await page.waitForTimeout(20);
  await page.evaluate(() => window.focus(true));
  const warm = await waitRead('medical_drives','drive_date','2026-10-23');
  assert.equal(await page.evaluate(() => window.health.loadingDrives), false);
  assert.equal(await page.evaluate(() => window.health.refreshingDrives), true);
  assert.equal(await page.evaluate(() => window.health.drives.length), 1);
  assert.equal(await page.evaluate(() => window.health.loadingRegistrations), false);
  await reply(warm,null,{message:'offline'});
  await settleHealth();
  await page.waitForFunction(() => !!window.health.error);
  assert.equal(await page.evaluate(() => window.health.drives.length), 1);
  await page.evaluate(() => {void window.health.refetch()});
  await reply(await waitRead('medical_drives','drive_date','2026-10-23'), []);
  await page.waitForFunction(() => !window.health.error && !window.health.refreshingDrives && window.health.drives.length === 0);
  passed.push('Warm Health feeds remain usable during slow/offline focus refresh; refresh failure and retry preserve content, including loaded empty results');

  await page.evaluate(() => window.configure({selectedDate:'2026-10-24'}));
  const oldDate = await waitRead('medical_drives','drive_date','2026-10-24');
  await page.evaluate(() => window.configure({selectedDate:'2026-10-25'}));
  const newDate = await waitRead('medical_drives','drive_date','2026-10-25');
  await reply(newDate,[{id:'new',title:'Newest date'}]);
  await page.waitForFunction(() => window.health.drives[0]?.id === 'new');
  await reply(oldDate,[{id:'old',title:'Obsolete date'}]);
  assert.equal(await page.evaluate(() => window.reads.find(q=>q.filters.some(([k,v])=>k==='drive_date'&&v==='2026-10-24')).signal.aborted), true);
  assert.equal(await page.evaluate(() => window.health.drives[0]?.id), 'new');
  await page.evaluate(() => window.configure({calendarMonth:{year:2026,month:11},monthViewActive:true}));
  const november = await waitRead('medical_drives','gte','2026-11-01');
  await page.evaluate(() => window.configure({calendarMonth:{year:2026,month:12}}));
  await waitRead('medical_drives','gte','2026-12-01');
  await page.evaluate(() => window.reads.forEach((q,index)=>{
    if(q.done||!q.filters.some(([k,v])=>k==='gte'&&v==='2026-12-01'))return;
    window.reply(index,q.columns==='drive_date, type'?[{drive_date:'2026-12-01',type:'dental'}]:[{id:'December',drive_date:'2026-12-01'}]);
  }));
  await page.waitForFunction(() => window.health.monthDrives[0]?.drive_date === '2026-12-01');
  await settleHealth();
  assert.equal(await page.evaluate(index=>window.reads[index].signal.aborted,november), true);
  assert.equal(await page.evaluate(() => Object.keys(window.health.monthEventMap)[0]), '2026-12-01');
  passed.push('Date/month/calendar ownership cancels obsolete transport and survives newest-before-oldest replies');

  await page.evaluate(() => window.profile.refetch());
  for (let attempt=0;attempt<3;attempt++) await reply(await waitRead('profiles'),null,{message:'offline'});
  await page.waitForFunction(() => !!window.profile.error && !window.profile.isLoading);
  assert.equal(await page.evaluate(() => window.profile.profile?.full_name), 'latest');
  assert.equal(await page.evaluate(() => window.profile.profile?.id_verification_status), null);
  assert.equal(await page.evaluate(() => window.profile.profile?.approved_id_submission_id), null);
  await page.evaluate(() => window.profile.refetch());
  await reply(await waitRead('profiles'), profileRow('A'));
  await page.waitForFunction(() => !window.profile.error && window.profile.profile?.id_verification_status === 'verified');
  passed.push('Profile retries remain bounded; failure preserves demographics and revokes cached approval; explicit retry restores authoritative status');

  await page.evaluate(() => {window.health.registerForDrive({driveId:'drive',age:30,isPwd:false,comorbidities:[]}).then(result=>{window.mutationResult=result})});
  await waitRead('drive_registrations','user_id','A');
  await settleHealth();
  await page.waitForFunction(() => !!window.mutationResult);
  assert.equal(await page.evaluate(() => window.rpcCalls),1);
  await page.evaluate(() => {window.channels.forEach(c=>{c.status?.('CHANNEL_ERROR');c.status?.('SUBSCRIBED')})});
  await reply(await waitRead('profiles','id','A'),profileRow('A'));
  await waitRead('drive_registrations','user_id','A');
  await settleHealth();
  await page.waitForFunction(() => !window.profile.isLoading && !window.health.refreshingRegistrations);
  passed.push('Successful mutation invalidates all active Health views; channel reconnect catches up profile and Health without a TTL');

  await page.evaluate(() => window.configure({userId:'B'}));
  const b = await waitRead('profiles','id','B');
  const bRegs = await waitRead('drive_registrations','user_id','B');
  await page.evaluate(() => window.configure({userId:'C'}));
  assert.equal(await page.evaluate(() => window.profile.profile), null);
  assert.deepEqual(await page.evaluate(() => window.health.myRegistrations), []);
  await reply(await waitRead('profiles','id','C'),profileRow('C'));
  await page.waitForFunction(() => window.profile.profile?.id === 'C');
  await page.evaluate(() => window.reads.forEach((q,index)=>{if(!q.done&&q.table==='drive_registrations'&&q.filters.some(([k,v])=>k==='user_id'&&v==='C'))window.reply(index,[{id:'current-C',user_id:'C',drive_id:'current'}])}));
  await page.waitForFunction(() => window.health.myRegistrations[0]?.user_id === 'C');
  await reply(b,profileRow('B'));
  await reply(bRegs,[{id:'private-B',user_id:'B',drive_id:'old'}]);
  await settleHealth();
  await page.waitForFunction(() => window.health.myRegistrations[0]?.user_id === 'C');
  assert.equal(await page.evaluate(() => window.profile.profile?.id), 'C');
  await page.evaluate(() => {window.nativeListeners.forEach(fn=>fn('active'))});
  await reply(await waitRead('profiles','id','C'),profileRow('C'));
  await settleHealth();
  await page.waitForFunction(() => !window.profile.isLoading);
  // Sign out while both private owners are still reading. Retired subscription
  // callbacks can arrive after cleanup, and transport may ignore AbortSignal.
  await page.evaluate(() => {
    window.retiredChannels = [...window.channels];
    window.profile.refetch();
    void window.health.refetchRegistrations();
  });
  const signingOutProfile = await waitRead('profiles', 'id', 'C');
  const signingOutRegistrations = await waitRead('drive_registrations', 'user_id', 'C');
  await page.evaluate(() => window.configure({userId:null}));
  await page.waitForFunction(() => !window.profile.profile && window.channels.size === 0);
  assert.deepEqual(await page.evaluate(() => window.health.myRegistrations), []);
  assert.equal(await page.evaluate(indices => indices.every(index => window.reads[index].signal.aborted),
    [signingOutProfile, signingOutRegistrations]), true);
  await reply(signingOutProfile, profileRow('C'));
  await reply(signingOutRegistrations, null, { message: 'Late obsolete private failure' });
  const privateReadCount = await page.evaluate(() => window.reads.filter(q => ['profiles', 'drive_registrations'].includes(q.table)).length);
  await page.evaluate(() => window.retiredChannels.forEach(c => { c.event?.(); c.status?.('SUBSCRIBED'); }));
  await settleHealth();
  assert.equal(await page.evaluate(() => window.reads.filter(q => ['profiles', 'drive_registrations'].includes(q.table)).length), privateReadCount);
  assert.equal(await page.evaluate(() => window.profile.error), null);
  assert.equal(await page.evaluate(() => window.health.registrationsError), null);
  assert.equal(await page.evaluate(() => window.profile.profile), null);
  assert.deepEqual(await page.evaluate(() => window.health.myRegistrations), []);
  passed.push('Sign-out aborts active private reads; ignored-abort success/failure and retired channel callbacks cannot restore data or restart private transport');
  assert.equal(await page.evaluate(() => window.storage.has('resident_profile_v2:A') || window.storage.has('resident_profile_v2:B') || window.storage.has('resident_profile_v2:C')), false);
  await page.evaluate(() => window.unmount());
  assert.equal(await page.evaluate(() => window.nativeListeners.size), 0);
  assert.equal(await page.evaluate(() => window.channels.size), 0);
  passed.push('Account switch/sign-out immediately hide private data; late old replies are rejected; foreground catches up; cache/listeners/channels clean up');
  assert.deepEqual(errors, []);
  const metrics=await page.evaluate(()=>({initialProfileRequests:1,equalProfileRefresh:window.equalRefreshMetrics,totalRequests:window.reads.length,rpcCalls:window.rpcCalls}));
  const result = {passed,errors,metrics,scope:'Real hooks with synthetic deferred transport; no native timing claim'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
