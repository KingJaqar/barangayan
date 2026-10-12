-- Phase 2: derived comparison keys, complete aggregates, and applicant-name joins.
-- Existing PostgREST count/range/filter operations remain authoritative.
-- Every view is read-only, invoker-secured, and explicitly active-admin/tenant scoped.
begin;
create schema admin_table_keys;
revoke all on schema admin_table_keys from public;
grant usage on schema admin_table_keys to authenticated;
create function admin_table_keys.text_key(value text) returns text
language sql immutable strict security invoker set search_path='' as $$
 select nullif(lower(regexp_replace(value, '^\s+|\s+$', '', 'g')), '')
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

create view public.admin_requests_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('document_types',case when d.id is null then null else jsonb_build_object('name', d.name) end,'profiles',case when p.id is null then null else jsonb_build_object('full_name', p.full_name) end) as row,
b.status as f_status,
b.document_type_id as f_doc,
lower(b.reference_number) as x0,
lower(p.full_name) as x1,
lower(d.name) as x2,
admin_table_keys.reference_key(b.reference_number) collate "C" as s_reference,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_resident,
admin_table_keys.text_key((d.name)::text) collate "C" as s_document,
admin_table_keys.text_key((case b.status::text when 'submitted' then 'Submitted' when 'in_progress' then 'Processing' when 'ready_for_pickup' then 'Ready for Pickup' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' when 'pending' then 'Pending' when 'paid' then 'Paid' when 'waived' then 'Waived' when 'failed' then 'Failed' when 'expired' then 'Expired' when 'refunded' then 'Refunded' when 'open' then 'Open' when 'resolved' then 'Resolved' when 'withdrawn' then 'Withdrawn' when 'unresolved' then 'Unresolved' when 'confirmed' then 'Confirmed' when 'attended' then 'Attended' when 'verified' then 'Verified' when 'unverified' then 'Unverified' when 'verification_failed' then 'Verification Failed' else initcap(replace(b.status::text, '_', ' ')) end)::text) collate "C" as s_status,
admin_table_keys.text_key((case b.payment_status::text when 'submitted' then 'Submitted' when 'in_progress' then 'Processing' when 'ready_for_pickup' then 'Ready for Pickup' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' when 'pending' then 'Pending' when 'paid' then 'Paid' when 'waived' then 'Waived' when 'failed' then 'Failed' when 'expired' then 'Expired' when 'refunded' then 'Refunded' when 'open' then 'Open' when 'resolved' then 'Resolved' when 'withdrawn' then 'Withdrawn' when 'unresolved' then 'Unresolved' when 'confirmed' then 'Confirmed' when 'attended' then 'Attended' when 'verified' then 'Verified' when 'unverified' then 'Unverified' when 'verification_failed' then 'Verification Failed' else initcap(replace(b.payment_status::text, '_', ' ')) end)::text) collate "C" as s_payment_status,
b.created_at as s_submitted,
b.updated_at as s_modified
from public.service_requests b left join public.document_types d on d.id=b.document_type_id left join public.profiles p on p.id=b.resident_id
where b.deleted_at is null and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_requests_summary with (security_invoker=true) as
select jsonb_build_object('submitted', count(*) filter(where f_status='submitted'),
'processing', count(*) filter(where f_status='in_progress'),
'pickup', count(*) filter(where f_status='ready_for_pickup'),
'completed', count(*) filter(where f_status='completed'),
'cancelled', count(*) filter(where f_status='cancelled')) as summary
from public.admin_requests_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_requests_browse, public.admin_requests_summary from public,anon,authenticated;
grant select on public.admin_requests_browse, public.admin_requests_summary to authenticated;

create view public.admin_transactions_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('service_requests',case when r.id is null then null else jsonb_build_object('reference_number',r.reference_number,'resident_id',r.resident_id,'document_type_id',r.document_type_id,'document_types',case when d.id is null then null else jsonb_build_object('name', d.name) end,'profiles',case when p.id is null then null else jsonb_build_object('full_name', p.full_name) end) end,'collector',case when c.id is null then null else jsonb_build_object('full_name', c.full_name) end) as row,
b.status as f_status,
b.method as f_method,
b.amount_centavos as f_amount,
lower(r.reference_number) as x0,
lower(p.full_name) as x1,
lower(d.name) as x2,
lower(c.full_name) as x3,
b.created_at as s_created,
b.updated_at as s_modified,
admin_table_keys.reference_key(r.reference_number) collate "C" as s_reference,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_resident,
admin_table_keys.text_key((d.name)::text) collate "C" as s_document,
admin_table_keys.text_key((case b.method::text when 'pickup' then 'Pay at Pickup' when 'qrph' then 'QR PH' else initcap(replace(b.method::text, '_', ' ')) end)::text) collate "C" as s_method,
admin_table_keys.text_key((case b.status::text when 'submitted' then 'Submitted' when 'in_progress' then 'Processing' when 'ready_for_pickup' then 'Ready for Pickup' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' when 'pending' then 'Pending' when 'paid' then 'Paid' when 'waived' then 'Waived' when 'failed' then 'Failed' when 'expired' then 'Expired' when 'refunded' then 'Refunded' when 'open' then 'Open' when 'resolved' then 'Resolved' when 'withdrawn' then 'Withdrawn' when 'unresolved' then 'Unresolved' when 'confirmed' then 'Confirmed' when 'attended' then 'Attended' when 'verified' then 'Verified' when 'unverified' then 'Unverified' when 'verification_failed' then 'Verification Failed' else initcap(replace(b.status::text, '_', ' ')) end)::text) collate "C" as s_status,
b.amount_centavos as s_amount,
b.paid_at as s_paid,
b.refunded_at as s_refund
from public.payments b left join public.service_requests r on r.id=b.service_request_id left join public.document_types d on d.id=r.document_type_id left join public.profiles p on p.id=r.resident_id left join public.profiles c on c.id=b.collected_by
where b.deleted_at is null and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_transactions_summary with (security_invoker=true) as
select jsonb_build_object('cash', coalesce(sum(f_amount) filter(where f_method='pickup' and f_status='paid'),0),
'qrph', coalesce(sum(f_amount) filter(where f_method='qrph' and f_status='paid'),0),
'pending', coalesce(sum(f_amount) filter(where f_status='pending'),0)) as summary
from public.admin_transactions_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_transactions_browse, public.admin_transactions_summary from public,anon,authenticated;
grant select on public.admin_transactions_browse, public.admin_transactions_summary to authenticated;

create view public.admin_residents_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, case when b.id is null then null else jsonb_build_object('id', b.id, 'full_name', b.full_name, 'first_name', b.first_name, 'last_name', b.last_name, 'middle_name', b.middle_name, 'suffix', b.suffix, 'sex', b.sex, 'avatar_url', b.avatar_url, 'email', b.email, 'mobile_number', b.mobile_number, 'home_address', b.home_address, 'house_no', b.house_no, 'street', b.street, 'city', b.city, 'employment_status', b.employment_status, 'occupation', b.occupation, 'birth_date', b.birth_date, 'email_verification_status', b.email_verification_status, 'household_members', b.household_members, 'id_photo_urls', b.id_photo_urls, 'id_type', b.id_type, 'id_verification_status', b.id_verification_status, 'current_id_submission_id', b.current_id_submission_id, 'id_repair_required', b.id_repair_required, 'created_at', b.created_at, 'updated_at', b.updated_at, 'location_verified', b.location_verified, 'verified_location', b.verified_location, 'verified_location_address', b.verified_location_address) end as row,
b.email_verification_status='verified' as f_email_verified,
coalesce(cardinality(b.id_photo_urls),0)>0 as f_with_id,
b.id_verification_status as f_id_status,
case when jsonb_typeof(b.household_members)='array' then jsonb_array_length(b.household_members) else 0 end as f_household_count,
lower(b.full_name) as x0,
lower(b.first_name) as x1,
lower(b.last_name) as x2,
lower(b.middle_name) as x3,
lower(b.email) as x4,
lower(b.mobile_number) as x5,
lower(b.home_address) as x6,
lower(b.house_no) as x7,
lower(b.street) as x8,
lower(b.city) as x9,
lower(b.occupation) as x10,
lower(b.id_type) as x11,
admin_table_keys.text_key((b.full_name)::text) collate "C" as s_name,
admin_table_keys.text_key((b.first_name)::text) collate "C" as s_first_name,
admin_table_keys.text_key((b.last_name)::text) collate "C" as s_last_name,
admin_table_keys.text_key((b.email)::text) collate "C" as s_email,
admin_table_keys.text_key((b.email_verification_status)::text) collate "C" as s_email_verification,
admin_table_keys.text_key((case when b.id_repair_required then 'Evidence repair required' else case b.id_verification_status::text when 'verified' then 'Verified ID' when 'pending' then 'Pending Verification' when 'verification_failed' then 'Verification Failed, Try Again' else initcap(replace(b.id_verification_status::text, '_', ' ')) end end)::text) collate "C" as s_id_status,
b.created_at as s_joined,
b.updated_at as s_modified
from public.profiles b
where b.deleted_at is null and b.role='resident' and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_residents_summary with (security_invoker=true) as
select jsonb_build_object('total', count(*),
'verified', count(*) filter(where f_email_verified),
'unverified', count(*) filter(where not f_email_verified),
'withId', count(*) filter(where f_with_id),
'withoutId', count(*) filter(where not f_with_id),
'idPending', count(*) filter(where f_id_status='pending'),
'idVerified', count(*) filter(where f_id_status='verified'),
'idFailed', count(*) filter(where f_id_status='verification_failed'),
'householdMembers', coalesce(sum(f_household_count),0)) as summary
from public.admin_residents_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_residents_browse, public.admin_residents_summary from public,anon,authenticated;
grant select on public.admin_residents_browse, public.admin_residents_summary to authenticated;

create view public.admin_incidents_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('incident_categories',case when d.id is null then null else jsonb_build_object('name', d.name, 'color', d.color, 'icon', d.icon) end,'profiles',case when p.id is null then null else jsonb_build_object('full_name', p.full_name, 'email', p.email, 'mobile_number', p.mobile_number, 'home_address', p.home_address) end) as row,
b.status as f_status,
b.category_id as f_category,
lower(b.title) as x0,
lower(b.description) as x1,
lower(d.name) as x2,
lower(p.full_name) as x3,
lower(p.email) as x4,
b.created_at as s_submitted,
admin_table_keys.text_key((b.title)::text) collate "C" as s_title,
admin_table_keys.text_key((d.name)::text) collate "C" as s_category,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_reporter,
admin_table_keys.text_key((case b.status::text when 'open' then 'Open' when 'in_progress' then 'In Progress' when 'resolved' then 'Resolved' when 'withdrawn' then 'Withdrawn' when 'unresolved' then 'Unresolved' else initcap(replace(b.status::text, '_', ' ')) end)::text) collate "C" as s_status,
b.confirmation_count as s_confirmations,
b.updated_at as s_modified
from public.incidents b left join public.incident_categories d on d.id=b.category_id left join public.profiles p on p.id=b.reporter_id
where b.deleted_at is null and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_incidents_summary with (security_invoker=true) as
select jsonb_build_object('open', count(*) filter(where f_status='open'),
'in_progress', count(*) filter(where f_status='in_progress'),
'resolved', count(*) filter(where f_status='resolved'),
'withdrawn', count(*) filter(where f_status='withdrawn'),
'unresolved', count(*) filter(where f_status='unresolved'),
'total', count(*)) as summary
from public.admin_incidents_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_incidents_browse, public.admin_incidents_summary from public,anon,authenticated;
grant select on public.admin_incidents_browse, public.admin_incidents_summary to authenticated;

create view public.admin_health_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('registration_count',coalesce(g.n,0)) as row,
b.type as f_type,
b.is_active as f_active,
b.drive_date as f_drive_date,
lower(b.title) as x0,
lower(b.location) as x1,
lower(b.eligible_criteria) as x2,
lower(case when b.type in ('vaccination','maternal_care','blood_drive','medicine','dental','optical','emergency_kit','screening','consultation','minor_surgical','others') then case b.type::text when 'vaccination' then 'Vaccination' when 'maternal_care' then 'Maternal Care' when 'blood_drive' then 'Blood Drive' when 'medicine' then 'Medicine Distribution' when 'dental' then 'Dental Care' when 'optical' then 'Optical Care' when 'emergency_kit' then 'Emergency Kit' when 'screening' then 'Medical Screening' when 'consultation' then 'Medical Consultation' when 'minor_surgical' then 'Minor Surgical Drive' when 'others' then 'Others' else initcap(replace(b.type::text, '_', ' ')) end else '' end) as x3,
b.created_at as s_created,
b.updated_at as s_modified,
admin_table_keys.text_key((b.title)::text) collate "C" as s_title,
admin_table_keys.text_key((case b.type::text when 'vaccination' then 'Vaccination' when 'maternal_care' then 'Maternal Care' when 'blood_drive' then 'Blood Drive' when 'medicine' then 'Medicine Distribution' when 'dental' then 'Dental Care' when 'optical' then 'Optical Care' when 'emergency_kit' then 'Emergency Kit' when 'screening' then 'Medical Screening' when 'consultation' then 'Medical Consultation' when 'minor_surgical' then 'Minor Surgical Drive' when 'others' then 'Others' else initcap(replace(b.type::text, '_', ' ')) end)::text) collate "C" as s_category,
b.drive_date as s_drive_date,
b.is_active as s_active,
coalesce(g.n,0) as s_registrations,
b.stock_remaining as s_stock
from public.medical_drives b left join (select drive_id,count(*) as n from public.drive_registrations group by drive_id) g on g.drive_id=b.id
where b.deleted_at is null and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_health_summary with (security_invoker=true) as
select jsonb_build_object('total', count(*),
'upcoming', count(*) filter(where f_active and f_drive_date >= (current_timestamp at time zone 'Asia/Manila')::date),
'today', count(*) filter(where f_active and f_drive_date = (current_timestamp at time zone 'Asia/Manila')::date),
'past', count(*) filter(where f_active and f_drive_date < (current_timestamp at time zone 'Asia/Manila')::date),
'inactive', count(*) filter(where not f_active),
'registrations', (select count(*) from public.drive_registrations reg join public.medical_drives dr on dr.id=reg.drive_id where dr.barangay_id=(select public.current_barangay_id()))) as summary
from public.admin_health_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_health_browse, public.admin_health_summary from public,anon,authenticated;
grant select on public.admin_health_browse, public.admin_health_summary to authenticated;

create view public.admin_applicants_browse with (security_invoker=true) as
select b.id, d.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('priority_score',s.priority_score,'medical_drives',case when d.id is null then null else jsonb_build_object('id', d.id, 'title', d.title, 'type', d.type, 'drive_date', d.drive_date, 'location', d.location) end,'profiles',case when p.id is null then null else jsonb_build_object('full_name', p.full_name) end) as row,
b.status as f_status,
d.type as f_type,
b.is_pwd as f_pwd,
lower(b.applicant_number) as x0,
lower(d.title) as x1,
lower(array_to_string(b.comorbidities, ', ')) as x2,
b.created_at as s_registered,
b.updated_at as s_modified,
admin_table_keys.reference_key(b.applicant_number) collate "C" as s_number,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_resident,
admin_table_keys.text_key((d.title)::text) collate "C" as s_drive,
admin_table_keys.text_key((case d.type::text when 'vaccination' then 'Vaccination' when 'maternal_care' then 'Maternal Care' when 'blood_drive' then 'Blood Drive' when 'medicine' then 'Medicine Distribution' when 'dental' then 'Dental Care' when 'optical' then 'Optical Care' when 'emergency_kit' then 'Emergency Kit' when 'screening' then 'Medical Screening' when 'consultation' then 'Medical Consultation' when 'minor_surgical' then 'Minor Surgical Drive' when 'others' then 'Others' else initcap(replace(d.type::text, '_', ' ')) end)::text) collate "C" as s_category,
admin_table_keys.text_key((case b.status::text when 'submitted' then 'Submitted' when 'in_progress' then 'Processing' when 'ready_for_pickup' then 'Ready for Pickup' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' when 'pending' then 'Pending' when 'paid' then 'Paid' when 'waived' then 'Waived' when 'failed' then 'Failed' when 'expired' then 'Expired' when 'refunded' then 'Refunded' when 'open' then 'Open' when 'resolved' then 'Resolved' when 'withdrawn' then 'Withdrawn' when 'unresolved' then 'Unresolved' when 'confirmed' then 'Confirmed' when 'attended' then 'Attended' when 'verified' then 'Verified' when 'unverified' then 'Unverified' when 'verification_failed' then 'Verification Failed' else initcap(replace(b.status::text, '_', ' ')) end)::text) collate "C" as s_status,
b.age as s_age,
s.priority_score as s_priority,
d.drive_date as s_drive_date
from public.drive_registrations b join public.drive_registration_scores s on s.registration_id=b.id left join public.medical_drives d on d.id=b.drive_id left join public.profiles p on p.id=b.user_id
where true and d.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_applicants_summary with (security_invoker=true) as
select jsonb_build_object('pending', count(*) filter(where f_status='pending'),
'confirmed', count(*) filter(where f_status='confirmed'),
'attended', count(*) filter(where f_status='attended'),
'cancelled', count(*) filter(where f_status='cancelled'),
'total', count(*),
'pwd', count(*) filter(where f_pwd)) as summary
from public.admin_applicants_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_applicants_browse, public.admin_applicants_summary from public,anon,authenticated;
grant select on public.admin_applicants_browse, public.admin_applicants_summary to authenticated;

create view public.admin_households_browse with (security_invoker=true) as
select b.id, p.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('profiles',case when p.id is null then null else jsonb_build_object('full_name', p.full_name, 'email', p.email, 'mobile_number', p.mobile_number, 'home_address', p.home_address) end) as row,
b.is_checked_in as f_checked_in,
b.relation as f_relation,
lower(b.name) as x0,
lower(p.full_name) as x1,
lower(b.relation) as x2,
lower(b.role) as x3,
admin_table_keys.text_key((b.name)::text) collate "C" as s_name,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_head,
admin_table_keys.text_key((initcap(b.relation))::text) collate "C" as s_relation,
admin_table_keys.text_key((initcap(b.role))::text) collate "C" as s_role,
b.is_checked_in as s_checked_in,
admin_table_keys.text_key((b.checked_in_center_name)::text) collate "C" as s_center,
b.created_at as s_added,
b.updated_at as s_modified,
b.checked_in_at as s_check_in_date
from public.household_members b left join public.profiles p on p.id=b.profile_id
where true and p.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_households_summary with (security_invoker=true) as
select jsonb_build_object('total', count(*),
'checked_in', count(*) filter(where f_checked_in),
'not_checked_in', count(*) filter(where not f_checked_in),
'spouse', count(*) filter(where f_relation='spouse'),
'child', count(*) filter(where f_relation='child'),
'parent', count(*) filter(where f_relation='parent'),
'other', count(*) filter(where f_relation not in ('spouse','child','parent'))) as summary
from public.admin_households_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_households_browse, public.admin_households_summary from public,anon,authenticated;
grant select on public.admin_households_browse, public.admin_households_summary to authenticated;

create view public.admin_staff_browse with (security_invoker=true) as
select b.id, b.barangay_id as tenant_id, to_jsonb(b) || jsonb_build_object('profile',to_jsonb(p)) as row,
b.official_role as f_role,
lower(p.full_name) as x0,
lower(p.email) as x1,
lower(p.mobile_number) as x2,
lower(p.home_address) as x3,
lower(b.official_role) as x4,
admin_table_keys.text_key((p.full_name)::text) collate "C" as s_name,
admin_table_keys.text_key((case b.official_role::text when 'admin' then 'Administrator' when 'staff' then 'Staff' when 'barangay_captain' then 'Barangay Captain' when 'kagawad' then 'Kagawad' when 'sk_chairman' then 'SK Chairman' when 'secretary' then 'Secretary' when 'treasurer' then 'Treasurer' when 'health_worker' then 'Barangay Health Worker' when 'tanod' then 'Tanod' when 'clerk' then 'Clerk' else initcap(replace(b.official_role::text, '_', ' ')) end)::text) collate "C" as s_role,
admin_table_keys.text_key((p.email)::text) collate "C" as s_email,
b.date_hired as s_hired,
b.created_at as s_created,
b.updated_at as s_modified,
p.updated_at as s_profile_modified
from public.barangay_officials b join public.profiles p on p.id=b.profile_id
where b.deleted_at is null and b.barangay_id=(select actor.barangay_id from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
create view public.admin_staff_summary with (security_invoker=true) as
select jsonb_build_object('total', count(*),
'admin', count(*) filter(where f_role='admin'),
'staff', count(*) filter(where f_role<>'admin')) as summary
from public.admin_staff_browse
having exists(select 1 from public.profiles actor where actor.id=(select auth.uid()) and actor.role='admin' and actor.deleted_at is null);
revoke all on public.admin_staff_browse, public.admin_staff_summary from public,anon,authenticated;
grant select on public.admin_staff_browse, public.admin_staff_summary to authenticated;
commit;
