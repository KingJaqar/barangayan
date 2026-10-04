/* global __dirname */
// Disposable loopback databases only. Preserves all prior rehearsal evidence.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const run = process.argv[2] || `database-${Date.now()}`;
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid evidence directory');
const output = path.join(root, 'plans/evidence/phase2', run);
if (fs.existsSync(path.join(output, 'results.json'))) throw new Error('Use a new evidence directory');
fs.mkdirSync(output, { recursive: true });
const bin = path.join(root, 'dist/phase1-tools/postgres/pgsql/bin');
const common = ['-h','127.0.0.1','-p','55431','-U','postgres'];
const results = [];
function command(name, args, label) {
  const result = spawnSync(path.join(bin, `${name}.exe`), [...common, ...args], { encoding:'utf8', cwd:root, timeout:60000 });
  fs.appendFileSync(path.join(output, 'database.log'), `${label}\n${result.stdout}${result.stderr}\n`);
  results.push({ label, exitCode:result.status });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  assert.equal(result.status, 0, `${label}: ${result.stderr.slice(-2000)}`);
  return result.stdout;
}
const bootstrap = fs.readFileSync(path.join(root,'scripts/fixtures/phase1-supabase-bootstrap.sql'),'utf8');
const roles = new Set(command('psql',['-X','-At','-d','postgres','-c',"select rolname from pg_roles"], 'Inspect fixture roles').trim().split(/\r?\n/));
const temporary = path.join(output, 'bootstrap.sql');
fs.writeFileSync(temporary, bootstrap.replace(/^create role ([a-z_]+).*;\r?\n/gm, (statement, name) => roles.has(name) ? '' : statement));
const tables = ['barangays','profiles','document_types','service_requests','payments','drive_registrations','household_members'];
for (const database of ['phase2_empty', 'phase2_existing']) {
  command('dropdb',['--if-exists',database], `Reset ${database}`);
  command('createdb',[database], `Create ${database}`);
  const sql = (file, label) => command('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,'-c','set search_path=public,extensions','-f',path.join(root,file)], `${database}: ${label}`);
  sql(path.relative(root,temporary),'Infrastructure fixture');
  let before;
  const snapshot = () => Object.fromEntries(tables.map(table => [table, JSON.parse(command('psql',['-X','-At','-d',database,'-c',`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.${table} t`], `${database}: snapshot ${table}`))]));
  for (const migration of fs.readdirSync(path.join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) {
    if (migration.includes('_phase2_') && database === 'phase2_existing') {
      sql('scripts/fixtures/phase2-history.sql', 'Historical approvals and addresses');
      before = snapshot();
      fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(before,null,2));
    }
    sql(`supabase/migrations/${migration}`,migration);
  }
  if (before) {
    const after = snapshot();
    fs.writeFileSync(path.join(output,'after.json'),JSON.stringify(after,null,2));
    const allowed = new Set(['city','province','current_id_submission_id','approved_id_submission_id','id_repair_required','updated_at']);
    for (const table of tables) {
      assert.equal(before[table].length,after[table].length, `${table} counts retained`);
      for (const original of before[table]) {
        const final = after[table].find(row=>row.id===original.id);
        for (const [key,value] of Object.entries(original)) {
          if (table==='profiles' && original.barangay_id==='a2000000-0000-0000-0000-000000000001' && allowed.has(key)) continue;
          assert.deepEqual(final[key],value, `${table}.${key} retained`);
        }
      }
    }
    sql('scripts/fixtures/phase2-history-checks.sql','Historical reconciliation assertions');
  }
  const checks = sql('supabase/tests/trusted_evidence_locality.test.sql','Phase 2 database acceptance');
  assert.ok(!/not ok|Looks like you failed/.test(checks));
  console.log(`PASS ${database}: migrations, history and Phase 2 acceptance`);
}
