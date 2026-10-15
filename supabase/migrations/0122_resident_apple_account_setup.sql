-- Resident iOS Phase 3 (P03-T03): provider-aware account setup for Sign in with Apple.
--
-- Additive. `public.get_resident_account_setup_status()` keeps its strict legacy shape
-- (`registrationOrigin` email_otp | google | legacy) for Android/web; an Apple account
-- is reported there as `legacy` with its true password state, which those clients treat
-- as "recover a password first". iOS consumes the new versioned
-- `public.get_resident_account_setup_status_v2()`.
--
-- Apple Auth-managed identity rows (not editable user metadata) are the only input to
-- profile provisioning, exactly as for Google. Tenant comes from the configured
-- registration locality. No profile detail, completion or ID approval is invented.
begin;

alter table barangayan_private.resident_account_lifecycle
 drop constraint resident_account_lifecycle_registration_origin_check;
alter table barangayan_private.resident_account_lifecycle
 add constraint resident_account_lifecycle_registration_origin_check
 check (registration_origin in ('email_otp','google','apple','legacy'));

-- Same observation logic as 0107 plus the Apple origin. An Apple sign-in carries no
-- password, so its password state is "absent" until a server credential write.
create or replace function barangayan_private.observe_resident_auth_password() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into barangayan_private.resident_account_lifecycle
   (user_id,registration_origin,password_set,password_evidence,creation_transaction)
  values(new.id,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' then 'email_otp'
    when new.raw_app_meta_data->>'provider'='google' then 'google'
    when new.raw_app_meta_data->>'provider'='apple' then 'apple' else 'legacy' end,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' or coalesce(new.encrypted_password,'')='' then false else null end,
   case when new.raw_user_meta_data->>'resident_registration_origin'='email_otp' or coalesce(new.encrypted_password,'')='' then 'absent' else 'unknown_initial_hash' end,
   pg_current_xact_id()) on conflict(user_id) do nothing;
 elsif new.encrypted_password is distinct from old.encrypted_password then
  update barangayan_private.resident_account_lifecycle
  set password_set=coalesce(new.encrypted_password,'')<>'',
   password_evidence=case when coalesce(new.encrypted_password,'')='' then 'absent' else 'auth_password_write' end,
   password_observed_at=clock_timestamp()
  where user_id=new.id and creation_transaction is distinct from pg_current_xact_id();
 end if;
 return new;
end $$;

-- Provider-managed identities never import user-editable registration metadata.
create or replace function barangayan_private.guard_profile_locations() returns trigger
language plpgsql security definer set search_path='' as $$
declare geometry jsonb; metadata jsonb; configured uuid;
begin
 select boundary into geometry from public.barangays where id=new.barangay_id;
 if tg_op='INSERT' and new.role='resident' then
  select raw_user_meta_data into metadata from auth.users where id=new.id;
  if metadata ? 'barangay_id' then
   select barangay_id into configured from public.barangay_localities where resident_registration_enabled;
   if (select count(*) from public.barangay_localities where resident_registration_enabled)<>1 or new.barangay_id is distinct from configured then
    raise exception 'registration_locality_not_configured' using errcode='22023';
   end if;
  end if;
  if not exists(select 1 from auth.identities where user_id=new.id and provider in ('google','apple')) then
   if metadata ? 'registration_gps' then new.registration_location:=nullif(metadata->'registration_gps','null'::jsonb); end if;
   if metadata ? 'registration_home' then new.registration_home_location:=nullif(metadata->'registration_home','null'::jsonb); end if;
  end if;
 elsif tg_op='UPDATE' and current_setting('role',true) in ('authenticated','anon')
   and current_setting('barangayan.profile_location_operation',true) is distinct from new.id::text
   and (new.registration_location is distinct from old.registration_location or new.registration_home_location is distinct from old.registration_home_location
     or new.location_verified is distinct from old.location_verified) then
  raise exception 'registration_location_operation_required' using errcode='42501';
 end if;
 if not barangayan_private.valid_location(new.registration_location) or not barangayan_private.valid_location(new.registration_home_location)
   or not barangayan_private.valid_location(new.verified_location) then raise exception 'invalid_coordinates' using errcode='22023'; end if;
 if tg_op='INSERT' then
  new.location_verified:=barangayan_private.location_inside(coalesce(new.registration_home_location,new.registration_location),geometry);
 end if;
 if new.verified_location is not null and (tg_op='INSERT' or new.verified_location is distinct from old.verified_location) then
  if barangayan_private.location_inside(new.verified_location,geometry) is distinct from true then raise exception 'location_outside_or_unavailable' using errcode='22023'; end if;
  new.location_verified_at:=clock_timestamp();
 elsif tg_op='UPDATE' and new.location_verified_at is distinct from old.location_verified_at and new.verified_location is not distinct from old.verified_location then
  new.location_verified_at:=old.location_verified_at;
 end if;
 return new;
end $$;

