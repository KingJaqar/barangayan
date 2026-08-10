-- Evacuation Centers Enhancement: verified flag + seed data
--
-- Adds a `verified` boolean to evacuation_centers so the Centers tab can show
-- the shield/verified badge on trusted government facilities, and seeds the
-- pilot barangay with the four centers shown in the Emergency & DRRM design.

-- ============================================================================
-- 1. Add verified column
-- ============================================================================
alter table public.evacuation_centers
  add column if not exists verified boolean not null default false;

comment on column public.evacuation_centers.verified is
  'True when the center has been verified by barangay officials / DRRM.';

-- ============================================================================
-- 2. Seed evacuation centers for Barangay Ampid I (Barangay Ampid I, San Mateo)
-- ============================================================================
insert into public.evacuation_centers
  (id, barangay_id, name, address, position, capacity, current_occupancy,
   is_active, contact_number, facilities, verified, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-000000000001',
    'Ampid 1 Elementary',
    'General Luna St, Ampid 1, San Mateo',
    '{"lat": 14.684583, "lng": 121.112071}'::jsonb,
    1000,
    450,
    true,
    '(02) 8123-4501',
    array['medical_desk', 'pet_friendly'],
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000c002',
    '00000000-0000-0000-0000-000000000001',
    'San Mateo Civic Center',
    'Kambal Rd, Guitnang Bayan 2',
    '{"lat": 14.683500, "lng": 121.115500}'::jsonb,
    2000,
    1640,
    true,
    '(02) 8123-4502',
    array['generator'],
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000c003',
    '00000000-0000-0000-0000-000000000001',
    'Dulong Bayan Covered Court',
    'Gen. Luna St, Dulong Bayan 1',
    '{"lat": 14.682000, "lng": 121.114000}'::jsonb,
    800,
    800,
    true,
    '(02) 8123-4503',
    array[]::text[],
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000c004',
    '00000000-0000-0000-0000-000000000001',
    'Malanday National High School',
    'P. Zamora St, Malanday',
    '{"lat": 14.681000, "lng": 121.113000}'::jsonb,
    800,
    120,
    true,
    '(02) 8123-4504',
    array[]::text[],
    true,
    now(),
    now()
  )
on conflict (id) do update set
  name         = excluded.name,
  address      = excluded.address,
  position     = excluded.position,
  capacity     = excluded.capacity,
  current_occupancy = excluded.current_occupancy,
  is_active    = excluded.is_active,
  contact_number = excluded.contact_number,
  facilities   = excluded.facilities,
  verified     = excluded.verified,
  updated_at   = now();
