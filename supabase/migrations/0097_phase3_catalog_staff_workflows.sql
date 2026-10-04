-- Phase 3: source-preserving pilot catalog and audited staff review.
begin;
alter table public.service_requests
  add column legacy_fee_centavos integer check (legacy_fee_centavos >= 0),
  add column eligibility_state text not null default 'pending' check (eligibility_state in ('pending','eligible','ineligible')),
  add column requirements_reviewed_by uuid references public.profiles(id),
  add column requirements_reviewed_at timestamptz,
  add column requirements_review_note text check (length(btrim(requirements_review_note)) between 1 and 1000),
  add column personal_appearance_recorded_by uuid references public.profiles(id),
  add constraint request_review_audit check (
    (requirements_reviewed_by is null and requirements_reviewed_at is null and requirements_review_note is null)
    or (requirements_reviewed_by is not null and requirements_reviewed_at is not null and requirements_review_note is not null));

-- Preserve unpaid historical pricing before any equivalent catalog fee changes.
-- Timestamp-only trigger is suspended inside this atomic migration, so adding a
-- snapshot cannot rewrite the original request's last-change history.
alter table public.service_requests disable trigger set_service_requests_updated_at;
update public.service_requests r set legacy_fee_centavos=d.fee_centavos
from public.document_types d,public.barangay_localities l,public.barangays b
where r.document_type_id=d.id and r.contract_version=1 and r.legacy_fee_centavos is null
  and r.barangay_id=l.barangay_id and b.id=l.barangay_id and b.name='Barangay Ampid I'
  and l.display_name='Ampid 1' and l.city='San Mateo' and l.province='Rizal';
alter table public.service_requests enable trigger set_service_requests_updated_at;

