-- Editable document fees apply only to future submissions.
-- Existing request assessments and payment ledgers remain unchanged. Older
-- page-count recovery keeps its original ten-peso rate in set_service_request_pages.
begin;
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
  if (new.pricing_mode='per_page' and new.service_kind<>'certified_true_copy') or
    ((new.requirement_rules->>'dtiRequired')::boolean and new.service_kind<>'business') or
    (((new.requirement_rules->>'hoaRequired')::boolean or (new.requirement_rules->>'lessorForRenter')::boolean) and new.service_kind not in ('indigency','first_time_job_seeker')) then
    raise exception 'incompatible_catalog_rules_or_page_rate' using errcode='22023';
  end if;
  -- The stored amount is editable; keep published guidance aligned with it.
  if new.pricing_mode='assessment' then
    new.fee_centavos := 0;
    new.charter := jsonb_set(new.charter,'{feesToBePaid}',to_jsonb('See Attached Tax Code (depends on the kind of transaction)'::text));
  elsif new.service_kind<>'general' then
    new.charter := jsonb_set(new.charter,'{feesToBePaid}',to_jsonb(
      '₱' || (new.fee_centavos::numeric / 100)::numeric(12,2)::text ||
      case when new.pricing_mode='per_page' then ' per page' else '' end));
  end if;
  return new;
end $$;

create or replace function barangayan_private.submit_service_request(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.profiles; p public.profiles; d public.document_types; s public.id_submissions; r public.service_requests;
  v_key uuid; v_doc uuid; v_purpose jsonb; v_details jsonb; v_files jsonb; f jsonb;
  v_explanation text; v_notes text; v_path text; v_mime text; v_size integer; v_request uuid := gen_random_uuid(); v_previous text;
begin
  a := barangayan_private.assert_actor(public.current_role() = 'admin');
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
  if d.pricing_mode='per_page' and (v_details->>'totalPages')::bigint * d.fee_centavos > 2147483647 then
    raise exception 'document_fee_total_too_large' using errcode='22023';
  end if;
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','submit',true);
  insert into public.service_requests(id,barangay_id,resident_id,document_type_id,contract_version,idempotency_key,submission_payload,
    purpose_code,purpose_label,purpose_explanation,requester_notes,supporting_details,approved_id_submission_id,requirements_review_state,
    personal_appearance_required,pricing_mode_snapshot,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,billable_pages,eligibility_state,
    timing_model,target_minutes_snapshot,sla_state)
  values(v_request,a.barangay_id,a.id,d.id,2,v_key,p_input,v_purpose->>'code',v_purpose->>'label',v_explanation,v_notes,v_details,s.id,'complete',
    coalesce((d.requirement_rules->>'personalAppearance')::boolean,false),d.pricing_mode,
    case when d.pricing_mode='assessment' then 'pickup_due' else 'assessed' end,
    case when d.pricing_mode='assessment' then null when d.pricing_mode='per_page' then ((v_details->>'totalPages')::bigint * d.fee_centavos)::integer else d.fee_centavos end,
    case when d.pricing_mode='assessment' then 'See Attached Tax Code (depends on the kind of transaction)' when d.pricing_mode='per_page' then '₱' || (d.fee_centavos::numeric / 100)::numeric(12,2)::text || ' per page' else 'Configured fee at submission' end,
    clock_timestamp(),case when d.service_kind='certified_true_copy' then (v_details->>'totalPages')::integer end,'eligible','agency_minutes_v1',d.processing_target_minutes,'pre_processing');
  for f in select value from jsonb_array_elements(v_files) loop
    insert into public.request_attachments(request_id,resident_id,barangay_id,requirement_code,object_path,mime_type,size_bytes)
    values(v_request,a.id,a.barangay_id,f->>'requirementCode',f->>'path',f->>'mimeType',(f->>'sizeBytes')::integer);
  end loop;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  return v_request;
end $$;

-- Defaults belong to initial setup, never to every save or submission.
CREATE OR REPLACE FUNCTION barangayan_private.configure_ampid_charter()
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
      {"name":"Issuance of Barangay Clearance for Business Establishments","kind":"business","pricing":"assessment","description":"Clearance for business establishments. Pay the applicable tax-code fee at pickup.","requirements":["DTI","Verified valid ID","Personal appearance"],"purposes":[{"code":"new_business","label":"New business permit application","requiresExplanation":false},{"code":"renewal","label":"Business permit renewal","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"Certificate of Indigency","kind":"indigency","pricing":"assessment","description":"Certificate for residents. HOA certification may support or establish residency.","requirements":["Valid ID/HOA certificate (6 months residency)","Personal appearance","Lessor endorsement for transients/renters"],"purposes":[{"code":"medical","label":"Medical assistance","requiresExplanation":false},{"code":"education","label":"Educational assistance","requiresExplanation":false},{"code":"burial","label":"Burial/funeral assistance","requiresExplanation":false},{"code":"welfare","label":"Financial or social welfare assistance","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"First Time Job Seeker","kind":"first_time_job_seeker","pricing":"assessment","description":"Certificate for residents seeking first employment.","requirements":["Valid ID/HOA certificate (6 months residency)","Personal appearance","Lessor endorsement for transients/renters"],"purposes":[{"code":"first_employment","label":"First employment application","requiresExplanation":false},{"code":"pre_employment","label":"Pre-employment documentary requirements","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]},
      {"name":"Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)","kind":"certified_true_copy","pricing":"per_page","description":"Certified copies of barangay records. Fees are charged per total billable page across all requested copies.","requirements":["Verified valid ID","Personal appearance"],"purposes":[{"code":"government","label":"Submission to a government office","requiresExplanation":false},{"code":"legal","label":"Legal documentation","requiresExplanation":false},{"code":"reference","label":"Official or administrative reference","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]}
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
      -- Re-running setup must not reset fees or charters edited by staff.
      if exists(select 1 from public.document_types where id=v_id and contract_version=2) then
        kept := array_append(kept,v_id); v_id := null; continue;
      end if;
      if v_id is null then
        insert into public.document_types(barangay_id,name) values(b,x->>'name') returning id into v_id;
      end if;
      update public.document_types set name=x->>'name',description=x->>'description',is_active=true,
        contract_version=2,service_kind=x->>'kind',charter=c,purposes=x->'purposes',
        requirement_rules=jsonb_build_object('dtiRequired',x->>'kind'='business','hoaRequired',false,
          'lessorForRenter',x->>'kind' in ('indigency','first_time_job_seeker'),'personalAppearance',true),
        pricing_mode=case when x->>'kind' in ('indigency','first_time_job_seeker') then 'fixed' else x->>'pricing' end,
        fee_centavos=case when x->>'kind'='certified_true_copy' then 1000 when x->>'kind' in ('indigency','first_time_job_seeker') then 10000 else 0 end,
        processing_target_minutes=15,
        requirements=array(select jsonb_array_elements_text(x->'requirements'))
      where id=v_id;
      kept := array_append(kept,v_id);
      v_id := null;
    end loop;
    update public.document_types set is_active=false where barangay_id=b and not (id=any(kept)) and is_active;
  end loop;
end $function$;

notify pgrst,'reload schema';
commit;
