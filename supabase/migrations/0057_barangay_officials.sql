-- ============================================================================
-- Barangay Officials — migration 0057
-- ============================================================================
-- Standalone roster table backing the web admin Staff & Admin Accounts screen.
-- Does NOT reuse public.profiles as the source of truth for the screen: this
-- table tracks the employee/roster side of a barangay official (their job
-- role, employment status, hire date) while public.profiles keeps the
-- account/access side (login, contact info, resident-facing fields).
--
-- Every barangay_officials row is 1:1 with a public.profiles row that has
-- role = 'admin' (an "admin" profile is required to sign in to web admin).
-- A trigger on public.profiles keeps this table in sync automatically:
--   - profile promoted to 'admin'   -> officials row created (default 'staff')
--   - profile demoted off 'admin'   -> officials row soft-deleted
--   - profile soft-deleted          -> officials row soft-deleted
-- so every admin profile always "shows up" as an official, even if a row
-- wasn't created explicitly.

-- ============================================================================
-- 1. Table
-- ============================================================================
create table public.barangay_officials (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles(id) on delete cascade,
  barangay_id  uuid        not null references public.barangays(id) on delete cascade,
  official_role text       not null default 'staff'
                 check (official_role in (
                   'admin',            -- general system administrator
                   'staff',            -- general office staff
                   'barangay_captain', -- punong barangay
                   'kagawad',          -- barangay councilor
                   'sk_chairman',      -- sangguniang kabataan chairman
                   'secretary',        -- barangay secretary
                   'treasurer',        -- barangay treasurer
                   'health_worker',    -- barangay health worker (BHW)
                   'tanod',            -- barangay peace and order officer
                   'clerk'             -- administrative clerk
                 )),
  is_active    boolean     not null default true,
  date_hired   date        not null default current_date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (profile_id)
);

create index barangay_officials_barangay_id_idx on public.barangay_officials (barangay_id);

alter table public.barangay_officials enable row level security;

-- ============================================================================
-- 2. updated_at trigger
-- ============================================================================
create or replace function public.set_barangay_officials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_barangay_officials_updated_at on public.barangay_officials;

create trigger trg_barangay_officials_updated_at
  before update on public.barangay_officials
  for each row
  execute function public.set_barangay_officials_updated_at();

-- ============================================================================
-- 3. RLS: admins manage officials in their own barangay
-- ============================================================================
drop policy if exists "admins read barangay officials in their barangay" on public.barangay_officials;

create policy "admins read barangay officials in their barangay"
  on public.barangay_officials for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  );

drop policy if exists "admins insert barangay officials in their barangay" on public.barangay_officials;

create policy "admins insert barangay officials in their barangay"
  on public.barangay_officials for insert
  to authenticated
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  );

drop policy if exists "admins update barangay officials in their barangay" on public.barangay_officials;

create policy "admins update barangay officials in their barangay"
  on public.barangay_officials for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  )
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  );

drop policy if exists "admins delete barangay officials in their barangay" on public.barangay_officials;

create policy "admins delete barangay officials in their barangay"
  on public.barangay_officials for delete
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  );

-- ============================================================================
-- 4. Sync trigger: keep barangay_officials in step with profiles.role
-- ============================================================================
create or replace function public.sync_barangay_official()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile became (or was created as) an admin: ensure a roster row exists.
  if new.role = 'admin' and new.deleted_at is null then
    insert into public.barangay_officials (profile_id, barangay_id, official_role)
    values (new.id, new.barangay_id, 'staff')
    on conflict (profile_id) do update
      set barangay_id = excluded.barangay_id,
          is_active = true,
          deleted_at = null;
  end if;

  -- Profile stopped being admin, or was soft-deleted: retire the roster row.
  if (new.role != 'admin' or new.deleted_at is not null)
     and (tg_op = 'INSERT' or old.role = 'admin') then
    update public.barangay_officials
      set is_active = false,
          deleted_at = coalesce(new.deleted_at, now())
      where profile_id = new.id
        and deleted_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_barangay_official on public.profiles;

create trigger trg_sync_barangay_official
  after insert or update of role, deleted_at, barangay_id on public.profiles
  for each row
  execute function public.sync_barangay_official();

-- Backfill: create a roster row for every existing admin profile.
insert into public.barangay_officials (profile_id, barangay_id, official_role)
select id, barangay_id, 'staff'
from public.profiles
where role = 'admin'
  and deleted_at is null
on conflict (profile_id) do nothing;
