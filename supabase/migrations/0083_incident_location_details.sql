-- Full location feature for the Incident Reports module (Module 3).
--
-- `incidents.location` (jsonb { lat, lng }) has existed since 0022 — this adds the two
-- new fields the mobile/web map picker now populates:
--   - address:                reverse-geocoded (or resident-corrected) human-readable
--                              address for `location`.
--   - specific_area_details:  free-text detail the resident adds on top of the pin/address
--                              (e.g. "near the blue gate, 2nd house from the corner").
--
-- Both are optional — older reports and admin walk-in reports (created without a pinned
-- location, see incident-table.tsx's AddIncidentForm) simply have NULL here.

alter table public.incidents
  add column if not exists address                text,
  add column if not exists specific_area_details   text;

comment on column public.incidents.address is
  'Reverse-geocoded (OpenStreetMap Nominatim) or resident-corrected human-readable '
  'address for `location`. The map picker auto-fills this when a pin is placed/moved; '
  'residents may overwrite the text before submitting. NULL for reports created before '
  'this column existed or without a pinned location.';

comment on column public.incidents.specific_area_details is
  'Free-text detail the resident enters to pinpoint the report beyond the map pin and '
  'address (e.g. "near the blue gate, 2nd house from the corner, purple wall"). Optional.';
