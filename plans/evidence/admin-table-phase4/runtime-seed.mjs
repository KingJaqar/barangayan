import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {sql,statePath,privateDir} from './runtime-stack.mjs';

const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
assert.equal(state.api,'http://127.0.0.1:55431');
const client=createClient(state.api,state.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
if (!process.argv.includes('--accounts-only')) assert.equal(sql('select count(*) from public.barangays;'),'0','Only a new empty fixture schema may be seeded');
if (!process.argv.includes('--accounts-only')) sql(fs.readFileSync(new URL('../admin-table-phase0/runtime-seed.sql',import.meta.url),'utf8'));
const users={};
for(const name of ['admin','foreignAdmin','resident','removedAdmin']) {
 const email=`phase4-${name.toLowerCase()}@example.invalid`,password=randomBytes(18).toString('hex');
 const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);
 users[name]={id:data.user.id,email,password};
 const profile={id:data.user.id,barangay_id:name==='foreignAdmin'?'10000000-0000-4000-8000-000000000002':'10000000-0000-4000-8000-000000000001',role:name==='resident'?'resident':'admin',full_name:`Runtime ${name}`,email};
 const inserted=await client.from('profiles').insert(profile);assert.ifError(inserted.error);
 if(name==='removedAdmin'){const deleted=await client.from('profiles').update({deleted_at:'2026-01-01T00:00:00Z'}).eq('id',data.user.id);assert.ifError(deleted.error);}
}
fs.writeFileSync(privateDir+'/users.json',JSON.stringify(users,null,2));
sql("update public.profiles set full_name=case right(id::text,4) when '0001' then '  alpha Duplicate  ' when '0002' then 'ALPHA duplicate' when '0003' then 'Álpha Duplicate' when '0004' then '' when '0005' then repeat('Long Name Ω ',40) end where id::text like '21000000-%' and right(id::text,4) in ('0001','0002','0003','0004','0005'); update public.household_members set name=case right(id::text,4) when '0001' then '  alpha Duplicate  ' when '0002' then 'ALPHA duplicate' when '0003' then 'Álpha Duplicate' when '0004' then '' when '0005' then repeat('Long Name Ω ',40) end,relation='child' where right(id::text,4) in ('0001','0002','0003','0004','0005');");
const counts=JSON.parse(sql("select jsonb_build_object('profiles',(select count(*) from public.profiles),'requests',(select count(*) from public.service_requests),'payments',(select count(*) from public.payments),'incidents',(select count(*) from public.incidents),'drives',(select count(*) from public.medical_drives),'registrations',(select count(*) from public.drive_registrations),'scores',(select count(*) from public.drive_registration_scores),'members',(select count(*) from public.household_members),'officials',(select count(*) from public.barangay_officials));"));
fs.writeFileSync(new URL('./runtime-fixture-counts.json',import.meta.url),JSON.stringify({counts,loginAccounts:Object.keys(users),tenants:2,seedTransaction:true,credentialsLocation:'ignored dist directory; removed during cleanup'},null,2)+'\n');
console.log(JSON.stringify(counts));

