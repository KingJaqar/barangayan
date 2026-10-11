// Five real RLS-authorized Realtime subscriptions, each removed before the next.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {statePath,privateDir,sql} from './runtime-stack.mjs';
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
assert.equal(state.api,'http://127.0.0.1:55431');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(10000)})}};
const caller=createClient(state.api,state.anonKey,options),trusted=createClient(state.api,state.serviceKey,options);
const signedIn=await caller.auth.signInWithPassword(users.admin);assert.ifError(signedIn.error);
await caller.realtime.setAuth(signedIn.data.session.access_token);
const report={passed:false,checks:[],failures:[]};
try{
 for(const [table,id,patch] of [
  ['service_requests','40000000-0000-4000-8000-000000001504',{requester_notes:'Realtime fixture request'}],
  ['incidents','61000000-0000-4000-8000-000000001504',{title:'Fixture Incident 1504 refreshed'}],
  ['medical_drives','70000000-0000-4000-8000-000000000001',{location:'Realtime fixture clinic'}],
  ['drive_registrations','71000000-0000-4000-8000-000000001504',{age:44}],
  ['household_members','80000000-0000-4000-8000-000000001504',{name:'Fixture Member 1504 refreshed'}],
 ]){
  let onChange,subscribed,rejected;
  const event=new Promise(resolve=>{onChange=resolve;});const ready=new Promise((resolve,reject)=>{subscribed=resolve;rejected=reject;});
  const channel=caller.channel('phase0-'+table).on('postgres_changes',{event:'UPDATE',schema:'public',table,filter:`id=eq.${id}`},payload=>onChange(payload));
  channel.subscribe((status,error)=>{if(status==='SUBSCRIBED'){console.log('Subscribed: '+table);subscribed();}else if(['CHANNEL_ERROR','TIMED_OUT'].includes(status))rejected(error??new Error(status));});
  let readyTimer,eventTimer;
  try{
   await Promise.race([ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(new Error(table+': subscription timeout')),15000);})]);clearTimeout(readyTimer);
   // A new self-hosted tenant can acknowledge a channel before its WAL slot
   // exists. Confirm the actual replication resource before the fixture write.
   let slotReady=false;
   for(let attempt=0;attempt<4;attempt++){
    slotReady=Number(sql("select count(*) from pg_replication_slots where plugin='wal2json' and restart_lsn is not null;"))>0;
    if(slotReady)break;
    await new Promise(resolve=>setTimeout(resolve,500));
   }
   assert.ok(slotReady,'Cold Realtime WAL slot not ready within the finite bound');
   const before=await trusted.from(table).select(Object.keys(patch).join(',')).eq('id',id).single();assert.ifError(before.error);
   for(const [key,value]of Object.entries(patch))if(before.data[key]===value)patch[key]=typeof value==='number'?value+1:value+' alternate';
   const update=await trusted.from(table).update(patch).eq('id',id).select('id');assert.ifError(update.error);assert.equal(update.data.length,1);
   const payload=await Promise.race([event,new Promise((_,reject)=>{eventTimer=setTimeout(()=>reject(new Error(table+': change timeout')),15000);})]);clearTimeout(eventTimer);
   assert.equal(payload.new.id,id);for(const [key,value]of Object.entries(patch))assert.equal(payload.new[key],value);
   report.checks.push({table,event:payload.eventType,matchingId:true,matchingValues:true});
  }finally{clearTimeout(readyTimer);clearTimeout(eventTimer);await caller.removeChannel(channel);assert.equal(caller.getChannels().length,0);}
  console.log('Verified real subscription and cleanup: '+table);
 }
 report.passed=true;
}catch(error){report.failures.push({message:error.message});console.error(error);process.exitCode=1;}
finally{await caller.removeAllChannels();await caller.auth.signOut({scope:'local'});fs.writeFileSync(new URL('./runtime-subscription-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
