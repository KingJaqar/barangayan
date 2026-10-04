begin;

-- Google identity rows are Auth-managed, unlike editable user metadata. Auth
-- inserts them after auth.users, before returning the OAuth session/callback.
-- Keep the existing password-signup and staff-invitation paths intact.
create function barangayan_private.google_resident_names(p_metadata jsonb)
returns table(first_name text, last_name text)
language plpgsql immutable set search_path='' as $$
declare v_full text; v_key text; v_text text; v_given text; v_family text;
begin
 for v_key in select unnest(array['given_name','first_name','family_name','last_name','full_name','name']) loop
  v_text:=null;
  if jsonb_typeof(p_metadata->v_key)='string' then
   v_text:=nullif(regexp_replace(regexp_replace(p_metadata->>v_key,'^[[:space:]]+|[[:space:]]+$','','g'),'[[:space:]]+',' ','g'),'');
  end if;
  if v_key in ('given_name','first_name') then v_given:=coalesce(v_given,v_text);
  elsif v_key in ('family_name','last_name') then v_family:=coalesce(v_family,v_text);
  else v_full:=coalesce(v_full,v_text); end if;
 end loop;
 if v_given is not null then
  if starts_with(v_full,v_given || ' ') then v_family:=coalesce(v_family,substr(v_full,length(v_given)+2)); end if;
 elsif v_family is not null then
  if right(v_full,length(v_family)+1)=' ' || v_family then v_given:=left(v_full,length(v_full)-length(v_family)-1); end if;
 elsif v_full is not null then
  -- Editable display-name suggestion; no surname is invented for a mononym.
  v_given:=split_part(v_full,' ',1);
  v_family:=nullif(substr(v_full,length(v_given)+2),'');
 end if;
 return query select v_given,v_family;
end $$;

create function barangayan_private.provision_google_resident(p_uid uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_email text; v_metadata jsonb; v_profile public.profiles;
 v_locality public.barangay_localities; v_first text; v_last text;
begin
 if p_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 -- Same lock as completion: bootstrap and completion cannot overwrite each other.
 perform pg_advisory_xact_lock(hashtextextended(p_uid::text,1));
 select u.email,i.identity_data into v_email,v_metadata
 from auth.users u join auth.identities i on i.user_id=u.id and i.provider='google'
 where u.id=p_uid and not coalesce(u.is_anonymous,false)
 order by i.created_at,i.id limit 1;
 if not found then raise exception 'google_identity_required' using errcode='42501'; end if;
 select * into v_profile from public.profiles where id=p_uid for update;
 if found then
  if v_profile.deleted_at is not null then raise exception 'forbidden' using errcode='42501'; end if;
  return p_uid; -- Preserve every saved field, including tenant, role and ID approval.
 end if;
 begin
  select * into strict v_locality from public.barangay_localities
  where resident_registration_enabled for share;
 exception when no_data_found or too_many_rows then
  raise exception 'registration_locality_not_configured' using errcode='22023';
 end;
 select first_name,last_name into v_first,v_last from barangayan_private.google_resident_names(v_metadata);
 insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,email,city,province)
 values(p_uid,v_locality.barangay_id,'resident',concat_ws(' ',v_first,v_last),v_first,v_last,v_email,v_locality.city,v_locality.province)
 on conflict(id) do nothing;
 -- Required resident details, completion time and ID outcomes retain their defaults.
 return p_uid;
end $$;

-- Preserve all existing coordinate/locality protections. Import password-signup
-- location metadata only for accounts without a Google identity. Completion's
-- UPSERT also runs BEFORE INSERT triggers, so Google metadata must not be imported
-- there either; completion supplies explicit, validated location through its RPC.
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
  if not exists(select 1 from auth.identities where user_id=new.id and provider='google') then
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

create function barangayan_private.create_google_resident_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform barangayan_private.provision_google_resident(new.user_id);
 return new;
end $$;
create trigger create_google_resident_profile after insert on auth.identities
for each row when (new.provider='google')
execute function barangayan_private.create_google_resident_profile();

-- No caller-supplied user, tenant, role or profile payload. Repairs earlier
-- profile-less Google accounts on callback/session restart; existing rows are no-ops.
create function barangayan_private.ensure_google_resident_profile() returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return barangayan_private.provision_google_resident((select auth.uid()));
end $$;
create function public.ensure_google_resident_profile() returns uuid
language sql security invoker set search_path='' as $$
 select barangayan_private.ensure_google_resident_profile()
$$;
revoke all on function barangayan_private.google_resident_names(jsonb),
 barangayan_private.provision_google_resident(uuid),barangayan_private.create_google_resident_profile(),
 barangayan_private.ensure_google_resident_profile(),public.ensure_google_resident_profile()
 from public,anon,authenticated;
grant execute on function barangayan_private.ensure_google_resident_profile(),public.ensure_google_resident_profile() to authenticated;

comment on function public.ensure_google_resident_profile() is
 'Idempotently creates the authenticated Google resident''s minimal profile. Auth supplies identity/name/email; configuration supplies tenant. Does not complete required details or approve ID evidence.';
notify pgrst,'reload schema';
commit;
