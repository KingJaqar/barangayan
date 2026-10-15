SET local check_function_bodies = off;

DROP TRIGGER "guard_household_archive" ON "public"."household_members";

ALTER TABLE "public"."service_requests"
  DROP CONSTRAINT "service_requests_assessment_shape";

ALTER TABLE "public"."service_requests"
  DROP CONSTRAINT "service_requests_fee_assessment_state_check";

DROP FUNCTION "barangayan_private"."collect_tax_code_pickup_payment"(uuid, integer);

DROP FUNCTION "barangayan_private"."guard_household_archive"();

DROP FUNCTION "barangayan_private"."set_service_request_pages"(uuid, integer);

DROP FUNCTION "public"."collect_tax_code_pickup_payment"(uuid, integer);

DROP FUNCTION "public"."set_service_request_pages"(uuid, integer);

CREATE OR REPLACE FUNCTION barangayan_private.active_member_barangay_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 select p.barangay_id from public.profiles p
 where p.id=(select auth.uid()) and p.deleted_at is null
$function$;

CREATE OR REPLACE FUNCTION barangayan_private.assess_service_request_fee (
  p_input jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.guard_announcement_read()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if current_user not in ('authenticated','anon') then return new; end if;
 if tg_op='UPDATE' and (new.resident_id is distinct from old.resident_id or new.announcement_id is distinct from old.announcement_id) then
  raise exception 'announcement_read_identity_immutable' using errcode='42501';
 end if;
 if not exists(select 1 from public.announcements a where a.id=new.announcement_id and a.deleted_at is null
               and a.barangay_id=barangayan_private.active_member_barangay_id()) then
  raise exception 'announcement_not_available' using errcode='42501';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.guard_catalog_contract()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  return new;
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.guard_incident_write()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
 v_admin boolean;
 v_uid uuid:=(select auth.uid());
 v_photo text;
begin
 if current_user not in ('authenticated','anon') then return new; end if;
 v_admin:=coalesce(public."current_role"()='admin',false);

 if new.category_id is not null and (tg_op='INSERT' or new.category_id is distinct from old.category_id) then
  if not exists(select 1 from public.incident_categories c where c.id=new.category_id and c.barangay_id=new.barangay_id) then
   raise exception 'incident_category_not_in_barangay' using errcode='23514';
  end if;
 end if;
 if new.zone_id is not null and (tg_op='INSERT' or new.zone_id is distinct from old.zone_id) then
  if not exists(select 1 from public.waste_zones z where z.id=new.zone_id and z.barangay_id=new.barangay_id
                and z.is_active and z.deleted_at is null) then
   raise exception 'incident_zone_not_in_barangay' using errcode='23514';
  end if;
 end if;

 if v_admin then return new; end if;

 if tg_op='INSERT' then
  if new.status<>'open' or new.confirmation_count<>0 or new.deleted_at is not null or new.resolved_read_at is not null
     or new.reporter_id is distinct from v_uid then
   raise exception 'invalid_initial_incident_state' using errcode='22023';
  end if;
  if cardinality(new.photo_urls)>5 then
   raise exception 'too_many_incident_photos' using errcode='22023';
  end if;
  foreach v_photo in array new.photo_urls loop
   if position('/incident-photos/'||v_uid::text||'/' in v_photo)=0 then
    raise exception 'invalid_incident_photo' using errcode='22023';
   end if;
  end loop;
  return new;
 end if;

 if (to_jsonb(new)-array['deleted_at','status','resolved_read_at','updated_at'])
    is distinct from (to_jsonb(old)-array['deleted_at','status','resolved_read_at','updated_at']) then
  raise exception 'incident_fields_immutable' using errcode='42501';
 end if;
 if new.status is distinct from old.status and not (old.status='open' and new.status='withdrawn') then
  raise exception 'incident_status_controlled' using errcode='42501';
 end if;
 if new.deleted_at is distinct from old.deleted_at and not (old.deleted_at is null and new.deleted_at is not null) then
  raise exception 'incident_not_restorable' using errcode='42501';
 end if;
 if new.resolved_read_at is distinct from old.resolved_read_at and old.status<>'resolved' then
  raise exception 'incident_not_resolved' using errcode='42501';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.guard_payment_foundations()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.has_recent_authentication (
  p_window interval DEFAULT '00:10:00'::interval
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select coalesce((
  select max(case when (e->>'timestamp') ~ '^[0-9]{1,12}$' then (e->>'timestamp')::bigint end)
  from jsonb_array_elements(case when jsonb_typeof((select auth.jwt())->'amr')='array'
                                 then (select auth.jwt())->'amr' else '[]'::jsonb end) e
 ) >= extract(epoch from (now()-p_window))::bigint,false)
$function$;

CREATE OR REPLACE FUNCTION barangayan_private.pickup_payment (
  p_request_id uuid,
  p_collect    boolean
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.review_service_request (
  p_input jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.set_request_payment_method (
  p_request_id uuid,
  p_method     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.submit_service_request (
  p_input jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION barangayan_private.transition_service_request_sla (
  p_input jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_add_household_member (
  p_profile_id uuid,
  p_name       text,
  p_relation   text,
  p_role       text DEFAULT 'member'::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_member_id uuid := gen_random_uuid();
  v_profile public.profiles%rowtype;
  v_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select * into v_profile
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  v_members := coalesce(v_profile.household_members, '[]'::jsonb);
  v_members := v_members || jsonb_build_object(
    'id', v_member_id::text,
    'name', p_name,
    'relation', p_relation,
    'role', p_role
  );

  update public.profiles set household_members = v_members where id = p_profile_id;
  return v_member_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_household_member (
  p_profile_id uuid,
  p_member_id  uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_members jsonb;
  v_updated_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select household_members into v_members
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as item(elem)
    where elem->>'id' = p_member_id::text
  ) then
    raise exception 'Member % not found in profile %', p_member_id, p_profile_id;
  end if;

  select coalesce(jsonb_agg(elem order by item.ordinality), '[]'::jsonb) into v_updated_members
  from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) with ordinality as item(elem, ordinality)
  where coalesce(elem->>'id', '') <> p_member_id::text;

  update public.profiles set household_members = v_updated_members where id = p_profile_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_household_member (
  p_profile_id uuid,
  p_member_id  uuid,
  p_name       text,
  p_relation   text,
  p_role       text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_members jsonb;
  v_updated_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select household_members into v_members
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  select jsonb_agg(
    case when elem->>'id' = p_member_id::text then jsonb_build_object(
      'id', p_member_id::text,
      'name', p_name,
      'relation', p_relation,
      'role', p_role
    ) else elem end
    order by item.ordinality
  ) into v_updated_members
  from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) with ordinality as item(elem, ordinality);

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as item(elem)
    where elem->>'id' = p_member_id::text
  ) then
    raise exception 'Member % not found in profile %', p_member_id, p_profile_id;
  end if;

  update public.profiles set household_members = v_updated_members where id = p_profile_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_to_evacuation_center (
  p_center_id uuid
)
  RETURNS TABLE (
    check_in_id            uuid,
    evacuation_center_id   uuid,
    evacuation_center_name text,
    barangay_id            uuid,
    checked_in_at          timestamp with time zone,
    already_checked_in     boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
 v_uid uuid:=(select auth.uid());
 v_profile public.profiles;
 v_center public.evacuation_centers;
 v_row public.evacuation_center_checkins;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into v_profile from public.profiles p where p.id=v_uid and p.deleted_at is null;
 if not found or v_profile.role<>'resident' then
  raise exception 'Only an active resident can check in' using errcode='P0010';
 end if;
 select * into v_center from public.evacuation_centers c where c.id=p_center_id and c.deleted_at is null;
 if not found or not v_center.is_active then
  raise exception 'Evacuation center not found or inactive' using errcode='P0012';
 end if;
 if v_center.barangay_id<>v_profile.barangay_id then
  raise exception 'Resident and evacuation center must belong to the same barangay' using errcode='P0011';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_center_id::text,3));
 select * into v_row from public.evacuation_center_checkins k
  where k.user_id=v_uid and k.evacuation_center_id=p_center_id and k.checked_in_at>now()-interval '10 minutes'
  order by k.checked_in_at desc limit 1;
 if found then
  return query select v_row.id,v_row.evacuation_center_id,v_center.name,v_row.barangay_id,v_row.checked_in_at,true;
  return;
 end if;
 insert into public.evacuation_center_checkins(evacuation_center_id,user_id,barangay_id)
 values(p_center_id,v_uid,v_profile.barangay_id) returning * into v_row;
 return query select v_row.id,v_row.evacuation_center_id,v_center.name,v_row.barangay_id,v_row.checked_in_at,false;
end $function$;

CREATE OR REPLACE FUNCTION public.confirm_incident (
  p_incident_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
 v_barangay_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.deleted_at is null) then
  raise exception 'not authenticated' using errcode='42501';
 end if;

 select barangay_id into v_barangay_id from public.incidents
  where id=p_incident_id and deleted_at is null;
 if v_barangay_id is null then raise exception 'incident not found'; end if;
 if v_barangay_id is distinct from public.current_barangay_id() then
  raise exception 'incident is not in your barangay';
 end if;
 if exists(select 1 from public.incidents where id=p_incident_id and reporter_id=auth.uid()) then
  raise exception 'you cannot confirm your own report';
 end if;

 begin
  insert into public.incident_confirmations(incident_id,user_id) values(p_incident_id,auth.uid());
 exception when unique_violation then
  return false;
 end;
 update public.incidents set confirmation_count=confirmation_count+1 where id=p_incident_id;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.current_barangay_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select barangay_id from public.profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public."current_role"()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select role from public.profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.guard_drive_registration_tenant()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_profile public.profiles;
  v_drive public.medical_drives;
begin
  select * into v_profile from public.profiles where id = new.user_id and deleted_at is null;
  if not found or v_profile.role <> 'resident' then
    raise exception 'Only an active resident can be registered for a medical drive' using errcode = 'P0010';
  end if;

  select * into v_drive from public.medical_drives where id = new.drive_id and deleted_at is null;
  if not found or not v_drive.is_active then
    raise exception 'Drive not found or inactive' using errcode = 'P0002';
  end if;

  if v_profile.barangay_id <> v_drive.barangay_id then
    raise exception 'Resident and medical drive must belong to the same barangay' using errcode = 'P0011';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_evacuation_checkin_tenant()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_profile public.profiles;
  v_center public.evacuation_centers;
begin
  select * into v_profile from public.profiles where id = new.user_id and deleted_at is null;
  if not found or v_profile.role <> 'resident' then
    raise exception 'Only an active resident can check in' using errcode = 'P0010';
  end if;

  select * into v_center from public.evacuation_centers where id = new.evacuation_center_id and deleted_at is null;
  if not found or not v_center.is_active then
    raise exception 'Evacuation center not found or inactive' using errcode = 'P0012';
  end if;

  if new.user_id <> auth.uid()
     or new.barangay_id <> v_profile.barangay_id
     or new.barangay_id <> v_center.barangay_id then
    raise exception 'Resident, check-in, and evacuation center must belong to the same barangay' using errcode = 'P0011';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_id_verification_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  -- Allow if the caller is an admin or service_role
  if public.current_role() = 'admin' then
    return new;
  end if;

  -- Resident: block escalation to 'verified' or 'verification_failed' — both are
  -- admin-only outcomes of a review the resident cannot perform on themselves.
  if new.id_verification_status in ('verified', 'verification_failed')
     and (old.id_verification_status is distinct from new.id_verification_status) then
    raise exception
      'Residents cannot set their own ID verification result. '
      'Status must be set to "verified" or "verification_failed" by an administrator.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_request_completion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and current_setting('barangayan.allow_request_completion', true) is distinct from 'true' then
    raise exception 'use complete_service_request to mark a request completed';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_role_escalation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if new.role = 'admin' and (old.role is distinct from new.role) then
    if public.current_role() != 'admin' then
      raise exception 'Only administrators can assign the % role.', new.role;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_household_member_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_verification_field_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if (
    new.email_verification_status      is distinct from old.email_verification_status      or
    new.email_verification_requested_at is distinct from old.email_verification_requested_at or
    new.email_verified_at              is distinct from old.email_verified_at
  ) then
    raise exception
      'Direct updates to email verification fields are not allowed. '
      'Use the server-side verification endpoint instead.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_waste_zone_scores()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  -- Keep in sync with DEFAULT_TRASH_SCORING_CONFIG.halfLifeDays
  -- (packages/shared/src/constants/priority-weights.ts) — same formula as the
  -- client-side trashIncidentScore() helper (packages/shared/src/lib/format.ts),
  -- just evaluated in SQL against a whole zone instead of one incident in JS.
  v_half_life_days numeric := 14;
begin
  update public.waste_zones z
  set trash_score = coalesce(scores.total_score, 0),
      trash_score_updated_at = now()
  from (
    select
      i.zone_id,
      sum(
        i.confirmation_count *
        exp(-ln(2) / v_half_life_days * (extract(epoch from (now() - i.created_at)) / 86400.0))
      ) as total_score
    from public.incidents i
    join public.incident_categories c on c.id = i.category_id
    where c.is_trash_related = true
      and i.deleted_at is null
      and i.zone_id is not null
      and i.confirmation_count > 0
    group by i.zone_id
  ) scores
  where z.id = scores.zone_id;

  -- Zones with no currently-scoring incidents reset to 0 instead of keeping a
  -- stale score from reports that have since aged out (0 confirmations) or
  -- been resolved/deleted.
  update public.waste_zones z
  set trash_score = 0, trash_score_updated_at = now()
  where z.trash_score != 0
    and not exists (
      select 1
      from public.incidents i
      join public.incident_categories c on c.id = i.category_id
      where i.zone_id = z.id
        and c.is_trash_related = true
        and i.deleted_at is null
        and i.confirmation_count > 0
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_for_drive (
  p_drive_id        uuid,
  p_age             integer,
  p_is_pwd          boolean,
  p_comorbidities   text[],
  p_prior_dose_date date    DEFAULT NULL::date
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
 v_user_id uuid:=auth.uid();
 v_today date:=(now() at time zone 'Asia/Manila')::date;
 v_drive public.medical_drives;
 v_prefix text;
 v_applicant_number text;
 v_reg public.drive_registrations;
begin
 if v_user_id is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
 if p_age is null or p_age not between 0 and 130 then
  raise exception 'invalid_age' using errcode='22023';
 end if;
 if p_prior_dose_date is not null and p_prior_dose_date>v_today then
  raise exception 'invalid_prior_dose_date' using errcode='22023';
 end if;
 if p_comorbidities is not null and (cardinality(p_comorbidities)>10
    or exists(select 1 from unnest(p_comorbidities) c where c is null or char_length(btrim(c)) not between 1 and 50)
    or (cardinality(p_comorbidities)>1 and exists(select 1 from unnest(p_comorbidities) c where lower(btrim(c))='none'))) then
  raise exception 'invalid_comorbidities' using errcode='22023';
 end if;

 select * into v_drive from public.medical_drives where id=p_drive_id and is_active=true and deleted_at is null for update;
 if not found then raise exception 'Drive not found or inactive' using errcode='P0002'; end if;
 if v_drive.drive_date<v_today then raise exception 'Registration is closed for this drive' using errcode='P0005'; end if;
 if exists(select 1 from public.drive_registrations where drive_id=p_drive_id and user_id=v_user_id) then
  raise exception 'Already registered for this drive' using errcode='P0004';
 end if;
 if v_drive.stock_remaining<=0 then raise exception 'No remaining slots for this drive' using errcode='P0003'; end if;

 v_prefix:=case v_drive.type
  when 'vaccination' then 'VAC' when 'maternal_care' then 'MAT' when 'blood_drive' then 'BLD' when 'dental' then 'DEN'
  when 'optical' then 'OPT' when 'medicine' then 'MED' when 'emergency_kit' then 'EMK' when 'screening' then 'SCR'
  when 'consultation' then 'CON' when 'minor_surgical' then 'SRG' else 'DRV' end;
 v_applicant_number:=v_prefix||'-'||to_char(now(),'YYYYMMDD')||'-'||
  lpad((v_drive.stock_total-v_drive.stock_remaining+1)::text,4,'0');

 insert into public.drive_registrations(drive_id,user_id,applicant_number,age,is_pwd,comorbidities,prior_dose_date,status)
 values(p_drive_id,v_user_id,v_applicant_number,p_age,p_is_pwd,coalesce(p_comorbidities,'{}'),p_prior_dose_date,'pending')
 returning * into v_reg;
 update public.medical_drives set stock_remaining=stock_remaining-1 where id=p_drive_id;

 return json_build_object('registration_id',v_reg.id,'applicant_number',v_applicant_number,'status',v_reg.status);
end $function$;

CREATE OR REPLACE FUNCTION public.request_own_account_deletion()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user_id uuid:=(select auth.uid());
begin
 if v_user_id is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
 if not exists(select 1 from public.profiles where id=v_user_id and deleted_at is null) then
  raise exception 'Profile not found or already deleted' using errcode='P0002';
 end if;
 if not barangayan_private.has_recent_authentication() then
  raise exception 'fresh_authentication_required' using errcode='42501';
 end if;
 update public.profiles set
  full_name='Deleted Resident',mobile_number=null,home_address=null,email=null,avatar_url=null,
  id_photo_urls='{}',id_type=null,id_verification_status=null,household_members='[]'::jsonb,deleted_at=now()
 where id=v_user_id and deleted_at is null;
 if not found then raise exception 'Profile not found or already deleted' using errcode='P0002'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.save_about_us_with_developers (
  p_barangay_id   uuid,
  p_mission       text,
  p_vision        text,
  p_history       text,
  p_contact_email text,
  p_contact_phone text,
  p_address       text,
  p_logo_url      text,
  p_developers    jsonb,
  p_is_active     boolean DEFAULT true,
  p_sort_order    integer DEFAULT 0
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_about_id uuid;
  v_dev      jsonb;
  v_existed  boolean;
begin
  -- 1. Authorize: caller must be admin in this barangay
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  select exists (
    select 1 from public.about_us
    where barangay_id = p_barangay_id and deleted_at is null
  ) into v_existed;

  -- 2. Upsert about_us (partial unique index on barangay_id WHERE deleted_at IS NULL)
  insert into public.about_us
    (barangay_id, mission, vision, history, contact_email, contact_phone, address, logo_url, is_active, sort_order)
  values
    (p_barangay_id, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address, p_logo_url, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  -- 3. Soft-delete all existing developers for this about_us
  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  -- 4. Insert fresh developer set (replaces soft-deleted rows)
  for v_dev in select * from jsonb_array_elements(coalesce(p_developers, '[]'::jsonb))
  loop
    insert into public.developer_profiles
      (about_us_id, barangay_id, name, role, bio, photo_url, sort_order)
    values (
      v_about_id,
      p_barangay_id,
      coalesce(v_dev->>'name', ''),
      coalesce(v_dev->>'role', ''),
      coalesce(v_dev->>'bio', ''),
      nullif(v_dev->>'photo_url', ''),
      coalesce((v_dev->>'sort_order')::integer, 0)
    );
  end loop;

  -- 5. Audit log (fires inside the same transaction)
  insert into public.admin_audit_log
    (barangay_id, admin_id, action, entity_type, entity_id, entity_label)
  values (
    p_barangay_id,
    auth.uid(),
    case when v_existed then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_about_us_with_developers (
  p_barangay_id   uuid,
  p_mission       text,
  p_vision        text,
  p_history       text,
  p_contact_email text,
  p_contact_phone text,
  p_address       text,
  p_logo_url      text,
  p_developers    jsonb,
  p_is_active     boolean DEFAULT true,
  p_sort_order    integer DEFAULT 0,
  p_logo_size     integer DEFAULT 64
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_about_id uuid;
  v_dev      jsonb;
  v_existed  boolean;
begin
  -- 1. Authorize: caller must be admin in this barangay
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  select exists (
    select 1 from public.about_us
    where barangay_id = p_barangay_id and deleted_at is null
  ) into v_existed;

  -- 2. Upsert about_us
  insert into public.about_us
    (barangay_id, mission, vision, history, contact_email, contact_phone, address,
     logo_url, logo_size, is_active, sort_order)
  values
    (p_barangay_id, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address,
     p_logo_url, p_logo_size, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    logo_size      = excluded.logo_size,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  -- 3. Soft-delete all existing developers for this about_us
  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  -- 4. Insert fresh developer set
  for v_dev in select * from jsonb_array_elements(coalesce(p_developers, '[]'::jsonb))
  loop
    insert into public.developer_profiles
      (about_us_id, barangay_id, name, role, bio, photo_url, sort_order)
    values (
      v_about_id,
      p_barangay_id,
      coalesce(v_dev->>'name', ''),
      coalesce(v_dev->>'role', ''),
      coalesce(v_dev->>'bio', ''),
      nullif(v_dev->>'photo_url', ''),
      coalesce((v_dev->>'sort_order')::integer, 0)
    );
  end loop;

  -- 5. Audit log
  insert into public.admin_audit_log
    (barangay_id, admin_id, action, entity_type, entity_id, entity_label)
  values (
    p_barangay_id,
    auth.uid(),
    case when v_existed then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_about_us_with_developers (
  p_barangay_id   uuid,
  p_mission       text,
  p_vision        text,
  p_history       text,
  p_contact_email text,
  p_contact_phone text,
  p_address       text,
  p_logo_url      text,
  p_developers    jsonb,
  p_is_active     boolean DEFAULT true,
  p_sort_order    integer DEFAULT 0,
  p_logo_size     integer DEFAULT 64,
  p_title         text    DEFAULT 'Barangayan'::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_about_id uuid;
  v_dev      jsonb;
  v_existed  boolean;
begin
  -- 1. Authorize: caller must be admin in this barangay
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  select exists (
    select 1 from public.about_us
    where barangay_id = p_barangay_id and deleted_at is null
  ) into v_existed;

  -- 2. Upsert about_us
  insert into public.about_us
    (barangay_id, title, mission, vision, history, contact_email, contact_phone, address,
     logo_url, logo_size, is_active, sort_order)
  values
    (p_barangay_id, p_title, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address,
     p_logo_url, p_logo_size, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    title          = excluded.title,
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    logo_size      = excluded.logo_size,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  -- 3. Soft-delete all existing developers for this about_us
  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  -- 4. Insert fresh developer set
  for v_dev in select * from jsonb_array_elements(coalesce(p_developers, '[]'::jsonb))
  loop
    insert into public.developer_profiles
      (about_us_id, barangay_id, name, role, bio, photo_url, sort_order)
    values (
      v_about_id,
      p_barangay_id,
      coalesce(v_dev->>'name', ''),
      coalesce(v_dev->>'role', ''),
      coalesce(v_dev->>'bio', ''),
      nullif(v_dev->>'photo_url', ''),
      coalesce((v_dev->>'sort_order')::integer, 0)
    );
  end loop;

  -- 5. Audit log
  insert into public.admin_audit_log
    (barangay_id, admin_id, action, entity_type, entity_id, entity_label)
  values (
    p_barangay_id,
    auth.uid(),
    case when v_existed then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_barangay_officials_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_faq_articles_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_barangay_official()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  -- Profile became (or was created as) an admin: ensure a roster row exists.
  if new.role = 'admin' and new.deleted_at is null then
    insert into public.barangay_officials (profile_id, barangay_id, official_role)
    values (new.id, new.barangay_id, 'staff')
    on conflict (profile_id) do update
      set barangay_id = excluded.barangay_id,
          is_active = true,
          deleted_at = null;
  end if;

  -- Profile stopped being admin, or was soft-deleted: retire the roster row.
  if (new.role != 'admin' or new.deleted_at is not null)
     and (tg_op = 'INSERT' or old.role = 'admin') then
    update public.barangay_officials
      set is_active = false,
          deleted_at = coalesce(new.deleted_at, now())
      where profile_id = new.id
        and deleted_at is null;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.track_service_request_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  v_note text;
begin
  if tg_op = 'INSERT' then
    new.status_history := jsonb_build_array(
      jsonb_build_object('status', new.status, 'at', now(), 'note', 'Request submitted')
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_note := nullif(current_setting('barangayan.status_note', true), '');
    new.status_history := old.status_history || jsonb_build_object(
      'status', new.status, 'at', now(), 'note', v_note
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_push_token (
  p_expo_push_token text,
  p_device_type     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_uid uuid:=(select auth.uid());
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.deleted_at is null) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_expo_push_token is null or char_length(p_expo_push_token)>200
    or p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
  raise exception 'invalid_push_token' using errcode='22023';
 end if;
 if p_device_type is null or p_device_type not in ('ios','android') then
  raise exception 'invalid_device_type' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_expo_push_token,2));
 delete from public.push_tokens where expo_push_token=p_expo_push_token and user_id<>v_uid;
 insert into public.push_tokens(user_id,expo_push_token,device_type) values(v_uid,p_expo_push_token,p_device_type)
 on conflict (expo_push_token) do update
  set user_id=excluded.user_id,device_type=excluded.device_type,last_used_at=now();
end $function$;

CREATE OR REPLACE FUNCTION public.withdraw_incident (
  p_incident_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
 v_barangay_id uuid;
 v_reporter_id uuid;
 v_status text;
 v_created_at timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.deleted_at is null) then
  raise exception 'not authenticated' using errcode='42501';
 end if;

 select barangay_id,reporter_id,status,created_at into v_barangay_id,v_reporter_id,v_status,v_created_at
  from public.incidents where id=p_incident_id and deleted_at is null;
 if v_barangay_id is null then raise exception 'incident not found'; end if;
 if v_barangay_id is distinct from public.current_barangay_id() then
  raise exception 'incident is not in your barangay';
 end if;
 if v_reporter_id is distinct from auth.uid() then
  raise exception 'you can only withdraw a report you filed yourself';
 end if;
 if v_status<>'open' then raise exception 'you can only withdraw a report that is still open'; end if;
 if v_created_at<now()-interval '24 hours' then
  raise exception 'the 24-hour withdrawal window for this report has closed';
 end if;
 update public.incidents set status='withdrawn' where id=p_incident_id;
end $function$;

ALTER TABLE "public"."service_requests"
  ADD CONSTRAINT "service_requests_assessment_shape"
    CHECK
    (((fee_assessment_state = 'legacy'::text) OR ((fee_assessment_state = 'pending'::text) AND (assessed_amount_centavos IS NULL) AND (fee_basis IS NULL) AND (fee_assessed_by IS
    NULL) AND (fee_assessed_at IS NULL)) OR ((fee_assessment_state = ANY (ARRAY['assessed'::text, 'waived'::text])) AND (assessed_amount_centavos IS NOT NULL) AND (fee_basis IS
    NOT NULL) AND (fee_assessed_at IS NOT NULL) AND ((fee_assessment_state <> 'waived'::text) OR (assessed_amount_centavos = 0)))));

ALTER TABLE "public"."service_requests"
  ADD CONSTRAINT "service_requests_fee_assessment_state_check" CHECK ((fee_assessment_state = ANY (ARRAY['legacy'::text, 'pending'::text, 'assessed'::text, 'waived'::text])));

COMMENT ON COLUMN "public"."profiles"."email_verification_status" IS 'App-level deferred verification state. unavailable = SMTP not yet configured;
   unverified = SMTP available but resident has not verified; pending = OTP sent,
   awaiting entry; verified = confirmed. Never blocks login, dashboard, or services.';

COMMENT ON COLUMN "public"."profiles"."id_verification_status" IS 'ID verification workflow status.
   NULL                  = no ID document uploaded yet.
   pending                = resident uploaded ID type + front/back photos; awaiting admin review.
   verified               = admin has confirmed the uploaded ID is genuine.
   verification_failed    = admin rejected the uploaded ID; resident should re-upload to retry.
   Residents may only set this to pending (via handleSave in the mobile/web apps).
   Admins transition it to verified or verification_failed via the Resident Directory admin panel.
   Re-uploading a new ID photo always resets the status to pending, regardless of prior state.';

COMMENT ON COLUMN "public"."profiles"."location_verified" IS '
Result of the point-in-polygon check against barangays.boundary at signup time. NULL = check could not run (no boundary configured, permission denied, or GPS unavailable) — no conclusion, not flagged. TRUE = device location was inside the boundary. FALSE = device location was outside the boundary — surfaced to admins for review, never blocks registration (soft check only, per the project paper).
';

COMMENT ON COLUMN "public"."profiles"."registration_location" IS '
The { lat, lng } the resident''s device reported at signup time, kept for the admin review flagged by location_verified = false. NULL if location access was denied or unavailable during signup.
';

COMMENT ON COLUMN "public"."profiles"."verified_location" IS '
The { lat, lng } pin the resident placed and saved via Settings > Location Verification. Always inside the barangay boundary — the map picker (map-view.tsx) rejects any drop/drag outside it. NULL until the resident completes this flow at least once. Distinct from registration_location (0078), which is the one-time GPS fix captured automatically at signup.
';

COMMENT ON FUNCTION "public"."guard_drive_registration_tenant"() IS 'Rejects non-resident, deleted, inactive-drive, and cross-barangay medical registrations at the table boundary.';

COMMENT ON FUNCTION "public"."prevent_verification_field_update"() IS 'Trigger: rejects any UPDATE on profiles that changes email_verification_status,
   email_verification_requested_at, or email_verified_at. Verification state must
   only be changed by a service-role Edge Function, never by a resident client.';

