-- Local/dev seed data for the pilot barangay (Ampid I, San Mateo, Rizal — per the
-- proposal). Fine to name it here: this is data, not app code branching on it
-- (AGENTS.md §0 is about code, not seed fixtures). Written to be safely re-runnable
-- (`supabase db reset` re-executes this every time) via fixed UUIDs / natural keys.

-- boundary: real GeoJSON Polygon trace of Ampid I, San Mateo, Rizal (user-supplied,
-- see 0024_ampid1_boundary.sql for provenance) — used by the Maps screen's red
-- perimeter overlay and default map focus.
insert into public.barangays (id, name, config, boundary)
values (
  '00000000-0000-0000-0000-000000000001',
  'Barangay Ampid I',
  '{}'::jsonb,
  '{"type":"Polygon","coordinates":[[[121.112071,14.684583],[121.111589,14.683696],[121.11119,14.682938],[121.110588,14.68167],[121.110227,14.680994],[121.111337,14.680657],[121.111538,14.681181],[121.11201,14.680987],[121.112639,14.68094],[121.112523,14.68067],[121.113036,14.680529],[121.113198,14.68051],[121.113527,14.680559],[121.113633,14.680694],[121.11395,14.680462],[121.112791,14.67911],[121.113227,14.678874],[121.113615,14.678928],[121.113997,14.678685],[121.114505,14.678351],[121.115052,14.677566],[121.115111,14.677538],[121.115194,14.677389],[121.115264,14.677146],[121.115385,14.677176],[121.115453,14.677252],[121.115714,14.677204],[121.11588,14.677342],[121.115986,14.677413],[121.116078,14.67741],[121.116219,14.677329],[121.116405,14.677291],[121.116744,14.677402],[121.116916,14.677441],[121.117053,14.677505],[121.117137,14.677565],[121.117332,14.677586],[121.1178,14.67773],[121.11835,14.67765],[121.11888,14.6776],[121.1194,14.67755],[121.119699,14.677335],[121.119919,14.677606],[121.120435,14.677799],[121.12057,14.677672],[121.1209,14.67746],[121.121247,14.676374],[121.12285,14.675863],[121.12295,14.675833],[121.123415,14.675664],[121.123538,14.675499],[121.123479,14.675243],[121.123386,14.67517],[121.12333,14.675082],[121.123336,14.674932],[121.123471,14.674848],[121.123541,14.674852],[121.123597,14.674788],[121.123603,14.674673],[121.123664,14.674666],[121.123761,14.674695],[121.123915,14.674842],[121.124053,14.674789],[121.124037,14.674652],[121.123883,14.674353],[121.123905,14.67427],[121.124313,14.674157],[121.124469,14.67409],[121.124697,14.674091],[121.124728,14.674169],[121.124755,14.674262],[121.125185,14.673944],[121.12528,14.674032],[121.125385,14.674068],[121.125577,14.674105],[121.125558,14.674687],[121.125495,14.67528],[121.124963,14.67549],[121.125009,14.676367],[121.124198,14.67738],[121.124843,14.678374],[121.124888,14.678732],[121.124685,14.678862],[121.124612,14.67964],[121.12585,14.679571],[121.125981,14.680021],[121.125871,14.68021],[121.12559,14.680595],[121.125638,14.681139],[121.126124,14.681541],[121.126901,14.682126],[121.127262,14.682688],[121.126457,14.683075],[121.126121,14.683093],[121.125692,14.683105],[121.12548,14.683044],[121.123765,14.683534],[121.12369,14.683676],[121.123708,14.683877],[121.123286,14.684046],[121.122833,14.684481],[121.122726,14.684701],[121.122519,14.684869],[121.122308,14.685028],[121.122303,14.685217],[121.122665,14.685424],[121.122815,14.685407],[121.122906,14.685521],[121.122891,14.685635],[121.122754,14.685759],[121.12263,14.685704],[121.12242,14.685849],[121.122069,14.685859],[121.121842,14.686011],[121.121671,14.686372],[121.120837,14.686638],[121.121109,14.685911],[121.121103,14.685602],[121.120734,14.685296],[121.120329,14.684888],[121.119695,14.684664],[121.119547,14.684673],[121.119482,14.684741],[121.119259,14.685274],[121.119095,14.685609],[121.118907,14.685707],[121.118608,14.685578],[121.118371,14.685322],[121.118247,14.685267],[121.117853,14.685243],[121.117008,14.684831],[121.116345,14.684996],[121.11607,14.684951],[121.115783,14.684928],[121.115285,14.685069],[121.114709,14.685565],[121.114524,14.68565],[121.114468,14.685667],[121.114403,14.685704],[121.11435,14.685708],[121.114233,14.685739],[121.113884,14.685586],[121.113534,14.685444],[121.113411,14.685353],[121.11325,14.68532],[121.112606,14.684883],[121.112071,14.684583]]]}'::jsonb
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

-- ============================================================================
-- Sample incidents — realistic data for dev/demo so the Reports feed and the
-- Maps screen both have content without manual entry.
--
-- reporter_id is NULL (anonymous) because seed.sql runs before any auth.users
-- rows exist in a fresh `supabase db reset`. Barangay-scoped RLS still applies
-- via barangay_id. Real production incidents always have a reporter_id.
--
-- category_id is resolved from the 0023 category names for the pilot barangay.
-- ============================================================================
insert into public.incidents (
  id, barangay_id, reporter_id, category_id, title, description,
  location, photo_urls, status, confirmation_count, created_at, updated_at
)
select
  v.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  null,
  (select id from public.incident_categories
     where barangay_id = '00000000-0000-0000-0000-000000000001'
       and name = v.category_name
     limit 1),
  v.title,
  v.description,
  v.location::jsonb,
  '{}'::text[],
  v.status,
  v.confirmation_count,
  now() - (v.age_hours || ' hours')::interval,
  now() - (v.age_hours || ' hours')::interval
from (values
  (
    '00000000-0000-0000-0000-000000000201',
    'Road Damage',
    'Large pothole on the corner of Sitio Pag-asa and Purok 3 road',
    'Large pothole forming near the drainage outlet. Vehicles swerve dangerously to avoid it, especially at night. Approximate depth 30 cm.',
    '{"lat":14.6825,"lng":121.1155}',
    'in_progress', 4, 48
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'Illegal Dumping',
    'Garbage dumped along creek bank near Purok 2',
    'Pile of household trash and construction debris dumped along the creek bank near Purok 2 bridge. Foul smell noticeable and may block drainage during rain.',
    '{"lat":14.6820,"lng":121.1148}',
    'open', 2, 24
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    'Damaged Street Light',
    'Streetlamp flickering and out on Purok 4 main road',
    'The streetlamp at the intersection of the main road and the path to the barangay hall flickered for a week and is now completely out. Area is very dark at night.',
    '{"lat":14.6832,"lng":121.1162}',
    'open', 1, 72
  ),
  (
    '00000000-0000-0000-0000-000000000204',
    'Drainage Issue',
    'Blocked canal causing flooding after heavy rain near Sitio Riverside',
    'The main drainage canal along Sitio Riverside is partially blocked by silt and debris. Water flooded the road for over 3 hours after last week''s rain, affecting 12 households.',
    '{"lat":14.6815,"lng":121.1140}',
    'resolved', 7, 120
  ),
  (
    '00000000-0000-0000-0000-000000000205',
    'Road Damage',
    'Fallen tree branch blocking road to Purok 5',
    'A large branch fell across the road leading to Purok 5 during last night''s storm. One lane fully blocked; motorcycle riders are at risk.',
    '{"lat":14.6840,"lng":121.1170}',
    'resolved', 3, 96
  ),
  (
    '00000000-0000-0000-0000-000000000206',
    'Illegal Dumping',
    'Informal trash pile growing behind the basketball court',
    'An informal dump has been growing behind the barangay basketball court for two weeks. Household garbage mixed with used tyres.',
    '{"lat":14.6827,"lng":121.1153}',
    'in_progress', 5, 36
  )
) as v(id, category_name, title, description, location, status, confirmation_count, age_hours)
on conflict (id) do nothing;

-- pgcrypto is required for crypt() / gen_salt() used in the test-account block
-- below. Supabase local dev always bundles it; this is just an explicit guard.
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- Dev test account: alex@gmaiil.com  (password: Alex1234!)
--
-- Inserts a fully-wired resident account so the Reports screen, detail view,
-- confirm, and withdraw flows can all be exercised without signing up manually.
--
-- HOW IT WORKS:
--   1. auth.users  — the Supabase GoTrue row; email already confirmed so login
--                    works immediately without an OTP step.
--   2. auth.identities — required for the email provider; without this Supabase
--                        Auth cannot authenticate the user via email/password.
--   3. public.profiles — the handle_new_user() trigger (migration 0012) fires
--                        AFTER INSERT on auth.users and creates this row
--                        automatically from raw_user_meta_data, so we don't
--                        insert it manually here.
--   4. public.incidents — three linked incidents (2 active, 1 resolved) that
--                         show up in "My Incident Reports" when signed in as Alex.
--
-- All UUIDs are in the 0x10 namespace so they never collide with other seed rows.
-- Safe to re-run: every statement uses ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1. Auth user -----------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'alex@gmaiil.com',
  -- bcrypt hash of 'Alex1234!' — schema-qualified so the seed works regardless
  -- of the session search_path. Dev-only fixture; never use a known password in production.
  extensions.crypt('Alex1234!', extensions.gen_salt('bf', 10)),
  now(),                        -- email already confirmed; no OTP required
  '{"provider":"email","providers":["email"]}',
  -- handle_new_user() reads these fields to build the profiles row.
  jsonb_build_object(
    'full_name',    'Alex Reyes',
    'barangay_id',  '00000000-0000-0000-0000-000000000001',
    'mobile_number','+639175551234',
    'home_address', 'Purok 3, Sitio Pag-asa, Barangay Ampid I'
  ),
  now(),
  now(),
  '', '', '', ''
)
on conflict (id) do nothing;

