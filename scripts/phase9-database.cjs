/* global __dirname */
// Named synthetic Docker stack only. Rehearsal databases are task-created and disposable.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), mode = process.argv[2];
assert.ok(['test', 'replay'].includes(mode));
const run = process.argv[3] || mode;
assert.match(run, /^[a-z0-9-]+$/);
const output = path.join(root, 'plans/evidence/phase9/database', run);
fs.mkdirSync(output, {recursive:true});
assert.ok(!fs.existsSync(path.join(output,'results.json')), 'Preserve earlier execution');
function docker(args, input) {
  const r = spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker',...args],{input,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,windowsHide:true});
  if (r.status !== 0) fs.writeFileSync(path.join(output, 'failure.log'), r.stdout + r.stderr);
  assert.equal(r.status,0,r.stderr); return r.stdout;
}
const target = JSON.parse(docker(['inspect','supabase_db_barangayan']))[0];
assert.equal(target.Config.Image,'public.ecr.aws/supabase/postgres:17.6.1.155');
assert.ok(target.NetworkSettings.Ports['5432/tcp'].every(p=>p.HostPort==='54322'));
const sql = (db, input) => docker(['exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,'-At'], input);
assert.ok(Number(sql('postgres',"select count(*) from auth.users where email like '%@test.local';")) > 0, 'Synthetic test stack required');
fs.writeFileSync(path.join(output,'target.json'),JSON.stringify({container:target.Name,image:target.Config.Image,ports:target.NetworkSettings.Ports,synthetic:true},null,2));
const results = [];
if (mode === 'test') {
  for (const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(f=>f.endsWith('.test.sql')).sort()) {
    const log = sql('postgres', fs.readFileSync(path.join(root,'supabase/tests',file),'utf8'));
    fs.writeFileSync(path.join(output,file+'.log'),log);
    const passed = !/not ok|Looks like you failed/.test(log);
    results.push({file,passed,assertions:(log.match(/^ok \d+/gm)||[]).length});
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
    assert.ok(passed,file);console.log('PASS '+file);
  }
} else {
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
  assert.ok(migrations.every(f=>/^\d{4}_/.test(f)), 'Sequential four digit migrations required');
const bootstrap=fs.readFileSync(path.join(root,'scripts/fixtures/phase1-supabase-bootstrap.sql'),'utf8');
  const tables=['profiles','barangays','medical_drives','drive_registrations','service_requests','payments','id_submissions','document_types','household_members'];
  const snapshot = label => `select '${label}:' || jsonb_build_object(${tables.filter(t=>label!=='BASELINE'||t!=='id_submissions').map(t=>`'${t}',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.${t} r)`).join(',')})::text;\n`;
  for (const db of ['phase9_empty','phase9_existing']) {
    // pg_cron must be installed in its configured database. A fresh cluster in
    // a dedicated container lets the unmodified migrations use postgres without
    // changing the existing test stack's scheduler or configuration.
    const name = db.replace('_','-')+'-replay';
    const id=docker(['run','--detach','--rm','--name',name,'--label','barangayan.task=phase9-replay','--network','none','--memory','512m','--cpus','1','--user','postgres','--entrypoint','sh',target.Config.Image,'-c','initdb -D /tmp/phase9-pg -A trust -U postgres > /tmp/phase9-init.log && exec postgres -D /tmp/phase9-pg -c shared_preload_libraries=pg_cron -c cron.database_name=postgres']).trim();
    assert.match(id,/^[0-9a-f]{64}$/);
    const replaySql=source=>docker(['exec','-i',id,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],source);
    try {
      let ready=false;
      for(let attempt=0;attempt<20;attempt++){
        const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec',id,'pg_isready','-U','postgres'],{encoding:'utf8',timeout:10000,windowsHide:true});
        if(r.status===0){ready=true;break;}
      }
      assert.ok(ready,'Disposable cluster readiness exceeded bound');
      let source = bootstrap;
      for (const file of migrations) {
        if (file.startsWith('0095_')) {
          if (db==='phase9_existing') source += fs.readFileSync(path.join(root,'scripts/fixtures/phase1-historical.sql'),'utf8')+'\n';
          source += snapshot('BASELINE');
        }
        if (file.startsWith('0105_')) source += snapshot('BEFORE');
        source += `\n\\echo MIGRATION:${file}\n`+fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8')+'\n';
        if (file.startsWith('0105_')) source += "select 'CHECKPOINT:' || jsonb_build_object('nullMirrors',not exists(select 1 from public.drive_registrations where priority_score is not null),'constrained',exists(select 1 from pg_constraint where conname='drive_registration_score_mirror_empty'))::text;\n";
      }
      source += snapshot('AFTER')+"select 'SCORES:' || coalesce(jsonb_agg(to_jsonb(s) order by registration_id),'[]')::text from public.drive_registration_scores s;\n";
      const log = replaySql(source);fs.writeFileSync(path.join(output,db+'.log'),log);
      const extract = label => JSON.parse(log.split(/\r?\n/).find(l=>l.startsWith(label+':')).slice(label.length+1));
      const before=extract('BEFORE'), after=extract('AFTER'), scores=extract('SCORES'), baseline=extract('BASELINE'), checkpoint=extract('CHECKPOINT');
      assert.ok(checkpoint.nullMirrors&&checkpoint.constrained,'0105 privacy checkpoint');
      for (const table of tables) for (const old of before[table]) {
        const current=after[table].find(r=>r.id===old.id);assert.ok(current,table+' historical row retained');
        for(const [key,value] of Object.entries(old)) {
          if(table==='drive_registrations'&&key==='priority_score')assert.equal(scores.find(s=>s.registration_id===old.id).priority_score,value);
          else assert.deepEqual(current[key],value,table+'.'+key);
        }
      }
      // Additive locality/catalog migrations intentionally change those objects.
      // Financial/request/household history and original applicants must remain exact.
      for(const table of ['service_requests','payments','household_members','drive_registrations']) for(const old of baseline[table]) {
        const current=after[table].find(r=>r.id===old.id);assert.ok(current);
        for(const [key,value] of Object.entries(old)) {
          if(table==='drive_registrations'&&key==='priority_score')assert.equal(scores.find(s=>s.registration_id===old.id).priority_score,value);
          else assert.deepEqual(current[key],value,`pre0095 ${table}.${key}`);
        }
      }
      const record={database:db,passed:true,migrations:migrations.length,checkpoint,tables:tables.map(t=>({table:t,rows:before[t].length,originalValuesPreserved:true})),historicalScores:scores.map(s=>s.priority_score)};
      fs.writeFileSync(path.join(output,db+'-reconciliation.json'),JSON.stringify({baseline,before,after,scores,record},null,2));
      results.push(record);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log('PASS '+db+': full chain and exact historical reconciliation');
    } finally {
      // Only a database created above can reach this cleanup.
      const owned=JSON.parse(docker(['inspect',id]))[0];
      assert.equal(owned.Config.Labels['barangayan.task'],'phase9-replay');
      docker(['rm','--force','--volumes',id]);
    }
  }
}
