-- Adds: (1) soft-delete column on announcements so archived items stay in the DB but
-- disappear from resident/guest feeds; (2) admin write RLS on announcements; (3) rebuilt
-- SELECT policies that filter out soft-deleted rows.
--
-- Pattern mirrors 0009's admin CRUD on document_types / service_requests.

-- ============================================================================
-- soft-delete column
-- ============================================================================
alter table public.announcements
  add column if not exists deleted_at timestamptz;

-- ============================================================================
-- SELECT policies — drop and recreate to add deleted_at IS NULL guard.
-- Original policies were created in 0003 / 0005 migrations.
-- ============================================================================
drop policy if exists "residents can read announcements from their barangay" on public.announcements;
drop policy if exists "guests can read all announcements"                    on public.announcements;

create policy "residents can read announcements from their barangay"
  on public.announcements for select
  to authenticated
  using (barangay_id = public.current_barangay_id() and deleted_at is null);

create policy "guests can read all announcements"
  on public.announcements for select
  to anon
  using (deleted_at is null);

-- ============================================================================
-- Admin ALL policy — insert / update / delete (soft) scoped to own barangay.
-- ============================================================================
create policy "admins can manage announcements in their barangay"
  on public.announcements for all
  to authenticated
  using  (barangay_id = public.current_barangay_id() and public.current_role() = 'admin')
  with check (barangay_id = public.current_barangay_id() and public.current_role() = 'admin');
