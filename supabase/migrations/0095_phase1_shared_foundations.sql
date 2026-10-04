-- Phase 1 only: additive, opt-in v2 contracts. Existing catalogs/requests stay v1.
-- No charter activation, legacy ID migration, score move, evaluator or UI rollout.
begin;
create schema if not exists barangayan_private;
revoke all on schema barangayan_private from public, anon;
grant usage on schema barangayan_private to authenticated;

create table public.barangay_localities (
  barangay_id uuid primary key references public.barangays(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  city text not null check (length(btrim(city)) between 1 and 200),
  province text not null check (length(btrim(province)) between 1 and 200),
  resident_registration_enabled boolean not null default false
);
insert into public.barangay_localities(barangay_id, display_name, city, province, resident_registration_enabled)
select id, 'Ampid 1', 'San Mateo', 'Rizal', true from public.barangays
where name = 'Barangay Ampid I'
on conflict (barangay_id) do nothing;
alter table public.barangay_localities enable row level security;
revoke all on public.barangay_localities from anon, authenticated;
grant select on public.barangay_localities to anon, authenticated;
create policy "localities are public reference data" on public.barangay_localities for select to anon, authenticated using (true);

alter table public.document_types
  add column contract_version integer not null default 1 check (contract_version in (1,2)),
  add column service_kind text check (service_kind in ('business','indigency','first_time_job_seeker','certified_true_copy')),
  add column charter jsonb,
  add column purposes jsonb not null default '[]',
  add column requirement_rules jsonb not null default '{}',
  add column pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed','assessment','per_page')),
  add column processing_target_minutes integer check (processing_target_minutes > 0),
  add constraint document_types_v2_config check (contract_version = 1 or (
    service_kind is not null and charter is not null and processing_target_minutes is not null
    and jsonb_typeof(purposes) = 'array' and jsonb_array_length(purposes) > 0
    and jsonb_typeof(requirement_rules) = 'object'
  ));

create table public.id_submissions (
  id uuid primary key,
  resident_id uuid not null references public.profiles(id),
  barangay_id uuid not null references public.barangays(id),
  version integer not null check (version > 0),
  id_type text not null check (length(btrim(id_type)) between 1 and 200),
  front_path text not null unique,
  back_path text not null unique,
  submitted_at timestamptz not null default clock_timestamp(),
  decision text not null default 'pending' check (decision in ('pending','verified','verification_failed','revoked')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  unique(resident_id, version),
  unique(id, resident_id, barangay_id),
  check (front_path <> back_path),
  check ((decision = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (decision <> 'pending' and reviewed_by is not null and reviewed_at is not null
      and (decision = 'verified' or length(btrim(rejection_reason)) between 1 and 1000)))
);
alter table public.id_submissions enable row level security;
revoke all on public.id_submissions from anon, authenticated;
grant select on public.id_submissions to authenticated;
create policy "owner and tenant administrator read ID versions" on public.id_submissions for select to authenticated
using (resident_id = (select auth.uid()) or (public.current_role() = 'admin' and barangay_id = public.current_barangay_id()));
alter table public.profiles
  add column province text,
  add column profile_completed_at timestamptz,
  add column current_id_submission_id uuid,
  add column approved_id_submission_id uuid,
  add column id_repair_required boolean not null default false,
  add constraint profiles_current_id_submission_fkey foreign key(current_id_submission_id, id, barangay_id) references public.id_submissions(id, resident_id, barangay_id),
  add constraint profiles_approved_id_submission_fkey foreign key(approved_id_submission_id, id, barangay_id) references public.id_submissions(id, resident_id, barangay_id);

alter table public.service_requests
  add column contract_version integer not null default 1 check (contract_version in (1,2)),
  add column idempotency_key uuid,
  add column submission_payload jsonb,
  add column purpose_code text,
  add column purpose_label text,
  add column purpose_explanation text check (length(purpose_explanation) <= 1000),
  add column supporting_details jsonb,
  add column approved_id_submission_id uuid,
  add column requirements_review_state text not null default 'legacy' check (requirements_review_state in ('legacy','pending','complete')),
  add column personal_appearance_required boolean not null default false,
  add column personal_appearance_at timestamptz,
  add column pricing_mode_snapshot text check (pricing_mode_snapshot in ('fixed','assessment','per_page')),
  add column fee_assessment_state text not null default 'legacy' check (fee_assessment_state in ('legacy','pending','assessed','waived')),
  add column assessed_amount_centavos integer check (assessed_amount_centavos >= 0),
  add column fee_basis text,
  add column fee_assessed_by uuid references public.profiles(id),
  add column fee_assessed_at timestamptz,
  add column billable_pages integer check (billable_pages > 0),
  add column timing_model text not null default 'legacy_hours' check (timing_model in ('legacy_hours','agency_minutes_v1')),
  add column target_minutes_snapshot integer check (target_minutes_snapshot > 0),
  add column sla_state text not null default 'legacy' check (sla_state in ('legacy','pre_processing','running','paused','ready','released','cancelled')),
  add column accepted_at timestamptz,
  add column ready_at timestamptz,
  add column released_at timestamptz,
  add column cancelled_at timestamptz,
  add constraint service_requests_approved_submission_fkey foreign key(approved_id_submission_id, resident_id, barangay_id) references public.id_submissions(id, resident_id, barangay_id),
  add constraint service_requests_v2_shape check (contract_version = 1 or (
    idempotency_key is not null and submission_payload is not null and approved_id_submission_id is not null
    and purpose_code is not null and purpose_label is not null and supporting_details is not null
    and timing_model = 'agency_minutes_v1' and target_minutes_snapshot is not null and sla_state <> 'legacy'
    and fee_assessment_state <> 'legacy' and requirements_review_state <> 'legacy' and pricing_mode_snapshot is not null
  )),
  add constraint service_requests_legacy_foundations check (contract_version = 2 or (
    idempotency_key is null and submission_payload is null and approved_id_submission_id is null
    and purpose_code is null and purpose_label is null and purpose_explanation is null and supporting_details is null
    and fee_assessment_state='legacy' and assessed_amount_centavos is null and pricing_mode_snapshot is null
    and timing_model='legacy_hours' and target_minutes_snapshot is null and sla_state='legacy'
    and requirements_review_state='legacy' and not personal_appearance_required and personal_appearance_at is null
    and fee_basis is null and fee_assessed_by is null and fee_assessed_at is null and billable_pages is null
    and accepted_at is null and ready_at is null and released_at is null and cancelled_at is null
  )),
  add constraint service_requests_assessment_shape check (
    fee_assessment_state = 'legacy' or
    (fee_assessment_state = 'pending' and assessed_amount_centavos is null and fee_basis is null and fee_assessed_by is null and fee_assessed_at is null) or
    (fee_assessment_state in ('assessed','waived') and assessed_amount_centavos is not null and fee_basis is not null and fee_assessed_at is not null
      and (fee_assessment_state <> 'waived' or assessed_amount_centavos = 0))
  );
create unique index service_requests_owner_idempotency_idx on public.service_requests(resident_id, idempotency_key) where idempotency_key is not null;
create index service_requests_approved_submission_idx on public.service_requests(approved_id_submission_id);
create index profiles_current_submission_idx on public.profiles(current_id_submission_id);
create index profiles_approved_submission_idx on public.profiles(approved_id_submission_id);
create index id_submissions_tenant_idx on public.id_submissions(barangay_id);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  resident_id uuid not null references public.profiles(id),
  barangay_id uuid not null references public.barangays(id),
  requirement_code text not null check (requirement_code in ('dti','hoa','lessor','other')),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default clock_timestamp()
);
create index request_attachments_request_idx on public.request_attachments(request_id);
create index request_attachments_tenant_idx on public.request_attachments(barangay_id);
create index request_attachments_owner_idx on public.request_attachments(resident_id);
alter table public.request_attachments enable row level security;
revoke all on public.request_attachments from anon, authenticated;
grant select on public.request_attachments to authenticated;
create policy "owner and tenant administrator read request attachments" on public.request_attachments for select to authenticated
using (resident_id = (select auth.uid()) or (public.current_role() = 'admin' and barangay_id = public.current_barangay_id()));

create table public.service_request_pauses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  started_by uuid not null references public.profiles(id),
  started_at timestamptz not null default clock_timestamp(),
  resumed_by uuid references public.profiles(id),
  resumed_at timestamptz,
  check ((resumed_at is null and resumed_by is null) or (resumed_at >= started_at and resumed_by is not null))
);
create unique index service_request_one_open_pause_idx on public.service_request_pauses(request_id) where resumed_at is null;
alter table public.service_request_pauses enable row level security;
revoke all on public.service_request_pauses from anon, authenticated;
grant select on public.service_request_pauses to authenticated;
create policy "read pauses of accessible requests" on public.service_request_pauses for select to authenticated
using (exists (select 1 from public.service_requests r where r.id = request_id and
  (r.resident_id = (select auth.uid()) or (public.current_role() = 'admin' and r.barangay_id = public.current_barangay_id()))));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('request-attachments','request-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "residents upload private supporting files" on storage.objects for insert to authenticated
with check (bucket_id = 'request-attachments' and public.current_role() = 'resident'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.deleted_at is null));
create policy "owners read private supporting files" on storage.objects for select to authenticated
using (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tenant administrators read attached supporting files" on storage.objects for select to authenticated
using (bucket_id = 'request-attachments' and public.current_role() = 'admin' and exists (
  select 1 from public.request_attachments a where a.object_path = name and a.barangay_id = public.current_barangay_id()));
-- Both supporting files and new ID version paths are insert-only for residents.
alter policy "residents update own id docs" on storage.objects
using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] is distinct from 'versions')
with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] is distinct from 'versions');
alter policy "residents delete own id docs" on storage.objects
using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] is distinct from 'versions');
create policy "tenant administrators read ID version evidence" on storage.objects for select to authenticated
using (bucket_id = 'id-documents' and public.current_role() = 'admin' and exists (
  select 1 from public.id_submissions s where name in (s.front_path,s.back_path) and s.barangay_id = public.current_barangay_id()));

