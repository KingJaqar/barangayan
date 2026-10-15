begin;

alter table public.household_members add column deleted_at timestamptz;
alter table public.drive_registrations add column deleted_at timestamptz;
create index household_members_archive_idx on public.household_members(profile_id, deleted_at);
create index drive_registrations_archive_idx on public.drive_registrations(drive_id, deleted_at);

-- Read the same joined, administrator/tenant-scoped projections for both modes.
-- Keep existing active views and summary consumers intact. No definer read views.
do $$
declare screen text; definition text;
begin
 foreach screen in array array['requests','transactions','residents','incidents','health','applicants','households','staff'] loop
  definition := pg_get_viewdef(format('public.admin_%s_browse',screen)::regclass, true);
  definition := rtrim(definition, E';\n ');
  definition := regexp_replace(definition, 'b\.deleted_at IS NULL', 'true', 'g');
  if screen='residents' then definition := replace(definition,'WHERE deleted_at IS NULL','WHERE true'); end if;
  definition := regexp_replace(definition, '^\s*SELECT ', 'SELECT b.deleted_at AS archive_timestamp, ');
  execute format('create view public.admin_%I_records with (security_invoker=true) as select v.*, v.archive_timestamp is not null as f_archived from (%s) v',screen,definition);
  execute format('revoke all on public.admin_%I_records from public,anon,authenticated',screen);
  execute format('grant select on public.admin_%I_records to authenticated',screen);
  if screen in ('households','applicants') then
   definition := pg_get_viewdef(format('public.admin_%s_browse',screen)::regclass, true);
   definition := regexp_replace(definition, 'WHERE ', 'WHERE b.deleted_at IS NULL AND ');
   execute format('create or replace view public.admin_%I_browse with (security_invoker=true) as %s',screen,definition);
  end if;
 end loop;
end $$;

-- Archive updates need admin SELECT visibility; DELETE is deliberately separate
-- from UPDATE. These permissions do not allow residents to delete records.
-- This internal identity lookup avoids a recursive policy on profiles itself.
create function barangayan_private.active_admin_barangay_id() returns uuid
language sql stable security definer set search_path='' as $$
 select a.barangay_id from public.profiles a where a.id=(select auth.uid())
 and (select auth.uid()) is not null and a.role='admin' and a.deleted_at is null
$$;
revoke all on function barangayan_private.active_admin_barangay_id() from public,anon;
grant usage on schema barangayan_private to authenticated;
grant execute on function barangayan_private.active_admin_barangay_id() to authenticated;
create policy "active admins read archived residents" on public.profiles for select to authenticated
using (role='resident' and barangay_id=(select barangayan_private.active_admin_barangay_id()));
create policy "active admins read archived incidents" on public.incidents for select to authenticated
using ((select public.current_role())='admin' and barangay_id=(select public.current_barangay_id())
 and exists(select 1 from public.profiles a where a.id=(select auth.uid()) and a.deleted_at is null));
create policy "active admins delete requests" on public.service_requests for delete to authenticated
using ((select public.current_role())='admin' and barangay_id=(select public.current_barangay_id())
 and exists(select 1 from public.profiles a where a.id=(select auth.uid()) and a.deleted_at is null));
create policy "active admins delete payments" on public.payments for delete to authenticated
using ((select public.current_role())='admin' and barangay_id=(select public.current_barangay_id())
 and exists(select 1 from public.profiles a where a.id=(select auth.uid()) and a.deleted_at is null));
create policy "active admins delete resident profiles" on public.profiles for delete to authenticated
using (barangay_id=(select barangayan_private.active_admin_barangay_id()) and role='resident' and id<>(select auth.uid()));
create policy "active admins delete incidents" on public.incidents for delete to authenticated
using (barangay_id=(select barangayan_private.active_admin_barangay_id()));
create policy "active admins delete registrations" on public.drive_registrations for delete to authenticated
using (exists(select 1 from public.medical_drives d join public.profiles a on a.barangay_id=d.barangay_id
 where d.id=drive_id and a.id=(select auth.uid()) and a.role='admin' and a.deleted_at is null));
