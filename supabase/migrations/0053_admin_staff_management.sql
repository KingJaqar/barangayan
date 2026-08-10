-- ============================================================================
-- Admin Staff Management
-- ============================================================================
-- Unlocks the Staff & Admin Accounts screen by:
--   1. Expanding the profiles.role CHECK constraint to include 'staff'
--   2. Adding RLS so admins can read admin/staff profiles in their barangay
--   3. Adding RLS so admins can update (including soft-delete) admin/staff
--      profiles in their barangay, but never their own row
--   4. Adding a guard trigger so residents cannot escalate their role
--   5. Seeding 3 sample staff/admin accounts for testing

-- ============================================================================
-- 1. Expand role constraint to include 'staff'
-- ============================================================================
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles add constraint profiles_role_check
  check (role in ('resident', 'admin', 'staff'));

-- ============================================================================
-- 2. RLS: admins can read admin and staff profiles in their barangay
-- ============================================================================
drop policy if exists "admins can read admin and staff profiles in their barangay" on public.profiles;

create policy "admins can read admin and staff profiles in their barangay"
  on public.profiles for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role in ('admin', 'staff')
  );

-- ============================================================================
-- 3. RLS: admins can update admin and staff profiles in their barangay
--    (excluding their own row to prevent self-demotion/removal via this screen)
-- ============================================================================
drop policy if exists "admins can update admin and staff profiles in their barangay" on public.profiles;

create policy "admins can update admin and staff profiles in their barangay"
  on public.profiles for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role in ('admin', 'staff')
    and id != auth.uid()
  )
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role in ('admin', 'staff')
  );

-- ============================================================================
-- 4. Guard trigger: residents and staff cannot escalate their role to admin
-- ============================================================================
create or replace function public.guard_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('admin', 'staff') and (old.role is distinct from new.role) then
    if public.current_role() != 'admin' then
      raise exception 'Only administrators can assign the % role.', new.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_role_escalation on public.profiles;

create trigger trg_guard_role_escalation
  before update of role on public.profiles
  for each row
  execute function public.guard_role_escalation();

-- ============================================================================
-- 5. Seed 3 sample staff/admin accounts (idempotent)
-- ============================================================================
do $$
declare
  v_id uuid;
begin
  -- Admin 1: Maria Santos
  v_id := '00000000-0000-0000-0000-00000000a001';
  if not exists (select 1 from public.profiles where id = v_id) then
    insert into auth.users
      (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at,
       last_sign_in_at, raw_user_meta_data, created_at, updated_at,
       is_super_admin, is_anonymous, aud, role)
    values
      (
        v_id,
        'admin1@barangay.gov.ph',
        'AdminPass123!',
        now(), now(), now(),
        jsonb_build_object(
          'full_name',    'Maria Santos',
          'barangay_id',  '00000000-0000-0000-0000-000000000001',
          'mobile_number','+639171234567',
          'home_address', 'Purok 1, Barangay Ampid I'
        ),
        now(), now(),
        false, false, 'authenticated', 'authenticated'
      )
    on conflict (id) do nothing;

    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (
        gen_random_uuid(),
        v_id,
        'admin1@barangay.gov.ph',
        jsonb_build_object('sub', v_id::text, 'email', 'admin1@barangay.gov.ph'),
        'email',
        now(), now(), now()
      )
    on conflict (id) do nothing;

    insert into public.profiles
      (id, barangay_id, role, full_name, email, mobile_number, home_address, created_at, updated_at)
    values
      (
        v_id,
        '00000000-0000-0000-0000-000000000001',
        'admin',
        'Maria Santos',
        'admin1@barangay.gov.ph',
        '+639171234567',
        'Purok 1, Barangay Ampid I',
        now(), now()
      )
    on conflict (id) do nothing;
  end if;

  -- Staff 1: Juan Dela Cruz
  v_id := '00000000-0000-0000-0000-00000000a002';
  if not exists (select 1 from public.profiles where id = v_id) then
    insert into auth.users
      (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at,
       last_sign_in_at, raw_user_meta_data, created_at, updated_at,
       is_super_admin, is_anonymous, aud, role)
    values
      (
        v_id,
        'staff1@barangay.gov.ph',
        'StaffPass123!',
        now(), now(), now(),
        jsonb_build_object(
          'full_name',    'Juan Dela Cruz',
          'barangay_id',  '00000000-0000-0000-0000-000000000001',
          'mobile_number','+639179876543',
          'home_address', 'Purok 2, Barangay Ampid I'
        ),
        now(), now(),
        false, false, 'authenticated', 'authenticated'
      )
    on conflict (id) do nothing;

    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (
        gen_random_uuid(),
        v_id,
        'staff1@barangay.gov.ph',
        jsonb_build_object('sub', v_id::text, 'email', 'staff1@barangay.gov.ph'),
        'email',
        now(), now(), now()
      )
    on conflict (id) do nothing;

    insert into public.profiles
      (id, barangay_id, role, full_name, email, mobile_number, home_address, created_at, updated_at)
    values
      (
        v_id,
        '00000000-0000-0000-0000-000000000001',
        'staff',
        'Juan Dela Cruz',
        'staff1@barangay.gov.ph',
        '+639179876543',
        'Purok 2, Barangay Ampid I',
        now(), now()
      )
    on conflict (id) do nothing;
  end if;

  -- Admin 2: Ana Reyes
  v_id := '00000000-0000-0000-0000-00000000a003';
  if not exists (select 1 from public.profiles where id = v_id) then
    insert into auth.users
      (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at,
       last_sign_in_at, raw_user_meta_data, created_at, updated_at,
       is_super_admin, is_anonymous, aud, role)
    values
      (
        v_id,
        'admin2@barangay.gov.ph',
        'Admin2Pass123!',
        now(), now(), now(),
        jsonb_build_object(
          'full_name',    'Ana Reyes',
          'barangay_id',  '00000000-0000-0000-0000-000000000001',
          'mobile_number','+639176543210',
          'home_address', 'Purok 3, Barangay Ampid I'
        ),
        now(), now(),
        false, false, 'authenticated', 'authenticated'
      )
    on conflict (id) do nothing;

    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (
        gen_random_uuid(),
        v_id,
        'admin2@barangay.gov.ph',
        jsonb_build_object('sub', v_id::text, 'email', 'admin2@barangay.gov.ph'),
        'email',
        now(), now(), now()
      )
    on conflict (id) do nothing;

    insert into public.profiles
      (id, barangay_id, role, full_name, email, mobile_number, home_address, created_at, updated_at)
    values
      (
        v_id,
        '00000000-0000-0000-0000-000000000001',
        'admin',
        'Ana Reyes',
        'admin2@barangay.gov.ph',
        '+639176543210',
        'Purok 3, Barangay Ampid I',
        now(), now()
      )
    on conflict (id) do nothing;
  end if;
end $$;