-- Functions in this private schema own writes; public wrappers retain the existing RPC transport.
create function barangayan_private.assert_actor(p_admin boolean default false) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v public.profiles;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v from public.profiles where id = auth.uid() and deleted_at is null;
  if not found or (p_admin and v.role <> 'admin') or (not p_admin and v.role <> 'resident') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v;
end $$;
create function barangayan_private.check_keys(p_input jsonb, p_keys text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_input) k where not k = any(p_keys)
  ) then raise exception 'invalid_payload' using errcode = '22023'; end if;
end $$;
create function barangayan_private.required_text(p_input jsonb, p_key text, p_max integer) returns text
language plpgsql set search_path = '' as $$
declare v text := btrim(p_input->>p_key);
begin
  if jsonb_typeof(p_input->p_key) is distinct from 'string' or v is null or length(v) not between 1 and p_max then
    raise exception 'invalid_%', p_key using errcode = '22023';
  end if;
  return v;
end $$;
create function barangayan_private.optional_text(p_input jsonb, p_key text, p_max integer) returns text
language plpgsql set search_path = '' as $$
declare v text := nullif(btrim(p_input->>p_key), '');
begin
  if (p_input ? p_key and jsonb_typeof(p_input->p_key) <> 'string') or length(v) > p_max then
    raise exception 'invalid_%', p_key using errcode = '22023';
  end if;
  return v;
