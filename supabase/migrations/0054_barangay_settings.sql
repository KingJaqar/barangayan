-- ============================================================================
-- Barangay Settings — migration 0054
-- ============================================================================
-- Unlocks the web admin Settings screen by:
--   1. Adding an updated_at column to barangays
--   2. Creating a trigger to auto-bump updated_at on config changes
--   3. Adding an RLS policy so admins/staff can update their own barangay's
--      config JSONB (read is already public via the existing policy)
--   4. Seeding default config values for the sample barangay

-- ============================================================================
-- 1. updated_at column + trigger
-- ============================================================================
alter table public.barangays add column if not exists updated_at timestamptz not null default now();

drop trigger if exists barangays_set_updated_at on public.barangays;

create trigger barangays_set_updated_at
  before update on public.barangays
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. RLS: admins and staff can update their own barangay's config
-- ============================================================================
drop policy if exists "admins can update barangay config in their barangay" on public.barangays;

create policy "admins can update barangay config in their barangay"
  on public.barangays for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = barangays.id
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = barangays.id
        and profiles.role in ('admin', 'staff')
    )
  );

-- ============================================================================
-- 3. Seed default config for the sample barangay (idempotent)
-- ============================================================================
do $$
declare
  v_default jsonb;
begin
  v_default := jsonb_build_object(
    'contact', jsonb_build_object(
      'email', '',
      'phone', '',
      'address', ''
    ),
    'operatingHours', jsonb_build_object(
      'monday',    jsonb_build_object('open', '08:00', 'close', '17:00'),
      'tuesday',   jsonb_build_object('open', '08:00', 'close', '17:00'),
      'wednesday', jsonb_build_object('open', '08:00', 'close', '17:00'),
      'thursday',  jsonb_build_object('open', '08:00', 'close', '17:00'),
      'friday',    jsonb_build_object('open', '08:00', 'close', '17:00'),
      'saturday',  jsonb_build_object('open', '08:00', 'close', '12:00'),
      'sunday',    jsonb_build_object('open', '', 'close', '')
    ),
    'features', jsonb_build_object(
      'allowGuestCheckIn',       true,
      'requireIdVerification',   true,
      'enableWasteNotifications', true,
      'enableEmergencyAlerts',    true
    )
  );

  update public.barangays
    set config = coalesce(config, '{}'::jsonb) || v_default
    where id = '00000000-0000-0000-0000-000000000001';
end $$;
