-- Add emergency, household, and incident confirmation tables to the
-- supabase_realtime publication so postgres_changes subscriptions fire.
-- Pattern: identical to 0027_incidents_realtime.sql and 0038_health_realtime.sql.
alter publication supabase_realtime add table public.emergency_information;
alter publication supabase_realtime add table public.evacuation_center_checkins;
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.incident_confirmations;
