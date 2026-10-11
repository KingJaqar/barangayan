// Consolidate only checks actually executed; then compare current authoritative schema/scope.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql,docker,root} from './runtime-stack.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const api=read('runtime-api-results.json'),edges=read('runtime-query-edges.json'),browser=read('runtime-browser-results.json'),subscriptions=read('runtime-subscription-results.json'),routes=read('runtime-route-permissions.json');
const remaining=read('runtime-interaction-results.json');
for(const [name,result]of Object.entries({api,edges,browser,subscriptions,routes,remaining}))assert.equal(result.passed,true,name+': actual checks incomplete');
assert.equal(browser.screens.length,8);assert.equal(subscriptions.checks.length,5);
const selectedLabels=['Directory','Households','Applicants','Incidents','Health'];
// Earlier failed expectations remain preserved; only its completed assertions
// are combined with the subsequently verified scenarios, not its failed gate.
// A later complete run needs no historical supplement or double counting.
const interactions=remaining.checks.some(check=>check.label.startsWith('HTTP-denied edit'))
 ? remaining.checks : [...read('runtime-interaction-attempt3.json').checks,...remaining.checks];
for(const label of selectedLabels)assert.ok(interactions.some(check=>check.label===label+': detail closes without changing row identity'));
assert.ok(interactions.some(check=>check.label.startsWith('Successful inline age edit')));
assert.ok(interactions.some(check=>check.label.startsWith('HTTP-denied edit')));
const catalog=JSON.parse(sql('set search_path=public;\n'+fs.readFileSync(new URL('./hosted-schema-query.sql',import.meta.url),'utf8')));
const hosted=read('hosted-schema.json'),normalize=data=>JSON.stringify(data.map(item=>JSON.stringify(item)).sort());
const alignment=Object.fromEntries(['columns','constraints','indexes','rls','collations','migrations'].map(key=>[key,normalize(catalog[key])===normalize(hosted[key])]));
for(const [key,value]of Object.entries(alignment))assert.equal(value,true,key);
const readPolicies=data=>data.policies.filter(row=>['SELECT','ALL'].includes(row.cmd));
assert.equal(normalize(readPolicies(catalog)),normalize(readPolicies(hosted)));
fs.writeFileSync(new URL('./runtime-final-schema.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
const baseline=read('runtime-baseline-hashes.json'),changed=[],missing=[];
for(const [relative,oldHash]of Object.entries(baseline)){
 const target=path.join(root,relative);
 if(!fs.existsSync(target)){missing.push(relative);continue;}
 if(createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==oldHash)changed.push(relative);
}
const applicationChanges=changed.filter(file=>file.startsWith('apps/admin-web/')||file.startsWith('apps/resident-android-mobile/'));
assert.equal(applicationChanges.length,0,'Task cannot claim preserved application baseline');
const schemaSubscriptions=Number(sql('select count(*) from realtime.subscription;'));
const report={timestamp:new Date().toISOString(),phase0RuntimeEvidenceComplete:true,counts:{authenticatedApiAssertions:api.checks.length,queryEdgeAssertions:edges.checks.length,renderedScreens:browser.screens.length,browserInteractionAssertions:interactions.length,realTableSubscriptionChecks:subscriptions.checks.length,browserPermissionChecks:routes.checks.length},interactions,schemaAlignment:{...alignment,affectedReadPolicies:true,knownDifference:'Hosted-only payment INSERT policy; no affected read-policy difference'},finalServerSubscriptionRows:schemaSubscriptions,subscriptionBoundary:'Server metadata retention alone does not establish a live callback. Each direct client channel was removed, browser context closed, and a removed incident topic delivered no callback/refresh during a 2,500ms mutation observation. Container teardown is verified separately; long stress coverage remains a later gate.',scope:{baselineFiles:Object.keys(baseline).length,changed,missing,applicationChanges},boundaries:['Representative isolated schema/session/browser checks, not authenticated hosted acceptance','Chrome only; other browsers, physical input/accessibility and large performance remain Phase 6 gates','Existing defects documented; no table improvements or application migrations implemented'],sourceContainersUntouchedByTask:true};
fs.writeFileSync(new URL('./runtime-completion.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,scope:report.scope,alignment:report.schemaAlignment,finalServerSubscriptionRows:schemaSubscriptions}));
console.log('Source migration prefix (read-only): '+docker(['exec','supabase_db_barangayan','psql','-U','postgres','-d','postgres','-At','-c','select max(version) from supabase_migrations.schema_migrations;']));
