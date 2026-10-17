-- Complete the existing admin sheet editors with the fields already editable in tables.
-- Retain invoker permissions, tenant checks, locks, version checks and domain triggers.
begin;

create or replace function public.admin_mutate_record(p_screen text,p_id uuid,p_operation text,p_patch jsonb,p_expected timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare table_name text; allowed text[]; assignment text; current_record jsonb; actor public.profiles;
 affected integer; member_profile uuid; profile_patch jsonb; official_patch jsonb; linked_request uuid;
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
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then
   raise exception 'Invalid editable fields' using errcode='22023'; end if;
  if p_screen='requests' and current_record->>'contract_version'='2' and p_patch-'payment_method'<>'{}'::jsonb then raise exception 'Use request review' using errcode='42501'; end if;
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
   if p_patch?'resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'resident_id')::uuid and barangay_id=actor.barangay_id and role='resident' and deleted_at is null) then
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
    if p_patch?'linked_resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'linked_resident_id')::uuid and barangay_id=actor.barangay_id and role='resident' and deleted_at is null) then
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
end $$;
revoke all on function public.admin_mutate_record(text,uuid,text,jsonb,timestamptz) from public,anon;
grant execute on function public.admin_mutate_record(text,uuid,text,jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