end $$;

create function barangayan_private.guard_profile_foundations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' or new.id is distinct from old.id or new.barangay_id is distinct from old.barangay_id or new.role is distinct from old.role then
      raise exception 'use_controlled_profile_completion' using errcode = '42501';
    end if;
    if new.current_id_submission_id is distinct from old.current_id_submission_id
      or new.approved_id_submission_id is distinct from old.approved_id_submission_id
      or new.profile_completed_at is distinct from old.profile_completed_at or new.id_repair_required is distinct from old.id_repair_required then
      raise exception 'protected_profile_foundations' using errcode = '42501';
    end if;
    if old.current_id_submission_id is not null and
      (new.id_type is distinct from old.id_type or new.id_photo_urls is distinct from old.id_photo_urls or new.id_verification_status is distinct from old.id_verification_status) then
      raise exception 'use_ID_version_operations' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger a_guard_profile_foundations before insert or update on public.profiles
for each row execute function barangayan_private.guard_profile_foundations();

create function barangayan_private.guard_request_foundations() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_doc public.document_types; v_res public.profiles; v_operation text := current_setting('barangayan.foundation_operation',true);
begin
  if tg_op = 'UPDATE' and new.contract_version <> old.contract_version then
    raise exception 'immutable_request_contract' using errcode='42501';
  end if;
  if tg_op = 'INSERT' or new.resident_id is distinct from old.resident_id or new.document_type_id is distinct from old.document_type_id or new.barangay_id is distinct from old.barangay_id then
    select * into v_res from public.profiles where id = new.resident_id and role = 'resident' and deleted_at is null;
    select * into v_doc from public.document_types where id = new.document_type_id and is_active and deleted_at is null;
    if v_res.id is null or v_doc.id is null or new.barangay_id is distinct from v_res.barangay_id or new.barangay_id is distinct from v_doc.barangay_id then
      raise exception 'invalid_request_ownership_or_service' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and (new.status <> 'submitted' or new.payment_status <> 'pending' or new.deleted_at is not null) then
      raise exception 'invalid_initial_request_state' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' and (new.contract_version <> v_doc.contract_version or (v_doc.contract_version = 2 and
      (v_operation is distinct from 'submit' or current_user in ('authenticated','anon')))) then
      raise exception 'use_submit_service_request' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.contract_version = 2 then
    if (to_jsonb(new) - array['updated_at','payment_method','payment_status','deleted_at']) is distinct from
       (to_jsonb(old) - array['updated_at','payment_method','payment_status','deleted_at'])
       and (coalesce(v_operation,'') not in ('assessment','sla') or current_user in ('authenticated','anon')) then
      raise exception 'use_controlled_request_operations' using errcode = '42501';
    end if;
    if new.resident_id is distinct from old.resident_id or new.barangay_id is distinct from old.barangay_id
      or new.document_type_id is distinct from old.document_type_id or new.contract_version <> old.contract_version
      or new.submission_payload is distinct from old.submission_payload or new.approved_id_submission_id is distinct from old.approved_id_submission_id
      or new.target_minutes_snapshot is distinct from old.target_minutes_snapshot or new.timing_model <> old.timing_model
      or new.pricing_mode_snapshot is distinct from old.pricing_mode_snapshot then
      raise exception 'immutable_request_snapshot' using errcode = '42501';
    end if;
    if new.payment_status = 'paid' and old.payment_status <> 'paid' and not exists (
      select 1 from public.payments p where p.service_request_id = new.id and p.status = 'paid'
    ) then raise exception 'payment_ledger_required' using errcode = '42501'; end if;
    if new.payment_status = 'waived' and new.fee_assessment_state <> 'waived' then raise exception 'fee_waiver_required' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger a_guard_request_foundations before insert or update on public.service_requests
for each row execute function barangayan_private.guard_request_foundations();

create function barangayan_private.guard_payment_foundations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = new.service_request_id for update;
  if r.contract_version = 2 then
    if r.fee_assessment_state <> 'assessed' or r.assessed_amount_centavos is null or r.assessed_amount_centavos <= 0
      or new.barangay_id <> r.barangay_id or new.amount_centavos <> r.assessed_amount_centavos
      or new.document_fee_centavos <> r.assessed_amount_centavos then
      raise exception 'confirmed_request_amount_required' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' and (r.status in ('cancelled','completed') or r.payment_status in ('paid','waived')) then
      raise exception 'request_not_payable' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' and exists(select 1 from public.payments p where p.service_request_id=r.id and p.status in ('pending','paid')) then
      raise exception 'active_payment_already_exists' using errcode='23505';
    end if;
  end if;
  if tg_op = 'UPDATE' and exists(select 1 from public.service_requests where id = old.service_request_id and contract_version = 2) and
    (new.service_request_id <> old.service_request_id or new.barangay_id <> old.barangay_id or new.amount_centavos <> old.amount_centavos or new.document_fee_centavos <> old.document_fee_centavos) then
    raise exception 'immutable_payment_amount' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger a_guard_payment_foundations before insert or update on public.payments
for each row execute function barangayan_private.guard_payment_foundations();

