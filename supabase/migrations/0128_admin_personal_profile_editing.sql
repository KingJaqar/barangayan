begin;

-- Expand self-editable admin personal details only. Verification, account role,
-- tenant, staff and associated resident data remain outside this write boundary.
create or replace function barangayan_private.enforce_profile_locality() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.barangay_localities; begin
  -- Admin contact addresses are personal data, not resident eligibility evidence.
  if tg_op='UPDATE' and old.role='admin' and new.role='admin' then return new; end if;
  select * into l from public.barangay_localities where barangay_id=new.barangay_id;
  if not found then return new; end if;
  if tg_op='UPDATE' and current_user in ('authenticated','anon')
    and new.home_address is distinct from old.home_address and new.house_no is not distinct from old.house_no
    and new.street is not distinct from old.street then
    raise exception 'derived_address' using errcode='42501';
  end if;
  if tg_op='UPDATE' and current_user in ('authenticated','anon') and
    ((new.city is distinct from old.city and new.city is distinct from l.city)
      or (new.province is distinct from old.province and new.province is distinct from l.province)) then
    raise exception 'fixed_locality' using errcode='42501';
  end if;
  new.city:=l.city; new.province:=l.province;
  return new;
end $$;

create or replace function public.compose_profile_display_fields() returns trigger
language plpgsql set search_path='' as $$
declare l public.barangay_localities; v_name text; begin
  if coalesce(nullif(trim(new.first_name),''),nullif(trim(new.middle_name),''),nullif(trim(new.last_name),''),nullif(trim(new.suffix),'')) is not null then
    new.full_name:=concat_ws(' ',nullif(trim(new.first_name),''),nullif(trim(new.middle_name),''),nullif(trim(new.last_name),''),nullif(trim(new.suffix),''));
  end if;
  -- Preserve the independently editable admin contact address and locality.
  if tg_op='UPDATE' and old.role='admin' and new.role='admin' then return new; end if;
  if nullif(trim(new.house_no),'') is not null or nullif(trim(new.street),'') is not null then
    select * into l from public.barangay_localities where barangay_id=new.barangay_id;
    select name into v_name from public.barangays where id=new.barangay_id;
    new.home_address:=concat_ws(', ',nullif(trim(concat_ws(' ',nullif(trim(new.house_no),''),nullif(trim(new.street),''))),''),
      coalesce(l.display_name,v_name),nullif(trim(new.city),''),nullif(trim(new.province),''));
  end if;
  return new;
end $$;

create or replace function public.admin_update_own_profile(p_patch jsonb,p_expected timestamptz)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare p public.profiles; v_count integer; v_updated timestamptz; v_path text; v_assignments text; v_name public.profiles; begin
 perform barangayan_private.admin_profile_actor();
 if p_expected is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
  or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('full_name','mobile_number','email','avatar_url','first_name','middle_name','last_name','suffix','home_address','city','province','birth_date','sex','employment_status','occupation'))
  or exists(select 1 from jsonb_each(p_patch) e where jsonb_typeof(e.value) not in ('string','null')) then
  raise exception 'invalid_profile_patch' using errcode='22023';
 end if;
 select * into p from public.profiles where id=(select auth.uid()) for update;
 perform 1 from public.barangay_officials where profile_id=(select auth.uid()) for share;
 perform barangayan_private.admin_profile_actor();
 if p.id is null then raise exception 'active_admin_required' using errcode='42501'; end if;
 if p.updated_at is distinct from p_expected then raise exception 'profile_changed' using errcode='PT409'; end if;
 if p_patch ? 'full_name' and (nullif(btrim(p_patch->>'full_name'),'') is null or char_length(btrim(p_patch->>'full_name'))>150
  or coalesce(nullif(btrim(p.first_name),''),nullif(btrim(p.last_name),''),nullif(btrim(p.middle_name),''),nullif(btrim(p.suffix),'')) is not null) then
  raise exception 'legacy_name_only' using errcode='22023';
 end if;
 if p_patch ?| array['first_name','middle_name','last_name','suffix'] then
  if p_patch ? 'full_name' then raise exception 'choose_one_name_format' using errcode='22023'; end if;
  v_name:=jsonb_populate_record(p,p_patch);
  if nullif(btrim(v_name.first_name),'') is null or nullif(btrim(v_name.last_name),'') is null
   or char_length(v_name.first_name)>100 or char_length(v_name.last_name)>100
   or char_length(v_name.middle_name)>100 or char_length(v_name.suffix)>20
   or char_length(concat_ws(' ',v_name.first_name,v_name.middle_name,v_name.last_name,v_name.suffix))>150 then
   raise exception 'invalid_structured_name' using errcode='22023';
  end if;
 end if;
 if char_length(p_patch->>'home_address')>500 or char_length(p_patch->>'city')>150
  or char_length(p_patch->>'province')>150 or char_length(p_patch->>'occupation')>150 then
  raise exception 'invalid_profile_text' using errcode='22023';
 end if;
 if p_patch->>'sex' is not null and p_patch->>'sex' not in ('male','female') then
  raise exception 'invalid_sex' using errcode='22023';
 end if;
 if p_patch->>'employment_status' is not null and p_patch->>'employment_status' not in ('employed','unemployed','student','self_employed','retired') then
  raise exception 'invalid_employment' using errcode='22023';
 end if;
 if p_patch->>'birth_date' is not null then
  begin
   if p_patch->>'birth_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_patch->>'birth_date')::date>current_date then
    raise exception 'invalid_birth_date' using errcode='22023';
   end if;
  exception when datetime_field_overflow or invalid_datetime_format then
   raise exception 'invalid_birth_date' using errcode='22023';
  end;
 end if;
 if p_patch->>'mobile_number' is not null and p_patch->>'mobile_number' !~ '^09[0-9]{9}$' then
  raise exception 'invalid_mobile' using errcode='22023';
 end if;
 if p_patch->>'email' is not null and (char_length(p_patch->>'email')>254
  or p_patch->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
  raise exception 'invalid_email' using errcode='22023';
 end if;
 if p_patch->>'avatar_url' is not null then
  if char_length(p_patch->>'avatar_url')>1024 or p_patch->>'avatar_url' !~
   ('^https?://[^/]+/storage/v1/object/public/profile-photos/'||p.id||'/[0-9a-f-]{36}\.(jpg|png|webp)$') then
   raise exception 'owned_avatar_required' using errcode='22023';
  end if;
  v_path:=split_part(p_patch->>'avatar_url','/profile-photos/',2);
  if not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=v_path
   and (storage.foldername(name))[1]=p.id::text) then
   raise exception 'owned_avatar_required' using errcode='22023';
  end if;
 end if;
 -- Assign only supplied allowlisted columns. Unrelated contact/photo edits must
 -- not activate the structured-name/address compose trigger for legacy records.
 select string_agg(format('%1$I = (jsonb_populate_record(null::public.profiles, $1)).%1$I',key),', ')
 into v_assignments from jsonb_object_keys(p_patch) as fields(key);
 execute format('update public.profiles set %s where id=$2 and role=''admin'' and deleted_at is null and updated_at=$3 returning updated_at',v_assignments)
 into v_updated using p_patch,p.id,p_expected;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'profile_changed' using errcode='PT409'; end if;
 return v_updated;
end $$;

commit;
