-- Settings > Location Verification (mobile): the pin's address, human-readable —
-- auto-filled via reverse geocoding when the resident drops/drags the pin (mirrors
-- Incident Reports' location picker, components/reports/location-picker-modal.tsx),
-- and editable by the resident before saving. Previously verified_location (0090)
-- only stored { lat, lng } — no characters a human could read at a glance.

alter table public.profiles
  add column if not exists verified_location_address text;

comment on column public.profiles.verified_location_address is
  'Human-readable address for verified_location (0090) — auto-filled via reverse '
  'geocoding when the resident places the pin in Settings > Location Verification, '
  'and editable by the resident before saving. NULL until verified_location is first set.';
