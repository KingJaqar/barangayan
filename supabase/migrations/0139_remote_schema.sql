SET local check_function_bodies = off;

DROP POLICY "household_attendance_read" ON "public"."household_attendance";

DROP TRIGGER "attendance_auth_identity" ON "auth"."users";

DROP TRIGGER "reject_legacy_attendance" ON "public"."evacuation_center_checkins";

DROP TRIGGER "guard_attendance_center" ON "public"."evacuation_centers";

DROP TRIGGER "guard_household_archive" ON "public"."household_members";

DROP TRIGGER "attendance_profile_identity" ON "public"."profiles";

DROP TRIGGER "guard_attendance_household" ON "public"."profiles";

DROP TRIGGER "initialize_attendance_household" ON "public"."profiles";

DROP TRIGGER "sync_household_members_from_jsonb" ON "public"."profiles";

DROP VIEW "public"."admin_households_browse";

DROP VIEW "public"."admin_households_records";

DROP VIEW "public"."admin_households_summary";

DROP VIEW "public"."household_attendance_receipt_exports";

ALTER TABLE "barangayan_private"."household_attendance_receipts"
  DROP CONSTRAINT "household_attendance_receipts_actor_profile_id_fkey";

ALTER TABLE "barangayan_private"."household_attendance_receipts"
  DROP CONSTRAINT "household_attendance_receipts_household_profile_id_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_barangay_id_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_checked_in_by_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_checked_out_by_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_evacuation_center_id_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_household_member_id_household_profile_fkey";

ALTER TABLE "public"."household_attendance"
  DROP CONSTRAINT "household_attendance_household_profile_id_fkey";

ALTER TABLE "public"."household_members"
  DROP CONSTRAINT "household_members_id_profile_key";

DROP FUNCTION "barangayan_private"."attendance_actor"(text);

DROP FUNCTION "barangayan_private"."attendance_can_read"(uuid, uuid);

DROP FUNCTION "barangayan_private"."check_in_household_members"(uuid, uuid, jsonb, uuid);

DROP FUNCTION "barangayan_private"."check_out_household_attendance"(uuid[], uuid);

DROP FUNCTION "barangayan_private"."erase_household_attendance"(uuid);

DROP FUNCTION "barangayan_private"."get_my_household_attendance"();

DROP FUNCTION "barangayan_private"."guard_attendance_lifecycle"();

DROP FUNCTION "barangayan_private"."guard_household_archive"();

DROP FUNCTION "barangayan_private"."initialize_attendance_household"();

DROP FUNCTION "barangayan_private"."lookup_household_for_attendance"(text);

DROP FUNCTION "barangayan_private"."mutate_attendance_household_member"(uuid, text, jsonb, timestamp WITH time zone);

DROP FUNCTION "barangayan_private"."read_household_attendance"(uuid, uuid);

DROP FUNCTION "barangayan_private"."reject_legacy_attendance"();

DROP FUNCTION "barangayan_private"."serialize_attendance_identity"();

DROP FUNCTION "public"."check_in_household_members"(uuid, uuid, jsonb, uuid);

DROP FUNCTION "public"."check_out_household_attendance"(uuid[], uuid);

DROP FUNCTION "public"."get_my_household_attendance"();

DROP FUNCTION "public"."lookup_household_for_attendance"(text);

DROP TABLE "barangayan_private"."household_attendance_receipts";

DROP TABLE "public"."household_attendance";

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

