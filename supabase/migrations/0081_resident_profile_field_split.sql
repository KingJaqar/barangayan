-- Register/Profile screen field improvements (frontend+backend+database):
--   • Full Name        -> first_name (req), last_name (req), middle_name (opt), suffix (opt)
--   • Home Address     -> house_no (req), street (req), city (req)
--                         + "Barangay" component is NOT a new column — it's already
--                         profiles.barangay_id (the multi-tenant root, auto-assigned
--                         at registration per AGENTS.md §0). The Register/Profile UIs
--                         display barangays.name read-only for that slot instead of
--                         collecting a second, potentially-inconsistent free-text value.
--   • Sex              -> new column, 'male' | 'female'
--   • Employment        -> employment_status (req, 5 options) + occupation (opt; only
--                         meaningful when employment_status is 'employed' or
--                         'self_employed', enforced at the app/schema layer, not here)
--
-- All new columns are nullable at the DB level even though the Register screen makes
-- most of them required going forward — pre-existing rows have none of this data and
-- can't be backfilled by guessing (Filipino full names don't split reliably on
-- whitespace). Residents are prompted to fill these in from the Profile screen instead.
--
-- full_name and home_address remain the columns every other screen already reads
-- (admin resident directory, incident reports, transactions, dashboards, avatars, ...).
-- Rather than touching every one of those call sites in this pass, a BEFORE INSERT/
-- UPDATE trigger keeps full_name/home_address composed from the structured columns
-- whenever the structured columns are actually supplied, and otherwise leaves whatever
-- value the caller explicitly set untouched (legacy write paths keep working as-is).

-- ============================================================================
-- 1. New columns
-- ============================================================================

alter table public.profiles
  add column if not exists first_name        text,
  add column if not exists last_name         text,
  add column if not exists middle_name       text,
  add column if not exists suffix            text,
  add column if not exists house_no          text,
  add column if not exists street            text,
  add column if not exists city              text,
  add column if not exists sex               text
    check (sex in ('male', 'female')),
  add column if not exists employment_status text
    check (employment_status in ('employed', 'unemployed', 'student', 'self_employed', 'retired')),
  add column if not exists occupation        text;

comment on column public.profiles.first_name is
  'Structured given name (Register/Profile field-split). Required going forward at the '
  'app layer; nullable here because pre-existing rows only have the composed full_name.';
comment on column public.profiles.last_name is
  'Structured family name. Same nullability note as first_name.';
comment on column public.profiles.middle_name is
  'Optional structured middle name.';
comment on column public.profiles.suffix is
  'Optional name suffix, e.g. "Jr.", "III".';
comment on column public.profiles.house_no is
  'Structured address: house/unit number. Required going forward at the app layer; '
  'nullable here for the same reason as first_name.';
comment on column public.profiles.street is
  'Structured address: street.';
comment on column public.profiles.city is
  'Structured address: city/municipality. NOT the barangay itself — that is '
  'profiles.barangay_id, already assigned at registration; the address form displays '
  'barangays.name read-only rather than collecting a second, possibly-inconsistent value.';
