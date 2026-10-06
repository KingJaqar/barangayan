/* global __dirname */
// Track task fixtures before creation and remove only newly created, tagged users.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..'),mode=process.argv[2];
assert.ok(['snapshot','cleanup'].includes(mode));
const output=path.join(root,'plans/evidence/phase9/fixtures');fs.mkdirSync(output,{recursive:true});
const config=require('./phase7-local-config.cjs')();
const trusted=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(10000)})}});
function sql(source){const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const tables=['profiles','barangays','document_types','service_requests','payments','id_submissions','medical_drives','drive_registrations','drive_registration_scores'];
function snapshot(){return JSON.parse(sql(`select jsonb_build_object(${tables.map(t=>`'${t}',(select coalesce(jsonb_agg(to_jsonb(r) order by ${t==='drive_registration_scores'?'registration_id':'id'}),'[]') from public.${t} r)`).join(',')},'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email) order by id),'[]') from auth.users));`));}
async function main(){
 const file=path.join(output,'before.json');
 if(mode==='snapshot'){assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(snapshot(),null,2));console.log('PASS: original synthetic records snapshotted');return;}
 const before=JSON.parse(fs.readFileSync(file,'utf8')),current=snapshot();
 for(const table of tables) for(const row of before[table]) {
  const key=table==='drive_registration_scores'?'registration_id':'id';
  assert.deepEqual(current[table].find(candidate=>candidate[key]===row[key]),row,table+' original record must be unchanged before cleanup');
 }
 const users=current.users.filter(u=>!before.users.some(v=>v.id===u.id)&&/^phase9-(services|sla|scores)-.*@test\.local$/.test(u.email));
 assert.ok(users.length>0,'Task-tagged users required');
 const ids=users.map(u=>u.id);ids.forEach(id=>assert.match(id,/^[0-9a-f-]{36}$/));
 const tenants=current.profiles.filter(p=>ids.includes(p.id)).map(p=>p.barangay_id).filter(id=>!before.barangays.some(b=>b.id===id));
 tenants.forEach(id=>assert.match(id,/^[0-9a-f-]{36}$/));
 assert.ok(current.profiles.filter(p=>tenants.includes(p.barangay_id)).every(p=>ids.includes(p.id)),'Disposable tenants contain only task users');
 const drives=current.medical_drives.filter(d=>!before.medical_drives.some(v=>v.id===d.id)&&['Phase Seven Privacy Drive','Phase Seven Concurrent Slot','Phase Seven Browser Registration'].includes(d.title));
 for(const drive of drives){
  assert.match(drive.id,/^[0-9a-f-]{36}$/);
  assert.ok(current.drive_registrations.filter(r=>r.drive_id===drive.id).every(r=>ids.includes(r.user_id)),'Only task users may belong to a disposable drive');
 }
 const list=ids.map(id=>`'${id}'`).join(',');
 const objects=JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name)),'[]') from storage.objects where bucket_id in ('id-documents','request-attachments') and split_part(name,'/',1) in (${list});`));
 for(const bucket of ['id-documents','request-attachments']) {
  const paths=objects.filter(object=>object.bucket===bucket).map(object=>object.name);
  if(paths.length){const result=await trusted.storage.from(bucket).remove(paths);assert.ifError(result.error);}
 }
 const ownedRequests=`select id from public.service_requests where resident_id in (${list})`;
 sql(`begin;
 delete from public.admin_audit_log where admin_id in (${list});
 ${['barangayan_private.legacy_submission_keys','public.request_attachments','public.service_request_pauses','public.service_request_sla_alerts'].map(table=>`delete from ${table} where request_id in (${ownedRequests});`).join('\n')}
 delete from public.payments where service_request_id in (${ownedRequests});
 delete from public.service_requests where resident_id in (${list});
 update public.profiles set current_id_submission_id=null,approved_id_submission_id=null where id in (${list});
 delete from public.id_submissions where resident_id in (${list});
 delete from public.drive_registrations where user_id in (${list});
 ${drives.length?`delete from public.medical_drives where id in (${drives.map(d=>`'${d.id}'`).join(',')});`:''}
 delete from auth.users where id in (${list});
 ${[...new Set(tenants)].map(id=>`delete from public.document_types where barangay_id='${id}';`).join('\n')}
 ${[...new Set(tenants)].map(id=>`delete from public.barangays where id='${id}';`).join('\n')}
 commit;`);
 const after=snapshot();
 for(const table of tables) assert.deepEqual(after[table],before[table],table+' original data exactly retained');
 assert.deepEqual(after.users,before.users,'Original Auth identities retained');
 fs.writeFileSync(path.join(output,'cleanup.json'),JSON.stringify({passed:true,removedTaskUsers:ids.length,tables:tables.map(table=>({table,rows:before[table].length,unchanged:true})),originalAuthUsersUnchanged:true},null,2));
 for(const dir of ['services','sla','scores']) for(const file of ['ui-users.json','fixtures.json']) {const target=path.join(root,'dist/phase9-tools',dir,file);if(fs.existsSync(target))fs.unlinkSync(target);}
 console.log('PASS: task fixtures removed, every original compared record unchanged');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
