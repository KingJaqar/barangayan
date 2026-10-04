/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const run = process.argv[2];
if (!/^[a-z0-9-]+$/.test(run || '')) throw new Error('Specify a fresh evidence directory');
const output = path.join(root, 'plans/evidence/phase1', run);
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(output,'grants-audit.json'))) throw new Error('Preserve previous audit evidence');
const audit = spawnSync(path.join(root,'dist/phase1-tools/postgres/pgsql/bin/psql.exe'),
  ['-X','-At','-h','127.0.0.1','-p','55431','-U','postgres','-d','phase1_existing','-v','ON_ERROR_STOP=1','-f',path.join(root,'scripts/fixtures/phase1-grants-audit.sql')],
  {cwd:root,encoding:'utf8',timeout:30000});
if (audit.status !== 0) throw new Error(audit.stderr);
const grants = JSON.parse(audit.stdout);
fs.writeFileSync(path.join(output,'grants-audit.json'),JSON.stringify(grants,null,2));
const operations = new Set(['complete_resident_profile','publish_id_submission','review_id_submission','submit_service_request','assess_service_request_fee','transition_service_request_sla']);
const emptyPath = f => f.settings?.includes('search_path=""');
const grantsPassed = !grants.anon_private_schema_usage && grants.private_functions.length === 15
  && grants.private_functions.every(f=>emptyPath(f) && !f.anon_execute && f.authenticated_execute === operations.has(f.name))
  && grants.private_functions.find(f=>f.name==='guard_request_foundations')?.definer === false
  && grants.public_wrappers.length === operations.size
  && grants.public_wrappers.every(f=>operations.has(f.name) && emptyPath(f) && !f.definer && !f.anon_execute && f.authenticated_execute)
  && grants.new_tables.length === 4
  && grants.new_tables.every(t=>t.rls && !t.authenticated_insert && !t.authenticated_update && !t.authenticated_delete)
  && grants.attachments_bucket.public === false && grants.attachments_bucket.file_size_limit === 5242880
  && JSON.stringify([...grants.attachments_bucket.allowed_mime_types].sort()) === JSON.stringify(['application/pdf','image/jpeg','image/png','image/webp']);
const advisor = spawnSync(process.execPath,[path.join(root,'node_modules/supabase/dist/supabase.js'),'db','advisors',
  '--db-url','postgresql://postgres@127.0.0.1:55431/phase1_existing?sslmode=disable','--fail-on','error','--output-format','json'],
  {cwd:root,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(output,'advisors.log'),advisor.stdout + advisor.stderr);
const jsonLine = advisor.stdout.split(/\r?\n/).find(line=>line.startsWith('{'));
if (!jsonLine) throw new Error('No structured advisor result');
const advisors = JSON.parse(jsonLine);
fs.writeFileSync(path.join(output,'advisors.json'),JSON.stringify(advisors,null,2));
const findings = advisors.results;
const summary = {exitCode:advisor.status,grantsPassed,errorCount:findings.filter(f=>f.level==='ERROR').length,
  warnings:Object.fromEntries([...new Set(findings.map(f=>f.name))].map(name=>[name,findings.filter(f=>f.name===name).length])),
  newTableFindings:findings.filter(f=>grants.new_tables.some(t=>t.name===f.metadata?.name)),checkedAt:new Date().toISOString()};
fs.writeFileSync(path.join(output,'audit-result.json'),JSON.stringify(summary,null,2));
console.log(`Private grants/storage/RLS: ${grantsPassed ? 'PASS':'FAIL'}; advisor errors: ${summary.errorCount}`);
if (!grantsPassed || advisor.status !== 0 || summary.errorCount !== 0 || summary.newTableFindings.length !== 0) process.exitCode=1;
