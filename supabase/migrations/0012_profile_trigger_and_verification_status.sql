-- Migration: move profile creation into the database (auth trigger) and add
-- deferred email-verification status columns.
--
-- Previously, profiles were created client-side after signup OTP verification
-- (otp.tsx). That path is being removed: Supabase Confirm Email is now disabled,
-- so signUp() creates a live session immediately — the OTP screen is no longer
-- used for signup. A database trigger is safer because it creates the profile
-- atomically with the auth.users row, so no user can exist without a profile.
--
-- The email_verification_status column captures the app-level deferred state.
-- It is informational only and must NOT affect authentication, RLS, dashboard
-- access, service requests, or payments.  Supabase's own email_confirmed_at
-- is not used for this — disabling Confirm Email sets it implicitly, so it
-- cannot represent a meaningful business verification state.

-- ============================================================================
-- 1. Deferred email-verification columns on profiles
-- ============================================================================

alter table public.profiles
  add column if not exists email_verification_status text
    not null default 'unavailable'
    check (email_verification_status in ('unavailable', 'unverified', 'pending', 'verified')),
  add column if not exists email_verification_requested_at timestamptz,
  add column if not exists email_verified_at timestamptz;

comment on column public.profiles.email_verification_status is
  'App-level deferred verification state. unavailable = SMTP not yet configured;
   unverified = SMTP available but resident has not verified; pending = OTP sent,
   awaiting entry; verified = confirmed. Never blocks login, dashboard, or services.';

-- ============================================================================
-- 2. Trigger function: create a profiles row on every new auth.users insert.
--    Runs as SECURITY DEFINER so it bypasses RLS (the trigger fires in the
--    auth schema context where RLS on public.profiles would otherwise block it).
--    Only fires when user_metadata contains the required registration fields;
--    admin-invited users (inviteUserByEmail) skip this path — the API route
--    already inserts the profile directly.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_full_name   text;
begin
  -- Admin invitations arrive without registration metadata — skip silently so
  -- the admin API route can insert the profile itself without a conflict.
  v_full_name := (new.raw_user_meta_data->>'full_name');
  if v_full_name is null or trim(v_full_name) = '' then
    return new;
  end if;

  v_barangay_id := (new.raw_user_meta_data->>'barangay_id')::uuid;

  -- Validate the barangay exists before inserting.
  if not exists (select 1 from public.barangays where id = v_barangay_id) then
    raise exception 'Invalid barangay_id in signup metadata: %', v_barangay_id;
  end if;

  insert into public.profiles (
    id,
    barangay_id,
    role,
    full_name,
    mobile_number,
    home_address,
    email_verification_status
  ) values (
    new.id,
    v_barangay_id,
    'resident',
    trim(v_full_name),
    nullif(trim(coalesce(new.raw_user_meta_data->>'mobile_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), ''),
    'unavailable'  -- SMTP not yet configured
  )
  on conflict (id) do nothing;  -- idempotent in case of retries

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: creates a profiles row atomically with the auth.users row when
   registration metadata (full_name, barangay_id) is present. Admin-invited
   users (no metadata) are skipped so the admin API route handles their profile.';

-- Drop and recreate the trigger so re-running this migration is safe.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
