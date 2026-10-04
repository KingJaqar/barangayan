/* global __dirname */
// Report actual Phase 1 evidence, including the separate live-service boundary.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'plans/evidence/phase1');
const read = file => JSON.parse(fs.readFileSync(path.join(output,file),'utf8').replace(/^\uFEFF/,''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const database = read('completion-database/results.json');
const migrations = fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
// Keep immutable historical evidence readable after the authorized filename-only renumbering.
const migrationAliases = {
  '20261001030133_phase1_shared_foundations.sql': '0095_phase1_shared_foundations.sql',
  '20261001145422_phase2_trusted_evidence_locality.sql': '0096_phase2_trusted_evidence_locality.sql',
  '20261001160010_phase3_catalog_staff_workflows.sql': '0097_phase3_catalog_staff_workflows.sql',
  '20261003084732_phase4_resident_submission_payment.sql': '0098_phase4_resident_submission_payment.sql',
};
const currentMigrationName = file => migrationAliases[file] || file;
const migrated = name => {
  const rows = database.filter(r=>r.database===name);
  return rows.every(r=>r.exitCode===0) && migrations.every(file=>rows.filter(r=>currentMigrationName(r.label)===file && r.exitCode===0).length===1);
};
const existingTests = read('completion-database/phase1_existing/tests.json').results;
const emptyTests = read('completion-post-live-tests/phase1_empty/tests.json').results;
const races = read('completion-database/races.json').results;
const reconciliation = read('completion-database/reconciliation.json');
const contracts = read('completion-contracts/contract-check.json');
const seed = read('completion-seed-final/seed-results.json');
const audit = read('completion-audit/audit-result.json');
const latestChecks = new Map(read('completion-checks/results.json').checks.map(r=>[r.id,r]));
const checks = [];
const check = (name,passed) => checks.push({name,passed:Boolean(passed)});
check('Full migration chain from empty database',migrated('phase1_empty'));
check('Representative existing database migrated',migrated('phase1_existing'));
check('Every historical column/value reconciles',reconciliation.length===7 && reconciliation.every(r=>r.everyLegacyValueUnchanged));
function suitesPass(results, historical) {
  const expected = new Map([['foundations',111],['legacy-rls',17],['tenant-write-guards',7],...(historical ? [['historical-reads',9]]:[])]);
  return results.length===expected.size && results.every(r=>r.passed && r.exitCode===0 && expected.get(r.name)===r.assertions);
}
check('Representative SQL suites pass',suitesPass(existingTests,true));
check('Empty migration-chain SQL suites pass',suitesPass(emptyTests,false));
check('Four multi-session concurrency scenarios pass',races.length===4 && races.every(r=>r.passed));
check('Shared contracts match introspected schema',contracts.exitCode===0 && contracts.assertions===21);
check('Normal development seed and retry pass',seed.results.length===2 && seed.results.every(r=>r.exitCode===0) && seed.idempotent && seed.passed && seed.assertions===12);
check('Fresh migration creates no synthetic application rows',Object.values(seed.before).every(count=>count===0));
for (const name of ['shared-tests','shared-types','resident-web-types','admin-web-types','android-types','resident-web-lint','admin-web-lint','android-lint','resident-web-build','admin-web-build','android-export']) check(name,latestChecks.get(name)?.exitCode===0);
const planFile = 'plans/Major_Web_AndroidMobile_Improvement_Plan.md';
const protectedFiles = read('baseline-unrestricted/preservation.json').filter(r=>r.file!==planFile);
check('Unrelated protected user files are unchanged',protectedFiles.length===3 && protectedFiles.every(r=>hash(r.file)===r.sha256));
const approvedPlan = read('completion-baseline/sources.json').find(r=>r.file===planFile);
check('Authorized Android-only plan is preserved',hash(planFile)===approvedPlan.sha256 && !/\bios\b/i.test(fs.readFileSync(path.join(root,planFile),'utf8')));
check('Scoped source/script lint and final diff checks pass',read('completion-review/scoped-checks-final.json').every(r=>r.exitCode===0));
check('Private grants, storage, RLS and advisors pass',audit.grantsPassed && audit.exitCode===0 && audit.errorCount===0 && audit.newTableFindings.length===0);
check('Account deletion nested storage compatibility passes',
  ['storage-cleanup-tests','storage-cleanup-lint','delete-account-types','delete-account-lint'].every(name=>read(`completion-review/${name}.json`).exitCode===0));
check('Local test services stopped after verification',read('completion-live-runtime/shutdown.json').passed);
const independentChecksPass = checks.every(r=>r.passed);
const exitGate = [
  {condition:'Migrations succeed on empty database',passed:checks[0].passed,evidence:'completion-database/results.json'},
  {condition:'Migrations succeed on representative existing database',passed:checks[1].passed,evidence:'completion-database/results.json'},
  {condition:'Historical records remain readable',passed:checks[2].passed && existingTests.find(r=>r.name==='historical-reads')?.passed,evidence:'completion-database/reconciliation.json; phase1_existing/historical-reads.log'},
  {condition:'Unauthorized operations fail',passed:checks[3].passed && checks[4].passed && checks[5].passed && audit.grantsPassed,evidence:'completion-post-live-tests/phase1_empty/tests.json; completion-database/phase1_existing/tests.json; races.json; native grants/SQL and completion-http/results.json'},
];
const livePath = path.join(output,'completion-http/results.json');
const live = fs.existsSync(livePath) ? read('completion-http/results.json') : null;
const requiredLiveChecks = ['Auth session and profile completion','ID upload, publication and review',
  'Attachment upload and signed URL','Submission retry and direct bypass',
  'Cross-tenant and anonymous denial','Assessment and SLA operations','Legacy administrator joins','Account deletion nested media cleanup'];
const liveServicesVerified = live?.passed===true && live.checks?.every(r=>r.passed)
  && requiredLiveChecks.every(name=>live.checks.filter(r=>r.name===name && r.passed).length===1);
const native = read('completion-live-stack/results.json');
const nativeGrants = read('completion-live-stack/grants-audit.json');
const operationNames = new Set(['complete_resident_profile','publish_id_submission','review_id_submission',
  'submit_service_request','assess_service_request_fee','transition_service_request_sla']);
const nativeGrantsPassed = !nativeGrants.anon_private_schema_usage && nativeGrants.private_functions.length===15
  && nativeGrants.private_functions.every(f=>f.settings?.includes('search_path=""') && !f.anon_execute && f.authenticated_execute===operationNames.has(f.name))
  && nativeGrants.private_functions.find(f=>f.name==='guard_request_foundations')?.definer===false
  && nativeGrants.public_wrappers.length===6
  && nativeGrants.public_wrappers.every(f=>operationNames.has(f.name) && f.settings?.includes('search_path=""') && !f.definer && !f.anon_execute && f.authenticated_execute)
  && nativeGrants.new_tables.length===4
  && nativeGrants.new_tables.every(t=>t.rls && !t.authenticated_insert && !t.authenticated_update && !t.authenticated_delete)
  && nativeGrants.attachments_bucket.public===false && nativeGrants.attachments_bucket.file_size_limit===5242880
  && JSON.stringify([...nativeGrants.attachments_bucket.allowed_mime_types].sort())===JSON.stringify(['application/pdf','image/jpeg','image/png','image/webp']);
const nativeChainPassed = record=>record?.passed && record.exitCode===0
  && migrations.every(file=>record.appliedMigrations.filter(name=>currentMigrationName(name)===file).length===1);
const nativeStackVerified = nativeChainPassed(native.start) && nativeChainPassed(native.reset)
  && native.tests.passed && native.tests.exitCode===0 && native.tests.assertions===135
  && native.advisors.passed && native.advisorSummary.errorCount===0 && native.advisorSummary.newTableFindings.length===0
  && nativeGrantsPassed;
const runtime = read('completion-live-runtime/runtime.json');
const verdict = independentChecksPass && liveServicesVerified && nativeStackVerified ? 'complete' : independentChecksPass ? 'partially complete' : 'blocked';
const evidenceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name!=='gate.json') evidenceFiles.push(path.relative(root,file).replaceAll('\\','/'));
  }
}
walk(output);
const sources = [
  'packages/shared/src/index.ts','packages/shared/src/types/database.ts',
  ...['schemas/service-foundations.ts','schemas/service-foundations.test.ts','types/service-foundations.ts','lib/service-foundations.ts'].map(file=>'packages/shared/src/'+file),
  ...['0044_evacuation_centers_verified.sql','0049_seed_empty_tables.sql','0053_faq.sql','0095_phase1_shared_foundations.sql'].map(file=>'supabase/migrations/'+file),
  'supabase/seed.sql',
  ...['index.ts','storage-cleanup.ts','storage-cleanup.test.ts'].map(file=>'supabase/functions/delete-my-account/'+file),
  ...fs.readdirSync(path.join(root,'supabase/tests')).map(file=>'supabase/tests/'+file),
  ...fs.readdirSync(path.join(root,'scripts')).filter(file=>file.startsWith('phase1-')).map(file=>'scripts/'+file),
  ...fs.readdirSync(path.join(root,'scripts/fixtures')).filter(file=>file.startsWith('phase1-')).map(file=>'scripts/fixtures/'+file),
  ...['dashboard/page.tsx','requests/page.tsx','requests/[requestId]/page.tsx','transactions/page.tsx','transactions/transactions-table.tsx'].map(file=>'apps/admin-web/src/app/(admin)/'+file),
  planFile,'plans/Phase_1_Shared_Contracts_and_Additive_Foundations.md',
];
const gate = {checkedAt:new Date().toISOString(),verdict,scope:['Android','resident web','web admin','shared/backend'],
  independentChecksPass,checks,exitGate,databaseExitGatePassed:exitGate.every(r=>r.passed),liveServicesVerified,nativeStackVerified,nativeGrantsPassed,
  runtime:runtime.runtime,subscriptionRequired:runtime.subscriptionRequired,
  blocker:verdict==='complete' ? null : 'Review required checks, actual local stack replay and live HTTP evidence',
  limitations:['Representative existing-data evidence uses PostgreSQL 17.11 with Supabase role/schema fixtures; fresh migrations and HTTP journeys also pass on actual Supabase services',
    'No deployment or production data changes','Dependent consumer, catalog, SLA evaluator, Google and legacy-ID rollouts remain later phases'],
  manifest:[...sources,...evidenceFiles].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(path.join(output,'gate.json'),JSON.stringify(gate,null,2)+'\n');
console.log(`Phase 1: ${verdict}; database exit gate ${gate.databaseExitGatePassed ? 'PASS':'FAIL'}; live services ${liveServicesVerified ? 'PASS':'UNVERIFIED'}`);
if (verdict!=='complete') process.exitCode=2;
