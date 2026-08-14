-- ============================================================================
-- Admin Staff Management (profiles-level access control)
-- ============================================================================
-- Unlocks the Staff & Admin Accounts screen by:
--   1. Restricting profiles.role to 'resident' | 'admin' — 'admin' is the
--      system-access flag (can sign in to web admin). The employee-facing
--      details (job role, headcount, roster) live in public.barangay_officials,
--      created in migration 0057, not in this table.
--   2. Adding RLS so admins can read other admin profiles in their barangay
--   3. Adding RLS so admins can update other admin profiles in their barangay
--      (including soft-delete), but never their own row via this screen
--   4. Adding a guard trigger so residents cannot self-escalate to admin

-- ============================================================================
-- 1. Restrict role constraint to resident | admin
-- ============================================================================
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles add constraint profiles_role_check
  check (role in ('resident', 'admin'));

-- ============================================================================
-- 2. RLS: admins can read other admin profiles in their barangay
-- ============================================================================
drop policy if exists "admins can read admin and staff profiles in their barangay" on public.profiles;
drop policy if exists "admins can read admin profiles in their barangay" on public.profiles;

create policy "admins can read admin profiles in their barangay"
  on public.profiles for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'admin'
  );

-- ============================================================================
-- 3. RLS: admins can update other admin profiles in their barangay
--    (excluding their own row to prevent self-demotion/removal via this screen)
-- ============================================================================
drop policy if exists "admins can update admin and staff profiles in their barangay" on public.profiles;
drop policy if exists "admins can update admin profiles in their barangay" on public.profiles;

create policy "admins can update admin profiles in their barangay"
  on public.profiles for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'admin'
    and id != auth.uid()
  )
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'admin'
  );

-- ============================================================================
-- 4. Guard trigger: only admins can promote a resident to admin
-- ============================================================================
create or replace function public.guard_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' and (old.role is distinct from new.role) then
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
