-- Seed incident_categories for every existing barangay.
--
-- These five categories match SEED_INCIDENT_CATEGORIES in
-- packages/shared/src/constants/incident-categories.ts and the UI colors
-- used by the Maps screen's filter pills. The ON CONFLICT clause makes this
-- idempotent — safe to re-run or apply to a barangay that already has these rows.
--
-- New barangays created after this migration will NOT automatically get these
-- rows; the admin onboarding flow (future) will handle that. This only
-- back-fills existing barangays at deploy time.

insert into public.incident_categories (barangay_id, name, color, icon, is_trash_related)
select
  b.id,
  v.name,
  v.color,
  v.icon,
  v.is_trash_related
from public.barangays b
cross join (values
  ('Damaged Street Light', '#F59E0B', 'bulb-outline',          false),
  ('Road Damage',          '#EF4444', 'construct-outline',      false),
  ('Drainage Issue',       '#3B82F6', 'water-outline',          true),
  ('Illegal Dumping',      '#10B981', 'trash-outline',          true),
  ('Flooding',             '#6366F1', 'thunderstorm-outline',   false)
) as v(name, color, icon, is_trash_related)
on conflict (barangay_id, name) do nothing;
