begin;

-- Initial hashes (including Auth's generated OTP password) never prove choice.
-- No credentials are copied into this private, non-exposed record.
create table barangayan_private.resident_account_lifecycle (
 user_id uuid primary key references auth.users(id) on delete cascade,
 registration_origin text not null check (registration_origin in ('email_otp','google','legacy')),
 password_set boolean,
 password_evidence text not null check (password_evidence in ('absent','unknown_initial_hash','auth_password_write')),
 creation_transaction xid8,
 created_at timestamptz not null default clock_timestamp(),
 password_observed_at timestamptz
);
alter table barangayan_private.resident_account_lifecycle enable row level security;
revoke all on barangayan_private.resident_account_lifecycle from public,anon,authenticated,service_role;

-- This backfill is deliberately conservative and replay-safe. Metadata and even
-- password AMR can come from the internal auto-confirmed OTP signup session.
insert into barangayan_private.resident_account_lifecycle(user_id,registration_origin,password_set,password_evidence)
select u.id,'legacy',case when coalesce(u.encrypted_password,'')='' then false else null end,
 case when coalesce(u.encrypted_password,'')='' then 'absent' else 'unknown_initial_hash' end
from auth.users u on conflict(user_id) do nothing;

create function barangayan_private.observe_resident_auth_password() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into barangayan_private.resident_account_lifecycle
   (user_id,registration_origin,password_set,password_evidence,creation_transaction)
  values(new.id,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' then 'email_otp'
    when new.raw_app_meta_data->>'provider'='google' then 'google' else 'legacy' end,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' or coalesce(new.encrypted_password,'')='' then false else null end,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' or coalesce(new.encrypted_password,'')='' then 'absent' else 'unknown_initial_hash' end,
   pg_current_xact_id()) on conflict(user_id) do nothing;
 elsif new.encrypted_password is distinct from old.encrypted_password then
  -- Ignore initial multi-statement creation, but observe later server credential
  -- writes/removal atomically. Auth v2.197.0 writes setup/change/recovery here;
  -- its login re-encryption follows successful existing-password authentication.
  update barangayan_private.resident_account_lifecycle
  set password_set=coalesce(new.encrypted_password,'')<>'',
   password_evidence=case when coalesce(new.encrypted_password,'')='' then 'absent' else 'auth_password_write' end,
   password_observed_at=clock_timestamp()
  where user_id=new.id and creation_transaction is distinct from pg_current_xact_id();
 end if;
 return new;
end $$;
create trigger observe_resident_auth_password after insert or update of encrypted_password on auth.users
for each row execute function barangayan_private.observe_resident_auth_password();
revoke all on function barangayan_private.observe_resident_auth_password() from public,anon,authenticated,service_role;

-- One SQL predicate for completion, status and the existing submission boundary.
-- Cross-language fixture tests reconcile it with profileCompletionSchema.
create function barangayan_private.resident_details_complete(p_input jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare k text; max_len integer; v text; d date;
 -- ECMAScript trim/\s characters, matching Zod's string trim/name rules.
 ws text:=E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)
  ||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)
  ||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 if jsonb_typeof(p_input) is distinct from 'object' then return false; end if;
 for k,max_len in select * from (values ('firstName',200),('lastName',200),('houseNo',200),('street',500)) fields loop
  if jsonb_typeof(p_input->k) is distinct from 'string' then return false; end if;
  v:=btrim(p_input->>k,ws);
  -- JavaScript max lengths count UTF-16 units, not Unicode code points.
  if length(v)+length(regexp_replace(v,U&'[^\+010000-\+10FFFF]','','g')) not between 1 and max_len then return false; end if;
  if k in ('firstName','lastName') and v !~ ('^[A-Za-z'||ws||']+$') then return false; end if;
 end loop;
 for k,max_len in select * from (values ('middleName',200),('suffix',50),('occupation',200)) fields loop
  if p_input ? k then
   if jsonb_typeof(p_input->k) is distinct from 'string' then return false; end if;
   v:=btrim(p_input->>k,ws);
   if length(v)+length(regexp_replace(v,U&'[^\+010000-\+10FFFF]','','g'))>max_len then return false; end if;
  end if;
 end loop;
 if not coalesce(jsonb_typeof(p_input->'sex')='string' and p_input->>'sex' in ('male','female')
  and jsonb_typeof(p_input->'employmentStatus')='string' and p_input->>'employmentStatus' in ('employed','unemployed','student','self_employed','retired')
  and jsonb_typeof(p_input->'mobileNumber')='string' and p_input->>'mobileNumber' ~ '^09[0-9]{9}$'
  and jsonb_typeof(p_input->'birthDate')='string' and p_input->>'birthDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',false) then return false; end if;
 begin d:=(p_input->>'birthDate')::date; exception when invalid_datetime_format or datetime_field_overflow then return false; end;
 return d<=current_date and to_char(d,'YYYY-MM-DD')=p_input->>'birthDate';
