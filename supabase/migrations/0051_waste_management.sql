-- ============================================================================
-- Waste Management Module
-- ============================================================================
-- Creates waste_zones and waste_collection_schedules tables with RLS policies,
-- updated_at triggers, and realtime replication.

-- ============================================================================
-- 1. waste_zones — geographic zones within a barangay
-- ============================================================================
create table public.waste_zones (
  id           uuid        primary key default gen_random_uuid(),
  barangay_id  uuid        not null references public.barangays(id) on delete cascade,
  name         text        not null,
  description  text        not null default '',
  is_active    boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============================================================================
-- 2. waste_collection_schedules — recurring pickup schedule per zone
-- ============================================================================
create table public.waste_collection_schedules (
  id           uuid        primary key default gen_random_uuid(),
  barangay_id  uuid        not null references public.barangays(id) on delete cascade,
  zone_id      uuid        not null references public.waste_zones(id) on delete cascade,
  waste_type   text        not null check (waste_type in ('biodegradable', 'recyclable', 'residual', 'special', 'bulk')),
  day_of_week  integer     not null check (day_of_week between 0 and 6),
  start_time   time        not null,
  end_time     time        not null,
  notes        text        not null default '',
  is_active    boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============================================================================
-- 3. indexes
-- ============================================================================
create index idx_waste_zones_barangay     on public.waste_zones (barangay_id);
create index idx_waste_schedules_zone     on public.waste_collection_schedules (zone_id);
create index idx_waste_schedules_barangay on public.waste_collection_schedules (barangay_id);

-- ============================================================================
-- 4. updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_waste_zones_modtime
  before update on public.waste_zones
  for each row execute function public.set_updated_at_column();

create trigger update_waste_schedules_modtime
  before update on public.waste_collection_schedules
  for each row execute function public.set_updated_at_column();

-- ============================================================================
-- 5. row level security
-- ============================================================================
alter table public.waste_zones                enable row level security;
alter table public.waste_collection_schedules  enable row level security;

create policy "admins manage waste zones"
  on public.waste_zones
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = waste_zones.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = waste_zones.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "admins manage waste collection schedules"
  on public.waste_collection_schedules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = waste_collection_schedules.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = waste_collection_schedules.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  );

-- ============================================================================
-- 6. realtime replication
-- ============================================================================
alter table public.waste_zones                 replica identity full;
alter table public.waste_collection_schedules  replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.waste_zones,
      public.waste_collection_schedules;
  end if;
end $$;
