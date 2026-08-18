-- Ticket 11: real point-in-polygon geofencing at registration.
--
-- The register.tsx "Allow Location Access" step was a presentational stand-in
-- (flips local state, never reads real GPS or checks the barangay boundary).
-- This adds columns to record what the real check found, following the same
-- signup-metadata -> handle_new_user() pattern as birth_date (0068).
--
-- Per the audit report's guardrail: the PDF specifies this as a preliminary/
-- soft check, not a hard registration requirement. A resident whose device
-- reports a location outside the barangay boundary is NOT blocked from
-- registering — they're flagged for admin review instead. A hard block would
-- introduce a new bug (locking out legitimate residents on imprecise consumer
-- GPS) that doesn't exist in the current stand-in today.

alter table public.profiles
  add column if not exists location_verified     boolean,
  add column if not exists registration_location  jsonb;

comment on column public.profiles.location_verified is
  'Result of the point-in-polygon check against barangays.boundary at signup time. '
  'NULL = check could not run (no boundary configured, permission denied, or GPS '
  'unavailable) — no conclusion, not flagged. TRUE = device location was inside the '
  'boundary. FALSE = device location was outside the boundary — surfaced to admins '
  'for review, never blocks registration (soft check only, per the project paper).';

comment on column public.profiles.registration_location is
  'The { lat, lng } the resident''s device reported at signup time, kept for the '
  'admin review flagged by location_verified = false. NULL if location access was '
  'denied or unavailable during signup.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id        uuid;
  v_full_name          text;
  v_birth_date         date;
  v_location_verified  boolean;
  v_registration_lat   double precision;
  v_registration_lng   double precision;
  v_registration_location jsonb;
begin
  v_full_name := (new.raw_user_meta_data->>'full_name');
  if v_full_name is null or trim(v_full_name) = '' then
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

  -- location_verified travels as a pre-computed boolean (or absent) — the
  -- point-in-polygon check itself runs client-side in register.tsx, since the
  -- boundary is already fetched there for display and re-fetching/re-checking
  -- server-side would need PostGIS for no real security benefit (this is a
  -- soft advisory flag, not an access-control decision).
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
    mobile_number,
    home_address,
    birth_date,
    email,
    email_verification_status,
    location_verified,
    registration_location
  ) values (
    new.id,
    v_barangay_id,
    'resident',
    trim(v_full_name),
    nullif(trim(coalesce(new.raw_user_meta_data->>'mobile_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), ''),
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
  'registration metadata (full_name, barangay_id) is present. Also stores '
  'email (0039), birth_date (0068), and location_verified/registration_location '
  '(0075 — soft geofencing flag, never blocks signup) from signup metadata when '
  'provided. Admin-invited users (no metadata) are skipped so the admin API route '
  'handles their profile.';
