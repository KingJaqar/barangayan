-- Restore automatic fees after hosted schema drift left the earlier request functions active.
-- Keep this standalone so both an intact 0125 installation and the drifted schema can recover.
-- Preserve 0118 front-only approved IDs; never relax resident or tenant authorization.
begin;
-- Fees are computed by the server at submission. No request review or assessment queue.
alter table public.service_requests drop constraint service_requests_fee_assessment_state_check;
alter table public.service_requests add constraint service_requests_fee_assessment_state_check
  check (fee_assessment_state in ('legacy','assessed','waived','pickup_due','page_count_required')) not valid;
alter table public.service_requests drop constraint service_requests_assessment_shape;
alter table public.service_requests add constraint service_requests_assessment_shape check (
  fee_assessment_state='legacy' or
  (fee_assessment_state='page_count_required' and assessed_amount_centavos is null) or
  (fee_assessment_state='pickup_due' and assessed_amount_centavos is null and fee_basis is not null) or
  (fee_assessment_state in ('assessed','waived') and assessed_amount_centavos is not null
    and fee_basis is not null and fee_assessed_at is not null
    and (fee_assessment_state<>'waived' or assessed_amount_centavos=0))) not valid;
create or replace function barangayan_private.guard_catalog_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb; k text; previous_operation text;
begin
  if tg_op='UPDATE' and old.contract_version=2 and new.contract_version<>2 then raise exception 'immutable_catalog_contract' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.contract_version=2 and new.service_kind is distinct from old.service_kind then
    raise exception 'immutable_service_workflow' using errcode='42501';
  end if;
  if new.contract_version = 1 then return new; end if;
  if length(btrim(new.name)) not between 1 and 200 or length(coalesce(new.description,'')) > 2000 then
    raise exception 'invalid_document_identity' using errcode='22023';
  end if;
  if tg_op='UPDATE' then
    previous_operation := current_setting('barangayan.foundation_operation',true);
    perform set_config('barangayan.foundation_operation','catalog_snapshot',true);
    update public.service_requests set legacy_fee_centavos=old.fee_centavos
    where document_type_id=old.id and contract_version=1 and legacy_fee_centavos is null;
    perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
  end if;
  perform barangayan_private.check_keys(new.charter,array['officeDivision','classification','transactionType','whoMayAvail','checklistOfRequirements',
    'whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime','personResponsible']);
  foreach k in array array['officeDivision','whoMayAvail','checklistOfRequirements','whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime'] loop
    perform barangayan_private.required_text(new.charter,k,10000);
  end loop;
  perform barangayan_private.required_text(new.charter,'classification',200);
  perform barangayan_private.required_text(new.charter,'transactionType',200);
  if not new.charter ? 'personResponsible' then raise exception 'invalid_charter' using errcode='22023'; end if;
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
  if (new.pricing_mode='per_page' and (new.service_kind<>'certified_true_copy' or new.fee_centavos<>1000)) or
    ((new.requirement_rules->>'dtiRequired')::boolean and new.service_kind<>'business') or
    (((new.requirement_rules->>'hoaRequired')::boolean or (new.requirement_rules->>'lessorForRenter')::boolean) and new.service_kind not in ('indigency','first_time_job_seeker')) then
    raise exception 'incompatible_catalog_rules_or_page_rate' using errcode='22023';
  end if;
  if new.service_kind='business' then
    new.pricing_mode := 'assessment'; new.fee_centavos := 0;
    new.charter := jsonb_set(new.charter,'{feesToBePaid}',to_jsonb('See Attached Tax Code (depends on the kind of transaction)'::text));
  elsif new.service_kind in ('indigency','first_time_job_seeker') then
    new.pricing_mode := 'fixed'; new.fee_centavos := 10000;
    new.charter := jsonb_set(new.charter,'{feesToBePaid}',to_jsonb('₱100.00'::text));
  elsif new.service_kind='certified_true_copy' then
    new.pricing_mode := 'per_page'; new.fee_centavos := 1000;
    new.charter := jsonb_set(new.charter,'{feesToBePaid}',to_jsonb('₱10.00 per page'::text));
  end if;
  return new;
