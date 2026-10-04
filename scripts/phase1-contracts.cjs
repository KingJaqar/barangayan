/* global __dirname */
// Compare Phase 1 shared contracts with types introspected from the local database.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const run = process.argv[2] || 'database-reviewed';
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid evidence directory');
const output = path.join(root,'plans/evidence/phase1',run);
fs.mkdirSync(output,{recursive:true});
const generated = path.join(output,'generated-types.ts');
const generation = spawnSync(process.execPath,[path.join(root,'node_modules/supabase/dist/supabase.js'),'gen','types','typescript','--db-url','postgresql://postgres@127.0.0.1:55431/phase1_existing?sslmode=disable'],{cwd:root,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(output,'generated-types.log'),generation.stderr || '');
if (generation.status !== 0) throw new Error(generation.stderr);
fs.writeFileSync(generated,generation.stdout);
const assertions = [
  ['document_types','CatalogFoundationFields'],['profiles','ProfileFoundationFields'],['service_requests','RequestFoundationFields'],
].map(([table,fields]) => `type Check_${table} = Assert<Equal<${fields}, Pick<Actual['public']['Tables']['${table}']['Row'],keyof ${fields}>>>;`);
for (const table of ['barangay_localities','id_submissions','request_attachments','service_request_pauses']) {
  assertions.push(`type Check_${table} = Assert<Equal<Shared['public']['Tables']['${table}']['Row'],Actual['public']['Tables']['${table}']['Row']>>;`);
  assertions.push(`type Relations_${table} = Assert<Equal<Shared['public']['Tables']['${table}']['Relationships'][number],Actual['public']['Tables']['${table}']['Relationships'][number]>>;`);
}
for (const operation of ['complete_resident_profile','publish_id_submission','review_id_submission','submit_service_request','assess_service_request_fee','transition_service_request_sla']) {
  assertions.push(`type Check_${operation} = Assert<Equal<Shared['public']['Functions']['${operation}'],Actual['public']['Functions']['${operation}']>>;`);
}
for (const [table,names] of [
  ['profiles',['profiles_current_id_submission_fkey','profiles_approved_id_submission_fkey']],
  ['service_requests',['service_requests_approved_submission_fkey','service_requests_fee_assessed_by_fkey']],
]) {
  for (const name of names) assertions.push(`type Relation_${name} = Assert<Equal<Extract<Shared['public']['Tables']['${table}']['Relationships'][number],{foreignKeyName:'${name}'}>,Extract<Actual['public']['Tables']['${table}']['Relationships'][number],{foreignKeyName:'${name}' }>>>;`);
}
const source = `import type { Database as Shared } from '../../packages/shared/src/types/database';
import type { CatalogFoundationFields,ProfileFoundationFields,RequestFoundationFields } from '../../packages/shared/src/types/service-foundations';
import type { Database as Actual } from '../../plans/evidence/phase1/${run}/generated-types';
type Equal<A,B> = (<T>()=>T extends A ? 1 : 2) extends (<T>()=>T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
${assertions.join('\n')}
`;
const file = path.join(root,'dist/phase1-tools/contract-check.ts');
fs.writeFileSync(file,source);
const configuration = path.join(root,'dist/phase1-tools/contract-check.tsconfig.json');
fs.writeFileSync(configuration,JSON.stringify({compilerOptions:{noEmit:true,strict:true,skipLibCheck:true,moduleResolution:'bundler',module:'esnext',target:'es2020',types:[]},files:['contract-check.ts']}));
const checked = spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',configuration],{cwd:root,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(output,'contract-check.log'),checked.stdout + checked.stderr);
fs.writeFileSync(path.join(output,'contract-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),assertions:assertions.length,exitCode:checked.status},null,2));
if (checked.status !== 0) throw new Error(checked.stdout + checked.stderr);
console.log(`PASS: ${assertions.length} schema-introspected shared contract assertions`);
