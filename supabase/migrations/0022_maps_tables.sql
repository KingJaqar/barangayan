-- Maps & DRRM Module: incident_categories, incidents, evacuation_centers
--
-- Three new tables that power the Maps tab's live map markers, filter pills,
-- and evacuation center cards. All three are barangay-scoped (multi-tenant)
-- with RLS using the existing current_role() / current_barangay_id() helpers.
--
-- Deferred from 0001 per the comment there: "Deferred to later migrations:
-- incidents, evacuation_centers/checkins, vaccination_drives, trash_zones …"

-- ============================================================================
-- 1. incident_categories — barangay-configurable catalog (not hardcoded in app)
-- ============================================================================
create table public.incident_categories (
  id               uuid        primary key default gen_random_uuid(),
  barangay_id      uuid        not null references public.barangays(id) on delete cascade,
  name             text        not null,
  color            text        not null default '#6B7280',
  icon             text,                    -- Ionicons name, e.g. 'bulb-outline'
  is_trash_related boolean     not null default false,
  created_at       timestamptz not null default now(),

  unique (barangay_id, name)
);

alter table public.incident_categories enable row level security;

-- Any authenticated resident or admin in the same barangay may read categories.
create policy "residents read own barangay categories"
  on public.incident_categories for select
  to authenticated
  using (barangay_id = public.current_barangay_id());

-- Admins may insert, update, and delete categories in their own barangay.
create policy "admins manage categories"
  on public.incident_categories for all
  to authenticated
  using  (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ============================================================================
-- 2. incidents — community-submitted geo-tagged reports
-- ============================================================================
create table public.incidents (
  id                 uuid        primary key default gen_random_uuid(),
  barangay_id        uuid        not null references public.barangays(id) on delete cascade,
  reporter_id        uuid        references public.profiles(id) on delete set null,
  category_id        uuid        references public.incident_categories(id) on delete set null,
  title              text        not null,
  description        text,
  -- location stored as { "lat": <number>, "lng": <number> } — matches LatLng in map-bridge.ts
  location           jsonb       not null,
  photo_urls         text[]      not null default '{}',
  status             text        not null default 'open'
                       check (status in ('open', 'in_progress', 'resolved')),
  confirmation_count integer     not null default 0,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index incidents_barangay_id_idx      on public.incidents (barangay_id);
create index incidents_category_id_idx      on public.incidents (category_id);
create index incidents_status_idx           on public.incidents (status);
create index incidents_deleted_at_idx       on public.incidents (deleted_at) where deleted_at is null;

alter table public.incidents enable row level security;

-- Residents and admins may read non-deleted incidents in their barangay.
create policy "residents read own barangay incidents"
  on public.incidents for select
  to authenticated
  using (deleted_at is null and barangay_id = public.current_barangay_id());

-- Residents may report incidents in their own barangay (reporter_id must be themselves).
create policy "residents insert incidents"
  on public.incidents for insert
  to authenticated
  with check (
    barangay_id = public.current_barangay_id()
    and reporter_id = auth.uid()
  );

-- Admins may update or soft-delete any incident in their barangay.
create policy "admins manage incidents"
  on public.incidents for update
  to authenticated
  using  (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ============================================================================
-- 3. evacuation_centers — barangay-managed shelter locations
-- ============================================================================
create table public.evacuation_centers (
  id                uuid        primary key default gen_random_uuid(),
  barangay_id       uuid        not null references public.barangays(id) on delete cascade,
  name              text        not null,
  address           text,
  -- position stored as { "lat": <number>, "lng": <number> } — matches LatLng in map-bridge.ts
  position          jsonb       not null,
  capacity          integer,
  current_occupancy integer     not null default 0,
  is_active         boolean     not null default true,
  contact_number    text,
  facilities        text[]      not null default '{}',
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index evacuation_centers_barangay_id_idx on public.evacuation_centers (barangay_id);
create index evacuation_centers_active_idx       on public.evacuation_centers (is_active) where is_active = true;

alter table public.evacuation_centers enable row level security;

-- Evacuation centers are publicly readable — even unauthenticated users (guests and
-- residents who haven't logged in yet) must be able to find shelter during a disaster.
create policy "public read active evacuation centers"
  on public.evacuation_centers for select
  using (deleted_at is null and is_active = true);

-- Admins may manage centers in their own barangay.
create policy "admins manage evacuation centers"
  on public.evacuation_centers for all
  to authenticated
  using  (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());