CREATE OR REPLACE FUNCTION public.admin_mutate_record (
  p_screen    text,
  p_id        uuid,
  p_operation text,
  p_patch     jsonb,
  p_expected  timestamp with time zone
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare table_name text; allowed text[]; assignment text; current_record jsonb; actor public.profiles;
 affected integer; member_profile uuid; profile_patch jsonb; official_patch jsonb; linked_request uuid; payment_result jsonb;
begin
 select * into actor from public.profiles where id=(select auth.uid()) and role='admin' and deleted_at is null;
 if actor.id is null then raise exception 'Active administrator required' using errcode='42501'; end if;
 case p_screen
 when 'requests' then table_name:='service_requests'; allowed:=array['reference_number','resident_id','document_type_id','created_at','status','requester_notes','payment_status','payment_method'];
 when 'transactions' then table_name:='payments'; allowed:=array['amount_centavos','method','status','paymongo_source_id','created_at','collected_by','request_reference','linked_resident_id','linked_document_type_id'];
 when 'residents' then table_name:='profiles'; allowed:=array['first_name','last_name','middle_name','suffix','sex','email','mobile_number','birth_date','house_no','street','city','employment_status','occupation'];
 when 'incidents' then table_name:='incidents'; allowed:=array['title','description','address','specific_area_details','status','category_id','reporter_id','location','confirmation_count','created_at'];
 when 'health' then table_name:='medical_drives'; allowed:=array['title','type','drive_date','location','time_start','time_end','eligible_criteria','stock_label','stock_unit','stock_total','stock_remaining','is_active'];
 when 'applicants' then table_name:='drive_registrations'; allowed:=array['age','is_pwd','comorbidities','prior_dose_date','status'];
 when 'households' then table_name:='household_members'; allowed:=array['name','relation','role','is_checked_in'];
 when 'staff' then table_name:='barangay_officials'; allowed:=array['full_name','mobile_number','home_address','official_role','date_hired','is_active'];
 else raise exception 'Invalid screen' using errcode='22023'; end case;
 if p_operation not in ('save','archive','restore','delete') then raise exception 'Invalid action' using errcode='22023'; end if;
 execute format('select to_jsonb(b) from public.%I b where id=$1 for update',table_name) into current_record using p_id;
 if current_record is null or not exists(
  select 1 from public.profiles where id=actor.id and deleted_at is null) then
  raise exception 'Record unavailable' using errcode='42501';
 end if;
 -- The record projections check the same active administrator and tenant,
 -- including parent-based tenant membership for household/applicant rows.
 execute format('select count(*) from public.admin_%I_records where id=$1 and tenant_id=$2',p_screen) into affected using p_id,actor.barangay_id;
 if affected<>1 then raise exception 'Record unavailable' using errcode='42501'; end if;
 if p_screen='residents' and current_record->>'role'='admin' and p_operation<>'save' then
   raise exception 'Manage admin account removal through Staff' using errcode='42501';
  end if;
  if p_screen='staff' and (current_record->>'profile_id')::uuid=actor.id then raise exception 'You cannot change your own staff record' using errcode='42501'; end if;
 if p_expected is null or (current_record->>'updated_at')::timestamptz is distinct from p_expected then
  raise exception 'Record changed. Reload details.' using errcode='40001'; end if;
 if p_operation='archive' and current_record->>'deleted_at' is not null or p_operation='restore' and current_record->>'deleted_at' is null then
  raise exception 'Archive state changed. Reload details.' using errcode='40001'; end if;
 if p_screen='households' then
  member_profile := (current_record->>'profile_id')::uuid;
  perform 1 from public.profiles where id=member_profile for update;
 end if;
 if p_operation='save' then
  if p_screen='requests' and current_record->>'contract_version'='2' then
   return barangayan_private.admin_edit_request_details(p_id,p_patch,p_expected);
  end if;
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then
   raise exception 'Invalid editable fields' using errcode='22023'; end if;
  if p_screen='requests' and current_record->>'contract_version'='2' and p_patch-array['payment_method','payment_status']<>'{}'::jsonb then raise exception 'Use request review' using errcode='42501'; end if;
   if p_screen='requests' and p_patch ?| array['payment_method','payment_status'] then
    payment_result := barangayan_private.admin_edit_request_payment(p_id,
     (select jsonb_object_agg(key,value) from jsonb_each(p_patch) where key in ('payment_method','payment_status')),p_expected);
    p_patch := p_patch-array['payment_method','payment_status'];
    if p_patch='{}'::jsonb then return payment_result; end if;
   end if;
  if p_screen='transactions' and current_record->>'status'<>'pending' and p_patch?'amount_centavos' then raise exception 'Paid amounts are immutable' using errcode='42501'; end if;
  if exists(select 1 from jsonb_each(p_patch) e where e.key in ('name','title','first_name','last_name','full_name','location','eligible_criteria','stock_label','stock_unit') and coalesce(trim(e.value#>>'{}'),'')='') then
   raise exception 'Required fields cannot be empty' using errcode='22023'; end if;
  -- Validate references in the caller's tenant before any write. Domain triggers
  -- continue to protect versioned request snapshots and settled payment amounts.
  if p_screen='incidents' then
   if p_patch->>'category_id' is not null and not exists(select 1 from public.incident_categories where id=(p_patch->>'category_id')::uuid and barangay_id=actor.barangay_id) then
    raise exception 'Category unavailable' using errcode='42501'; end if;
   if p_patch->>'reporter_id' is not null and not exists(select 1 from public.profiles where id=(p_patch->>'reporter_id')::uuid and barangay_id=actor.barangay_id and role='resident' and deleted_at is null) then
    raise exception 'Reporter unavailable' using errcode='42501'; end if;
   if p_patch?'confirmation_count' and (jsonb_typeof(p_patch->'confirmation_count')<>'number' or (p_patch->>'confirmation_count')::numeric<0 or (p_patch->>'confirmation_count')::numeric<>trunc((p_patch->>'confirmation_count')::numeric)) then
    raise exception 'Invalid confirmation count' using errcode='22023'; end if;
   if p_patch?'location' and p_patch->'location'<>'null'::jsonb and
    (jsonb_typeof(p_patch->'location')<>'object' or jsonb_typeof(p_patch->'location'->'lat') is distinct from 'number' or jsonb_typeof(p_patch->'location'->'lng') is distinct from 'number'
     or abs((p_patch->'location'->>'lat')::numeric)>90 or abs((p_patch->'location'->>'lng')::numeric)>180) then
    raise exception 'Invalid coordinates' using errcode='22023'; end if;
  end if;
  if p_screen='requests' then
   if p_patch?'resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'resident_id')::uuid and barangay_id=actor.barangay_id and role in ('resident','admin') and deleted_at is null) then
    raise exception 'Resident unavailable' using errcode='42501'; end if;
   if p_patch?'document_type_id' and not exists(select 1 from public.document_types where id=(p_patch->>'document_type_id')::uuid and barangay_id=actor.barangay_id and deleted_at is null) then
    raise exception 'Document unavailable' using errcode='42501'; end if;
  end if;
  if p_screen='transactions' then
   linked_request:=(current_record->>'service_request_id')::uuid;
   if p_patch?'request_reference' then
    select id into linked_request from public.service_requests
    where reference_number=ltrim(btrim(p_patch->>'request_reference'),'#') and barangay_id=actor.barangay_id and deleted_at is null for update;
    if linked_request is null then raise exception 'Request reference not found' using errcode='22023'; end if;
    p_patch:=p_patch-'request_reference'||jsonb_build_object('service_request_id',linked_request);
   end if;
   if p_patch->>'collected_by' is not null and not exists(select 1 from public.profiles where id=(p_patch->>'collected_by')::uuid and barangay_id=actor.barangay_id and role='admin' and deleted_at is null) then
    raise exception 'Collector unavailable' using errcode='42501'; end if;
   if p_patch ?| array['linked_resident_id','linked_document_type_id'] then
    if p_patch?'linked_resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'linked_resident_id')::uuid and barangay_id=actor.barangay_id and role in ('resident','admin') and deleted_at is null) then
     raise exception 'Resident unavailable' using errcode='42501'; end if;
    if p_patch?'linked_document_type_id' and not exists(select 1 from public.document_types where id=(p_patch->>'linked_document_type_id')::uuid and barangay_id=actor.barangay_id and deleted_at is null) then
     raise exception 'Document unavailable' using errcode='42501'; end if;
    update public.service_requests set
     resident_id=case when p_patch?'linked_resident_id' then (p_patch->>'linked_resident_id')::uuid else resident_id end,
     document_type_id=case when p_patch?'linked_document_type_id' then (p_patch->>'linked_document_type_id')::uuid else document_type_id end
     where id=linked_request and barangay_id=actor.barangay_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Linked request unavailable' using errcode='42501'; end if;
    p_patch:=p_patch-array['linked_resident_id','linked_document_type_id'];
   end if;
   if p_patch->>'status'='paid' and current_record->>'status'<>'paid' then
    p_patch:=p_patch||jsonb_build_object('paid_at',now());
   end if;
  end if;
  if p_screen='households' and p_patch->>'is_checked_in'='false' then
   p_patch:=p_patch||jsonb_build_object('checked_in_at',null,'checked_in_center_id',null,'checked_in_center_name',null);
  end if;
  if p_screen='households' and current_record->>'deleted_at' is null then
   perform public.admin_update_household_member(member_profile,p_id,coalesce(p_patch->>'name',current_record->>'name'),coalesce(p_patch->>'relation',current_record->>'relation'),coalesce(p_patch->>'role',current_record->>'role'));
   if p_patch?'is_checked_in' then
    update public.household_members set is_checked_in=(p_patch->>'is_checked_in')::boolean,
     checked_in_at=case when (p_patch->>'is_checked_in')::boolean then checked_in_at else null end,
     checked_in_center_id=case when (p_patch->>'is_checked_in')::boolean then checked_in_center_id else null end,
     checked_in_center_name=case when (p_patch->>'is_checked_in')::boolean then checked_in_center_name else null end
     where id=p_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Household update denied' using errcode='42501'; end if;
   end if;
   affected:=1;
  else
   official_patch:=p_patch;
   if p_screen='staff' then
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into profile_patch from jsonb_each(p_patch) where key in ('full_name','mobile_number','home_address');
    official_patch:=p_patch-array['full_name','mobile_number','home_address'];
    if profile_patch<>'{}'::jsonb then
     select string_agg(format('%I = v.%I',key,key),',') into assignment from jsonb_object_keys(profile_patch) key;
     execute format('update public.profiles b set %s from jsonb_populate_record(null::public.profiles,$1) v where b.id=$2',assignment)
      using profile_patch,(current_record->>'profile_id')::uuid;
     get diagnostics affected=row_count;
     if affected<>1 then raise exception 'Staff profile update denied' using errcode='42501'; end if;
    end if;
   end if;
   if official_patch<>'{}'::jsonb then
    select string_agg(format('%I = v.%I',key,key),',') into assignment from jsonb_object_keys(official_patch) key;
    execute format('update public.%I b set %s from jsonb_populate_record(null::public.%I,$1) v where b.id=$2',table_name,assignment,table_name) using official_patch,p_id;
   else
    -- Profile-only staff edits still advance the roster version for concurrency.
    execute format('update public.%I set updated_at=now() where id=$1',table_name) using p_id;
   end if;
   get diagnostics affected=row_count;
  end if;
 elsif p_operation='delete' then
  if p_screen='households' and current_record->>'deleted_at' is null then
   perform public.admin_remove_household_member(member_profile,p_id);
   -- Archived rows survive JSON synchronization and must be removed explicitly.
  end if;
  execute format('delete from public.%I where id=$1',table_name) using p_id;
  get diagnostics affected=row_count;
  if p_screen='households' then affected:=1; end if;
 else
  execute format('update public.%I set deleted_at=$1 where id=$2',table_name)
   using case when p_operation='archive' then now() else null::timestamptz end,p_id;
  get diagnostics affected=row_count;
  if p_screen='households' then
   if p_operation='archive' then
    update public.profiles set household_members=(select coalesce(jsonb_agg(e),'[]'::jsonb) from jsonb_array_elements(household_members) e where e->>'id'<>p_id::text) where id=member_profile;
   else
    update public.profiles set household_members=household_members||jsonb_build_array(jsonb_build_object('id',p_id,'name',current_record->>'name','relation',current_record->>'relation','role',current_record->>'role'))
    where id=member_profile and not exists(select 1 from jsonb_array_elements(household_members) e where e->>'id'=p_id::text);
   end if;
  end if;
 end if;
 if affected<>1 then raise exception 'No record changed. Check your access.' using errcode='42501'; end if;
 return jsonb_build_object('id',p_id);
end $function$;

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

CREATE OR REPLACE FUNCTION public.erase_own_account_records()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := (select auth.uid());
  v_state text;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode = 'P0001'; end if;
  select state into v_state from public.account_deletion_requests where user_id = v_user;
  if v_state = 'completed' then return v_state; end if;
  if exists (select 1 from public.profiles where id = v_user and deleted_at is null) then
    if not barangayan_private.has_recent_authentication() then
      raise exception 'fresh_authentication_required' using errcode = '42501';
    end if;
  elsif v_state is null then
    raise exception 'Profile not found or already deleted' using errcode = 'P0002';
  end if;

  insert into public.account_deletion_requests (user_id, state) values (v_user, 'requested')
  on conflict (user_id) do update set attempts = public.account_deletion_requests.attempts + 1, updated_at = now();

  perform set_config('barangayan.profile_location_operation', v_user::text, true);
  update public.profiles set
    full_name = 'Deleted Resident', first_name = null, middle_name = null, last_name = null, suffix = null,
    mobile_number = null, home_address = null, house_no = null, street = null, email = null, avatar_url = null,
    birth_date = null, sex = null, employment_status = null, occupation = null,
    id_photo_urls = '{}', id_type = null, id_verification_status = null,
    current_id_submission_id = null, approved_id_submission_id = null,
    household_members = '[]'::jsonb,
    registration_location = null, registration_home_location = null, verified_location = null, verified_location_address = null,
    location_verified = null, location_verified_at = null,
    push_notifications_enabled = false, custom_accent_colors = '{}',
    deleted_at = coalesce(deleted_at, now())
  where id = v_user;
  perform set_config('barangayan.profile_location_operation', '', true);

  perform set_config('barangayan.foundation_operation', 'admin_record_correction', true);
  update public.service_requests set
    requester_notes = null, purpose_explanation = null, id_document_path = null,
    supporting_details = case when contract_version = 2 then '{}'::jsonb else null end
  where resident_id = v_user;
  perform set_config('barangayan.foundation_operation', '', true);
  update public.incidents set reporter_id = null, photo_urls = '{}' where reporter_id = v_user;

  delete from public.household_members where profile_id = v_user;
  delete from public.request_attachments where resident_id = v_user;
  update public.id_submissions set id_type = 'erased', front_path = 'erased/' || id::text || '/front', back_path = 'erased/' || id::text || '/back', confirmed_details = null
  where resident_id = v_user;
  delete from public.id_submissions s where s.resident_id = v_user
    and not exists (select 1 from public.service_requests r where r.approved_id_submission_id = s.id);
  delete from public.drive_registrations where user_id = v_user;
  delete from public.evacuation_center_checkins where user_id = v_user;
  delete from public.push_tokens where user_id = v_user;
  delete from public.announcement_reads where resident_id = v_user;
  delete from public.notification_preferences where user_id = v_user;
  delete from barangayan_private.notification_events where recipient_id = v_user;

  update public.account_deletion_requests
  set state = case when barangayan_private.deletion_state_rank(state) < 2 then 'profile_erased' else state end, last_error = null, updated_at = now()
  where user_id = v_user
  returning state into v_state;
  return v_state;
end $function$;

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

CREATE OR REPLACE FUNCTION public.set_account_deletion_state (
  p_user  uuid,
  p_state text,
  p_error text DEFAULT NULL::text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_state text;
begin
  if p_state not in ('profile_erased','storage_cleaned','auth_revoked','completed','needs_attention') then
    raise exception 'invalid_deletion_state' using errcode = '22023';
  end if;
  update public.account_deletion_requests set
    state = case
      when state = 'completed' then state
      when p_state = 'needs_attention' then 'needs_attention'
      when barangayan_private.deletion_state_rank(p_state) > barangayan_private.deletion_state_rank(state) or state = 'needs_attention' then p_state
      else state end,
    last_error = case when p_state = 'needs_attention' then left(coalesce(p_error, 'unspecified'), 200) else null end,
    completed_at = case when p_state = 'completed' then coalesce(completed_at, now()) else completed_at end,
    updated_at = now()
  where user_id = p_user
  returning state into v_state;
  if v_state is null then raise exception 'deletion_not_requested' using errcode = 'P0002'; end if;
  return v_state;
end $function$;

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

CREATE OR REPLACE FUNCTION public.sync_household_members_from_jsonb()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare member jsonb; member_id uuid; retained uuid[] := '{}';
begin
 for member in select * from jsonb_array_elements(coalesce(new.household_members,'[]'::jsonb)) loop
  begin member_id := coalesce((member->>'id')::uuid,gen_random_uuid());
  exception when invalid_text_representation then member_id := gen_random_uuid(); end;
  retained := array_append(retained,member_id);
  if exists(select 1 from public.household_members h where h.id=member_id and h.profile_id<>new.id) then
   raise exception 'Household member belongs to another profile' using errcode='42501';
  end if;
  insert into public.household_members(id,profile_id,name,relation,role)
  values(member_id,new.id,member->>'name',member->>'relation',coalesce(nullif(member->>'role',''),'member'))
  on conflict(id) do update set name=excluded.name,relation=excluded.relation,role=excluded.role;
 end loop;
 delete from public.household_members where profile_id=new.id and deleted_at is null and not(id=any(retained));
 return new;
end $function$;

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

CREATE VIEW "public"."admin_households_browse" WITH (security_invoker=true) AS  SELECT b.id,
    p.barangay_id AS tenant_id,
    (to_jsonb(b.*) || jsonb_build_object('profiles',
        CASE
            WHEN (p.id IS NULL) THEN NULL::jsonb
            ELSE jsonb_build_object('full_name', p.full_name, 'email', p.email, 'mobile_number', p.mobile_number, 'home_address', p.home_address)
        END)) AS "row",
    b.is_checked_in AS f_checked_in,
    b.relation AS f_relation,
    lower(b.name) AS x0,
    lower(p.full_name) AS x1,
    lower(b.relation) AS x2,
    lower(b.role) AS x3,
    (admin_table_keys.text_key(b.name) COLLATE "C") AS s_name,
    (admin_table_keys.text_key(p.full_name) COLLATE "C") AS s_head,
    (admin_table_keys.text_key(initcap(b.relation)) COLLATE "C") AS s_relation,
    (admin_table_keys.text_key(initcap(b.role)) COLLATE "C") AS s_role,
    b.is_checked_in AS s_checked_in,
    (admin_table_keys.text_key(b.checked_in_center_name) COLLATE "C") AS s_center,
    b.created_at AS s_added,
    b.updated_at AS s_modified,
    b.checked_in_at AS s_check_in_date
   FROM (public.household_members b
     LEFT JOIN public.profiles p ON ((p.id = b.profile_id)))
  WHERE ((b.deleted_at IS NULL) AND true AND (p.barangay_id = ( SELECT actor.barangay_id
           FROM public.profiles actor
          WHERE ((actor.id = ( SELECT auth.uid() AS uid)) AND (actor.role = 'admin'::text) AND (actor.deleted_at IS NULL)))));

REVOKE ALL ON TABLE "public"."admin_households_browse" FROM "anon";

CREATE VIEW "public"."admin_households_records" WITH (security_invoker=true) AS  SELECT archive_timestamp,
    id,
    tenant_id,
    "row",
    f_checked_in,
    f_relation,
    x0,
    x1,
    x2,
    x3,
    s_name,
    s_head,
    s_relation,
    s_role,
    s_checked_in,
    s_center,
    s_added,
    s_modified,
    s_check_in_date,
    (archive_timestamp IS NOT NULL) AS f_archived
   FROM ( SELECT b.deleted_at AS archive_timestamp,
            b.id,
            p.barangay_id AS tenant_id,
            (to_jsonb(b.*) || jsonb_build_object('profiles',
                CASE
                    WHEN (p.id IS NULL) THEN NULL::jsonb
                    ELSE jsonb_build_object('full_name', p.full_name, 'email', p.email, 'mobile_number', p.mobile_number, 'home_address', p.home_address)
                END)) AS "row",
            b.is_checked_in AS f_checked_in,
            b.relation AS f_relation,
            lower(b.name) AS x0,
            lower(p.full_name) AS x1,
            lower(b.relation) AS x2,
            lower(b.role) AS x3,
            (admin_table_keys.text_key(b.name) COLLATE "C") AS s_name,
            (admin_table_keys.text_key(p.full_name) COLLATE "C") AS s_head,
            (admin_table_keys.text_key(initcap(b.relation)) COLLATE "C") AS s_relation,
            (admin_table_keys.text_key(initcap(b.role)) COLLATE "C") AS s_role,
            b.is_checked_in AS s_checked_in,
            (admin_table_keys.text_key(b.checked_in_center_name) COLLATE "C") AS s_center,
            b.created_at AS s_added,
            b.updated_at AS s_modified,
            b.checked_in_at AS s_check_in_date
           FROM (public.household_members b
             LEFT JOIN public.profiles p ON ((p.id = b.profile_id)))
          WHERE (true AND (p.barangay_id = ( SELECT actor.barangay_id
                   FROM public.profiles actor
                  WHERE ((actor.id = ( SELECT auth.uid() AS uid)) AND (actor.role = 'admin'::text) AND (actor.deleted_at IS NULL)))))) v;

REVOKE ALL ON TABLE "public"."admin_households_records" FROM "anon";

CREATE VIEW "public"."admin_households_summary" WITH (security_invoker=true) AS  SELECT jsonb_build_object('total', count(*), 'checked_in', count(*) FILTER (WHERE f_checked_in), 'not_checked_in', count(*) FILTER (WHERE (NOT f_checked_in)), 'spouse', count(*) FILTER (WHERE (f_relation = 'spouse'::text)), 'child', count(*) FILTER (WHERE (f_relation = 'child'::text)), 'parent', count(*) FILTER (WHERE (f_relation = 'parent'::text)), 'other', count(*) FILTER (WHERE (f_relation <> ALL (ARRAY['spouse'::text, 'child'::text, 'parent'::text])))) AS summary
   FROM public.admin_households_browse
 HAVING (EXISTS ( SELECT 1
           FROM public.profiles actor
          WHERE ((actor.id = ( SELECT auth.uid() AS uid)) AND (actor.role = 'admin'::text) AND (actor.deleted_at IS NULL))));

REVOKE ALL ON TABLE "public"."admin_households_summary" FROM "anon";

CREATE TRIGGER sync_household_members_from_jsonb
  BEFORE UPDATE OF household_members ON public.profiles
  FOR EACH ROW
  WHEN ((old.household_members IS DISTINCT FROM new.household_members))
  EXECUTE FUNCTION public.sync_household_members_from_jsonb();

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

REVOKE ALL ON FUNCTION "public"."sync_household_members_from_jsonb"() FROM "service_role";

GRANT EXECUTE ON FUNCTION "public"."sync_household_members_from_jsonb"() TO "service_role";

REVOKE ALL ON TABLE "public"."household_members" FROM "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."household_members" TO "anon";

REVOKE ALL ON TABLE "public"."household_members" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."household_members" TO "authenticated";

REVOKE ALL ON TABLE "public"."household_members" FROM "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."household_members" TO "service_role";

REVOKE ALL ON TABLE "public"."admin_households_browse" FROM "authenticated";

GRANT SELECT ON TABLE "public"."admin_households_browse" TO "authenticated";

REVOKE ALL ON TABLE "public"."admin_households_browse" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_browse" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_browse" TO "service_role";

REVOKE ALL ON TABLE "public"."admin_households_records" FROM "authenticated";

GRANT SELECT ON TABLE "public"."admin_households_records" TO "authenticated";

REVOKE ALL ON TABLE "public"."admin_households_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_records" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_records" TO "service_role";

REVOKE ALL ON TABLE "public"."admin_households_summary" FROM "authenticated";

GRANT SELECT ON TABLE "public"."admin_households_summary" TO "authenticated";

REVOKE ALL ON TABLE "public"."admin_households_summary" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_summary" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_households_summary" TO "service_role";

