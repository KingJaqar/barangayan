/* Disposable local PostgreSQL rehearsal. No hosted URLs or real accounts. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tmp/admin-request-status-fix');
fs.mkdirSync(output, { recursive: true });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(file => /^\d.*\.sql$/.test(file)).sort();
const repairs = migrations.filter(file => file.endsWith('_admin_request_optional_status_reason.sql'));
assert.equal(repairs.length, 1, 'Exactly one status-reason repair migration must exist');
const repair = repairs[0];
assert.equal(migrations.at(-1), repair, 'Review rehearsal ordering when later migrations are added');
const original = read('supabase/migrations/0133_full_versioned_request_record_editor.sql')
  .match(/create function barangayan_private\.admin_edit_request_details[\s\S]*?end \$\$;/)[0];
const replacement = read('supabase/migrations/' + repair)
  .match(/create or replace function barangayan_private\.admin_edit_request_details[\s\S]*?end \$\$;/)[0];
const normalize = text => text.replace(/--[^\r\n]*/g, '').replace(/\s/g, '').replace('createorreplacefunction', 'createfunction');
const expected = original.replace(
  "transition_service_request_sla(jsonb_build_object('requestId',request.id,'action',action,'reason',reason))",
  "transition_service_request_sla(jsonb_strip_nulls(jsonb_build_object('requestId',request.id,'action',action,'reason',reason)))");
assert.equal(normalize(replacement), normalize(expected), 'Only the reviewed transition-payload change is allowed');
let source = read('scripts/fixtures/phase1-supabase-bootstrap.sql');
// Later attendance migrations depend on these standard Supabase Auth columns.
source += '\nalter table auth.users add column banned_until timestamptz, add column deleted_at timestamptz;\n';
for (const file of migrations.filter(file => file !== repair)) {
  source += `\n\\echo MIGRATION:${file}\n${read('supabase/migrations/' + file)}\n`;
}
source += '\n\\echo BEFORE_FIX\n' + read('supabase/tests/admin_request_status_editor.test.sql');
source += `\ncreate temp table editor_before as select proowner,proacl,proconfig,prosecdef,prosrc from pg_proc where oid='barangayan_private.admin_edit_request_details(uuid,jsonb,timestamptz)'::regprocedure;\n`;
source += '\n' + read('supabase/migrations/' + repair);
source += `\ndo $$ begin
  if exists(select 1 from pg_proc p cross join editor_before b
    where p.oid='barangayan_private.admin_edit_request_details(uuid,jsonb,timestamptz)'::regprocedure
    and (p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl
      or p.proconfig is distinct from b.proconfig or p.prosecdef is distinct from b.prosecdef)) then
    raise exception 'Function security or ownership changed';
  end if;
end $$;\n`;
source += '\n\\echo AFTER_FIX\n' + read('supabase/tests/admin_request_status_editor.test.sql');
// Replacement is safe to replay and retains privileges on an already repaired DB.
source += '\n' + read('supabase/migrations/' + repair);
const result = spawnSync('wsl.exe', ['--distribution', 'barangayan-phase1', '--user', 'root', '--exec',
  'docker', 'run', '--rm', '--interactive', '--label', 'barangayan.task=admin-request-status-fix',
  '--network', 'none', '--memory', '768m', '--cpus', '2', '--user', 'postgres', '--entrypoint', 'sh',
  'public.ecr.aws/supabase/postgres:17.6.1.155', '-c',
  'initdb -D /tmp/request-status-pg -A trust -U postgres > /tmp/init.log && pg_ctl -D /tmp/request-status-pg -l /tmp/postgres.log -o "-c shared_preload_libraries=pg_cron -c cron.database_name=postgres" -w start > /tmp/start.log && psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At'],
{ input: source, encoding: 'utf8', timeout: 240000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
fs.writeFileSync(path.join(output, 'database.log'), result.stdout + '\n' + result.stderr);
if (result.status !== 0) console.error((result.stdout + '\n' + result.stderr).slice(-5000));
assert.equal(result.status, 0, 'Migration replay and test SQL must execute');
const before = result.stdout.split('BEFORE_FIX\n')[1]?.split('AFTER_FIX\n')[0];
const after = result.stdout.split('AFTER_FIX\n')[1];
assert.ok(before?.includes('invalid_reason') && before.includes('not ok'), 'Tests must reproduce the original bug');
assert.ok(after, 'Repaired workflow tests must run');
assert.deepEqual(after.split(/\r?\n/).filter(line => /^not ok|Looks like you failed/.test(line)), []);
const assertions = after.split(/\r?\n/).filter(line => /^ok \d/.test(line)).length;
assert.ok(assertions > 40, 'The full workflow regression suite must execute');
console.log(`PASS: ${migrations.length} migrations replayed; original invalid_reason reproduced; ${assertions} repaired workflow assertions passed; function security preserved; migration replay passed.`);