-- 2. Identity (email provider) ------------------------------------------------
-- Without this row, supabase-auth cannot sign the user in via email/password.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  'alex@gmaiil.com',
  jsonb_build_object(
    'sub',   '00000000-0000-0000-0000-000000000010',
    'email', 'alex@gmaiil.com'
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

-- NOTE: public.profiles is created automatically by the handle_new_user()
-- trigger that fired on the auth.users INSERT above. No manual insert needed.

-- 3. Alex's incident reports --------------------------------------------------
-- Three incidents with real Ampid I coordinates, categories from 0023 seed,
-- and reporter_id = Alex's UUID so they appear in her "My Incident Reports" feed.

insert into public.incidents (
  id, barangay_id, reporter_id, category_id, title, description,
  location, photo_urls, status, confirmation_count, created_at, updated_at
)
select
  v.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000010'::uuid,          -- Alex's reporter_id
  (select id from public.incident_categories
     where barangay_id = '00000000-0000-0000-0000-000000000001'
       and name = v.category_name
     limit 1),
  v.title,
  v.description,
  v.location::jsonb,
  '{}'::text[],
  v.status,
  v.confirmation_count,
  now() - (v.age_hours || ' hours')::interval,
  now() - (v.age_hours || ' hours')::interval
from (values

  -- ── Active #1 — Open ───────────────────────────────────────────────────────
  -- A freshly submitted report. Still within the 24-hour withdrawal window
  -- so the "Withdraw report" button appears on the detail screen.
  (
    '00000000-0000-0000-0000-000000000207',
    'Damaged Street Light',
    'Streetlamp completely out near the Purok 3 basketball court',
    'The streetlamp directly in front of the Purok 3 basketball court has been completely dark for 3 days. '
    'Children playing in the area in the evening are at risk, and the road becomes a hazard for motorcycles '
    'after 7 PM. Previously it was flickering for about a week before going out entirely.',
    '{"lat":14.6829,"lng":121.1158}',
    'open',
    2,     -- 2 neighbours confirmed the report
    6      -- submitted 6 hours ago — still inside the 24-hour withdrawal window
  ),

  -- ── Active #2 — In Progress ────────────────────────────────────────────────
  -- Admin has already acknowledged this one and moved it to in_progress,
  -- so the detail screen shows the In Progress badge and no withdrawal button.
  (
    '00000000-0000-0000-0000-000000000208',
    'Flooding',
    'Knee-deep flooding on the alley between Purok 3 and Purok 4 after heavy rain',
    'Every time it rains for more than 30 minutes, the alley connecting Purok 3 and Purok 4 floods to '
    'knee depth. The water takes 4–5 hours to drain completely. At least 8 households use this path as '
    'their only access. Possible cause is a blocked culvert at the Purok 4 end of the alley.',
    '{"lat":14.6823,"lng":121.1150}',
    'in_progress',
    7,     -- 7 residents confirmed — high community corroboration
    36     -- submitted 36 hours ago; admin moved it to in_progress at ~24 h
  ),

  -- ── Resolved ──────────────────────────────────────────────────────────────
  -- Admin marked this resolved. Shows the green Resolved badge and no action
  -- buttons on the detail screen (already handled).
  (
    '00000000-0000-0000-0000-000000000209',
    'Road Damage',
    'Deep crack running across the main road near the barangay hall gate',
    'A transverse crack approximately 2 metres wide and 10 cm deep appeared across the main road '
    'at the entrance of the barangay hall. Heavy vehicles have been widening it over the past two '
    'weeks. Patched and resurfaced by the barangay maintenance crew on August 6.',
    '{"lat":14.6835,"lng":121.1165}',
    'resolved',
    5,     -- 5 confirmations before it was resolved
    96     -- submitted 4 days ago; resolved the next morning
  )

) as v(id, category_name, title, description, location, status, confirmation_count, age_hours)
on conflict (id) do nothing;
