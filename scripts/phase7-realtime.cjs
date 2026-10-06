/* global __dirname */
// Diagnostic control event on the task's synthetic fixture only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..'),config=require('./phase7-local-config.cjs')();
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'dist/phase7-tools/fixtures.json'),'utf8'));
const report={events:[],system:[]};
async function main(){
 const resident=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const staff=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const session=await resident.auth.signInWithPassword(fixtures.users.resident);assert.ifError(session.error);
 await resident.realtime.setAuth(session.data.session.access_token);
 const channel=resident.channel('phase7-diagnostic-'+Date.now())
 .on('system',{},message=>{report.system.push(message);console.log(JSON.stringify(message));})
 .on('postgres_changes',{event:'*',schema:'public',table:'drive_registrations'},message=>{report.events.push(message);console.log('REGISTRATION '+message.eventType);})
 .on('postgres_changes',{event:'*',schema:'public',table:'medical_drives'},message=>{report.events.push(message);console.log('CONTROL '+message.eventType);});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Subscription timeout')),10000);channel.subscribe((state,error)=>{console.log(state,error?.message||'');if(state==='SUBSCRIBED'){clearTimeout(timer);resolve();}});});
 await new Promise(r=>setTimeout(r,2000));
 assert.ifError((await staff.from('medical_drives').update({title:'Phase Seven Privacy Drive'}).eq('id',fixtures.drive)).error);
 assert.ifError((await staff.from('drive_registrations').update({status:'confirmed'}).eq('id',fixtures.registration)).error);
 await new Promise(r=>setTimeout(r,5000));
 console.log('EVENTS '+report.events.length);await resident.removeAllChannels();
}
main().catch(e=>{report.error=e.message;process.exitCode=1;console.error(e.message);}).finally(()=>{fs.writeFileSync(path.join(root,'plans/evidence/phase7/http/realtime-diagnostic.json'),JSON.stringify(report,null,2));process.exit(process.exitCode||0);});
