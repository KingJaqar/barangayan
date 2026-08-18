-- 0068_signup_birth_date.sql
--
-- The account Register screen now collects birth_date (via the same calendar
-- picker used on the Profile screen) so residents no longer have to fill it
-- in twice. Register it in handle_new_user() so the trigger stores it on the
-- profiles row atomically with the rest of the signup metadata, same as
-- full_name / mobile_number / home_address already are (migrations 0012, 0039).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_full_name   text;
  v_birth_date  date;
begin
  v_full_name := (new.raw_user_meta_data->>'full_name');
  if v_full_name is null or trim(v_full_name) = '' then
    return new;
  end if;

  v_barangay_id := (new.raw_user_meta_data->>'barangay_id')::uuid;

  if not exists (select 1 from public.barangays where id = v_barangay_id) then
    raise exception 'Invalid barangay_id in signup metadata: %', v_barangay_id;
  end if;

  -- Registration form validates the YYYY-MM-DD shape client-side (zod), but
  -- guard the cast anyway so a malformed value can never fail the whole signup.
  begin
    v_birth_date := nullif(trim(coalesce(new.raw_user_meta_data->>'birth_date', '')), '')::date;
  exception when invalid_datetime_format then
    v_birth_date := null;
  end;

  insert into public.profiles (
    id,
    barangay_id,
    role,
    full_name,
    mobile_number,
    home_address,
    birth_date,
    email,
    email_verification_status
  ) values (
    new.id,
    v_barangay_id,
    'resident',
    trim(v_full_name),
    nullif(trim(coalesce(new.raw_user_meta_data->>'mobile_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), ''),
    v_birth_date,
    new.email,
    'unavailable'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: creates a profiles row atomically with the auth.users row when '
  'registration metadata (full_name, barangay_id) is present. Also stores '
  'email (0039) and birth_date (0068) from signup metadata when provided. '
  'Admin-invited users (no metadata) are skipped so the admin API route '
  'handles their profile.';