end $$;

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
  if s.back_path is not null then perform barangayan_private.check_object('id-documents',s.back_path); end if;
  select value into v_purpose from jsonb_array_elements(d.purposes) where value->>'code'=barangayan_private.required_text(p_input,'purposeCode',100);
  if v_purpose is null then raise exception 'invalid_purpose' using errcode='22023'; end if;
  v_explanation := barangayan_private.optional_text(p_input,'purposeExplanation',1000);
  v_notes := barangayan_private.optional_text(p_input,'requesterNotes',1000);
  if coalesce((v_purpose->>'requiresExplanation')::boolean,false) <> (v_explanation is not null) then
    raise exception 'purpose_explanation_required_only_when_configured' using errcode='22023';
  end if;
  v_details := p_input->'details'; v_files := p_input->'attachments';
  perform barangayan_private.check_keys(v_details,array['businessName','establishmentAddress','isRenter','recordReference','copies','totalPages','personalAppearanceAcknowledged']);
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
    if jsonb_typeof(v_details->'totalPages') is distinct from 'number' or (v_details->>'totalPages')::numeric not between 1 and 1000000 or (v_details->>'totalPages')::numeric <> trunc((v_details->>'totalPages')::numeric) then raise exception 'invalid_total_pages' using errcode='22023'; end if;
  elsif v_details ?| array['recordReference','copies','totalPages'] then raise exception 'incompatible_record_fields' using errcode='22023'; end if;
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
    personal_appearance_required,pricing_mode_snapshot,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,billable_pages,eligibility_state,
    timing_model,target_minutes_snapshot,sla_state)
  values(v_request,a.barangay_id,a.id,d.id,2,v_key,p_input,v_purpose->>'code',v_purpose->>'label',v_explanation,v_notes,v_details,s.id,'complete',
    coalesce((d.requirement_rules->>'personalAppearance')::boolean,false),d.pricing_mode,
    case when d.service_kind='business' then 'pickup_due' else 'assessed' end,
    case when d.service_kind='business' then null when d.service_kind in ('indigency','first_time_job_seeker') then 10000 when d.service_kind='certified_true_copy' then (v_details->>'totalPages')::integer * 1000 else d.fee_centavos end,
    case when d.service_kind='business' then 'See Attached Tax Code (depends on the kind of transaction)' when d.service_kind='certified_true_copy' then '₱10.00 per page' else 'Configured fee at submission' end,
    clock_timestamp(),case when d.service_kind='certified_true_copy' then (v_details->>'totalPages')::integer end,'eligible','agency_minutes_v1',d.processing_target_minutes,'pre_processing');
  for f in select value from jsonb_array_elements(v_files) loop
    insert into public.request_attachments(request_id,resident_id,barangay_id,requirement_code,object_path,mime_type,size_bytes)
    values(v_request,a.id,a.barangay_id,f->>'requirementCode',f->>'path',f->>'mimeType',(f->>'sizeBytes')::integer);
  end loop;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  return v_request;
