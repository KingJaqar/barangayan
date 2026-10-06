/* global __dirname */
// Additional native fixture and administrator/resident CSV compatibility proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..'),config=require('./phase7-local-config.cjs')();
const fixturePath=path.join(root,'dist/phase7-tools/fixtures.json'),fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const output=path.join(root,'plans/evidence/phase7'),mode=process.argv[2];assert.ok(['prepare','check','native'].includes(mode));
const report={passed:false,assertions:[]},prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
const client=key=>createClient(config.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(10000)})}});
async function main(){
 if(mode==='prepare'){
  assert.ok(!fixtures.nativeDrive,'Never replace an existing fixture');
  fixtures.nativeDrive=randomUUID();
  const r=await client(config.SERVICE_ROLE_KEY).from('medical_drives').insert({id:fixtures.nativeDrive,barangay_id:'00000000-0000-0000-0000-000000000001',title:'Phase Seven Native Registration',type:'consultation',drive_date:'2026-10-04',time_start:'08:00',time_end:'12:00',eligible_criteria:'Test residents',stock_total:5,stock_remaining:5});assert.ifError(r.error);
  fs.writeFileSync(fixturePath,JSON.stringify(fixtures,null,2));prove(true,'Created tracked synthetic native drive');
 }else if(mode==='native'){
  const r=await client(config.SERVICE_ROLE_KEY).from('drive_registrations').select('id,applicant_number,score:drive_registration_scores!inner(priority_score)').eq('drive_id',fixtures.nativeDrive).eq('user_id',fixtures.users.resident.id).single();assert.ifError(r.error);
  prove(r.data.score.priority_score===20,'Native submission retains protected senior score 20');prove(r.data.applicant_number.startsWith('CON-'),'Native submission retains typed applicant number');
  fixtures.nativeRegistration=r.data.id;fs.writeFileSync(fixturePath,JSON.stringify(fixtures,null,2));
 }else{
  for(const role of ['admin','resident']){
   const c=client(config.ANON_KEY),session=await c.auth.signInWithPassword(fixtures.users[role]);assert.ifError(session.error);
   const jwt=session.data.session.access_token;
   const query=role==='admin'?`drive_registration_scores?select=*&registration_id=in.(${fixtures.registration})&order=priority_score.desc`:`drive_registrations?select=*&id=eq.${fixtures.registration}`;
   const r=await fetch(`${config.API_URL}/rest/v1/${query}`,{headers:{apikey:config.ANON_KEY,Authorization:`Bearer ${jwt}`,Accept:'text/csv'},signal:AbortSignal.timeout(10000)});prove(r.ok,role+' CSV retrieval succeeds');const csv=await r.text();
   if(role==='admin'){prove(csv.includes('priority_score'),'Admin CSV keeps score column');prove(csv.includes(',80'),'Admin CSV keeps exact original score');}
   else{prove(!csv.includes('priority_score'),'Resident CSV omits score field');prove(csv.includes(fixtures.registration),'Resident CSV retains registration history');}
  }
 }
 report.passed=true;
}
main().then(()=>console.log('PASS '+report.assertions.length+' '+mode+' assertions')).catch(e=>{report.error=e.message;console.error(e.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,mode==='native'?'android/database-results.json':`compatibility-${mode}.json`),JSON.stringify(report,null,2)));
