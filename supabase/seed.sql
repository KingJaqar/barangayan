-- Local/dev seed data for the pilot barangay (Ampid I, San Mateo, Rizal — per the
-- proposal). Fine to name it here: this is data, not app code branching on it
-- (AGENTS.md §0 is about code, not seed fixtures). Written to be safely re-runnable
-- (`supabase db reset` re-executes this every time) via fixed UUIDs / natural keys.

insert into public.barangays (id, name, config)
values (
  '00000000-0000-0000-0000-000000000001',
  'Barangay Ampid I',
  '{}'::jsonb
)
on conflict (id) do nothing;

-- Mirrors packages/shared/src/constants/document-catalog-shape.ts's SEED_DOCUMENT_TYPES —
-- keep the two in sync if either changes.
insert into public.document_types
  (barangay_id, name, description, fee_centavos, processing_target_hours, requirements)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Barangay Clearance',
    'General-purpose clearance for employment, business, or travel requirements.',
    5000, 24,
    array['Valid ID', 'Proof of residency']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Certificate of Indigency',
    'Certifies low-income status for fee waivers or assistance applications.',
    0, 24,
    array['Valid ID']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Certificate of Residency',
    'Certifies that the applicant resides within the barangay.',
    3000, 24,
    array['Valid ID', 'Proof of residency']
  )
on conflict (barangay_id, name) do nothing;

-- Sample announcements — one per design-file category (General/Emergency/Health) so the
-- Home preview card and the Reports > Announcements sub-tab's category filters both have
-- something real to show across categories.
insert into public.announcements (id, barangay_id, title, body, category)
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Barangay Clearance Office Hours Update',
    'Starting next week, the Barangay Clearance window will be open until 5:00 PM on weekdays to better serve residents.',
    'general'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'Typhoon Advisory Signal No. 2',
    'PAGASA has raised Signal No. 2 over San Mateo, Rizal. Residents in low-lying areas are advised to prepare for possible evacuation.',
    'emergency'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    'Free Flu Vaccination Drive This Saturday',
    'The barangay health center will hold a free flu vaccination drive this Saturday, 9:00 AM to 12:00 PM. Walk-ins welcome, slots limited.',
    'health'
  )
on conflict (id) do nothing;
