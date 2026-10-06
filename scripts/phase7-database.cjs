/* global __dirname */
// Existing synthetic local Docker stack only; never reads a hosted connection.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'), mode=process.argv[2];
assert.ok(['baseline','migrate','finalize','test','focused','advisors','reconcile'].includes(mode));
const output=path.join(root,'plans/evidence/phase7/database');fs.mkdirSync(output,{recursive:true});
function sql(source) {
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
 assert.equal(r.status,0,r.stderr);return r.stdout;
}
const inspect=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','inspect','--format','{{json .NetworkSettings.Ports}}','supabase_db_barangayan'],{encoding:'utf8',timeout:30000});
assert.equal(inspect.status,0);assert.ok(JSON.parse(inspect.stdout)['5432/tcp'].every(p=>p.HostPort==='54322'));
assert.ok(Number(sql("select count(*) from auth.users where email like '%@test.local'").trim())>0);
assert.equal(sql("select to_regprocedure('public.ensure_google_resident_profile()') is not null").trim(),'t');
if(mode==='baseline') {
 const log=sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='drive_registrations' and column_name='priority_score'); select pg_get_functiondef('public.register_for_drive(uuid,integer,boolean,text[],date)'::regprocedure) like '%''priority_score''%';");
 fs.writeFileSync(path.join(output,'score-exposure-baseline.log'),log);assert.equal(log.trim(),'t\nt');
 console.log('REPRODUCED: resident-readable column and resident RPC expose score');
} else if(mode==='migrate') {
 assert.equal(sql("select to_regclass('public.drive_registration_scores') is null").trim(),'t','Do not replay applied migration');
 const tables=['profiles','medical_drives','drive_registrations','service_requests','payments','id_submissions','barangays','document_types'];
 const snapshot=()=>Object.fromEntries(tables.map(t=>[t,JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.${t} r`))]));
 const before=snapshot();fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(before,null,2));
 fs.writeFileSync(path.join(output,'migration.log'),sql(fs.readFileSync(path.join(root,'supabase/migrations/0105_phase7_administrator_only_scores.sql'),'utf8')));
 const after=snapshot(), scores=JSON.parse(sql("select coalesce(jsonb_agg(to_jsonb(s) order by registration_id),'[]') from public.drive_registration_scores s"));
 fs.writeFileSync(path.join(output,'after.json'),JSON.stringify({tables:after,scores},null,2));
 for(const table of tables){assert.equal(before[table].length,after[table].length);for(const old of before[table]){const current=after[table].find(r=>r.id===old.id);for(const [key,value] of Object.entries(old)){if(table==='drive_registrations'&&key==='priority_score'){assert.equal(scores.find(s=>s.registration_id===old.id).priority_score,value);assert.equal(current[key],null);}else assert.deepEqual(current[key],value,`${table}.${key}`);}}}
 fs.writeFileSync(path.join(output,'reconciliation.json'),JSON.stringify({passed:true,scoreRows:scores.length,tables:tables.map(t=>({table:t,rows:before[t].length,originalValuesPreserved:true}))},null,2));
 console.log('PASS: migration, exact score backfill and historical reconciliation');
} else if(mode==='finalize') {
 // Initial unpublished rehearsal removed the column in 0105. The final release
 // separates value protection (0105) from cleanup (0106); never restore exposure.
 const policy=fs.readFileSync(path.join(root,'supabase/migrations/0105_phase7_administrator_only_scores.sql'),'utf8');
 const start=policy.indexOf('alter policy "admins can read own barangay audit log"');
 const end=policy.indexOf(';',start)+1;assert.ok(start>=0&&end>start);
 fs.writeFileSync(path.join(output,'final-release-schema.log'),sql(policy.slice(start,end)+'\n'+fs.readFileSync(path.join(root,'supabase/migrations/0106_remove_obsolete_registration_score.sql'),'utf8')));
 console.log('PASS: final audit authorization and 0106 cleanup rehearsed locally');
} else if(mode==='reconcile') {
 const before=JSON.parse(fs.readFileSync(path.join(output,'before.json'),'utf8'));
 const scores=JSON.parse(sql("select coalesce(jsonb_agg(to_jsonb(s) order by registration_id),'[]') from public.drive_registration_scores s")),proof=[];
 for(const [table,rows] of Object.entries(before)){
  assert.ok(['profiles','medical_drives','drive_registrations','service_requests','payments','id_submissions','barangays','document_types'].includes(table));
  const after=JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.${table} r`));assert.equal(after.length,rows.length,table);
  for(const old of rows){const current=after.find(r=>r.id===old.id);for(const [key,value] of Object.entries(old)){
   if(table==='drive_registrations'&&key==='priority_score')assert.equal(scores.find(s=>s.registration_id===old.id).priority_score,value);
   else assert.deepEqual(current[key],value,`${table}.${key}`);
  }}
  proof.push({table,rows:rows.length,unchanged:true});
 }
 fs.writeFileSync(path.join(output,'post-cleanup-reconciliation.json'),JSON.stringify({passed:true,tables:proof},null,2));
 console.log('PASS original records and exact scores remain after fixture cleanup');
} else if(mode==='advisors') {
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','db','advisors','--local','--fail-on','error','--output-format','json'],{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(output,'advisors.log'),r.stdout+r.stderr);assert.equal(r.status,0,r.stderr);console.log('PASS: local advisors');
} else {
 const results=[];
 for(const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(f=>f.endsWith('.test.sql')&&(mode!=='focused'||f==='administrator_scores.test.sql')).sort()) {
  const log=sql(fs.readFileSync(path.join(root,'supabase/tests',file),'utf8'));fs.writeFileSync(path.join(output,file+'.log'),log);
  const passed=!/not ok|Looks like you failed/.test(log);results.push({file,passed,assertions:(log.match(/^ok \d+/gm)||[]).length});
  fs.writeFileSync(path.join(output,mode+'-results.json'),JSON.stringify(results,null,2));assert.ok(passed,file);console.log('PASS '+file);
 }
}
