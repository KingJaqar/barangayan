-- Resident iOS Phase 3: close the direct-write and execution-surface gaps found by the
-- two-tenant boundary tests (supabase/tests/resident_ios_phase3_backend.test.sql).
--
-- Compatible with the Android/web clients: every accepted payload they send today is
-- still accepted. Only writes that were previously able to forge server-owned state
-- (confirmation count, status, foreign category/zone/photo references, foreign read
-- state, another account's push token) are now rejected, and routines that were
-- callable by anonymous sessions are revoked.
begin;

-- Active (not deleted) account of any role, for guards that must reject stale JWTs of
-- deleted accounts. NULL when the caller is anonymous or deleted.
create or replace function barangayan_private.active_member_barangay_id() returns uuid
language sql stable security definer set search_path='' as $$
 select p.barangay_id from public.profiles p
 where p.id=(select auth.uid()) and p.deleted_at is null
$$;
revoke all on function barangayan_private.active_member_barangay_id() from public,anon;
grant execute on function barangayan_private.active_member_barangay_id() to authenticated;

-- Fresh authentication evidence from the Auth-issued JWT (`amr` timestamps survive
-- token refresh, so a refreshed old session is not fresh). Server-side counterpart of
-- the clients' own freshness windows.
create or replace function barangayan_private.has_recent_authentication(p_window interval default interval '10 minutes')
returns boolean language sql stable set search_path='' as $$
 select coalesce((
  select max(case when (e->>'timestamp') ~ '^[0-9]{1,12}$' then (e->>'timestamp')::bigint end)
  from jsonb_array_elements(case when jsonb_typeof((select auth.jwt())->'amr')='array'
                                 then (select auth.jwt())->'amr' else '[]'::jsonb end) e
 ) >= extract(epoch from (now()-p_window))::bigint,false)
$$;
revoke all on function barangayan_private.has_recent_authentication(interval) from public,anon;
grant execute on function barangayan_private.has_recent_authentication(interval) to authenticated;

-- ===== Incidents =====
-- Direct API writes were only constrained by row ownership: a reporter could set the
-- confirmation count, change status, move the row to another barangay or reference
-- another barangay's category, zone or photo objects. SECURITY DEFINER operations
-- (withdraw/confirm), the service role and migrations run as another role and are not
-- restricted by this guard.
create or replace function barangayan_private.guard_incident_write() returns trigger
language plpgsql set search_path='' as $$
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

 -- Residents may only withdraw (open -> withdrawn), soft-delete and mark a resolved
 -- report read; every other column is immutable on the direct API path.
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
end $$;
revoke all on function barangayan_private.guard_incident_write() from public,anon;

drop trigger if exists a_guard_incident_write on public.incidents;
create trigger a_guard_incident_write before insert or update on public.incidents
for each row execute function barangayan_private.guard_incident_write();

-- Corroboration and withdrawal keep their behaviour but stop trusting a deleted
-- account's still-valid JWT, and compare tenants NULL-safely.
create or replace function public.confirm_incident(p_incident_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
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
end $$;

create or replace function public.withdraw_incident(p_incident_id uuid) returns void
language plpgsql security definer set search_path=public as $$
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
 -- Deliberately no role branch: staff withdrawing a report they filed themselves
 -- receive resident semantics.
 if v_reporter_id is distinct from auth.uid() then
  raise exception 'you can only withdraw a report you filed yourself';
 end if;
 if v_status<>'open' then raise exception 'you can only withdraw a report that is still open'; end if;
 if v_created_at<now()-interval '24 hours' then
  raise exception 'the 24-hour withdrawal window for this report has closed';
 end if;
 update public.incidents set status='withdrawn' where id=p_incident_id;
end $$;

-- ===== Announcement read state =====
-- RLS only proved resident_id=auth.uid(); the announcement could belong to another
-- barangay or be deleted, leaking existence and polluting unread counters.
create or replace function barangayan_private.guard_announcement_read() returns trigger
language plpgsql set search_path='' as $$
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
end $$;
revoke all on function barangayan_private.guard_announcement_read() from public,anon;
drop trigger if exists guard_announcement_read on public.announcement_reads;
create trigger guard_announcement_read before insert or update on public.announcement_reads
for each row execute function barangayan_private.guard_announcement_read();

-- ===== Push tokens: one current owner per device token =====
-- A token left behind by the previous account of a shared device would receive the
-- next account's notifications. Keep the most recently used registration only.
delete from public.push_tokens t using public.push_tokens n
 where t.expo_push_token=n.expo_push_token and t.id<>n.id
   and (n.last_used_at,n.id)>(t.last_used_at,t.id);
create unique index if not exists push_tokens_expo_push_token_key on public.push_tokens(expo_push_token);
-- NOT VALID: new and changed rows are checked; legacy rows are left for the notification
-- phase to validate once the sender can report invalid tokens.
alter table public.push_tokens drop constraint if exists push_tokens_expo_push_token_format;
alter table public.push_tokens add constraint push_tokens_expo_push_token_format
 check (char_length(expo_push_token)<=200 and expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$') not valid;

create or replace function public.upsert_push_token(p_expo_push_token text, p_device_type text) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;

-- ===== Evacuation check-in with an authoritative receipt =====
-- The table insert has no idempotency (unique key includes a server timestamp), so a
-- double tap or a retry after a lost response created duplicate attendance. This
-- online-only operation returns the existing receipt for the same resident and center
-- within ten minutes. The direct insert path stays for the Android client.
create or replace function public.check_in_to_evacuation_center(p_center_id uuid)
returns table(check_in_id uuid,evacuation_center_id uuid,evacuation_center_name text,barangay_id uuid,
              checked_in_at timestamptz,already_checked_in boolean)
language plpgsql security definer set search_path='' as $$
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
end $$;
comment on function public.check_in_to_evacuation_center(uuid) is
 'Online, resident-only evacuation check-in for the caller. Idempotent for ten minutes per center; returns the authoritative receipt.';

-- ===== Medical registration input rules =====
-- Same operation, result shape and error codes as before; adds the server-side input
-- and closed-drive rules the clients previously enforced only in their forms. Dates are
-- evaluated in the barangay's local calendar (Asia/Manila). Existing P0001-P0004 codes
-- are unchanged; a drive whose date has passed is P0005 and invalid input is 22023.
create or replace function public.register_for_drive(
  p_drive_id uuid, p_age integer, p_is_pwd boolean, p_comorbidities text[], p_prior_dose_date date default null
) returns json
language plpgsql security definer set search_path='' as $$
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

 -- Lock the drive row so concurrent registrations cannot oversell.
 select * into v_drive from public.medical_drives where id=p_drive_id and is_active=true and deleted_at is null for update;
 if not found then raise exception 'Drive not found or inactive' using errcode='P0002'; end if;
 if v_drive.drive_date<v_today then raise exception 'Registration is closed for this drive' using errcode='P0005'; end if;
 -- A resident who already holds a slot is told so, not that the drive is full.
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
end $$;

-- ===== Account deletion requires fresh authentication =====
-- The Edge Function checked only that the caller held a valid JWT, and the RPC was
-- directly callable with any refreshed session. A deleted profile still converges on
-- retry (P0002) before the freshness check so the ban step can be completed.
create or replace function public.request_own_account_deletion() returns void
language plpgsql security definer set search_path='' as $$
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
end $$;

-- ===== Payments: resident insert policy =====
-- Migration 0017 dropped this policy, but the hosted project still carries it (found by
-- the Phase 3 catalog comparison on 2026-10-14): with it a resident can insert a payment
-- row for their own request, including a forged `paid` row. Residents never create payment
-- rows; they go through start_pickup_payment and the payment Edge Functions.
drop policy if exists "residents can create a payment on their own request" on public.payments;

-- ===== Execution surface =====
-- Supabase's default privileges grant EXECUTE to anon on every public routine. These
-- operate on the caller's own identity or are staff/maintenance operations; none has an
-- anonymous use. Other behaviour is unchanged.
revoke all on function public.confirm_incident(uuid) from public,anon;
revoke all on function public.withdraw_incident(uuid) from public,anon;
revoke all on function public.soft_delete_incident(uuid) from public,anon;
revoke all on function public.request_own_account_deletion() from public,anon;
revoke all on function public.upsert_push_token(text,text) from public,anon;
revoke all on function public.check_in_to_evacuation_center(uuid) from public,anon;
revoke all on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer) from public,anon;
revoke all on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer,integer) from public,anon;
revoke all on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer,integer,text) from public,anon;
grant execute on function public.confirm_incident(uuid) to authenticated,service_role;
grant execute on function public.withdraw_incident(uuid) to authenticated,service_role;
grant execute on function public.soft_delete_incident(uuid) to authenticated,service_role;
grant execute on function public.request_own_account_deletion() to authenticated,service_role;
grant execute on function public.upsert_push_token(text,text) to authenticated,service_role;
grant execute on function public.check_in_to_evacuation_center(uuid) to authenticated,service_role;
grant execute on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer) to authenticated,service_role;
grant execute on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer,integer) to authenticated,service_role;
grant execute on function public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer,integer,text) to authenticated,service_role;

-- Trigger functions are never RPC endpoints; firing a trigger does not check EXECUTE.
revoke all on function public.guard_drive_registration_tenant() from public,anon,authenticated;
revoke all on function public.guard_evacuation_checkin_tenant() from public,anon,authenticated;
revoke all on function public.guard_id_verification_status() from public,anon,authenticated;
revoke all on function public.guard_role_escalation() from public,anon,authenticated;
revoke all on function public.handle_household_member_updated_at() from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.prevent_verification_field_update() from public,anon,authenticated;
revoke all on function public.sync_barangay_official() from public,anon,authenticated;

-- Scheduled maintenance only (pg_cron runs as the owner): any session could previously
-- trigger a full recomputation of every barangay's waste-zone scores.
revoke all on function public.recompute_waste_zone_scores() from public,anon,authenticated;
grant execute on function public.recompute_waste_zone_scores() to service_role;

notify pgrst,'reload schema';
commit;