-- Apple supplies the (possibly private-relay) email on the Auth user and names, when
-- present, in identity data; subsequent sign-ins may omit names, which stay NULL until
-- the resident completes their profile. Same advisory lock as completion/Google.
create function barangayan_private.provision_apple_resident(p_uid uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_email text; v_metadata jsonb; v_profile public.profiles;
 v_locality public.barangay_localities; v_first text; v_last text;
begin
 if p_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_uid::text,1));
 select u.email,i.identity_data into v_email,v_metadata
 from auth.users u join auth.identities i on i.user_id=u.id and i.provider='apple'
 where u.id=p_uid and not coalesce(u.is_anonymous,false)
 order by i.created_at,i.id limit 1;
 if not found then raise exception 'apple_identity_required' using errcode='42501'; end if;
 select * into v_profile from public.profiles where id=p_uid for update;
 if found then
  if v_profile.deleted_at is not null then raise exception 'forbidden' using errcode='42501'; end if;
  return p_uid;
 end if;
 begin
  select * into strict v_locality from public.barangay_localities
  where resident_registration_enabled for share;
 exception when no_data_found or too_many_rows then
  raise exception 'registration_locality_not_configured' using errcode='22023';
 end;
 select first_name,last_name into v_first,v_last from barangayan_private.google_resident_names(coalesce(v_metadata,'{}'::jsonb));
 insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,email,city,province)
 values(p_uid,v_locality.barangay_id,'resident',concat_ws(' ',v_first,v_last),v_first,v_last,v_email,v_locality.city,v_locality.province)
 on conflict(id) do nothing;
 return p_uid;
end $$;

create function barangayan_private.create_apple_resident_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform barangayan_private.provision_apple_resident(new.user_id);
 return new;
end $$;
create trigger create_apple_resident_profile after insert on auth.identities
for each row when (new.provider='apple')
execute function barangayan_private.create_apple_resident_profile();

create function barangayan_private.ensure_apple_resident_profile() returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return barangayan_private.provision_apple_resident((select auth.uid()));
end $$;
create function public.ensure_apple_resident_profile() returns uuid
language sql security invoker set search_path='' as $$
 select barangayan_private.ensure_apple_resident_profile()
$$;
revoke all on function barangayan_private.provision_apple_resident(uuid),barangayan_private.create_apple_resident_profile(),
 barangayan_private.ensure_apple_resident_profile(),public.ensure_apple_resident_profile() from public,anon,authenticated;
grant execute on function barangayan_private.ensure_apple_resident_profile(),public.ensure_apple_resident_profile() to authenticated;
comment on function public.ensure_apple_resident_profile() is
 'Idempotently creates the authenticated Apple resident''s minimal profile. Auth supplies identity/email; configuration supplies tenant. Does not complete required details or approve ID evidence.';

-- v1 keeps its strict three-value origin. An Apple account has no Google identity, so
-- the legacy clients' derived mode remains conservative (recover a password first).
create or replace function barangayan_private.get_resident_account_setup_status() returns jsonb
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
 return jsonb_build_object('registrationOrigin',case when lifecycle.registration_origin='apple' then 'legacy' else lifecycle.registration_origin end,
  'profileComplete',barangayan_private.resident_profile_complete(p),'passwordSet',lifecycle.password_set,
  'hasGoogleIdentity',exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='google'));
end $$;

-- v2: provider-aware contract for iOS. Unknown providers are surfaced, not hidden, so
-- the client can fail closed on a value it does not understand.
create function barangayan_private.get_resident_account_setup_status_v2() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); p public.profiles; lifecycle barangayan_private.resident_account_lifecycle;
 v_email text;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select u.email into v_email from auth.users u where u.id=v_uid and not coalesce(u.is_anonymous,false)
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());
 if not found then raise exception 'resident_identity_required' using errcode='42501'; end if;
 select * into p from public.profiles where id=v_uid;
 if found and (p.role<>'resident' or p.deleted_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into lifecycle from barangayan_private.resident_account_lifecycle where user_id=v_uid;
 if not found then raise exception 'resident_setup_state_unavailable' using errcode='55000'; end if;
 return jsonb_build_object('contractVersion',2,
  'registrationOrigin',lifecycle.registration_origin,
  'profileComplete',barangayan_private.resident_profile_complete(p),
  'passwordSet',lifecycle.password_set,
  'identityProviders',coalesce((select jsonb_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id=v_uid),'[]'::jsonb),
  'hasGoogleIdentity',exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='google'),
  'hasAppleIdentity',exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='apple'),
  'emailIsPrivateRelay',coalesce(lower(v_email) like '%@privaterelay.appleid.com',false));
end $$;
create function public.get_resident_account_setup_status_v2() returns jsonb
language sql stable security invoker set search_path='' as $$ select barangayan_private.get_resident_account_setup_status_v2() $$;
revoke all on function barangayan_private.get_resident_account_setup_status_v2(),public.get_resident_account_setup_status_v2() from public,anon,authenticated,service_role;
grant execute on function barangayan_private.get_resident_account_setup_status_v2(),public.get_resident_account_setup_status_v2() to authenticated;
comment on function public.get_resident_account_setup_status_v2() is
 'Caller-only, provider-aware resident setup status for iOS (contractVersion 2). Null passwordSet means unresolved legacy provenance. The v1 function keeps its strict shape for Android/web.';

notify pgrst,'reload schema';
commit;