-- OAuth identities may have a name but no resident-registration metadata.
-- Preserve the password-signup trigger implementation and gate its metadata path.
drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row
when (new.raw_user_meta_data->>'barangay_id' is not null)
execute function public.handle_new_user();

create function barangayan_private.complete_resident_profile(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_profile public.profiles; v_locality public.barangay_localities;
  v_first text; v_last text; v_birth date; v_email text;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  perform barangayan_private.check_keys(p_input,array['firstName','lastName','middleName','suffix','houseNo','street','sex','employmentStatus','occupation','mobileNumber','birthDate']);
  v_first := barangayan_private.required_text(p_input,'firstName',200);
  v_last := barangayan_private.required_text(p_input,'lastName',200);
  if v_first !~ '^[A-Za-z[:space:]]+$' or v_last !~ '^[A-Za-z[:space:]]+$'
    or barangayan_private.required_text(p_input,'mobileNumber',11) !~ '^09[0-9]{9}$'
    or jsonb_typeof(p_input->'sex') is distinct from 'string' or p_input->>'sex' not in ('male','female')
    or jsonb_typeof(p_input->'employmentStatus') is distinct from 'string' or p_input->>'employmentStatus' not in ('employed','unemployed','student','self_employed','retired') then
    raise exception 'invalid_profile_fields' using errcode = '22023';
  end if;
  if barangayan_private.required_text(p_input,'birthDate',10) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid_birth_date' using errcode='22023'; end if;
  v_birth := (p_input->>'birthDate')::date;
  if v_birth > current_date then raise exception 'future_birth_date' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 1));
  select email into v_email from auth.users where id = v_uid and not coalesce(is_anonymous,false);
  if not found then raise exception 'resident_identity_required' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if found then
    if v_profile.role <> 'resident' or v_profile.deleted_at is not null then raise exception 'forbidden' using errcode = '42501'; end if;
    select * into v_locality from public.barangay_localities where barangay_id = v_profile.barangay_id;
  else
    if (select count(*) from public.barangay_localities where resident_registration_enabled) <> 1 then
      raise exception 'registration_locality_not_configured' using errcode = '22023';
    end if;
    select * into v_locality from public.barangay_localities where resident_registration_enabled;
  end if;
  if v_locality.barangay_id is null then raise exception 'registration_locality_not_configured' using errcode = '22023'; end if;
  insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,middle_name,suffix,house_no,street,city,province,
    sex,employment_status,occupation,mobile_number,birth_date,email,profile_completed_at)
  values(v_uid,v_locality.barangay_id,'resident',v_first || ' ' || v_last,v_first,v_last,
    barangayan_private.optional_text(p_input,'middleName',200),barangayan_private.optional_text(p_input,'suffix',50),
    barangayan_private.required_text(p_input,'houseNo',200),barangayan_private.required_text(p_input,'street',500),v_locality.city,v_locality.province,
    p_input->>'sex',p_input->>'employmentStatus',barangayan_private.optional_text(p_input,'occupation',200),
    p_input->>'mobileNumber',v_birth,v_email,clock_timestamp())
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,middle_name=excluded.middle_name,suffix=excluded.suffix,
    house_no=excluded.house_no,street=excluded.street,city=excluded.city,province=excluded.province,sex=excluded.sex,
    employment_status=excluded.employment_status,occupation=excluded.occupation,mobile_number=excluded.mobile_number,birth_date=excluded.birth_date,
    email=excluded.email,profile_completed_at=coalesce(public.profiles.profile_completed_at,excluded.profile_completed_at);
  return v_uid;
end $$;

