-- Settings > Location Verification (mobile): lets a resident drag a pin to their exact
-- home location (map centered on the barangay, boundary-constrained via MapView's
-- existing point-in-polygon rejection — see map-view.tsx / isPointInPolygon) and save it.
--
-- This is a separate concept from registration_location/location_verified (0078), which
-- record a one-time, best-effort GPS fix captured automatically at signup for admin review.
-- verified_location is resident-initiated at any time from Settings, always inside the
-- barangay boundary (the map picker rejects drops/drags outside it), and is self-reported —
-- there is no admin review step for it, matching the feature as specced.

alter table public.profiles
  add column if not exists verified_location   jsonb,
  add column if not exists location_verified_at timestamptz;

comment on column public.profiles.verified_location is
  'The { lat, lng } pin the resident placed and saved via Settings > Location Verification. '
  'Always inside the barangay boundary — the map picker (map-view.tsx) rejects any drop/drag '
  'outside it. NULL until the resident completes this flow at least once. Distinct from '
  'registration_location (0078), which is the one-time GPS fix captured automatically at signup.';

comment on column public.profiles.location_verified_at is
  'Timestamp of the resident''s most recent Settings > Location Verification save. '
  'NULL until verified_location is first set.';
