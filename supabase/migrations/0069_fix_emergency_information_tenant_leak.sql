-- Fix BUG-01: cross-tenant read leak on emergency_information.
--
-- 0055_grant_guest_read_access.sql intentionally made emergency_information
-- readable by both `anon` and `authenticated` with no barangay_id filter, to
-- support Guest Mode browsing before a barangay is selected. That also let
-- any signed-in resident read every other barangay's emergency guidelines
-- and hotlines, since the same unscoped policy covered `authenticated` too.
--
-- Split into two policies instead of one:
--   - anon:          unscoped read (guest mode browsing, unchanged)
--   - authenticated: scoped to the caller's own barangay_id
--
-- Mobile clients already filter by barangay_id client-side once a resident
-- is signed in (see use-emergency-guidelines.ts / use-emergency-hotlines.ts),
-- so this only closes the RLS gap defense-in-depth-style; it does not change
-- any authenticated user's observed behavior.

drop policy if exists "public read active emergency information" on public.emergency_information;

create policy "guest read active emergency information"
  on public.emergency_information for select
  to anon
  using (deleted_at is null and is_active = true);

create policy "residents read own barangay emergency information"
  on public.emergency_information for select
  to authenticated
  using (
    deleted_at is null
    and is_active = true
    and barangay_id = public.current_barangay_id()
  );