grant delete on public.service_requests,public.payments,public.profiles,public.drive_registrations to authenticated;
grant select,update,delete on public.household_members,public.barangay_officials,public.incidents,public.medical_drives to authenticated;

-- Preserve archive and check-in state when a profile's JSON member list changes.
-- The former wholesale rebuild silently resurrected archives and reset check-ins.
create or replace function public.sync_household_members_from_jsonb() returns trigger
language plpgsql security definer set search_path='' as $$
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
  values(member_id,new.id,member->>'name',member->>'relation',member->>'role')
  on conflict(id) do update set name=excluded.name,relation=excluded.relation,role=excluded.role;
 end loop;
 delete from public.household_members where profile_id=new.id and deleted_at is null and not(id=any(retained));
 return new;
end $$;
revoke all on function public.sync_household_members_from_jsonb() from public,anon,authenticated;

-- Residents cannot use their existing cancel policy to alter archive state.
create function barangayan_private.guard_registration_archive() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.deleted_at is distinct from old.deleted_at and not exists(
  select 1 from public.profiles a join public.medical_drives d on d.barangay_id=a.barangay_id
  where a.id=(select auth.uid()) and a.role='admin' and a.deleted_at is null and d.id=old.drive_id) then
  raise exception 'Only active administrators can archive registrations' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function barangayan_private.guard_registration_archive() from public,anon,authenticated;
create trigger guard_registration_archive before update of deleted_at on public.drive_registrations
for each row execute function barangayan_private.guard_registration_archive();

create function barangayan_private.guard_household_archive() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.deleted_at is distinct from old.deleted_at and not exists(
  select 1 from public.profiles p where p.id=old.profile_id
  and p.barangay_id=(select barangayan_private.active_admin_barangay_id())) then
  raise exception 'Only active administrators can archive household members' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function barangayan_private.guard_household_archive() from public,anon,authenticated;
create trigger guard_household_archive before update of deleted_at on public.household_members
for each row execute function barangayan_private.guard_household_archive();

-- One invoker transaction, allowlisted entity/fields, optimistic concurrency,
-- self-protection and affected-row checks. Existing RLS, FKs and domain triggers
-- remain authoritative. No service-role key or cascading deletion workaround.
create function public.admin_mutate_record(p_screen text,p_id uuid,p_operation text,p_patch jsonb,p_expected timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare table_name text; allowed text[]; assignment text; current_record jsonb; actor public.profiles;
 affected integer; member_profile uuid; profile_patch jsonb; official_patch jsonb;
begin
 select * into actor from public.profiles where id=(select auth.uid()) and role='admin' and deleted_at is null;
 if actor.id is null then raise exception 'Active administrator required' using errcode='42501'; end if;
 case p_screen
 when 'requests' then table_name:='service_requests'; allowed:=array['status','requester_notes','payment_status','payment_method'];
 when 'transactions' then table_name:='payments'; allowed:=array['amount_centavos','method','status','paymongo_source_id'];
 when 'residents' then table_name:='profiles'; allowed:=array['first_name','last_name','middle_name','suffix','sex','email','mobile_number','birth_date','house_no','street','city','employment_status','occupation'];
 when 'incidents' then table_name:='incidents'; allowed:=array['title','description','address','specific_area_details','status'];
 when 'health' then table_name:='medical_drives'; allowed:=array['title','type','drive_date','location','time_start','time_end','eligible_criteria','stock_label','stock_unit','stock_total','stock_remaining','is_active'];
 when 'applicants' then table_name:='drive_registrations'; allowed:=array['age','is_pwd','comorbidities','prior_dose_date','status'];
 when 'households' then table_name:='household_members'; allowed:=array['name','relation','role'];
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
  if p_screen='households' and current_record->>'deleted_at' is null then
   perform public.admin_update_household_member(member_profile,p_id,coalesce(p_patch->>'name',current_record->>'name'),coalesce(p_patch->>'relation',current_record->>'relation'),coalesce(p_patch->>'role',current_record->>'role'));
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
