-- Fix BUG-04: waste_zones / waste_collection_schedules have no resident read
-- policy. 0051_waste_management.sql only granted `admin`/`staff` `for all`
-- policies, so residents (and guests) get zero rows — contradicting the FAQ
-- content that promises residents can view their zone's collection schedule.
--
-- Adds an authenticated, own-barangay-scoped SELECT policy for both tables,
-- limited to active, non-deleted rows (mirrors the admin policies' tenancy
-- check, just relaxed to any signed-in resident of the same barangay).

create policy "residents read active waste zones in own barangay"
  on public.waste_zones for select
  to authenticated
  using (
    deleted_at is null
    and is_active = true
    and barangay_id = public.current_barangay_id()
  );

create policy "residents read active waste schedules in own barangay"
  on public.waste_collection_schedules for select
  to authenticated
  using (
    deleted_at is null
    and is_active = true
    and barangay_id = public.current_barangay_id()
  );
