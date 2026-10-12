import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sql, docker, owner } from './runtime.mjs';
assert.equal(JSON.parse(docker(['inspect','--format','{{json .Config.Labels}}','barangayan-admin-phase2-db']))['barangayan.task'],owner);
const views=JSON.parse(sql(`select json_agg(json_build_object('name',c.relname,'invoker',c.reloptions @> array['security_invoker=true'],
 'anonSelect',has_table_privilege('anon',c.oid,'select'),'authenticatedSelect',has_table_privilege('authenticated',c.oid,'select'),
 'authenticatedWrite',has_table_privilege('authenticated',c.oid,'insert,update,delete'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'admin_%' and c.relkind='v';`));
assert.equal(views.length,16);assert.ok(views.every(v=>v.invoker&&!v.anonSelect&&v.authenticatedSelect&&!v.authenticatedWrite));
const functions=JSON.parse(sql(`select json_agg(json_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,'anonExecute',has_function_privilege('anon',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='admin_table_keys';`));
assert.equal(functions.length,2);assert.ok(functions.every(f=>!f.definer&&!f.anonExecute&&f.volatility==='i'&&f.config.includes('search_path=""')));
const tables=['profiles','service_requests','document_types','payments','incidents','incident_categories','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'];
const policyQuery=`set search_path=public,pg_catalog; select coalesce(json_agg(json_build_object('table',tablename,'policy',policyname,'cmd',cmd,'roles',roles,'qual',qual,'check',with_check) order by tablename,policyname),'[]') from pg_policies where schemaname='public' and tablename in (${tables.map(t=>`'${t}'`).join(',')});`;
const source=JSON.parse(docker(['exec','supabase_db_barangayan','psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1','-c',policyQuery]));
const isolated=JSON.parse(sql(policyQuery));
const uncached=expression=>expression?.replace(/\(\s*SELECT\s+(?:public\.)?("current_role"\(\)|current_barangay_id\(\))\s+AS\s+(?:"?current_role"?|current_barangay_id)\s*\)/g,'$1')??expression;
const comparePolicies=policies=>policies.map(p=>({...p,qual:p.cmd==='SELECT'?uncached(p.qual):p.qual}));
assert.deepEqual(comparePolicies(isolated),source,'Read predicates must remain equivalent; ALL and write policies must be byte-identical');
const flags=JSON.parse(sql(`select json_agg(json_build_object('name',relname,'rls',relrowsecurity)) from pg_class where relname in (${tables.map(t=>`'${t}'`).join(',')}) and relnamespace='public'::regnamespace;`));
assert.ok(flags.every(t=>t.rls));
fs.writeFileSync(new URL('./security.json',import.meta.url),JSON.stringify({timestamp:new Date().toISOString(),views,functions,rls:flags,existingReadPredicatesEquivalent:true,allAndWritePoliciesUnchanged:true,cachedReadPolicies:isolated.filter((p,i)=>p.qual!==source[i].qual).map(p=>({table:p.table,policy:p.policy})),policies:isolated,advisors:'Catalog assertions for isolated schema; hosted advisors were not run because migrations are not deployed.'},null,2));
console.log('PASS: invoker views, read-only grants, private helpers, equivalent read predicates, unchanged write policies and RLS');
