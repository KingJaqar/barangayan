-- Phase 1 (post-session-handoff): full admin CRUD on Services, Requests, Transactions,
-- and Resident Directory. Adds soft-delete support everywhere (deleted_at, not a real
-- DELETE — preserves the payments<->service_requests FK and the audit trail the 0007/0008
-- migrations were built around: status_history, the payments ledger) and the admin write
-- policies that were still missing: service_requests insert (walk-in requests), payments
-- insert (admin-recorded transactions), profiles insert/update (resident directory CRUD).
--
-- document_types needs no new policy here — its existing "admins can manage document
-- types in their barangay" policy (0007) is already `for all`, so it already covers the
-- soft-delete UPDATE.

-- ============================================================================
-- Soft delete columns.
-- ============================================================================
alter table public.service_requests add column deleted_at timestamptz;
alter table public.payments add column deleted_at timestamptz;
alter table public.document_types add column deleted_at timestamptz;
alter table public.profiles add column deleted_at timestamptz;

-- ============================================================================
-- service_requests — admin insert (walk-in / phone-in requests created on a
-- resident's behalf from the admin panel). Reference number, status, and
-- status_history stay fully system-generated (0002/0004 triggers already fire on
-- INSERT regardless of who the caller is) — the admin only supplies resident_id,
-- document_type_id, and optional requester_notes.
-- ============================================================================
create policy "admins can create requests in their barangay"
  on public.service_requests for insert
  to authenticated
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ============================================================================
-- payments — admin insert (recording a transaction directly from the admin
-- Transactions screen, not just via the resident-initiated COD/QR Ph flows).
-- Admin update policy already exists (0007) and covers the soft-delete UPDATE.
-- ============================================================================
create policy "admins can create payments in their barangay"
  on public.payments for insert
  to authenticated
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ============================================================================
-- profiles — admin insert/update, scoped to resident rows in the admin's own
-- barangay only (never lets an admin touch another admin's row, or cross
-- barangay boundaries). This is what the Resident Directory's inline edit and
-- soft-delete need; admin-created residents additionally require provisioning
-- an auth.users row first, which RLS can't do — that part goes through a
-- service-role Next.js route handler (apps/web/src/app/api/admin/residents),
-- and the profiles row it inserts is covered by this same policy.
-- ============================================================================
create policy "admins can create resident profiles in their barangay"
  on public.profiles for insert
  to authenticated
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'resident'
  );

create policy "admins can update resident profiles in their barangay"
  on public.profiles for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'resident'
  )
  with check (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'resident'
  );
