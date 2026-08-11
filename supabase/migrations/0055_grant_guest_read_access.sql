-- ============================================================================
-- Grant Guest (Anon) Read Access to Public Emergency Data
-- ============================================================================
-- Fixes empty state bug in Guest Mode for Hub, Centers, and Scan tabs.
-- Unauthenticated users (anon role) can now read active, non-deleted records
-- from emergency tables. Admin write policies remain restricted to authenticated
-- admins/staff scoped to their barangay.

-- 1. emergency_information
drop policy if exists "residents read active emergency information" on public.emergency_information;

create policy "public read active emergency information"
  on public.emergency_information for select
  to anon, authenticated
  using (deleted_at is null and is_active = true);

-- 2. evacuation_centers (already implicitly public; recreate explicitly for anon)
drop policy if exists "public read active evacuation centers" on public.evacuation_centers;

create policy "public read active evacuation centers"
  on public.evacuation_centers for select
  to anon, authenticated
  using (deleted_at is null and is_active = true);

-- 3. emergency_qr_content
drop policy if exists "Allow read access to emergency_qr_content for authenticated users" on public.emergency_qr_content;

create policy "public read active emergency_qr_content"
  on public.emergency_qr_content for select
  to anon, authenticated
  using (deleted_at is null and is_active = true);

-- 4. evacuation_center_qr_codes
drop policy if exists "Allow read access to evacuation_center_qr_codes for authenticated users" on public.evacuation_center_qr_codes;

create policy "public read active evacuation_center_qr_codes"
  on public.evacuation_center_qr_codes for select
  to anon, authenticated
  using (is_active = true);
