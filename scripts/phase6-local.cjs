/* global __dirname */
// Existing, synthetic-only WSL Supabase stack. Never accepts a remote target.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.join(root,process.argv[2]?.includes('flexible')?'plans/evidence/phase6/flexible-local':'plans/evidence/phase6/local');fs.mkdirSync(output,{recursive:true});
function sql(source){
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
 assert.equal(r.status,0,r.stderr);return r.stdout;
}
function status(){
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,'Local stack unavailable');const config=JSON.parse(r.stdout);assert.equal(config.API_URL,'http://127.0.0.1:54321');return config;
}
const config=status();
const mode=process.argv[2];
if(mode==='migrate'||mode==='migrate-flexible'){
 const flexible=mode==='migrate-flexible';
 if(!flexible) assert.equal(sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='registration_home_location')").trim(),'f','Already applied: do not replay');
 if(flexible) assert.equal(sql("select to_regprocedure('public.incomplete_profile_browsing_barangay()') is null").trim(),'t','Already applied: do not replay');
 const tables=['profiles','service_requests','payments','drive_registrations','id_submissions','barangays','document_types'];
 const snapshot=()=>Object.fromEntries(tables.map(table=>[table,JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.${table} t`))]));
 const before=snapshot();fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(before,null,2));
 fs.writeFileSync(path.join(output,'migration.log'),sql(fs.readFileSync(path.join(root,flexible?'supabase/migrations/0103_phase6_deferred_profile_completion.sql':'supabase/migrations/0102_phase6_registration_maps_auth.sql'),'utf8')));
 const after=snapshot();
 for(const table of tables) {assert.equal(before[table].length,after[table].length);for(const row of before[table]) {const next=after[table].find(r=>r.id===row.id);for(const [key,value] of Object.entries(row))assert.deepEqual(next[key],value,`${table}.${key}`);}}
 fs.writeFileSync(path.join(output,'reconciliation.json'),JSON.stringify({passed:true,tables:tables.map(table=>({table,rows:before[table].length,originalValuesPreserved:true}))},null,2));
 sql("notify pgrst,'reload schema'");console.log('PASS: isolated container migration and full historical reconciliation');
}else if(mode==='revise-flexible'){
 // Rehearse the final definition of this unpublished migration on the synthetic stack.
 assert.equal(sql("select to_regprocedure('public.incomplete_profile_browsing_barangay()') is not null").trim(),'t');
 const source=fs.readFileSync(path.join(root,'supabase/migrations/0103_phase6_deferred_profile_completion.sql'),'utf8');
 const start=source.indexOf('create function barangayan_private.require_complete_profile_for_submission()');
 const end=source.indexOf('revoke all on function barangayan_private.require_complete_profile_for_submission()',start);
 assert.ok(start>=0&&end>start);
 fs.writeFileSync(path.join(output,'final-guard-rehearsal.log'),sql(source.slice(start,end).replace('create function','create or replace function')));
 console.log('PASS: final unpublished completion guard rehearsed locally');
}else if(mode.startsWith('test')){
 const results=[];
 for(const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(file=>file.endsWith('.test.sql')&&(mode!=='test-flexible'||file==='deferred_profile_completion.test.sql')).sort()){
  const result=sql(fs.readFileSync(path.join(root,'supabase/tests',file),'utf8'));
  fs.writeFileSync(path.join(output,file+'.log'),result);
  const passed=!/not ok|Looks like you failed/.test(result);
  results.push({file,passed,assertions:(result.match(/^ok \d+/gm)||[]).length});
  fs.writeFileSync(path.join(output,'tests.json'),JSON.stringify(results,null,2));
  assert.ok(passed,file);console.log('PASS '+file);
 }
}else if(['web','native'].includes(mode)){
 const native=mode==='native';
 const host=process.env.BARANGAYAN_LOCAL_TEST_HOST;
 if(host&&!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host))throw Error('Only the private WSL test host is permitted');
 const api=host?`http://${host}:54321`:config.API_URL;
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,EXPO_PUBLIC_SUPABASE_URL:host?api:'http://10.0.2.2:54321',EXPO_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,NEXT_TELEMETRY_DISABLED:'1',EXPO_NO_TELEMETRY:'1',REACT_NATIVE_PACKAGER_HOSTNAME:'127.0.0.1',BARANGAYAN_PREVIEW_DIST_DIR:'.next-phase6'};
 const exe=path.join(root,'node_modules',native?'expo/bin/cli':'next/dist/bin/next');
 const args=native?['start','--host','lan','--port','8086']:['dev','--hostname','127.0.0.1','--port','3106'];
 const child=spawn(process.execPath,[exe,...args],{cwd:path.join(root,'apps',native?'resident-android-mobile':'resident-web'),env,stdio:'inherit'});
 child.on('exit',code=>{process.exitCode=code;});
}else throw Error('Choose migrate, test, web or native');