create function barangayan_private.check_object(p_bucket text,p_path text,p_mime text default null,p_size integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare o storage.objects; v_size bigint;
begin
  select * into o from storage.objects where bucket_id=p_bucket and name=p_path for share;
  if not found then raise exception 'attachment_not_uploaded' using errcode = '22023'; end if;
  v_size := (o.metadata->>'size')::bigint;
  if v_size is null or v_size not between 1 and 5242880
    or (p_mime is not null and o.metadata->>'mimetype' is distinct from p_mime)
    or (p_size is not null and v_size <> p_size)
    or (p_bucket='id-documents' and coalesce(o.metadata->>'mimetype' not in ('image/jpeg','image/jpg','image/png','image/webp'),true)) then
    raise exception 'invalid_uploaded_file' using errcode = '22023';
  end if;
end $$;

create function barangayan_private.publish_id_submission(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_profile public.profiles; v_old public.id_submissions;
  v_id uuid; v_type text; v_front text; v_back text; v_prefix text; v_version integer;
begin
  v_actor := barangayan_private.assert_actor();
  perform barangayan_private.check_keys(p_input,array['submissionId','idType','frontPath','backPath']);
  v_id := barangayan_private.required_text(p_input,'submissionId',36)::uuid;
  v_type := barangayan_private.required_text(p_input,'idType',200);
  v_front := barangayan_private.required_text(p_input,'frontPath',500);
  v_back := barangayan_private.required_text(p_input,'backPath',500);
  v_prefix := v_actor.id::text || '/versions/' || v_id::text || '/';
  if v_front !~ ('^' || v_prefix || 'id-front\.(jpg|jpeg|png|webp)$') or v_back !~ ('^' || v_prefix || 'id-back\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_ID_version_path' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles where id=v_actor.id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_old from public.id_submissions where id=v_id;
  if found then
    if v_old.resident_id <> v_actor.id or v_old.id_type <> v_type or v_old.front_path <> v_front or v_old.back_path <> v_back then
      raise exception 'idempotency_conflict' using errcode='22023';
    end if;
    return v_id;
  end if;
  perform barangayan_private.check_object('id-documents',v_front);
  perform barangayan_private.check_object('id-documents',v_back);
  select coalesce(max(version),0)+1 into v_version from public.id_submissions where resident_id=v_actor.id;
  insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path)
  values(v_id,v_actor.id,v_actor.barangay_id,v_version,v_type,v_front,v_back);
  update public.profiles set current_id_submission_id=v_id,approved_id_submission_id=null,
    id_type=v_type,id_photo_urls=array[v_front,v_back],id_verification_status='pending' where id=v_actor.id;
  return v_id;
end $$;

create function barangayan_private.review_id_submission(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; p public.profiles; s public.id_submissions; v_id uuid; v_decision text; v_reason text;
begin
  a := barangayan_private.assert_actor(true);
  perform barangayan_private.check_keys(p_input,array['submissionId','decision','reason']);
  v_id := barangayan_private.required_text(p_input,'submissionId',36)::uuid;
  v_decision := barangayan_private.required_text(p_input,'decision',30);
  v_reason := barangayan_private.optional_text(p_input,'reason',1000);
  if v_decision not in ('verified','verification_failed','revoked') or (v_decision <> 'verified' and v_reason is null) then
    raise exception 'invalid_review_decision' using errcode='22023';
  end if;
  select * into s from public.id_submissions where id=v_id and barangay_id=a.barangay_id;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into p from public.profiles where id=s.resident_id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into s from public.id_submissions where id=v_id for update;
  if p.current_id_submission_id is distinct from v_id or
    (s.decision <> 'pending' and not (s.decision='verified' and v_decision='revoked')) then
    raise exception 'stale_or_repeated_ID_review' using errcode='22023';
  end if;
  update public.id_submissions set decision=v_decision,reviewed_by=a.id,reviewed_at=clock_timestamp(),rejection_reason=v_reason where id=v_id;
  update public.profiles set approved_id_submission_id=case when v_decision='verified' then v_id else null end,
    id_verification_status=case when v_decision='revoked' then 'verification_failed' else v_decision end where id=p.id;
  return v_id;
end $$;

create function barangayan_private.submit_service_request(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; p public.profiles; d public.document_types; s public.id_submissions; r public.service_requests;
  v_key uuid; v_doc uuid; v_purpose jsonb; v_details jsonb; v_files jsonb; f jsonb;
  v_explanation text; v_notes text; v_path text; v_mime text; v_size integer; v_request uuid := gen_random_uuid(); v_previous text;
begin
  a := barangayan_private.assert_actor();
  perform barangayan_private.check_keys(p_input,array['documentTypeId','idempotencyKey','purposeCode','purposeExplanation','requesterNotes','details','attachments']);
  v_key := barangayan_private.required_text(p_input,'idempotencyKey',36)::uuid;
  v_doc := barangayan_private.required_text(p_input,'documentTypeId',36)::uuid;
  -- Lock order is profile -> evidence -> request everywhere. This also serializes same-owner retries.
  select * into p from public.profiles where id=a.id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into r from public.service_requests where resident_id=a.id and idempotency_key=v_key;
  if found then
    if r.submission_payload is distinct from p_input then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return r.id;
  end if;
  select * into d from public.document_types where id=v_doc and barangay_id=a.barangay_id and is_active and deleted_at is null for share;
  if not found or d.contract_version <> 2 then raise exception 'service_contract_unavailable' using errcode='22023'; end if;
  select * into s from public.id_submissions where id=p.approved_id_submission_id and resident_id=a.id and barangay_id=a.barangay_id for share;
  if not found or s.decision <> 'verified' or p.id_verification_status <> 'verified' or p.current_id_submission_id is distinct from s.id or p.id_repair_required then
    raise exception 'current_approved_ID_required' using errcode='42501';
  end if;
  perform barangayan_private.check_object('id-documents',s.front_path);
  perform barangayan_private.check_object('id-documents',s.back_path);
  select value into v_purpose from jsonb_array_elements(d.purposes) where value->>'code'=barangayan_private.required_text(p_input,'purposeCode',100);
  if v_purpose is null then raise exception 'invalid_purpose' using errcode='22023'; end if;
  v_explanation := barangayan_private.optional_text(p_input,'purposeExplanation',1000);
  v_notes := barangayan_private.optional_text(p_input,'requesterNotes',1000);
  if coalesce((v_purpose->>'requiresExplanation')::boolean,false) <> (v_explanation is not null) then
    raise exception 'purpose_explanation_required_only_when_configured' using errcode='22023';
  end if;
  v_details := p_input->'details'; v_files := p_input->'attachments';
  perform barangayan_private.check_keys(v_details,array['businessName','establishmentAddress','isRenter','recordReference','copies','personalAppearanceAcknowledged']);
  if v_files is null or jsonb_typeof(v_files) <> 'array' or jsonb_array_length(v_files)>10 then raise exception 'invalid_attachments' using errcode='22023'; end if;
  if (v_details ? 'isRenter' and jsonb_typeof(v_details->'isRenter') <> 'boolean') or
     (v_details ? 'personalAppearanceAcknowledged' and jsonb_typeof(v_details->'personalAppearanceAcknowledged') <> 'boolean') then
    raise exception 'invalid_boolean_detail' using errcode='22023';
  end if;
  if d.service_kind='business' then
    perform barangayan_private.required_text(v_details,'businessName',200);
    perform barangayan_private.required_text(v_details,'establishmentAddress',1000);
  elsif v_details ?| array['businessName','establishmentAddress'] or exists(select 1 from jsonb_array_elements(v_files) x where x->>'requirementCode'='dti') then
    raise exception 'incompatible_business_fields' using errcode='22023';
  end if;
  if d.service_kind='certified_true_copy' then
    perform barangayan_private.required_text(v_details,'recordReference',1000);
    if jsonb_typeof(v_details->'copies') is distinct from 'number' or (v_details->>'copies')::numeric not between 1 and 1000 or
      (v_details->>'copies')::numeric <> trunc((v_details->>'copies')::numeric) then raise exception 'invalid_copies' using errcode='22023'; end if;
  elsif v_details ?| array['recordReference','copies'] then raise exception 'incompatible_record_fields' using errcode='22023'; end if;
  if d.service_kind not in ('indigency','first_time_job_seeker') and (v_details ? 'isRenter' or exists(select 1 from jsonb_array_elements(v_files) x where x->>'requirementCode' in ('hoa','lessor'))) then
    raise exception 'incompatible_residency_fields' using errcode='22023';
  end if;
  if coalesce((d.requirement_rules->>'personalAppearance')::boolean,false) and not coalesce((v_details->>'personalAppearanceAcknowledged')::boolean,false) then
    raise exception 'appearance_acknowledgment_required' using errcode='22023';
  end if;
  if (coalesce((d.requirement_rules->>'dtiRequired')::boolean,false) and not exists(select 1 from jsonb_array_elements(v_files) x where x->>'requirementCode'='dti')) or
     (coalesce((d.requirement_rules->>'hoaRequired')::boolean,false) and not exists(select 1 from jsonb_array_elements(v_files) x where x->>'requirementCode'='hoa')) or
     (coalesce((d.requirement_rules->>'lessorForRenter')::boolean,false) and coalesce((v_details->>'isRenter')::boolean,false) and not exists(select 1 from jsonb_array_elements(v_files) x where x->>'requirementCode'='lessor')) then
    raise exception 'supporting_requirement_missing' using errcode='22023';
  end if;
  for f in select value from jsonb_array_elements(v_files) loop
    perform barangayan_private.check_keys(f,array['requirementCode','path','mimeType','sizeBytes']);
    if f->>'requirementCode' not in ('dti','hoa','lessor','other') or not f ? 'requirementCode' then raise exception 'invalid_requirement_code' using errcode='22023'; end if;
    v_path := barangayan_private.required_text(f,'path',500);
    v_mime := barangayan_private.required_text(f,'mimeType',100);
    if v_path !~ ('^' || a.id::text || '/[0-9a-f-]{36}/[^/]+$') or v_mime not in ('image/jpeg','image/png','image/webp','application/pdf')
      or jsonb_typeof(f->'sizeBytes') is distinct from 'number' or (f->>'sizeBytes')::numeric <> trunc((f->>'sizeBytes')::numeric) then
      raise exception 'invalid_attachment' using errcode='22023';
    end if;
    v_size := (f->>'sizeBytes')::integer;
    if v_size not between 1 and 5242880 then raise exception 'invalid_attachment_size' using errcode='22023'; end if;
    perform barangayan_private.check_object('request-attachments',v_path,v_mime,v_size);
  end loop;
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','submit',true);
  insert into public.service_requests(id,barangay_id,resident_id,document_type_id,contract_version,idempotency_key,submission_payload,
    purpose_code,purpose_label,purpose_explanation,requester_notes,supporting_details,approved_id_submission_id,requirements_review_state,
    personal_appearance_required,pricing_mode_snapshot,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,
    timing_model,target_minutes_snapshot,sla_state)
  values(v_request,a.barangay_id,a.id,d.id,2,v_key,p_input,v_purpose->>'code',v_purpose->>'label',v_explanation,v_notes,v_details,s.id,'pending',
    coalesce((d.requirement_rules->>'personalAppearance')::boolean,false),d.pricing_mode,
    case when d.pricing_mode='fixed' then 'assessed' else 'pending' end,
    case when d.pricing_mode='fixed' then d.fee_centavos else null end,
    case when d.pricing_mode='fixed' then 'Configured fixed fee at submission' else null end,
    case when d.pricing_mode='fixed' then clock_timestamp() else null end,'agency_minutes_v1',d.processing_target_minutes,'pre_processing');
  for f in select value from jsonb_array_elements(v_files) loop
    insert into public.request_attachments(request_id,resident_id,barangay_id,requirement_code,object_path,mime_type,size_bytes)
    values(v_request,a.id,a.barangay_id,f->>'requirementCode',f->>'path',f->>'mimeType',(f->>'sizeBytes')::integer);
  end loop;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  return v_request;
end $$;

create function barangayan_private.assess_service_request_fee(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; r public.service_requests; v_id uuid; v_state text; v_amount integer; v_basis text; v_pages integer; v_previous text;
begin
  a := barangayan_private.assert_actor(true);
  perform barangayan_private.check_keys(p_input,array['requestId','state','amountCentavos','basis','billablePages']);
  v_id := barangayan_private.required_text(p_input,'requestId',36)::uuid;
  v_state := barangayan_private.required_text(p_input,'state',20);
  v_basis := barangayan_private.required_text(p_input,'basis',1000);
  if v_state not in ('assessed','waived') or jsonb_typeof(p_input->'amountCentavos') is distinct from 'number' or
    (p_input->>'amountCentavos')::numeric <> trunc((p_input->>'amountCentavos')::numeric) then raise exception 'invalid_assessment' using errcode='22023'; end if;
  v_amount := (p_input->>'amountCentavos')::integer;
  if v_amount < 0 or (v_state='waived' and v_amount <> 0) then raise exception 'invalid_assessment_amount' using errcode='22023'; end if;
  select * into r from public.service_requests where id=v_id and barangay_id=a.barangay_id and contract_version=2 and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if r.status in ('cancelled','completed') or r.payment_status='paid' or exists(select 1 from public.payments where service_request_id=r.id) then
    raise exception 'assessment_locked_after_payment_begins' using errcode='22023';
  end if;
  if p_input ? 'billablePages' then
    if jsonb_typeof(p_input->'billablePages') <> 'number' or (p_input->>'billablePages')::numeric <> trunc((p_input->>'billablePages')::numeric) then raise exception 'invalid_billable_pages' using errcode='22023'; end if;
    v_pages := (p_input->>'billablePages')::integer;
    if v_pages <= 0 then raise exception 'invalid_billable_pages' using errcode='22023'; end if;
  end if;
  if r.pricing_mode_snapshot='per_page' and v_state='assessed' and (v_pages is null or v_amount::bigint <> v_pages::bigint * 1000) then
    raise exception 'amount_requires_total_confirmed_pages' using errcode='22023';
  end if;
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','assessment',true);
  update public.service_requests set fee_assessment_state=v_state,assessed_amount_centavos=v_amount,fee_basis=v_basis,
    fee_assessed_by=a.id,fee_assessed_at=clock_timestamp(),billable_pages=v_pages,
    payment_status=case when v_state='waived' then 'waived' else 'pending' end where id=r.id;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  return r.id;
end $$;

create function barangayan_private.transition_service_request_sla(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; r public.service_requests; v_id uuid; v_action text; v_reason text; v_at timestamptz;
  v_previous text; v_completion text; v_status_note text;
begin
  perform barangayan_private.check_keys(p_input,array['requestId','action','reason','requirementsComplete','personalAppearanceReady']);
  v_id := barangayan_private.required_text(p_input,'requestId',36)::uuid;
  v_action := barangayan_private.required_text(p_input,'action',20);
  v_reason := barangayan_private.optional_text(p_input,'reason',1000);
  a := barangayan_private.assert_actor(public.current_role() = 'admin');
  if a.role <> 'admin' and v_action <> 'cancel' then raise exception 'forbidden' using errcode='42501'; end if;
  if (p_input ? 'requirementsComplete' and jsonb_typeof(p_input->'requirementsComplete') <> 'boolean') or
    (p_input ? 'personalAppearanceReady' and jsonb_typeof(p_input->'personalAppearanceReady') <> 'boolean') then raise exception 'invalid_readiness_confirmation' using errcode='22023'; end if;
  select * into r from public.service_requests where id=v_id and barangay_id=a.barangay_id and contract_version=2 and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if a.role = 'resident' and (r.resident_id <> a.id or r.status in ('ready_for_pickup','completed','cancelled') or r.payment_status='paid') then
    raise exception 'request_cannot_be_self_cancelled' using errcode='42501';
  end if;
  v_at := clock_timestamp();
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','sla',true);
  v_status_note := current_setting('barangayan.status_note',true);
  perform set_config('barangayan.status_note',coalesce(v_reason,'SLA ' || v_action),true);
  if v_action='accept' and r.sla_state='pre_processing' then
    if not coalesce((p_input->>'requirementsComplete')::boolean,false) or
      (r.personal_appearance_required and not coalesce((p_input->>'personalAppearanceReady')::boolean,false)) then
      raise exception 'complete_requirements_and_appearance_required' using errcode='22023';
    end if;
    update public.service_requests set requirements_review_state='complete',accepted_at=v_at,sla_state='running',status='in_progress',
      personal_appearance_at=case when r.personal_appearance_required then v_at else null end where id=r.id;
  elsif v_action='pause' and r.sla_state='running' then
    if v_reason is null then raise exception 'resident_wait_reason_required' using errcode='22023'; end if;
    insert into public.service_request_pauses(request_id,reason,started_by,started_at) values(r.id,v_reason,a.id,v_at);
    update public.service_requests set sla_state='paused' where id=r.id;
  elsif v_action='resume' and r.sla_state='paused' then
    update public.service_request_pauses set resumed_by=a.id,resumed_at=v_at where request_id=r.id and resumed_at is null;
    if not found then raise exception 'open_pause_required' using errcode='22023'; end if;
    update public.service_requests set sla_state='running' where id=r.id;
  elsif v_action='ready' and r.sla_state='running' then
    update public.service_requests set sla_state='ready',ready_at=v_at,status='ready_for_pickup' where id=r.id;
  elsif v_action='release' and r.sla_state='ready' then
    if r.payment_status not in ('paid','waived') and not (r.fee_assessment_state='assessed' and r.assessed_amount_centavos=0) then
      raise exception 'confirmed_payment_or_waiver_required' using errcode='22023';
    end if;
    v_completion := current_setting('barangayan.allow_request_completion',true);
    perform set_config('barangayan.allow_request_completion','true',true);
    update public.service_requests set sla_state='released',released_at=v_at,status='completed' where id=r.id;
    perform set_config('barangayan.allow_request_completion',coalesce(v_completion,''),true);
  elsif v_action='cancel' and r.sla_state in ('pre_processing','running','paused','ready') then
    if v_reason is null then raise exception 'cancellation_reason_required' using errcode='22023'; end if;
    update public.service_request_pauses set resumed_by=a.id,resumed_at=v_at where request_id=r.id and resumed_at is null;
    update public.service_requests set sla_state='cancelled',cancelled_at=v_at,status='cancelled' where id=r.id;
  else raise exception 'invalid_SLA_transition' using errcode='22023'; end if;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  perform set_config('barangayan.status_note',coalesce(v_status_note,''),true);
  return r.id;
end $$;

-- Preserve the existing resident cancellation RPC as catalogs later adopt v2.
create or replace function public.cancel_own_service_request(p_request_id uuid,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.service_requests;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into r from public.service_requests where id=p_request_id and resident_id=auth.uid() for update;
  if not found then raise exception 'request_not_found' using errcode='42501'; end if;
  if r.contract_version=2 then
    perform barangayan_private.transition_service_request_sla(jsonb_build_object('requestId',r.id,'action','cancel','reason',coalesce(nullif(btrim(p_note),''),'Cancelled by resident')));
    return;
  end if;
  if r.status in ('ready_for_pickup','completed','cancelled') then raise exception 'this request can no longer be cancelled'; end if;
  if r.payment_status='paid' then raise exception 'a paid request cannot be self-cancelled; contact the barangay office'; end if;
  perform set_config('barangayan.status_note',coalesce(p_note,'Cancelled by resident'),true);
  update public.service_requests set status='cancelled' where id=r.id;
end $$;

create function barangayan_private.guard_catalog_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb; k text;
begin
  if new.contract_version = 1 then return new; end if;
  perform barangayan_private.check_keys(new.charter,array['officeDivision','classification','transactionType','whoMayAvail','checklistOfRequirements',
    'whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime','personResponsible']);
  foreach k in array array['officeDivision','whoMayAvail','checklistOfRequirements','whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime'] loop
    perform barangayan_private.required_text(new.charter,k,10000);
  end loop;
  if new.charter->>'classification' is distinct from 'Simple' or new.charter->>'transactionType' is distinct from 'G2C'
    or not new.charter ? 'personResponsible' then raise exception 'invalid_charter' using errcode='22023'; end if;
  if new.charter->'personResponsible' <> 'null'::jsonb then perform barangayan_private.required_text(new.charter,'personResponsible',10000); end if;
  perform barangayan_private.check_keys(new.requirement_rules,array['dtiRequired','hoaRequired','lessorForRenter','personalAppearance']);
  foreach k in array array['dtiRequired','hoaRequired','lessorForRenter','personalAppearance'] loop
    if jsonb_typeof(new.requirement_rules->k) is distinct from 'boolean' then raise exception 'invalid_requirement_rules' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(new.purposes) is distinct from 'array' or jsonb_array_length(new.purposes) not between 1 and 30 then raise exception 'invalid_purposes' using errcode='22023'; end if;
  for p in select value from jsonb_array_elements(new.purposes) loop
    perform barangayan_private.check_keys(p,array['code','label','requiresExplanation']);
    if barangayan_private.required_text(p,'code',100) !~ '^[a-z0-9_]+$' or jsonb_typeof(p->'requiresExplanation') is distinct from 'boolean' then raise exception 'invalid_purpose_option' using errcode='22023'; end if;
    perform barangayan_private.required_text(p,'label',200);
  end loop;
  if (select count(*) from jsonb_array_elements(new.purposes)) <> (select count(distinct value->>'code') from jsonb_array_elements(new.purposes)) then raise exception 'duplicate_purpose_codes' using errcode='22023'; end if;
  return new;
end $$;
create trigger guard_catalog_contract before insert or update on public.document_types
for each row execute function barangayan_private.guard_catalog_contract();

create function public.complete_resident_profile(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.complete_resident_profile(p_input) $$;
create function public.publish_id_submission(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.publish_id_submission(p_input) $$;
create function public.review_id_submission(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.review_id_submission(p_input) $$;
create function public.submit_service_request(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.submit_service_request(p_input) $$;
create function public.assess_service_request_fee(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.assess_service_request_fee(p_input) $$;
create function public.transition_service_request_sla(p_input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select barangayan_private.transition_service_request_sla(p_input) $$;
revoke all on function public.cancel_own_service_request(uuid,text) from public,anon;
grant execute on function public.cancel_own_service_request(uuid,text) to authenticated;
revoke all on all functions in schema barangayan_private from public, anon, authenticated;
grant execute on function barangayan_private.complete_resident_profile(jsonb),barangayan_private.publish_id_submission(jsonb),
  barangayan_private.review_id_submission(jsonb),barangayan_private.submit_service_request(jsonb),
  barangayan_private.assess_service_request_fee(jsonb),barangayan_private.transition_service_request_sla(jsonb) to authenticated;
revoke all on function public.complete_resident_profile(jsonb),public.publish_id_submission(jsonb),public.review_id_submission(jsonb),
  public.submit_service_request(jsonb),public.assess_service_request_fee(jsonb),public.transition_service_request_sla(jsonb) from public, anon;
grant execute on function public.complete_resident_profile(jsonb),public.publish_id_submission(jsonb),public.review_id_submission(jsonb),
  public.submit_service_request(jsonb),public.assess_service_request_fee(jsonb),public.transition_service_request_sla(jsonb) to authenticated;
grant all on public.barangay_localities,public.id_submissions,public.request_attachments,public.service_request_pauses to service_role;
comment on column public.document_types.contract_version is '1 retains existing consumers. Activate 2 only with catalog and resident/admin consumer rollout; Phase 1 does not activate services.';
comment on column public.service_requests.timing_model is 'Historical rows keep legacy_hours; agency_minutes_v1 starts only at formal acceptance. No historical clock is rewritten.';
comment on column public.service_requests.submission_payload is 'Immutable original input for same-owner, same-key retry reconciliation. Contains no identity or tenant supplied by the caller.';
commit;
