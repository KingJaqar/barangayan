/* global __dirname */
// Disposable loopback databases only. Preserves all prior rehearsal evidence.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const run = process.argv[2] || `database-${Date.now()}`;
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid evidence directory');
const output = path.join(root, 'plans/evidence/phase6', run);
if (fs.existsSync(path.join(output, 'results.json'))) throw new Error('Use a new evidence directory');
fs.mkdirSync(output, { recursive: true });
const bin = path.join(root, 'dist/phase1-tools/postgres/pgsql/bin');
const port = process.env.BARANGAYAN_PHASE6_REPLAY_PORT || '55431';
assert.ok(['55431','55434'].includes(port), 'Only known loopback fixture ports are permitted');
const common = ['-w','-h','127.0.0.1','-p',port,'-U','postgres'];
const results = [];
function command(name, args, label) {
  const result = spawnSync(path.join(bin, `${name}.exe`), [...common, ...args], { encoding:'utf8', cwd:root, timeout:60000, windowsHide:true });
  fs.appendFileSync(path.join(output, 'database.log'), `${label}\n${result.stdout}${result.stderr}\n`);
  results.push({ label, exitCode:result.status });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  assert.equal(result.status, 0, `${label}: ${result.stderr.slice(-2000)}`);
  return result.stdout;
}
const bootstrap = fs.readFileSync(path.join(root,'scripts/fixtures/phase1-supabase-bootstrap.sql'),'utf8');
const temporary = path.join(output, 'bootstrap.sql');
const tables = ['barangays','profiles','document_types','service_requests','payments','drive_registrations','household_members'];
const prefix = port === '55434' ? 'google_profile' : 'phase6';
const selection = process.env.BARANGAYAN_PHASE6_REPLAY_DATABASE;
assert.ok(!selection || ['empty','existing'].includes(selection), 'Only fixture databases may be selected');
for (const database of [`${prefix}_empty`, `${prefix}_existing`].filter(name => !selection || name === `${prefix}_${selection}`)) {
  // Roles belong to the cluster and may have been created by the first database.
  const roles = new Set(command('psql',['-X','-At','-d','postgres','-c',"select rolname from pg_roles"], `${database}: inspect fixture roles`).trim().split(/\r?\n/));
  fs.writeFileSync(temporary, bootstrap.replace(/^create role ([a-z_]+).*;\r?\n/gm, (statement, name) => roles.has(name) ? '' : statement));
  command('dropdb',['--if-exists',database], `Reset ${database}`);
  command('createdb',[database], `Create ${database}`);
  const sql = (file, label) => command('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,'-c','set search_path=public,extensions','-f',path.join(root,file)], `${database}: ${label}`);
  sql(path.relative(root,temporary),'Infrastructure fixture');
  let before;
  const snapshot = () => Object.fromEntries(tables.map(table => [table, JSON.parse(command('psql',['-X','-At','-d',database,'-c',`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.${table} t`], `${database}: snapshot ${table}`))]));
  for (const migration of fs.readdirSync(path.join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) {
    if (migration.includes('_phase2_') && database === `${prefix}_existing`) {
      sql('scripts/fixtures/phase2-history.sql', 'Historical approvals and addresses');
    }
    if (migration.startsWith('0102_') && database === `${prefix}_existing`) {
      before = snapshot();
      fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(before,null,2));
    }
    sql(`supabase/migrations/${migration}`,migration);
  }
  if (before) {
    const after = snapshot();
    fs.writeFileSync(path.join(output,'after.json'),JSON.stringify(after,null,2));
    for (const table of tables) {
      assert.equal(before[table].length,after[table].length, `${table} counts retained`);
      for (const original of before[table]) {
        const final = after[table].find(row=>row.id===original.id);
        for (const [key,value] of Object.entries(original)) {
          assert.deepEqual(final[key],value, `${table}.${key} retained`);
        }
      }
    }
    sql('scripts/fixtures/phase2-history-checks.sql','Historical reconciliation assertions');
  }
  const checks = sql('supabase/tests/registration_maps_auth.test.sql','Phase 6 database acceptance');
  assert.ok(!/not ok|Looks like you failed/.test(checks));
  for (const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(file=>file.endsWith('.test.sql') && file!=='registration_maps_auth.test.sql')) {
    if(file==='agency_sla.test.sql') { console.log('SKIP native pg_cron regression: requires the full Supabase Linux test stack'); continue; }
    const regression = sql(`supabase/tests/${file}`,file);
    assert.ok(!/not ok|Looks like you failed/.test(regression),file);
  }
  console.log(`PASS ${database}: migrations, history and Phase 6 acceptance`);
}
