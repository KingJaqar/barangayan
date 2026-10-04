begin;
create table barangayan_private.legacy_submission_keys (
  resident_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  request_id uuid not null unique references public.service_requests(id),
  payload jsonb not null,
  primary key(resident_id,idempotency_key)
);
alter table barangayan_private.legacy_submission_keys enable row level security;
revoke all on barangayan_private.legacy_submission_keys from public,anon,authenticated;

create function barangayan_private.set_request_payment_method(p_request_id uuid,p_method text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.profiles; r public.service_requests;
begin
  a := barangayan_private.assert_actor();
  if p_method not in ('pickup','qrph') or p_method is null then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  select * into r from public.service_requests where id=p_request_id and resident_id=a.id and barangay_id=a.barangay_id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if r.contract_version=2 and (r.fee_assessment_state<>'assessed' or coalesce(r.assessed_amount_centavos,0)<=0) then raise exception 'confirmed_payable_amount_required' using errcode='22023'; end if;
  if r.payment_method=p_method then return; end if;
  if r.status in ('cancelled','completed') or r.payment_status in ('paid','waived') or exists(
    select 1 from public.payments where service_request_id=r.id and status in ('pending','paid')) then
    raise exception 'payment_method_locked' using errcode='22023';
  end if;
  update public.service_requests set payment_method=p_method where id=r.id;
end $$;
create or replace function public.set_service_request_payment_method(p_request_id uuid,p_method text) returns void
language sql security invoker set search_path='' as $$ select barangayan_private.set_request_payment_method(p_request_id,p_method) $$;
revoke all on function public.set_service_request_payment_method(uuid,text),barangayan_private.set_request_payment_method(uuid,text) from public,anon;
grant execute on function public.set_service_request_payment_method(uuid,text),barangayan_private.set_request_payment_method(uuid,text) to authenticated;

create function barangayan_private.pickup_payment(p_request_id uuid,p_collect boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.profiles; r public.service_requests; p public.payments; v_amount integer;
begin
  a := barangayan_private.assert_actor(p_collect);
  select * into r from public.service_requests where id=p_request_id and barangay_id=a.barangay_id and deleted_at is null
    and (p_collect or resident_id=a.id) for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into p from public.payments where service_request_id=r.id and status in ('pending','paid') order by created_at desc limit 1 for update;
  if found and p.method<>'pickup' then raise exception 'active_online_payment_exists' using errcode='22023'; end if;
  if p.status='paid' then return p.id; end if;
  if r.contract_version=2 then
    if r.fee_assessment_state<>'assessed' or coalesce(r.assessed_amount_centavos,0)<=0 or r.payment_method is distinct from 'pickup' then
      raise exception 'confirmed_pickup_amount_required' using errcode='22023';
    end if;
    v_amount := r.assessed_amount_centavos;
  else
    select coalesce(p.document_fee_centavos,p.amount_centavos,r.legacy_fee_centavos,d.fee_centavos) into v_amount from public.document_types d where id=r.document_type_id;
  end if;
  if r.status='cancelled' or r.payment_status in ('paid','waived') or v_amount<=0 or (r.status='completed' and not p_collect) then
    raise exception 'request_not_payable' using errcode='22023';
  end if;
  if p_collect and r.contract_version=2 and r.status<>'ready_for_pickup' then raise exception 'pickup_document_not_ready' using errcode='22023'; end if;
  if p.id is null then
    insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status)
    values(r.id,r.barangay_id,'pickup',v_amount,v_amount,'pending') returning * into p;
  end if;
  if p_collect then update public.payments set status='paid',paid_at=clock_timestamp(),collected_by=a.id where id=p.id; end if;
  return p.id;
end $$;
create function public.start_pickup_payment(p_request_id uuid) returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.pickup_payment(p_request_id,false) $$;
create function public.collect_pickup_payment(p_request_id uuid) returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.pickup_payment(p_request_id,true) $$;
revoke all on function barangayan_private.pickup_payment(uuid,boolean),public.start_pickup_payment(uuid),public.collect_pickup_payment(uuid) from public,anon,authenticated;
-- Boolean collection authority is still derived inside assert_actor; API wrappers
-- never accept amount, tenant, collector or resident identity.
grant execute on function barangayan_private.pickup_payment(uuid,boolean),public.start_pickup_payment(uuid),public.collect_pickup_payment(uuid) to authenticated;

create or replace function barangayan_private.submit_service_request(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; p public.profiles; d public.document_types; s public.id_submissions; r public.service_requests;
  v_key uuid; v_doc uuid; v_purpose jsonb; v_details jsonb; v_files jsonb; f jsonb;
  v_explanation text; v_notes text; v_path text; v_mime text; v_size integer; v_request uuid := gen_random_uuid(); v_previous text;
begin
  a := barangayan_private.assert_actor();
  perform barangayan_private.check_keys(p_input,array['documentTypeId','idempotencyKey','purposeCode','purposeExplanation','requesterNotes','details','attachments','legacyIdPath']);
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
  select request_id into v_request from barangayan_private.legacy_submission_keys where resident_id=a.id and idempotency_key=v_key;
  if found then
    if (select payload from barangayan_private.legacy_submission_keys where resident_id=a.id and idempotency_key=v_key) is distinct from p_input then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return v_request;
  end if;
  v_request := gen_random_uuid();
  select * into d from public.document_types where id=v_doc and barangay_id=a.barangay_id and is_active and deleted_at is null for share;
  if not found then raise exception 'service_contract_unavailable' using errcode='22023'; end if;
  if d.contract_version=1 then
    if p_input->>'purposeCode'<>'legacy' or p_input->'details' is distinct from '{}'::jsonb or p_input->'attachments' is distinct from '[]'::jsonb or p_input ? 'purposeExplanation' then
      raise exception 'invalid_legacy_submission' using errcode='22023';
    end if;
    v_notes := barangayan_private.optional_text(p_input,'requesterNotes',1000);
    v_path := barangayan_private.optional_text(p_input,'legacyIdPath',500);
    if v_path is not null then
      if left(v_path,length(a.id::text)+1)<>a.id::text || '/' then raise exception 'invalid_ID_owner' using errcode='42501'; end if;
      perform barangayan_private.check_object('id-documents',v_path);
    end if;
    insert into public.service_requests(id,barangay_id,resident_id,document_type_id,requester_notes,id_document_path,legacy_fee_centavos)
    values(v_request,a.barangay_id,a.id,d.id,v_notes,v_path,d.fee_centavos);
    insert into barangayan_private.legacy_submission_keys values(a.id,v_key,v_request,p_input);
    return v_request;
  end if;
  if p_input ? 'legacyIdPath' then raise exception 'use_approved_profile_ID' using errcode='22023'; end if;
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
create or replace function barangayan_private.guard_request_foundations() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_doc public.document_types; v_res public.profiles; v_operation text := current_setting('barangayan.foundation_operation',true);
begin
  if tg_op='INSERT' and current_user in ('authenticated','anon') and new.legacy_fee_centavos is not null then raise exception 'server_fee_snapshot_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and new.legacy_fee_centavos is distinct from old.legacy_fee_centavos then
    raise exception 'immutable_legacy_fee_snapshot' using errcode='42501';
  end if;
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
    if current_user in ('authenticated','anon') and new.payment_status is distinct from old.payment_status then raise exception 'use_payment_ledger_operations' using errcode='42501'; end if;
    if new.payment_method is distinct from old.payment_method and exists(select 1 from public.payments where service_request_id=old.id and status in ('pending','paid')) then raise exception 'payment_method_locked' using errcode='22023'; end if;
    if (to_jsonb(new) - array['updated_at','payment_method','payment_status','deleted_at']) is distinct from
       (to_jsonb(old) - array['updated_at','payment_method','payment_status','deleted_at'])
       and (coalesce(v_operation,'') not in ('assessment','sla','review') or current_user in ('authenticated','anon')) then
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
commit;
