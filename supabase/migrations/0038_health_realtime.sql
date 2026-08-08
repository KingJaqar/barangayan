-- Add medical_drives and drive_registrations to the supabase_realtime publication
-- so that postgres_changes subscriptions on these tables actually fire.
-- Pattern: identical to 0027_incidents_realtime.sql which fixed the same silent-inert bug
-- for the incidents table.
alter publication supabase_realtime add table public.medical_drives;
alter publication supabase_realtime add table public.drive_registrations;
