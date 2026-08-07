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

-- 16 sample announcements — 4 per category (General/Emergency/Health/Events) so the
-- Home preview card and the Reports > Announcements sub-tab's category filters all have
-- realistic data. published_at offsets give natural relative timestamps on mobile.
insert into public.announcements (id, barangay_id, title, body, category, published_at)
values
  -- General (0101–0104)
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Barangay Clearance Office Hours Update',
    'Starting next week, the Barangay Clearance window will be open until 5:00 PM on weekdays to better serve residents who cannot come in during lunch hours.',
    'general',
    now() - interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'Community Assembly — August 15',
    'All registered voters are invited to attend the quarterly community assembly on August 15 at 6:00 PM at the Barangay Hall. Agenda includes budget transparency and infrastructure updates.',
    'general',
    now() - interval '3 days'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    'New Barangay ID Application Procedure',
    'Starting August 10, all Barangay ID applications must be submitted online via the Barangayan app before visiting the office. Walk-in applications without prior online submission will no longer be accepted.',
    'general',
    now() - interval '5 days'
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000001',
    'Garbage Collection Schedule Change',
    'Effective immediately, garbage collection in Purok 4 and 5 will move from Tuesday/Friday to Monday/Thursday due to a new route optimization by the city sanitation department.',
    'general',
    now() - interval '7 days'
  ),
  -- Emergency (0105–0108)
  (
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000001',
    'Typhoon Advisory: Signal No. 2 Raised',
    'PAGASA has raised Signal No. 2 over San Mateo, Rizal. Residents in low-lying areas along the Ampid River are advised to prepare for possible evacuation. Stay indoors and monitor official updates.',
    'emergency',
    now() - interval '2 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000001',
    'Flood Warning — Low-Lying Areas',
    'Rising water levels have been observed along the Ampid Creek. Residents in Purok 1 and 2 are advised to move valuables to higher ground and prepare an emergency bag. BDRRMC is on standby.',
    'emergency',
    now() - interval '4 days'
  ),
  (
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000001',
    'Fire Incident Near Purok 3 — All Clear',
    'The fire incident reported near Purok 3 Sitio Pag-asa has been contained by BFP San Mateo. No casualties reported. Affected families are being assisted by DSWD. All residents may return to normal activities.',
    'emergency',
    now() - interval '6 days'
  ),
  (
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000001',
    'Power Outage Advisory — August 8–9',
    'MERALCO will conduct scheduled maintenance along the Ampid I feeder line on August 8–9, 8:00 AM to 5:00 PM. Affected sitios: Purok 2, 3, and 6. Please prepare accordingly.',
    'emergency',
    now() - interval '8 days'
  ),
  -- Health (0109–0112)
  (
    '00000000-0000-0000-0000-000000000109',
    '00000000-0000-0000-0000-000000000001',
    'Free Flu Vaccination Drive This Saturday',
    'The barangay health center will hold a free flu vaccination drive this Saturday, 9:00 AM to 12:00 PM. Priority slots for senior citizens. Walk-ins welcome while supplies last.',
    'health',
    now() - interval '2 days'
  ),
  (
    '00000000-0000-0000-0000-000000000110',
    '00000000-0000-0000-0000-000000000001',
    'Dengue Prevention Campaign',
    'In response to rising dengue cases in the municipality, the Barangay Health Center will conduct fogging operations in all puroks this week. Please remove stagnant water in and around your homes.',
    'health',
    now() - interval '4 days'
  ),
  (
    '00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000001',
    'Senior Citizen Medical Mission',
    'A free medical mission for senior citizens aged 60 and above will be held on August 20 at the Barangay Covered Court, 8:00 AM – 3:00 PM. Services include blood pressure monitoring, blood sugar testing, and free medicines.',
    'health',
    now() - interval '9 days'
  ),
  (
    '00000000-0000-0000-0000-000000000112',
    '00000000-0000-0000-0000-000000000001',
    'Mental Health Awareness Seminar',
    'The Barangay Health Center, in partnership with the San Mateo Community Hospital, invites all residents to a free mental health awareness seminar on August 25, 2:00 PM at the Barangay Hall.',
    'health',
    now() - interval '12 days'
  ),
  -- Events (0113–0116)
  (
    '00000000-0000-0000-0000-000000000113',
    '00000000-0000-0000-0000-000000000001',
    'Fiesta Planning Meeting — All Purok Leaders',
    'All Purok leaders and interested residents are invited to join the Fiesta 2026 planning meeting this Friday, August 9, at 6:00 PM at the Barangay Hall. Attendance is required for all committee heads.',
    'events',
    now() - interval '3 days'
  ),
  (
    '00000000-0000-0000-0000-000000000114',
    '00000000-0000-0000-0000-000000000001',
    'Barangay Anniversary Street Fair',
    'Celebrate Barangay Ampid I''s founding anniversary with us! The street fair will be held on August 22 along the main barangay road featuring local food, cultural performances, and games for all ages.',
    'events',
    now() - interval '5 days'
  ),
  (
    '00000000-0000-0000-0000-000000000115',
    '00000000-0000-0000-0000-000000000001',
    'Tree-Planting Activity — Rizal Day',
    'In celebration of Rizal Day, the barangay will hold a tree-planting activity on December 30 at the barangay creek buffer zone. Participants will receive seedlings and a certificate of participation.',
    'events',
    now() - interval '10 days'
  ),
  (
    '00000000-0000-0000-0000-000000000116',
    '00000000-0000-0000-0000-000000000001',
    'Livelihood Training Workshop',
    'The TESDA-accredited livelihood training workshop on food processing (longganisa, tocino, and pastillas) will be held on August 15–16, 8:00 AM – 5:00 PM. Register at the barangay office before August 12.',
    'events',
    now() - interval '14 days'
  )
on conflict (id) do nothing;