comment on column public.profiles.sex is
  '''male'' or ''female''. Required going forward at the app layer.';
comment on column public.profiles.employment_status is
  'One of employed / unemployed / student / self_employed / retired. Required going '
  'forward at the app layer.';
comment on column public.profiles.occupation is
  'Free-text occupation. Only meaningful (and only collected by the UI) when '
  'employment_status is employed or self_employed — not enforced by a DB constraint '
  'since it is purely descriptive.';

-- ============================================================================
-- 2. Keep full_name / home_address composed from the structured columns.
--
-- Guarded so it only overwrites full_name/home_address when the caller actually
-- supplied at least one of the relevant structured fields in this statement — a
-- write path that only ever touches full_name/home_address directly (e.g. the
-- admin portal's existing profile-form.tsx, or a legacy signup metadata payload)
-- is completely unaffected.
-- ============================================================================

create or replace function public.compose_profile_display_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(
       nullif(trim(new.first_name), ''),
       nullif(trim(new.middle_name), ''),
       nullif(trim(new.last_name), ''),
       nullif(trim(new.suffix), '')
     ) is not null then
    new.full_name := concat_ws(' ',
      nullif(trim(new.first_name), ''),
      nullif(trim(new.middle_name), ''),
      nullif(trim(new.last_name), ''),
      nullif(trim(new.suffix), '')
    );
  end if;

  if coalesce(
       nullif(trim(new.house_no), ''),
       nullif(trim(new.street), ''),
       nullif(trim(new.city), '')
     ) is not null then
    new.home_address := concat_ws(', ',
      nullif(trim(concat_ws(' ', nullif(trim(new.house_no), ''), nullif(trim(new.street), ''))), ''),
      (select nullif(trim(b.name), '') from public.barangays b where b.id = new.barangay_id),
      nullif(trim(new.city), '')
    );
  end if;

  return new;
end;
$$;

comment on function public.compose_profile_display_fields() is
  'Recomposes full_name from first/middle/last/suffix and home_address from '
  'house_no/street/barangays.name/city whenever a write actually supplies one of '
  'those structured columns — see migration 0081.';

drop trigger if exists compose_profiles_display_fields on public.profiles;

create trigger compose_profiles_display_fields
  before insert or update of first_name, last_name, middle_name, suffix, house_no, street, city
  on public.profiles
  for each row execute function public.compose_profile_display_fields();

-- ============================================================================
-- 3. handle_new_user(): accept the new structured signup metadata keys.
--    Rebuilt on top of the 0078 version (birth_date, email, location_verified,
--    registration_location) — nothing from that version is dropped.
--    full_name/home_address still travel from the client as a compatibility
--    fallback (covers a not-yet-updated app build during rollout); when the new
--    structured keys are present the BEFORE INSERT trigger above overwrites them.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id           uuid;
  v_full_name             text;
  v_first_name            text;
  v_last_name             text;
  v_birth_date            date;
  v_location_verified     boolean;
  v_registration_lat      double precision;
  v_registration_lng      double precision;
  v_registration_location jsonb;
begin
  v_full_name  := (new.raw_user_meta_data->>'full_name');
  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last_name  := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');

  -- Admin invitations (and anything else missing the minimum name info) skip this
  -- path — the admin API route inserts the profile itself without conflict.
  if (v_full_name is null or trim(v_full_name) = '') and (v_first_name is null or v_last_name is null) then
    return new;
  end if;

  v_barangay_id := (new.raw_user_meta_data->>'barangay_id')::uuid;

  if not exists (select 1 from public.barangays where id = v_barangay_id) then
    raise exception 'Invalid barangay_id in signup metadata: %', v_barangay_id;
  end if;

  begin
    v_birth_date := nullif(trim(coalesce(new.raw_user_meta_data->>'birth_date', '')), '')::date;
  exception when invalid_datetime_format then
    v_birth_date := null;
  end;

  begin
    v_location_verified := nullif(new.raw_user_meta_data->>'location_verified', '')::boolean;
  exception when invalid_text_representation then
    v_location_verified := null;
  end;

  begin
    v_registration_lat := nullif(new.raw_user_meta_data->>'registration_lat', '')::double precision;
    v_registration_lng := nullif(new.raw_user_meta_data->>'registration_lng', '')::double precision;
  exception when invalid_text_representation then
    v_registration_lat := null;
    v_registration_lng := null;
  end;

  if v_registration_lat is not null and v_registration_lng is not null then
    v_registration_location := jsonb_build_object('lat', v_registration_lat, 'lng', v_registration_lng);
  else
    v_registration_location := null;
  end if;

  insert into public.profiles (
    id,
    barangay_id,
    role,
    full_name,
    home_address,
    first_name,
    last_name,
    middle_name,
    suffix,
    house_no,
    street,
    city,
    sex,
    employment_status,
    occupation,
    mobile_number,
    birth_date,
    email,
    email_verification_status,
    location_verified,
    registration_location
  ) values (
    new.id,
    v_barangay_id,
    'resident',
    -- Fallback chain so the NOT NULL full_name column is always satisfiable even
    -- if neither legacy full_name nor first/last name metadata came through.
    coalesce(nullif(trim(v_full_name), ''), nullif(concat_ws(' ', v_first_name, v_last_name), ''), 'Unnamed Resident'),
    nullif(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), ''),
    v_first_name,
    v_last_name,
    nullif(trim(coalesce(new.raw_user_meta_data->>'middle_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'suffix', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'house_no', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'street', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'city', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'sex', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'employment_status', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'occupation', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'mobile_number', '')), ''),
    v_birth_date,
    new.email,
    'unavailable',
    v_location_verified,
    v_registration_location
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: creates a profiles row atomically with the auth.users row when '
  'registration metadata (full_name or first_name+last_name, plus barangay_id) is '
  'present. Stores email (0039), birth_date (0068), location_verified/'
  'registration_location (0078), and the structured name/address/sex/employment '
  'columns (0081) from signup metadata when provided — compose_profiles_display_fields '
  'then derives full_name/home_address from the structured columns when supplied. '
  'Admin-invited users (no metadata) are skipped so the admin API route handles '
  'their profile.';
