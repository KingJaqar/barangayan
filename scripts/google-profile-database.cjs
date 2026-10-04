/* global __dirname */
// Rehearses only against the verified synthetic WSL Supabase test stack.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];
assert.ok(['baseline','migrate','revise','focused','test'].includes(mode));
const output = path.join(root, 'plans/evidence/phase6/google-minimal-database');
fs.mkdirSync(output, { recursive: true });
function sql(source) {
  const result = spawnSync('wsl.exe', ['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i',
    'supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],
  { input: source, encoding: 'utf8', timeout: 60000, maxBuffer: 8*1024*1024 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const inspect = spawnSync('wsl.exe', ['--distribution','barangayan-phase1','--user','root','--exec','docker','inspect',
  '--format','{{json .NetworkSettings.Ports}}','supabase_db_barangayan'], { encoding:'utf8', timeout:30000 });
assert.equal(inspect.status, 0, 'Synthetic local container unavailable');
assert.ok(JSON.parse(inspect.stdout)['5432/tcp'].every(port => port.HostPort === '54322'), 'Expected dedicated local test database port');
assert.ok(Number(sql("select count(*) from auth.users where email like '%@test.local'").trim()) > 0, 'Expected synthetic fixtures');
if (mode === 'baseline') {
  assert.equal(sql("select to_regprocedure('public.ensure_google_resident_profile()') is null").trim(), 't');
  const result = sql(`begin;
    insert into auth.users(id,email,raw_user_meta_data) values ('b604b000-0000-0000-0000-000000000001','google-baseline@test.local','{"full_name":"Baseline Resident"}');
    insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
      ('c604b000-0000-0000-0000-000000000001','b604b000-0000-0000-0000-000000000001','google-baseline','google','{"name":"Baseline Resident"}');
    select count(*) from public.profiles where id='b604b000-0000-0000-0000-000000000001'; rollback;`);
  fs.writeFileSync(path.join(output,'missing-profile-baseline.log'), result);
  assert.match(result, /\n0\n/);
  console.log('REPRODUCED: Google identity exists without a profile before migration (rolled back).');
} else if (mode === 'migrate') {
  assert.equal(sql("select to_regprocedure('public.ensure_google_resident_profile()') is null").trim(), 't', 'Never replay an applied migration');
  const tables = ['profiles','service_requests','payments','drive_registrations','id_submissions','barangays','document_types'];
  const snapshot = () => Object.fromEntries(tables.map(table => [table, JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.${table} t`))]));
  const before = snapshot();
  fs.writeFileSync(path.join(output,'before.json'), JSON.stringify(before,null,2));
  const source = fs.readFileSync(path.join(root,'supabase/migrations/0104_google_minimal_resident_profiles.sql'),'utf8');
  fs.writeFileSync(path.join(output,'migration.log'), sql(source));
  const after = snapshot();
  fs.writeFileSync(path.join(output,'after.json'), JSON.stringify(after,null,2));
  assert.deepEqual(after,before,'No historical rows or field values may change');
  fs.writeFileSync(path.join(output,'reconciliation.json'), JSON.stringify({ passed:true, tables:tables.map(table => ({table,rows:before[table].length,originalValuesPreserved:true})) },null,2));
  console.log('PASS: migration 0104 and historical reconciliation on isolated local stack.');
} else if (mode === 'revise') {
  // Finalize the unpublished migration's functions on this synthetic rehearsal
  // only. Keep the initial failing assertion log; don't replay migration objects.
  const original = path.join(output,'google_minimal_profiles.test.sql.log');
  fs.copyFileSync(original,path.join(output,'google_minimal_profiles.initial-failure.log'));
  const source = fs.readFileSync(path.join(root,'supabase/migrations/0104_google_minimal_resident_profiles.sql'),'utf8');
  const start = source.indexOf('create function barangayan_private.provision_google_resident(');
  const end = source.indexOf('create function barangayan_private.create_google_resident_profile()',start);
  assert.ok(start >= 0 && end > start);
  const finalFunctions = source.slice(start,end).replace('create function barangayan_private.provision_google_resident','create or replace function barangayan_private.provision_google_resident');
  fs.writeFileSync(path.join(output,'final-functions-rehearsal.log'),sql(finalFunctions + `
    drop trigger z_guard_profile_locations on public.profiles;
    create trigger z_guard_profile_locations before insert or update on public.profiles
    for each row execute function barangayan_private.guard_profile_locations();`));
  console.log('PASS: final unpublished map/bootstrap compatibility definitions rehearsed locally.');
} else {
  const results = [];
  for (const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(file => file.endsWith('.test.sql') && (mode !== 'focused' || file === 'google_minimal_profiles.test.sql')).sort()) {
    const log = sql(fs.readFileSync(path.join(root,'supabase/tests',file),'utf8'));
    fs.writeFileSync(path.join(output,file+'.log'), log);
    const passed = !/not ok|Looks like you failed/.test(log);
    results.push({ file, passed, assertions:(log.match(/^ok \d+/gm)||[]).length });
    fs.writeFileSync(path.join(output,mode === 'focused' ? 'focused-tests.json' : 'tests.json'), JSON.stringify(results,null,2));
    assert.ok(passed,file);
    console.log('PASS '+file);
  }
}
