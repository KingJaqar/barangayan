-- Module 7 (Account/Security/RBAC) + multi-tenant root.
-- Scope: the "~30% Progress" milestone slice only (Home/Services/Announcements/Auth).
-- Deferred to later migrations: incidents, evacuation_centers/checkins, payments,
-- vaccination_drives/drive_registrations, trash_zones, appointments.

-- ============================================================================
-- barangays — the multi-tenant root. Every other table is scoped to one of these.
-- Boundary is stored as GeoJSON (not PostGIS geometry) because the proposal's cited
-- geofencing technique is a custom Point-in-Polygon (Ray Casting) implementation in
-- application code, not a PostGIS ST_Contains call — see AGENTS.md §3.
-- ============================================================================
create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- GeoJSON Polygon boundary, e.g. { "type": "Polygon", "coordinates": [...] }. Nullable
  -- until Module 3's geofencing work lands.
  boundary jsonb,
  -- Barangay-level config (future admin-configurable settings land here as needed).
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.barangays is
  'Multi-tenant root (AGENTS.md §0 — the configurable/multi-tenant design is the project''s primary novelty claim). Never hardcode a barangay-specific value anywhere outside seed.sql.';

-- Public reference data: the Register screen''s "Select Barangay" dropdown must be
-- readable before a resident has a profile (or even a confirmed session), so this is
-- readable by anyone, including anon. No client-side writes — barangay creation is an
-- operator/seed concern, not an app feature.
alter table public.barangays enable row level security;

create policy "barangays are publicly readable"
  on public.barangays for select
  using (true);

-- ============================================================================
-- profiles — one row per auth.users row. Role-Based Access Control (NIST model),
-- AGENTS.md §3.
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  barangay_id uuid not null references public.barangays (id),
  role text not null default 'resident' check (role in ('resident', 'admin')),
  full_name text not null,
  mobile_number text,
  home_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row. Created client-side by the app right after signup email verification succeeds (not via an auth.users trigger) — see the plan''s Real Auth Flow task for why.';

alter table public.profiles enable row level security;

create policy "residents can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "residents can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "residents can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Helper functions used by every downstream table's RLS policies. SECURITY DEFINER +
-- STABLE so they can be called inside other tables'' policies without re-triggering RLS
-- recursion on profiles itself (the standard Supabase pattern for this).
-- ============================================================================
create function public.current_barangay_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select barangay_id from public.profiles where id = auth.uid();
$$;

create function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_barangay_id() is
  'Used by every other table''s RLS policies to scope rows to the caller''s barangay — AGENTS.md §2.';
