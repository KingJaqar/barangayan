/* global __dirname */
// Verify recorded execution evidence. Does not rerun tests or contact services.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase7');
const read=file=>JSON.parse(fs.readFileSync(path.join(output,file),'utf8'));
const checks=[],check=(name,passed,evidence)=>checks.push({name,passed:Boolean(passed),evidence});
const sql=read('database/test-results.json'),http=read('http/results.json'),browser=read('browser/results.json');
check('All 12 SQL suites / 445 assertions pass',sql.length===12&&sql.every(r=>r.passed)&&sql.reduce((n,r)=>n+r.assertions,0)===445,'database/test-results.json');
check('Resident and administrator API/realtime/concurrency coverage',http.passed&&http.assertions.length===60,'http/results.json');
check('Real browser privacy, administrator display and legacy gate',browser.passed&&browser.assertions.length===15&&browser.consoleErrors.length===0,'browser/results.json');
const confirmation=read('browser/confirmation-before-list-ready.json');
check('Real web confirmation score-free',confirmation.assertions.includes('Resident confirmation: no visible score')&&confirmation.assertions.includes('Resident confirmation: no accessibility score')&&fs.existsSync(path.join(output,'browser/resident-confirmation.png')),'browser/confirmation-before-list-ready.json; browser/resident-confirmation.png');
for(const database of ['phase7_empty','phase7_existing']){
 const steps=read('transition-replay/results.json').filter(r=>r.database===database),reconciliation=read(`transition-replay/${database}-reconciliation.json`),transition=read(`transition-replay/${database}-transition.json`);
 const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql'));
 check(database+': full migration chain and exact historical reconciliation',steps.every(r=>r.passed)&&migrations.every(file=>steps.filter(r=>r.label===file).length===1)&&reconciliation.passed&&reconciliation.tables.every(t=>t.unchanged),'transition-replay');
 check(database+': intermediate null-only mirror protection',transition.passed&&transition.legacyMirrorsNull&&transition.mirrorWritesConstrained,`transition-replay/${database}-transition.json`);
}
for(const state of ['registration-list','registration-details','registration-form','registration-confirmation','saved-native-registration']){
 const result=read(`android/${state}-results.json`);
 check('Native '+state,result.passed&&result.device==='emulator-5578'&&result.scoreFreeVisibleAndAccessibilityLabels&&result.requiredLabels.length>=2,`android/${state}-results.json`);
}
check('Native submission creates expected protected score',read('android/database-results.json').passed,'android/database-results.json');
check('Administrator/resident CSV compatibility',read('compatibility-check.json').passed&&read('compatibility-check.json').assertions.length===6,'compatibility-check.json');
for(const run of ['final-types','final-lint','verified-builds','final-restored-config']){
 const results=read(run+'/results.json').checks;
 check(run+': all recorded commands pass',results.length>0&&results.every(r=>r.exitCode===0&&!r.error)&&results.every(r=>fs.existsSync(path.join(output,run,r.log))),run+'/results.json');
}
const sharedLog=fs.readFileSync(path.join(output,'final-types/shared-tests.log'),'utf8'),iosLog=fs.readFileSync(path.join(output,'final-types/ios-tests.log'),'utf8');
check('202 shared / 8 iOS unit tests passed',/Tests\s+202 passed/.test(sharedLog)&&/Tests\s+8 passed/.test(iosLog),'final-types');
const advisor=read('database/advisor-summary.json');
check('No error/Phase 7 advisor findings',advisor.errors===0&&advisor.phase7Findings.length===0,'database/advisor-summary.json');
check('Export Deno check recorded',fs.readFileSync(path.join(output,'export-deno-check.log'),'utf8').includes('Check supabase/functions/export-my-data/index.ts')&&read('final-review.json').exportDenoExitCode===0,'export-deno-check.log; final-review.json');
check('Scoped lint and diff checks pass',read('final-review.json').scriptLintExitCode===0&&read('final-review.json').diffCheckExitCode===0,'final-review.json');
check('Synthetic fixtures cleaned and original values preserved',read('http/cleanup.json').assertions.length===10&&!read('http/cleanup.json').error&&read('database/post-cleanup-reconciliation.json').passed,'http/cleanup.json; database/post-cleanup-reconciliation.json');
check('Task processes/files cleaned',read('cleanup.json').passed,'cleanup.json');
const sources=spawnSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'});
const files=[...new Set([...sources.stdout.trim().split(/\r?\n/).filter(Boolean),...['supabase/migrations/0105_phase7_administrator_only_scores.sql','supabase/migrations/0106_remove_obsolete_registration_score.sql','supabase/tests/administrator_scores.test.sql','packages/shared/src/schemas/drive-registration-result.test.ts']])];
const hashes=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
const passed=checks.every(r=>r.passed),gate={verdict:passed?'complete':'partially complete',scope:'Phase 7 local implementation and exit gate; no deployment or production mutation',checkedAt:new Date().toISOString(),checks,
 exitGate:[
  {condition:'Resident REST/RPC cannot retrieve scores',passed:http.passed&&sql.every(r=>r.passed),evidence:'http/results.json; database/administrator_scores.test.sql.log'},
  {condition:'Resident realtime cannot retrieve scores',passed:http.passed&&http.assertions.includes('Real Realtime registration event received')&&http.assertions.includes('Malicious protected-table subscription receives no score events'),evidence:'http/results.json'},
  {condition:'Resident exports cannot retrieve scores',passed:http.passed&&read('compatibility-check.json').passed,evidence:'http/results.json; compatibility-check.json'},
  {condition:'Active same-tenant administrators retain values/rankings',passed:http.passed&&browser.passed&&read('transition-replay/phase7_existing-reconciliation.json').passed,evidence:'http/results.json; browser/results.json; transition-replay/phase7_existing-reconciliation.json'},
 ],reviewedSourceHashes:hashes,
 limitations:['No hosted migration or production release performed','Signed native release/device qualification remains outside the locally verified SDK 57 Expo Go journey','Personal-data handler and Deno checks passed; deployed Edge Runtime serving was not tested','Phase 6 real Google/provider release gates remain open','Two unchanged resident-web lint warnings and 61 existing database advisor warnings remain']};
if(gate.exitGate.some(r=>!r.passed))gate.verdict='partially complete';
fs.writeFileSync(path.join(output,'gate.json'),JSON.stringify(gate,null,2)+'\n');
console.log(checks.map(r=>(r.passed?'PASS':'FAIL')+': '+r.name).join('\n')+'\nPhase 7 verdict: '+gate.verdict);
process.exitCode=gate.verdict==='complete'?0:1;
