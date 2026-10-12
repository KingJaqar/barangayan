import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql} from './runtime-stack.mjs';
const privileges=()=>JSON.parse(sql("select jsonb_build_object('serviceReference',has_function_privilege('service_role','admin_table_keys.reference_key(text)','execute'),'serviceText',has_function_privilege('service_role','admin_table_keys.text_key(text)','execute'),'anonReference',has_function_privilege('anon','admin_table_keys.reference_key(text)','execute'),'anonSchema',has_schema_privilege('anon','admin_table_keys','usage'),'authenticatedReference',has_function_privilege('authenticated','admin_table_keys.reference_key(text)','execute'))"));
const before=privileges();assert.equal(before.serviceReference,false);assert.equal(before.serviceText,false);
sql(fs.readFileSync('supabase/migrations/0112_admin_reference_index_writer_permissions.sql','utf8'));
const after=privileges();assert.equal(after.serviceReference,true);assert.equal(after.serviceText,true);assert.equal(after.anonReference,false);assert.equal(after.anonSchema,false);assert.equal(after.authenticatedReference,true);
const key=sql("begin;set local role service_role;select admin_table_keys.reference_key('REQ-2026-2') < admin_table_keys.reference_key('REQ-2026-10');rollback;");assert.equal(key,'t');
fs.writeFileSync(new URL('./writer-permissions.json',import.meta.url),JSON.stringify({passed:true,before,after,numericComparison:true,migration:'0112',scope:'Only task-owned fixture; no hosted/source migration application'},null,2));
// Restore only the exact synthetic row changed by the prior acceptance attempt.
sql("set session_replication_role=replica;update public.service_requests set reference_number='REQ-PHASE0-01505',status='submitted' where id='40000000-0000-4000-8000-000000001505';");
console.log('Verified narrow index-writer permissions and unchanged anon access');