end $$;

create function barangayan_private.resident_profile_complete(p public.profiles) returns boolean
language sql stable set search_path='' as $$
 select coalesce(p.id is not null and p.deleted_at is null and p.role='resident'
 and barangayan_private.resident_details_complete(jsonb_strip_nulls(jsonb_build_object(
  'firstName',p.first_name,'lastName',p.last_name,'middleName',p.middle_name,'suffix',p.suffix,
  'houseNo',p.house_no,'street',p.street,'sex',p.sex,'employmentStatus',p.employment_status,
  'occupation',p.occupation,'mobileNumber',p.mobile_number,'birthDate',p.birth_date))),false)
$$;

create or replace function barangayan_private.require_complete_profile_for_submission() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 if (select auth.uid()) is null then return new; end if;
 select * into p from public.profiles where id=(select auth.uid()) and deleted_at is null;
 if found and p.role<>'resident' then return new; end if;
 if not barangayan_private.resident_profile_complete(p) then
  raise exception 'resident_profile_completion_required' using errcode='42501';
 end if;
 return new;
end $$;

-- Keep the proven completion/locality/location/role operation. Validate through
-- the same predicate after delegation; established validation errors keep their
-- priority, and an invalid result rolls back the entire operation.
alter function barangayan_private.complete_resident_profile(jsonb) rename to complete_resident_profile_locations;
create function barangayan_private.complete_resident_profile(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'authentication_required' using errcode='42501'; end if;
 v_id:=barangayan_private.complete_resident_profile_locations(p_input);
 if not barangayan_private.resident_details_complete(p_input) then raise exception 'invalid_profile_fields' using errcode='22023'; end if;
 return v_id;
end $$;
create or replace function public.complete_resident_profile(p_input jsonb) returns uuid
language sql security invoker set search_path='' as $$ select barangayan_private.complete_resident_profile(p_input) $$;
revoke all on function barangayan_private.complete_resident_profile_locations(jsonb) from public,anon,authenticated,service_role;
revoke all on function barangayan_private.resident_details_complete(jsonb),barangayan_private.resident_profile_complete(public.profiles),
 barangayan_private.complete_resident_profile(jsonb) from public,anon,authenticated,service_role;
grant execute on function barangayan_private.complete_resident_profile(jsonb) to authenticated;

create function barangayan_private.get_resident_account_setup_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); p public.profiles; lifecycle barangayan_private.resident_account_lifecycle;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u where u.id=v_uid and not coalesce(u.is_anonymous,false)
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
  raise exception 'resident_identity_required' using errcode='42501'; end if;
 select * into p from public.profiles where id=v_uid;
 if found and (p.role<>'resident' or p.deleted_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into lifecycle from barangayan_private.resident_account_lifecycle where user_id=v_uid;
 if not found then raise exception 'resident_setup_state_unavailable' using errcode='55000'; end if;
 return jsonb_build_object('registrationOrigin',lifecycle.registration_origin,
  'profileComplete',barangayan_private.resident_profile_complete(p),'passwordSet',lifecycle.password_set,
  'hasGoogleIdentity',exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='google'));
end $$;
create function public.get_resident_account_setup_status() returns jsonb
language sql stable security invoker set search_path='' as $$ select barangayan_private.get_resident_account_setup_status() $$;
revoke all on function barangayan_private.get_resident_account_setup_status(),public.get_resident_account_setup_status() from public,anon,authenticated,service_role;
grant execute on function barangayan_private.get_resident_account_setup_status(),public.get_resident_account_setup_status() to authenticated;
comment on function public.get_resident_account_setup_status() is
 'Caller-only resident setup status. Null passwordSet means unresolved legacy provenance; never replace its credential via first-time setup. Metadata flow hints confer no authorization.';
notify pgrst,'reload schema';
commit;