end $$;
create or replace function barangayan_private.set_request_payment_method(p_request_id uuid,p_method text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.profiles; r public.service_requests;
begin
  a := barangayan_private.assert_actor();
  if p_method not in ('pickup','qrph') or p_method is null then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  select * into r from public.service_requests where id=p_request_id and resident_id=a.id and barangay_id=a.barangay_id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_method='qrph' and exists(select 1 from public.document_types where id=r.document_type_id and service_kind='business') then raise exception 'pickup_only_document' using errcode='22023'; end if;
  if r.contract_version=2 and not (p_method='pickup' and r.fee_assessment_state='pickup_due') and (r.fee_assessment_state<>'assessed' or coalesce(r.assessed_amount_centavos,0)<=0) then raise exception 'request_amount_unavailable' using errcode='22023'; end if;
  if r.payment_method=p_method then return; end if;
  if r.status in ('cancelled','completed') or r.payment_status in ('paid','waived') or exists(
    select 1 from public.payments where service_request_id=r.id and status in ('pending','paid')) then
    raise exception 'payment_method_locked' using errcode='22023';
  end if;
  update public.service_requests set payment_method=p_method where id=r.id;
end $$;
create or replace function barangayan_private.pickup_payment(p_request_id uuid,p_collect boolean) returns uuid
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
  -- A variable tax-code fee is collected at pickup. Never create a zero-value ledger entry.
  if r.fee_assessment_state='pickup_due' and not p_collect and r.payment_method='pickup' and r.status not in ('cancelled','completed') then return r.id; end if;
  if r.contract_version=2 then
    if r.fee_assessment_state<>'assessed' or coalesce(r.assessed_amount_centavos,0)<=0 or r.payment_method is distinct from 'pickup' then
      raise exception 'request_amount_unavailable' using errcode='22023';
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
create or replace function barangayan_private.transition_service_request_sla(p_input jsonb) returns uuid
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
    update public.service_requests set requirements_review_state='complete',accepted_at=v_at,sla_state='running',status='in_progress',
      personal_appearance_at=r.personal_appearance_at where id=r.id;
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
create or replace function barangayan_private.guard_payment_foundations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = new.service_request_id for update;
  if tg_op='INSERT' and new.method='qrph' and exists(select 1 from public.document_types where id=r.document_type_id and service_kind='business') then raise exception 'pickup_only_document' using errcode='22023'; end if;
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

update public.document_types set charter=charter,
  description=replace(replace(replace(replace(description,
    'Staff assess fees using the applicable tax code.', 'Pay the applicable tax-code fee at pickup.'),
    'Staff confirm eligibility, six-month residency and the applicable fee or exemption.', 'Document fee: ₱100.00.'),
    'Staff confirm eligibility and the applicable exemption.', 'Document fee: ₱100.00.'),
    '₱10 per total billable page confirmed by staff across all requested copies.', '₱10.00 per page across all requested copies.')
where contract_version=2
  and service_kind in ('business','indigency','first_time_job_seeker','certified_true_copy');
select set_config('barangayan.foundation_operation','assessment',true);
update public.service_requests r set
  requirements_review_state='complete', eligibility_state='eligible',
  fee_assessment_state=case when d.service_kind='business' then 'pickup_due'
    when d.service_kind='certified_true_copy' and r.billable_pages is null then 'page_count_required' else 'assessed' end,
  assessed_amount_centavos=case when d.service_kind='business' then null
    when d.service_kind in ('indigency','first_time_job_seeker') then 10000
    when d.service_kind='certified_true_copy' then r.billable_pages * 1000 else d.fee_centavos end,
  fee_basis=case when d.service_kind='business' then 'See Attached Tax Code (depends on the kind of transaction)'
    when d.service_kind='certified_true_copy' then '₱10.00 per page' else 'Configured fee at submission' end,
  fee_assessed_by=null, fee_assessed_at=clock_timestamp()
from public.document_types d where r.document_type_id=d.id and r.contract_version=2
  and (r.fee_assessment_state='pending' or (r.status not in ('completed','cancelled') and r.payment_status='pending'
  and not exists(select 1 from public.payments p where p.service_request_id=r.id)));
select set_config('barangayan.foundation_operation','',true);

-- Old uncharged copy requests did not capture pages. The resident supplies them directly.
create or replace function barangayan_private.set_service_request_pages(p_request_id uuid,p_total_pages integer) returns void
language plpgsql security definer set search_path='' as $$
declare a public.profiles; r public.service_requests; previous_operation text;
begin
  a := barangayan_private.assert_actor();
  if p_total_pages is null or p_total_pages not between 1 and 1000000 then raise exception 'invalid_total_pages' using errcode='22023'; end if;
  select * into r from public.service_requests where id=p_request_id and resident_id=a.id and barangay_id=a.barangay_id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if r.fee_assessment_state<>'page_count_required' or r.status in ('completed','cancelled') or r.payment_status<>'pending'
    or exists(select 1 from public.payments where service_request_id=r.id and status in ('pending','paid')) then raise exception 'page_count_locked' using errcode='22023'; end if;
  previous_operation := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','assessment',true);
  update public.service_requests set billable_pages=p_total_pages,assessed_amount_centavos=p_total_pages*1000,
    fee_assessment_state='assessed',fee_basis='₱10.00 per page',fee_assessed_at=clock_timestamp() where id=r.id;
  perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
end $$;
create or replace function public.set_service_request_pages(p_request_id uuid,p_total_pages integer) returns void
language sql security invoker set search_path='' as $$ select barangayan_private.set_service_request_pages(p_request_id,p_total_pages) $$;

-- Cash collection records the actual tax-code amount, without a pre-payment review.
create or replace function barangayan_private.collect_tax_code_pickup_payment(p_request_id uuid,p_amount_centavos integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.profiles; r public.service_requests; previous_operation text; payment_id uuid;
begin
  a := barangayan_private.assert_actor(true);
  select * into r from public.service_requests where id=p_request_id and barangay_id=a.barangay_id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select id into payment_id from public.payments where service_request_id=r.id and status='paid' and method='pickup';
  if found then return payment_id; end if;
  if r.fee_assessment_state<>'pickup_due' or r.payment_method is distinct from 'pickup' or r.status<>'ready_for_pickup'
    or p_amount_centavos is null or p_amount_centavos<=0 then raise exception 'invalid_pickup_collection' using errcode='22023'; end if;
  previous_operation := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','assessment',true);
  update public.service_requests set fee_assessment_state='assessed',assessed_amount_centavos=p_amount_centavos,
    fee_assessed_at=clock_timestamp() where id=r.id;
  perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
  return barangayan_private.pickup_payment(r.id,true);
end $$;
create or replace function public.collect_tax_code_pickup_payment(p_request_id uuid,p_amount_centavos integer) returns uuid
language sql security invoker set search_path='' as $$ select barangayan_private.collect_tax_code_pickup_payment(p_request_id,p_amount_centavos) $$;

-- Retire request review and staff fee overrides; retain callable signatures for old clients.
create or replace function barangayan_private.assess_service_request_fee(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.profiles;
begin
  a := barangayan_private.assert_actor(true);
  perform 1 from public.service_requests where id=(p_input->>'requestId')::uuid and barangay_id=a.barangay_id and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  raise exception 'request_fees_are_automatic' using errcode='22023';
end $$;
create or replace function barangayan_private.review_service_request(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.profiles;
begin
  a := barangayan_private.assert_actor(true);
  perform 1 from public.service_requests where id=(p_input->>'requestId')::uuid and barangay_id=a.barangay_id and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  raise exception 'request_review_removed' using errcode='22023';
end $$;
revoke all on function barangayan_private.set_service_request_pages(uuid,integer),public.set_service_request_pages(uuid,integer),
  barangayan_private.collect_tax_code_pickup_payment(uuid,integer),public.collect_tax_code_pickup_payment(uuid,integer) from public,anon;
grant execute on function barangayan_private.set_service_request_pages(uuid,integer),public.set_service_request_pages(uuid,integer),
  barangayan_private.collect_tax_code_pickup_payment(uuid,integer),public.collect_tax_code_pickup_payment(uuid,integer) to authenticated;
alter table public.service_requests validate constraint service_requests_fee_assessment_state_check;
alter table public.service_requests validate constraint service_requests_assessment_shape;
notify pgrst,'reload schema';
commit;
