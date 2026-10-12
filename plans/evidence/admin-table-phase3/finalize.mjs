import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(import.meta.dirname,name),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const sourceFiles=[
 'apps/admin-web/src/app/(admin)/requests/page.tsx',
 'apps/admin-web/src/app/(admin)/requests/requests-table.tsx',
 'apps/admin-web/src/app/(admin)/requests/types.ts',
 'apps/admin-web/src/app/(admin)/transactions/page.tsx',
 'apps/admin-web/src/app/(admin)/transactions/transactions-table.tsx',
 'apps/admin-web/src/components/admin/request-status-actions.tsx',
 'apps/admin-web/src/components/admin/pilot-summary.tsx',
 'apps/admin-web/src/hooks/use-table-browse-navigation.ts',
 'apps/admin-web/src/hooks/use-pilot-table-browse.ts',
 'apps/admin-web/src/lib/admin-tables/pilot-config.ts',
 'apps/admin-web/src/lib/admin-tables/queries/pilot-options.ts',
 'apps/admin-web/tests/table-browse/pilot.test.ts',
 'supabase/migrations/0112_admin_reference_index_writer_permissions.sql',
];
const plan='plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md';
const owned=new Set([...sourceFiles,plan]);
const baseline=read('baseline.json');
const comparisons=baseline.filter(entry=>!owned.has(entry.path)).map(entry=>({path:entry.path,
 baselineHash:entry.hash,currentHash:hash(path.join(root,entry.path)),identical:entry.hash===hash(path.join(root,entry.path))}));
const phase2=comparisons.filter(entry=>entry.path.startsWith('apps/admin-web/')||entry.path.startsWith('supabase/migrations/011')||entry.path.startsWith('plans/evidence/admin-table-phase2/'));
assert.ok(phase2.every(entry=>entry.identical),'Pre-existing Phase 2 dependency/evidence changed');
const normalize=text=>text.replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n');
const sources=sourceFiles.map(file=>{
 const absolute=path.join(root,file);
 const snapshot=file.startsWith('apps/admin-web/')?path.join(root,'dist/admin-table-phase3-preview',file.slice('apps/admin-web/'.length)):null;
 const exists=snapshot&&fs.existsSync(snapshot);
 return {path:file,sha256:hash(absolute),previewByteIdentical:exists?hash(absolute)===hash(snapshot):null,
  previewEquivalentIgnoringTrailingWhitespace:exists?normalize(fs.readFileSync(absolute,'utf8'))===normalize(fs.readFileSync(snapshot,'utf8')):null};
});
assert.ok(sources.filter(item=>item.path.includes('/src/')).every(item=>item.previewEquivalentIgnoringTrailingWhitespace),'Browser preview source mismatch');
const baselinePaths=new Set(baseline.map(entry=>entry.path));
const additionalUnrelatedStatusPaths=execFileSync('git',['status','--porcelain=v1','-uall'],{cwd:root,encoding:'utf8'}).trimEnd().split('\n').filter(Boolean).map(line=>{
 const file=line.slice(3);return file.startsWith('"')?JSON.parse(file):file;
}).filter(file=>!owned.has(file)&&!baselinePaths.has(file)&&!file.startsWith('plans/evidence/admin-table-phase3/'));
const scope={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),ownedSource:sources,
 initialDirtyFilesCompared:comparisons.length,phase2DependenciesIdentical:true,
 concurrentUnrelatedDrift:comparisons.filter(item=>!item.identical),
 additionalUnrelatedStatusPaths,
 note:'Initial dirty files were hashed before implementation. Concurrent unrelated drift is recorded, preserved and excluded from Phase 3. This manifest does not claim whole-workspace equality.',comparisons};
fs.writeFileSync(path.join(import.meta.dirname,'scope.json'),JSON.stringify(scope,null,2)+'\n');

const core=read('acceptance-attempt3.json'),actions=read('acceptance-actions-final.json'),matrix=read('browser-matrix-verified.json'),reconciliation=read('reconciliation-final.json'),creation=read('creation.json'),transaction=read('transaction-creation.json'),permissions=read('route-permissions.json'),writer=read('writer-permissions.json'),cleanup=read('runtime-cleanup.json'),preview=read('preview-cleanup.json');
assert.equal(core.checks.length,8);assert.equal(core.errors.length,0);
for(const report of [actions,matrix,reconciliation,transaction,permissions,writer])assert.equal(report.passed,true);
assert.equal(creation.checks.length,1);assert.equal(creation.errors.length,0);
assert.equal(preview.stillRunning,0);assert.equal(cleanup.remainingOwnedContainers,'');assert.equal(cleanup.privateCredentialsRemoved,true);
const timing=Object.fromEntries(['requests','transactions'].map(route=>{
 const samples=reconciliation.timings.filter(item=>item.route===route).map(item=>item.ms).sort((a,b)=>a-b);
 assert.equal(samples.length,10);const p95=samples[Math.ceil(samples.length*.95)-1];assert.ok(p95<=1500);
 return [route,{samples:samples.length,p95Ms:Math.round(p95*100)/100}];
}));
const summary={phase:3,status:'complete',recordedAt:new Date().toISOString(),
 verifiedGroups:[{source:'acceptance-attempt3.json',checks:core.checks,scope:'Eight completed groups only; full attempt stopped later on an incorrect action locator.'},
 {source:'acceptance-actions-final.json',checks:actions.checks},{source:'browser-matrix-verified.json',checks:matrix.checks},
 {source:'reconciliation-final.json',checks:reconciliation.checks},{source:'creation.json',checks:creation.checks,scope:'Completed request creation/archive group only; later transaction locator corrected in separate passing run.'},
 {source:'transaction-creation.json',checks:transaction.checks},{source:'route-permissions.json',cases:permissions.cases}],
 staticChecks:{unitTests:65,typecheck:'passed',fullAdminLint:'passed',productionBuild:'passed (webpack)',logs:['unit-tests-final.log','typecheck-final.log','full-lint.log','build-final.log']},
 timing:{profile:'Loopback, unthrottled, Next development preview; 1,505 rows per pilot table, DB/REST each two CPUs; warm Next/Previous commits',...timing},
 migration:{new:'0112_admin_reference_index_writer_permissions.sql',permissionsVerified:true,appliedTo:'task-owned fixture only',deploymentPrerequisites:['0110','0111','0112']},
 resourcesCleaned:true,scopeManifest:'scope.json',finalChecks:'final-checks.json',
 limitations:['No hosted/source migration application or deployment; Phase 6 release remains unstarted.',
 'Refund provider submission is mocked; confirmation read, guards, UI and audit are real. No PayMongo integration claim.',
 'Native Safari/Edge, physical input and manual screen-reader checks unavailable; WebKit is engine coverage.',
 'Earlier WebKit notification access-control errors and a Firefox navigation-aborted background read are retained. Settled browser repeat has no uncaught errors; precise earlier error cause is unproven. Shared notification code is unchanged.',
 'Core and request-creation evidence uses only completed groups from stopped attempts; corrected action, transaction, Realtime and browser groups have separate passing reports.']};
fs.writeFileSync(path.join(import.meta.dirname,'final-verification.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({phase:3,status:summary.status,timing,phase2DependenciesIdentical:true,concurrentUnrelatedDrift:scope.concurrentUnrelatedDrift.map(item=>item.path),additionalUnrelatedStatusPaths,previewByteMismatches:sources.filter(item=>item.previewByteIdentical===false).map(item=>item.path),resourcesCleaned:true}));
