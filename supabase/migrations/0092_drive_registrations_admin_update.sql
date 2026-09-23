-- Allow admins to update registrations only when the related medical drive
-- belongs to the admin's barangay. Keep this as a separate UPDATE policy so
-- the resident-only pending -> cancelled policy from migration 0035 remains
-- unchanged.
create policy "admins update drive registrations"
  on public.drive_registrations for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and exists (
      select 1
      from public.medical_drives d
      where d.id = drive_registrations.drive_id
        and d.barangay_id = public.current_barangay_id()
    )
  )
  with check (
    public.current_role() = 'admin'
    and exists (
      select 1
      from public.medical_drives d
      where d.id = drive_registrations.drive_id
        and d.barangay_id = public.current_barangay_id()
    )
  );
