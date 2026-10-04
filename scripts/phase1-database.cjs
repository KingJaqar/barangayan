/* global __dirname */
// Local PostgreSQL-only rehearsal. Never accepts a hosted URL or database name.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const bin = path.join(root, 'dist/phase1-tools/postgres/pgsql/bin');
const run = process.argv[3] || 'database';
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid evidence directory');
const output = path.join(root, 'plans/evidence/phase1', run);
fs.mkdirSync(output, { recursive: true });
const args = ['-h', '127.0.0.1', '-p', '55431', '-U', 'postgres'];
function command(name, extra) {
  return spawnSync(path.join(bin, name + '.exe'), [...args, ...extra], { encoding: 'utf8', cwd: root });
}
function sql(database, source, label) {
  const startedAt = new Date().toISOString();
  const result = command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database, '-f', source]);
  fs.appendFileSync(path.join(output, database + '.log'), `\n${label}\n${result.stdout}${result.stderr}`);
  const entry = { database, label, source: path.relative(root, source), startedAt, finishedAt: new Date().toISOString(), exitCode: result.status };
  results.push(entry);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.slice(-1200)}`);
}
const resultsPath = path.join(output, 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath,'utf8')) : [];
const database = process.argv[2];
if (!['phase1_empty', 'phase1_existing'].includes(database)) throw new Error('Only isolated phase1_empty/phase1_existing databases are allowed');
if (fs.existsSync(path.join(output, database + '.log'))) throw new Error('Preserve the previous run; move its evidence before rerunning');
const bootstrap = path.join(root, 'scripts/fixtures/phase1-supabase-bootstrap.sql');
const bootstrapText = fs.readFileSync(bootstrap, 'utf8');
// Roles are cluster-wide; every fresh rehearsal may safely reuse the fixture roles.
const roles = command('psql',['-X','-At','-d','postgres','-c',"select rolname from pg_roles where rolname in ('anon','authenticated','service_role')"]);
if (roles.status !== 0) throw new Error(roles.stderr);
const existingRoles = new Set(roles.stdout.trim().split(/\r?\n/));
const effectiveBootstrap = bootstrapText.replace(/^create role ([a-z_]+).*;\r?\n/gm,(statement,name)=>existingRoles.has(name) ? '' : statement);
const temporary = path.join(root, `dist/phase1-tools/${database}-bootstrap.sql`);
fs.writeFileSync(temporary, effectiveBootstrap);
sql(database, temporary, 'Supabase infrastructure fixture');
const migrations = fs.readdirSync(path.join(root,'supabase/migrations')).filter(n => n.endsWith('.sql')).sort();
const historyTables = ['barangays','profiles','document_types','service_requests','payments','drive_registrations','household_members'];
function snapshot() {
  const snapshot = {};
  for (const table of historyTables) {
    const response = command('psql', ['-X','-At','-d',database,'-c',`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.${table} t`]);
    if (response.status !== 0) throw new Error(response.stderr);
    snapshot[table] = JSON.parse(response.stdout);
  }
  return snapshot;
}
let before;
for (const migration of migrations) {
  if (database === 'phase1_existing' && migration.startsWith('0044_')) {
    const prerequisite = path.join(root, 'dist/phase1-tools/existing-pilot-fixture.sql');
    fs.writeFileSync(prerequisite, "insert into public.barangays(id,name) values ('00000000-0000-0000-0000-000000000001','Barangay Ampid I');");
    sql(database, prerequisite, 'Existing pilot reference fixture (not an empty-chain repair)');
  }
  if (database === 'phase1_existing' && migration.includes('_phase1_shared_foundations')) {
    const dump = command('pg_dump',['--schema-only','--no-owner','-d',database,'-f',path.join(root,'dist/phase1-tools/baseline-schema.sql')]);
    if (dump.status !== 0) throw new Error(dump.stderr);
    sql(database,path.join(root,'scripts/fixtures/phase1-historical.sql'),'Representative pre-migration historical fixture');
    before = snapshot();
    fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(before,null,2));
  }
  sql(database, path.join(root,'supabase/migrations',migration), migration);
}
if (before) {
  const after = snapshot();
  fs.writeFileSync(path.join(output,'after.json'),JSON.stringify(after,null,2));
  const reconciliation = historyTables.map(table => {
    const oldRows = before[table]; const newRows = after[table];
    const unchanged = oldRows.length === newRows.length && oldRows.every(old => {
      const row = newRows.find(row => row.id === old.id);
      return row && Object.keys(old).every(key => JSON.stringify(old[key]) === JSON.stringify(row[key]));
    });
    return { table, beforeCount: oldRows.length, afterCount: newRows.length, everyLegacyValueUnchanged: unchanged };
  });
  fs.writeFileSync(path.join(output,'reconciliation.json'),JSON.stringify(reconciliation,null,2));
  if (reconciliation.some(r => !r.everyLegacyValueUnchanged)) throw new Error('Historical reconciliation failed');
}
console.log('All repository migrations applied to ' + database);
