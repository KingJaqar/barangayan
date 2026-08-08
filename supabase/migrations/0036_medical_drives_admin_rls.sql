-- Admin write access for Module 10 (Health & Medical Drives).
--
-- 0035_medical_drives.sql only granted two read policies:
--   medical_drives_public_read      (is_active = true and deleted_at is null)
--   drive_registrations_own_read/own_cancel (resident's own rows)
-- There was no admin insert/update/select-all policy at all, so the admin web
-- Health screen (full CRUD, mirroring Incident Reports) could not create,
-- edit, deactivate, or soft-delete drives, nor see inactive/deleted ones in
-- its table. This mirrors the exact pattern 0022/0026 used for `incidents`:
-- an "admins manage X" (for all) policy plus a broader admin read policy.

-- ============================================================================
-- 1. medical_drives — admin read (including inactive/soft-deleted), write
-- ============================================================================

-- Admins need to see every drive in their own barangay in the management
-- table, not just the public-facing active/non-deleted subset.
create policy "admins read all medical drives"
  on public.medical_drives for select
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- Admins may insert, update, and soft-delete drives in their own barangay.
create policy "admins manage medical drives"
  on public.medical_drives for all
  to authenticated
  using  (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ============================================================================
-- 2. drive_registrations — admin read, so the management table can show a
--    per-drive registration count the same way incidents shows confirmation_count.
-- ============================================================================
create policy "admins read drive registrations"
  on public.drive_registrations for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and exists (
      select 1 from public.medical_drives d
      where d.id = drive_registrations.drive_id
        and d.barangay_id = public.current_barangay_id()
    )
  );
