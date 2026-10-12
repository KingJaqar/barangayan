// Generates the scoped, static read projections; no dynamic SQL endpoint.
import fs from 'node:fs';
const root = new URL('../../../', import.meta.url);
const norm = x => `admin_table_keys.text_key((${x})::text) collate "C"`;
const natural = x => `admin_table_keys.reference_key(${x}) collate "C"`;
const label = (x, values) => `case ${x}::text ${Object.entries(values).map(([k,v])=>`when '${k}' then '${v}'`).join(' ')} else initcap(replace(${x}::text, '_', ' ')) end`;
const status = x => label(x,{submitted:'Submitted',in_progress:'Processing',ready_for_pickup:'Ready for Pickup',completed:'Completed',cancelled:'Cancelled',pending:'Pending',paid:'Paid',waived:'Waived',failed:'Failed',expired:'Expired',refunded:'Refunded',open:'Open',resolved:'Resolved',withdrawn:'Withdrawn',unresolved:'Unresolved',confirmed:'Confirmed',attended:'Attended',verified:'Verified',unverified:'Unverified',verification_failed:'Verification Failed'});
const driveLabel = x => label(x,{vaccination:'Vaccination',maternal_care:'Maternal Care',blood_drive:'Blood Drive',medicine:'Medicine Distribution',dental:'Dental Care',optical:'Optical Care',emergency_kit:'Emergency Kit',screening:'Medical Screening',consultation:'Medical Consultation',minor_surgical:'Minor Surgical Drive',others:'Others'});
const profile = (alias,fields) => `case when ${alias}.id is null then null else jsonb_build_object(${fields.split(',').map(x=>`'${x}', ${alias}.${x}`).join(', ')}) end`;
const names = profile('p','full_name');
const contact = profile('p','full_name,email,mobile_number,home_address');
const filters = (key,values,defaultValue='')=>({[key]:{values:values.split(','),defaultValue}});
const textSort = (key,expression,label=key.replaceAll('_',' '))=>({key,expression:norm(expression),label,category:'text'});
const dateSort = (key,expression,label=key.replaceAll('_',' '))=>({key,expression,label,category:'date'});
const numSort = (key,expression,label=key.replaceAll('_',' '))=>({key,expression,label,category:'number'});
const refSort = (key,expression,label)=>({key,expression:natural(expression),label,category:'reference'});
const boolSort = (key,expression,label,positive,negative)=>({key,expression,label,category:'boolean',directionLabels:{asc:`${negative} first`,desc:`${positive} first`}});
const commonDates = alias=>[dateSort('created',`${alias}.created_at`,'Date created'),dateSort('modified',`${alias}.updated_at`,'Date modified')];
const records = {};
records.requests = {
 from:'public.service_requests b left join public.document_types d on d.id=b.document_type_id left join public.profiles p on p.id=b.resident_id',tenant:'b.barangay_id',where:'b.deleted_at is null',
 row:`to_jsonb(b) || jsonb_build_object('document_types',${profile('d','name')},'profiles',${names})`,
 fields:{status:'b.status',doc:'b.document_type_id'}, search:['b.reference_number','p.full_name','d.name'],
 sorts:[refSort('reference','b.reference_number','Reference'),textSort('resident','p.full_name','Resident'),textSort('document','d.name','Document type'),textSort('status',status('b.status'),'Status'),textSort('payment_status',status('b.payment_status'),'Payment status'),dateSort('submitted','b.created_at','Submitted'),dateSort('modified','b.updated_at','Date modified')],defaultSort:'reference',
 filters:{...filters('tab','all,active,processing,pickup,completed,cancelled','active'),...filters('doc','')},
 summary:{submitted:`count(*) filter(where status='submitted')`,processing:`count(*) filter(where status='in_progress')`,pickup:`count(*) filter(where status='ready_for_pickup')`,completed:`count(*) filter(where status='completed')`,cancelled:`count(*) filter(where status='cancelled')`},
};
records.transactions={
 from:'public.payments b left join public.service_requests r on r.id=b.service_request_id left join public.document_types d on d.id=r.document_type_id left join public.profiles p on p.id=r.resident_id left join public.profiles c on c.id=b.collected_by',tenant:'b.barangay_id',where:'b.deleted_at is null',
 row:`to_jsonb(b) || jsonb_build_object('service_requests',case when r.id is null then null else jsonb_build_object('reference_number',r.reference_number,'resident_id',r.resident_id,'document_type_id',r.document_type_id,'document_types',${profile('d','name')},'profiles',${names}) end,'collector',${profile('c','full_name')})`,
 fields:{status:'b.status',method:'b.method',amount:'b.amount_centavos'}, search:['r.reference_number','p.full_name','d.name','c.full_name'],
 sorts:[...commonDates('b'),refSort('reference','r.reference_number','Request reference'),textSort('resident','p.full_name','Resident'),textSort('document','d.name','Document type'),textSort('method',label('b.method',{pickup:'Pay at Pickup',qrph:'QR PH'}),'Method'),textSort('status',status('b.status'),'Status'),numSort('amount','b.amount_centavos','Amount'),dateSort('paid','b.paid_at','Paid date'),dateSort('refund','b.refunded_at','Refund date')],defaultSort:'created',
 filters:{...filters('tab','all,pending,paid,failed,expired,refunded','all'),...filters('method',',pickup,qrph')},
 summary:{cash:`coalesce(sum(amount) filter(where method='pickup' and status='paid'),0)`,qrph:`coalesce(sum(amount) filter(where method='qrph' and status='paid'),0)`,pending:`coalesce(sum(amount) filter(where status='pending'),0)`},
};
const residentFields='id,full_name,first_name,last_name,middle_name,suffix,sex,avatar_url,email,mobile_number,home_address,house_no,street,city,employment_status,occupation,birth_date,email_verification_status,household_members,id_photo_urls,id_type,id_verification_status,current_id_submission_id,id_repair_required,created_at,updated_at,location_verified,verified_location,verified_location_address';
records.residents={from:'public.profiles b',tenant:'b.barangay_id',where:`b.deleted_at is null and b.role='resident'`,row:profile('b',residentFields),
 fields:{email_verified:`b.email_verification_status='verified'`,with_id:'coalesce(cardinality(b.id_photo_urls),0)>0',id_status:'b.id_verification_status',household_count:`case when jsonb_typeof(b.household_members)='array' then jsonb_array_length(b.household_members) else 0 end`},
 search:'full_name,first_name,last_name,middle_name,email,mobile_number,home_address,house_no,street,city,occupation,id_type'.split(',').map(x=>`b.${x}`),
 sorts:[textSort('name','b.full_name','Name'),textSort('first_name','b.first_name','First name'),textSort('last_name','b.last_name','Last name'),textSort('email','b.email','Email'),textSort('email_verification','b.email_verification_status','Email verification'),textSort('id_status',`case when b.id_repair_required then 'Evidence repair required' else ${label('b.id_verification_status',{verified:'Verified ID',pending:'Pending Verification',verification_failed:'Verification Failed, Try Again'})} end`,'ID status'),dateSort('joined','b.created_at','Joined'),dateSort('modified','b.updated_at','Date modified')],defaultSort:'name',
 filters:{...filters('tab','all,verified,unverified','all'),...filters('verification',',with_id,without_id')},
 summary:{total:'count(*)',verified:'count(*) filter(where email_verified)',unverified:'count(*) filter(where not email_verified)',withId:'count(*) filter(where with_id)',withoutId:'count(*) filter(where not with_id)',idPending:`count(*) filter(where id_status='pending')`,idVerified:`count(*) filter(where id_status='verified')`,idFailed:`count(*) filter(where id_status='verification_failed')`,householdMembers:'coalesce(sum(household_count),0)'},
};
records.incidents={from:'public.incidents b left join public.incident_categories d on d.id=b.category_id left join public.profiles p on p.id=b.reporter_id',tenant:'b.barangay_id',where:'b.deleted_at is null',row:`to_jsonb(b) || jsonb_build_object('incident_categories',${profile('d','name,color,icon')},'profiles',${contact})`,
 fields:{status:'b.status',category:'b.category_id'},search:['b.title','b.description','d.name','p.full_name','p.email'],
 sorts:[dateSort('submitted','b.created_at','Submitted'),textSort('title','b.title','Title'),textSort('category','d.name','Category'),textSort('reporter','p.full_name','Reporter'),textSort('status',label('b.status',{open:'Open',in_progress:'In Progress',resolved:'Resolved',withdrawn:'Withdrawn',unresolved:'Unresolved'}),'Status'),numSort('confirmations','b.confirmation_count','Confirmation count'),dateSort('modified','b.updated_at','Date modified')],defaultSort:'submitted',filters:{...filters('tab','all,open,in_progress,resolved,withdrawn,unresolved','open'),...filters('category','')},
 summary:Object.fromEntries(['open','in_progress','resolved','withdrawn','unresolved'].map(x=>[x,`count(*) filter(where status='${x}')`]).concat([['total','count(*)']])),
};
records.health={from:'public.medical_drives b left join (select drive_id,count(*) as n from public.drive_registrations group by drive_id) g on g.drive_id=b.id',tenant:'b.barangay_id',where:'b.deleted_at is null',row:`to_jsonb(b) || jsonb_build_object('registration_count',coalesce(g.n,0))`,
 fields:{type:'b.type',active:'b.is_active',drive_date:'b.drive_date'},search:['b.title','b.location','b.eligible_criteria',`case when b.type in ('vaccination','maternal_care','blood_drive','medicine','dental','optical','emergency_kit','screening','consultation','minor_surgical','others') then ${driveLabel('b.type')} else '' end`],
 sorts:[...commonDates('b'),textSort('title','b.title','Title'),textSort('category',driveLabel('b.type'),'Category'),dateSort('drive_date','b.drive_date','Drive date'),boolSort('active','b.is_active','Active state','Active','Inactive'),numSort('registrations','coalesce(g.n,0)','Registration count'),numSort('stock','b.stock_remaining','Stock remaining')],defaultSort:'created',filters:{...filters('tab','all,upcoming,today,past,inactive','upcoming'),...filters('type',',vaccination,maternal_care,blood_drive,medicine,dental,optical,emergency_kit,screening,consultation,minor_surgical,others')},
 summary:{total:'count(*)',upcoming:`count(*) filter(where active and drive_date >= (current_timestamp at time zone 'Asia/Manila')::date)`,today:`count(*) filter(where active and drive_date = (current_timestamp at time zone 'Asia/Manila')::date)`,past:`count(*) filter(where active and drive_date < (current_timestamp at time zone 'Asia/Manila')::date)`,inactive:'count(*) filter(where not active)'},
};
records.applicants={from:'public.drive_registrations b join public.drive_registration_scores s on s.registration_id=b.id left join public.medical_drives d on d.id=b.drive_id left join public.profiles p on p.id=b.user_id',tenant:'d.barangay_id',where:'true',row:`to_jsonb(b) || jsonb_build_object('priority_score',s.priority_score,'medical_drives',${profile('d','id,title,type,drive_date,location')},'profiles',${names})`,
 fields:{status:'b.status',type:'d.type',pwd:'b.is_pwd'},search:['b.applicant_number','d.title',`array_to_string(b.comorbidities, ', ')`],
 sorts:[dateSort('registered','b.created_at','Registered'),dateSort('modified','b.updated_at','Date modified'),refSort('number','b.applicant_number','Applicant number'),textSort('resident','p.full_name','Resident'),textSort('drive','d.title','Drive title'),textSort('category',driveLabel('d.type'),'Drive category'),textSort('status',status('b.status'),'Status'),numSort('age','b.age','Age'),numSort('priority','s.priority_score','Priority score'),dateSort('drive_date','d.drive_date','Drive date')],defaultSort:'registered',filters:{...filters('tab','all,pending,confirmed,attended,cancelled','all'),...filters('type',',vaccination,maternal_care,blood_drive,medicine,dental,optical,emergency_kit,screening,consultation,minor_surgical,others')},
 summary:Object.fromEntries(['pending','confirmed','attended','cancelled'].map(x=>[x,`count(*) filter(where status='${x}')`]).concat([['total','count(*)'],['pwd','count(*) filter(where pwd)']])),
};
records.households={from:'public.household_members b left join public.profiles p on p.id=b.profile_id',tenant:'p.barangay_id',where:'true',row:`to_jsonb(b) || jsonb_build_object('profiles',${contact})`,fields:{checked_in:'b.is_checked_in',relation:'b.relation'},search:['b.name','p.full_name','b.relation','b.role'],
 sorts:[textSort('name','b.name','Name'),textSort('head','p.full_name','Head name'),textSort('relation',`initcap(b.relation)`,'Relation'),textSort('role',`initcap(b.role)`,'Member role'),boolSort('checked_in','b.is_checked_in','Check-in state','Checked in','Not checked in'),textSort('center','b.checked_in_center_name','Center'),dateSort('added','b.created_at','Added'),dateSort('modified','b.updated_at','Date modified'),dateSort('check_in_date','b.checked_in_at','Check-in date')],defaultSort:'name',filters:{...filters('tab','all,checked_in,not_checked_in','all'),...filters('relation',',spouse,child,parent,sibling,grandparent,grandchild,other')},
 summary:{total:'count(*)',checked_in:'count(*) filter(where checked_in)',not_checked_in:'count(*) filter(where not checked_in)',spouse:`count(*) filter(where relation='spouse')`,child:`count(*) filter(where relation='child')`,parent:`count(*) filter(where relation='parent')`,other:`count(*) filter(where relation not in ('spouse','child','parent'))`},
};
records.staff={from:'public.barangay_officials b join public.profiles p on p.id=b.profile_id',tenant:'b.barangay_id',where:'b.deleted_at is null',row:`to_jsonb(b) || jsonb_build_object('profile',to_jsonb(p))`,fields:{role:'b.official_role'},search:['p.full_name','p.email','p.mobile_number','p.home_address','b.official_role'],
 sorts:[textSort('name','p.full_name','Name'),textSort('role',label('b.official_role',{admin:'Administrator',staff:'Staff',barangay_captain:'Barangay Captain',kagawad:'Kagawad',sk_chairman:'SK Chairman',secretary:'Secretary',treasurer:'Treasurer',health_worker:'Barangay Health Worker',tanod:'Tanod',clerk:'Clerk'}),'Official role'),textSort('email','p.email','Email'),dateSort('hired','b.date_hired','Hired'),dateSort('created','b.created_at','Staff-record creation'),dateSort('modified','b.updated_at','Staff-record modification'),dateSort('profile_modified','p.updated_at','Account-profile modification')],defaultSort:'name',filters:{...filters('tab','all,admin,staff','all'),...filters('role',',admin,staff,barangay_captain,kagawad,sk_chairman,secretary,treasurer,health_worker,tanod,clerk')},summary:{total:'count(*)',admin:`count(*) filter(where role='admin')`,staff:`count(*) filter(where role<>'admin')`},
};
let sql=`-- Phase 2: derived comparison keys, complete aggregates, and applicant-name joins.
-- Existing PostgREST count/range/filter operations remain authoritative.
-- Every view is read-only, invoker-secured, and explicitly active-admin/tenant scoped.
begin;
create schema admin_table_keys;
revoke all on schema admin_table_keys from public;
grant usage on schema admin_table_keys to authenticated;
create function admin_table_keys.text_key(value text) returns text
language sql immutable strict security invoker set search_path='' as $$
 select nullif(lower(regexp_replace(value, '^\\s+|\\s+$', '', 'g')), '')
$$;
create function admin_table_keys.reference_key(value text) returns text[]
language plpgsql immutable strict security invoker set search_path='' as $$
declare normalized text := admin_table_keys.text_key(value); matched text; digits text; result text[] := '{}';
begin
 if normalized is null then return null; end if;
 while normalized <> '' loop
  matched := substring(normalized from '^[0-9]+|^[^0-9]+');
  if matched ~ '^[0-9]' then
   digits := coalesce(nullif(ltrim(matched,'0'),''),'0');
   result := array_append(result,'0' || lpad(length(digits)::text,10,'0') || digits);
  else result := array_append(result,'1' || matched); end if;
  normalized := substring(normalized from length(matched)+1);
 end loop;
 return result;
end
$$;
revoke all on all functions in schema admin_table_keys from public;
grant execute on all functions in schema admin_table_keys to authenticated;
`;
for(const [name,r] of Object.entries(records)) {
 const gate=`${r.tenant}=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null)`;
 sql+=`\ncreate view public.admin_${name}_browse with (security_invoker=true) as\nselect b.id, ${r.tenant} as tenant_id, ${r.row} as row,\n`;
 sql+=[...Object.entries(r.fields).map(([k,x])=>`${x} as f_${k}`),...r.search.map((x,i)=>`lower(${x}) as x${i}`),...r.sorts.map(s=>`${s.expression} as s_${s.key}`)].join(',\n')+`\nfrom ${r.from}\nwhere ${r.where} and ${gate};\n`;
 // Aggregation without GROUP BY returns a real zero summary for an empty authorized tenant.
 const summary=Object.entries(r.summary).map(([k,x])=>`'${k}', ${x.replace(/\b(status|method|amount|email_verified|with_id|id_status|household_count|active|drive_date|pwd|checked_in|relation|role)\b/g,m=>'f_'+m)}`).join(',\n');
 sql+=`create view public.admin_${name}_summary with (security_invoker=true) as\nselect jsonb_build_object(${summary}${name==='health'?`,\n'registrations', (select count(*) from public.drive_registrations reg join public.medical_drives dr on dr.id=reg.drive_id where dr.barangay_id=(select public.current_barangay_id()))`:''}) as summary\nfrom public.admin_${name}_browse\nhaving exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);\n`;
 sql+=`revoke all on public.admin_${name}_browse, public.admin_${name}_summary from public,anon,authenticated;\ngrant select on public.admin_${name}_browse, public.admin_${name}_summary to authenticated;\n`;
}
sql+='commit;\n';
fs.writeFileSync(new URL('supabase/migrations/0110_admin_table_browse_projections.sql',root),sql);
// The admin-local descriptors are safe to import from client controls in later phases.
let config=`import type { BrowseConfig } from './browse-state';\n\nexport const TABLE_CONFIGS = `;
config+=JSON.stringify(Object.fromEntries(Object.entries(records).map(([name,r])=>[name,{sorts:r.sorts.map(({expression,...s})=>({...s,directions:['asc','desc'],initialDirection:['date','number','boolean'].includes(s.category)?'desc':'asc'})),defaultSort:r.defaultSort,filters:r.filters}])),null,2)+` as const satisfies Record<string, BrowseConfig>;\nexport type TableName = keyof typeof TABLE_CONFIGS;\n`;
config+='\nexport const TABLE_SUMMARY_KEYS = '+JSON.stringify(Object.fromEntries(Object.entries(records).map(([k,r])=>[k,Object.keys(r.summary).concat(k==='health'?['registrations']:[])])),null,2)+' as const;\n';
fs.writeFileSync(new URL('apps/admin-web/src/lib/admin-tables/table-configs.ts',root),config);
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(records).map(([k,r])=>[k,{searchColumns:r.search.map((_,i)=>'x'+i),fields:Object.keys(r.fields),sorts:r.sorts.map(s=>({key:s.key,category:s.category})),summaryKeys:Object.keys(r.summary).concat(k==='health'?['registrations']:[])}])),null,2)+'\n');