create function barangayan_private.review_service_request(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; r public.service_requests; v_id uuid; v_eligibility text; v_note text; v_previous text;
begin
  a := barangayan_private.assert_actor(true);
  perform barangayan_private.check_keys(p_input,array['requestId','requirementsComplete','eligibility','note','personalAppearancePresent']);
  v_id := barangayan_private.required_text(p_input,'requestId',36)::uuid;
  v_eligibility := barangayan_private.required_text(p_input,'eligibility',20);
  v_note := barangayan_private.required_text(p_input,'note',1000);
  if v_eligibility not in ('pending','eligible','ineligible')
    or jsonb_typeof(p_input->'requirementsComplete') is distinct from 'boolean'
    or jsonb_typeof(p_input->'personalAppearancePresent') is distinct from 'boolean' then
    raise exception 'invalid_requirement_review' using errcode='22023';
  end if;
  select * into r from public.service_requests where id=v_id and barangay_id=a.barangay_id
    and contract_version=2 and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if r.sla_state <> 'pre_processing' then raise exception 'review_locked_after_acceptance' using errcode='22023'; end if;
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','review',true);
  update public.service_requests set
    requirements_review_state=case when (p_input->>'requirementsComplete')::boolean then 'complete' else 'pending' end,
    eligibility_state=v_eligibility,requirements_review_note=v_note,requirements_reviewed_by=a.id,requirements_reviewed_at=clock_timestamp(),
    personal_appearance_at=case when (p_input->>'personalAppearancePresent')::boolean then coalesce(r.personal_appearance_at,clock_timestamp()) else null end,
    personal_appearance_recorded_by=case when (p_input->>'personalAppearancePresent')::boolean then coalesce(r.personal_appearance_recorded_by,a.id) else null end
  where id=r.id;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  return r.id;
end $$;
create function public.review_service_request(p_input jsonb) returns uuid language sql security invoker set search_path = ''
as $$ select barangayan_private.review_service_request(p_input) $$;
revoke all on function barangayan_private.review_service_request(jsonb),public.review_service_request(jsonb) from public,anon;
grant execute on function barangayan_private.review_service_request(jsonb),public.review_service_request(jsonb) to authenticated;

-- Catalog data is configured once by migration; this private helper is also used
-- after the development seed creates the pilot. Never available to API callers.
create function barangayan_private.configure_ampid_charter() returns void
language plpgsql security invoker set search_path = '' as $$
declare b uuid; c jsonb; x jsonb; base jsonb; kept uuid[]; v_id uuid;
begin
  for b in select l.barangay_id from public.barangay_localities l
    join public.barangays t on t.id=l.barangay_id
    where t.name='Barangay Ampid I' and l.display_name='Ampid 1' and l.city='San Mateo' and l.province='Rizal'
  loop
    kept := array[]::uuid[];
    base := jsonb_build_object(
      'classification','Simple','transactionType','G2C',
      'clientSteps',E'1. Filling up of the Applied form\n2. Submit the required documents to the assigned clerk.\n3. Pay the required fees at the treasurers/cashiers office. Make sure to secure Official Receipt that will be issued upon payment.\n4. Return to the assigned clerk for the release of clearance/certification',
      'agencyActions',E'1. Take and check the filled up form\n2. Issue the order of payment if all documents were given\n3. Start processing the request.\n4. Issue the official receipt.\n5. Check the official receipt.\n6. Issue the Certificate or Clearance to the client.',
      'processingTime',E'Grouped durations shown in the charter: 2 mins, 3 mins, 4 mins, 2 mins, 2 mins, 2 mins.\nTOTAL: 15 MINS. The source does not establish individual action/person assignments.',
      'personResponsible',E'Brgy. Treasurer\nBrgy. Clerk\nBrgy. Secretary/PB/Authorized Signing Official',
      'officeDivision','Treasurer''s Office/Punong Barangay Office','whoMayAvail','RESIDENTS',
      'checklistOfRequirements',E'1. VALID ID/HOA CERTIFICATE (6 MONTHS RESIDENCY)\n2. PERSONAL APPEARANCE\n3. FOR TRANSCIENTS/RENTERS – ENDORSEMENT FROM THE LESSOR',
      'whereToSecureRequirements','TREASURER''S OFFICE/OFFICE OF THE PUNONG BARANGAY/SECRETARY',
      'feesToBePaid',E'₱100.00 / *NO FEES. Charter total: ₱100.00. The supplied page does not explain the distinction; staff must confirm the fee or applicable exemption before payment.');
    for x in select value from jsonb_array_elements($catalog$[
      {"name":"Issuance of Barangay Clearance for Business Establishments","kind":"business","pricing":"assessment","description":"Clearance for business establishments. Staff assess fees using the applicable tax code.","requirements":["DTI","Verified valid ID","Personal appearance"],"purposes":[{"code":"new_business","label":"New business permit application","requiresExplanation":false},{"code":"renewal","label":"Business permit renewal","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"Certificate of Indigency","kind":"indigency","pricing":"assessment","description":"Certificate for residents. Staff confirm eligibility, six-month residency and the applicable fee or exemption.","requirements":["Valid ID/HOA certificate (6 months residency)","Personal appearance","Lessor endorsement for transients/renters"],"purposes":[{"code":"medical","label":"Medical assistance","requiresExplanation":false},{"code":"education","label":"Educational assistance","requiresExplanation":false},{"code":"burial","label":"Burial/funeral assistance","requiresExplanation":false},{"code":"welfare","label":"Financial or social welfare assistance","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"First Time Job Seeker","kind":"first_time_job_seeker","pricing":"assessment","description":"Certificate for residents seeking first employment. Staff confirm eligibility and the applicable exemption.","requirements":["Valid ID/HOA certificate (6 months residency)","Personal appearance","Lessor endorsement for transients/renters"],"purposes":[{"code":"first_employment","label":"First employment application","requiresExplanation":false},{"code":"pre_employment","label":"Pre-employment documentary requirements","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)","kind":"certified_true_copy","pricing":"per_page","description":"Certified copies of barangay records. ₱10 per total billable page confirmed by staff across all requested copies.","requirements":["Verified valid ID","Personal appearance"],"purposes":[{"code":"government","label":"Submission to a government office","requiresExplanation":false},{"code":"legal","label":"Legal documentation","requiresExplanation":false},{"code":"reference","label":"Official or administrative reference","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]}
    ]$catalog$::jsonb) loop
      c := base;
      if x->>'kind'='business' then
        c := c || jsonb_build_object(
          'officeDivision','Treasurer''s Office','whoMayAvail','ALL',
          'checklistOfRequirements',E'1. DTI\n2. VALID ID\n3. PERSONAL APPEARANCE','whereToSecureRequirements','TREASURER''S OFFICE',
          'clientSteps',E'1. Fill up the necessary and applicable form for your request document\n2. Submit the required documents to the assigned clerk.\n3. Pay the required fees at the treasurer''s office. Make sure to secure Official Receipt that will be issued upon payment.\n4. Return to the assigned clerk for the release of clearance/certification',
          'agencyActions',E'1. Give the Log Book to the Client.\n2. Issue the order of payment if all documents were given\n3. Start processing the request.\n4. Issue the official receipt.\n5. Check the official receipt.\n6. Issue the Certificate or Clearance to the client.',
          'personResponsible',E'Brgy. Treasurer/Collecting staff\nBrgy. Clerk\nBrgy. Secretary/PB/Authorized Signing Official',
          'feesToBePaid','See Attached Tax Code (depends on the kind of transaction). The tax code is absent from the supplied PDF; staff assessment is required.');
      elsif x->>'kind'='certified_true_copy' then
        c := c || jsonb_build_object(
          'officeDivision','Office of the Secretary/Treasurer''s Office','whoMayAvail','ALL',
          'checklistOfRequirements',E'1. VALID ID\n3. PERSONAL APPEARANCE','whereToSecureRequirements','OFFICE OF THE PUNONG BARANGAY/SECRETARY',
          'clientSteps',E'1. Filling up of the Applied form\n2. Pay the required fees at the treasurer''s office. Make sure to secure Official Receipt that will be issued upon payment.\n3. Return to the assigned clerk for the release of clearance/certification',
          'agencyActions',E'1. Take and check the filled up form\n2. Issue the order of payment if all documents were given\n3. Start processing details.\n4. Issue the official receipt.\n5. Check the official receipt.\n6. Issue the documents needed by the client.',
          'processingTime',E'Grouped durations shown in the charter: 2 mins, 5 mins, 2 mins, 6 mins.\nTOTAL: 15 MINS. The source does not establish individual action/person assignments.',
          'personResponsible',null,'feesToBePaid','₱10.00 /page. TOTAL: ₱10.00 /PAGE. Staff confirm total billable pages across all requested copies.');
      end if;
      -- Reuse exact equivalent names/kinds only. General-purpose clearance is
      -- not silently reclassified as business clearance.
      select id into v_id from public.document_types where barangay_id=b and deleted_at is null
        and (service_kind=x->>'kind' or lower(name)=lower(x->>'name')) order by created_at,id limit 1;
      if v_id is null then
        insert into public.document_types(barangay_id,name) values(b,x->>'name') returning id into v_id;
      end if;
      update public.document_types set name=x->>'name',description=x->>'description',is_active=true,
        contract_version=2,service_kind=x->>'kind',charter=c,purposes=x->'purposes',
        requirement_rules=jsonb_build_object('dtiRequired',x->>'kind'='business','hoaRequired',false,
          'lessorForRenter',x->>'kind' in ('indigency','first_time_job_seeker'),'personalAppearance',true),
        pricing_mode=x->>'pricing',fee_centavos=case when x->>'kind'='certified_true_copy' then 1000 else fee_centavos end,
        processing_target_minutes=15,
        requirements=array(select jsonb_array_elements_text(x->'requirements'))
      where id=v_id;
      kept := array_append(kept,v_id);
      v_id := null;
    end loop;
    update public.document_types set is_active=false where barangay_id=b and not (id=any(kept)) and is_active;
  end loop;
end $$;
revoke all on function barangayan_private.configure_ampid_charter() from public,anon,authenticated;
select barangayan_private.configure_ampid_charter();
-- Guard/transition replacements follow. Historical v1 behavior is preserved.


create or replace function barangayan_private.guard_request_foundations() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_doc public.document_types; v_res public.profiles; v_operation text := current_setting('barangayan.foundation_operation',true);
begin
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
    if r.requirements_review_state <> 'complete' or r.eligibility_state <> 'eligible' or r.requirements_reviewed_by is null or
      not coalesce((p_input->>'requirementsComplete')::boolean,false) or
      (r.personal_appearance_required and (r.personal_appearance_at is null or not coalesce((p_input->>'personalAppearanceReady')::boolean,false))) then
      raise exception 'complete_requirements_and_appearance_required' using errcode='22023';
    end if;
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
create or replace function barangayan_private.guard_catalog_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb; k text;
begin
  if tg_op='UPDATE' and old.contract_version=2 and new.contract_version<>2 then raise exception 'immutable_catalog_contract' using errcode='42501'; end if;
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
  if (new.pricing_mode='per_page' and (new.service_kind<>'certified_true_copy' or new.fee_centavos<>1000)) or
    ((new.requirement_rules->>'dtiRequired')::boolean and new.service_kind<>'business') or
    (((new.requirement_rules->>'hoaRequired')::boolean or (new.requirement_rules->>'lessorForRenter')::boolean) and new.service_kind not in ('indigency','first_time_job_seeker')) then
    raise exception 'incompatible_catalog_rules_or_page_rate' using errcode='22023';
  end if;
  return new;
end $$;
create unique index document_types_active_service_kind on public.document_types(barangay_id,service_kind)
where contract_version=2 and is_active and deleted_at is null;
create function barangayan_private.guard_pilot_catalog_scope() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and new.is_active and new.deleted_at is null and new.contract_version<>2 and exists(
    select 1 from public.barangay_localities l join public.barangays b on b.id=l.barangay_id
    where l.barangay_id=new.barangay_id and b.name='Barangay Ampid I' and l.display_name='Ampid 1' and l.city='San Mateo' and l.province='Rizal') then
    raise exception 'pilot_uses_four_charter_services' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function barangayan_private.guard_pilot_catalog_scope() from public,anon,authenticated;
create trigger guard_pilot_catalog_scope before insert or update on public.document_types
for each row execute function barangayan_private.guard_pilot_catalog_scope();

commit;
