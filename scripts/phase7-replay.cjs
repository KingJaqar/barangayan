/* global __dirname */
// Empty and representative-history rehearsal; dedicated loopback fixture DBs only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),run=process.argv[2]||'replay';assert.match(run,/^[a-z0-9-]+$/);
const output=path.join(root,'plans/evidence/phase7',run);
fs.mkdirSync(output,{recursive:true});assert.ok(!fs.existsSync(path.join(output,'results.json')),'Preserve previous rehearsal');
const bin=path.join(root,'dist/phase1-tools/postgres/pgsql/bin'),results=[];
function command(name,args){const r=spawnSync(path.join(bin,name+'.exe'),['-w','-h','127.0.0.1','-p','55431','-U','postgres',...args],{encoding:'utf8',timeout:60000,windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
function sql(db,source,label){const log=command('psql',['-X','-v','ON_ERROR_STOP=1','-At','-d',db,'-c','set search_path=public,extensions','-f',source]);fs.appendFileSync(path.join(output,db+'.log'),label+'\n'+log);const record={database:db,label,passed:!/^not ok/m.test(log)};results.push(record);fs.appendFileSync(path.join(output,'steps.jsonl'),JSON.stringify(record)+'\n');assert.ok(record.passed,label);}
const bootstrap=fs.readFileSync(path.join(root,'scripts/fixtures/phase1-supabase-bootstrap.sql'),'utf8').replace(/^create role .*;\r?\n/gm,'');
const roles=new Set(command('psql',['-X','-At','-d','postgres','-c','select rolname from pg_roles']).trim().split(/\r?\n/));
assert.ok(['anon','authenticated','service_role'].every(role=>roles.has(role)));
const bootstrapFile=path.join(output,'bootstrap.sql');fs.writeFileSync(bootstrapFile,bootstrap);
const tables=['profiles','barangays','medical_drives','drive_registrations','service_requests','payments','id_submissions','document_types'];
for(const database of ['phase7_empty','phase7_existing']){
 assert.equal(command('psql',['-X','-At','-d','postgres','-c',`select count(*) from pg_database where datname='${database}'`]).trim(),'0','Never reset an existing database');
 command('createdb',[database]);sql(database,bootstrapFile,'Portable infrastructure fixture');
 const snapshot=()=>JSON.parse(command('psql',['-X','-At','-d',database,'-c',`select jsonb_build_object(${tables.map(t=>`'${t}',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.${t} r)`).join(',')})`]));
 let before;
 for(const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
  if(database==='phase7_existing'&&file.startsWith('0095_'))sql(database,path.join(root,'scripts/fixtures/phase1-historical.sql'),'Historical requests payments approvals and score 90');
  if(file.startsWith('0105_')){before=snapshot();fs.writeFileSync(path.join(output,database+'-before.json'),JSON.stringify(before,null,2));}
  sql(database,path.join(root,'supabase/migrations',file),file);
  if(file.startsWith('0105_')){
   const staged=snapshot();
   assert.ok(staged.drive_registrations.every(r=>r.priority_score===null),'Legacy clients see only null mirrors');
   assert.equal(command('psql',['-X','-At','-d',database,'-c',"select count(*) from pg_constraint where conname='drive_registration_score_mirror_empty'"]).trim(),'1');
   // A rejected write rolls back its timestamp trigger as well as its value.
   command('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,'-c',`do $$ begin
    if exists(select 1 from public.drive_registrations) then
     begin update public.drive_registrations set priority_score=999;
      raise exception 'Legacy score mirror accepted a value';
     exception when check_violation then null; end;
    end if;
   end $$;`]);
   assert.deepEqual(snapshot(),staged,'Rejected legacy writes preserve the registration');
   fs.writeFileSync(path.join(output,database+'-transition.json'),JSON.stringify({passed:true,legacyMirrorsNull:true,mirrorWritesConstrained:true,rows:staged.drive_registrations.length},null,2));
  }
 }
 const after=snapshot(),scores=JSON.parse(command('psql',['-X','-At','-d',database,'-c',"select coalesce(jsonb_agg(to_jsonb(s) order by registration_id),'[]') from public.drive_registration_scores s"]));
 for(const table of tables){assert.equal(after[table].length,before[table].length);for(const old of before[table]){const current=after[table].find(r=>r.id===old.id);for(const [key,value] of Object.entries(old)){if(table==='drive_registrations'&&key==='priority_score')assert.equal(scores.find(s=>s.registration_id===old.id).priority_score,value);else assert.deepEqual(current[key],value,`${table}.${key}`);}}}
 fs.writeFileSync(path.join(output,database+'-after.json'),JSON.stringify({tables:after,scores},null,2));
 fs.writeFileSync(path.join(output,database+'-reconciliation.json'),JSON.stringify({passed:true,scores,tables:tables.map(t=>({table:t,rows:before[t].length,unchanged:true}))},null,2));
 sql(database,path.join(root,'supabase/tests/administrator_scores.test.sql'),'Phase 7 acceptance');
 console.log('PASS '+database+': complete migration chain, historical reconciliation, Phase 7 SQL assertions');
 command('dropdb',[database]);
}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
