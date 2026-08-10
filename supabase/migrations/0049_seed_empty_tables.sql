-- Seed data for tables that are empty in the remote Supabase instance.
-- All inserts use ON CONFLICT DO NOTHING so this migration is safe to re-run.
-- Idempotent: re-applying will not duplicate rows.

-- ============================================================================
-- 1. emergency_information (3 guidelines + 3 hotlines)
-- ============================================================================
insert into public.emergency_information
  (id, barangay_id, category, title, body, published_at, created_at, created_by, deleted_at, icon, icon_color, icon_bg, content, sort_order, is_active)
values
  -- Guidelines
  (
    '00000000-0000-0000-0000-00000000e100',
    '00000000-0000-0000-0000-000000000001',
    'guidelines',
    'Typhoon Preparedness',
    'Before, during, and after a typhoon — stay informed and follow official evacuation orders.',
    now() - interval '30 days',
    now() - interval '30 days',
    null,
    null,
    'warning-outline',
    '#D97706',
    '#FEF3C7',
    '[
      "Secure loose objects outside your home and bring them indoors.",
      "Stock emergency supplies: water, food, flashlight, batteries, and first-aid kit.",
      "Monitor official updates via the Barangay DRRM Office and PAGASA.",
      "Evacuate to the nearest designated center if advised by authorities.",
      "After the typhoon, avoid damaged structures and report hazards to barangay officials."
    ]'::jsonb,
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000e101',
    '00000000-0000-0000-0000-000000000001',
    'guidelines',
    'Earthquake Safety',
    'Drop, Cover, and Hold On during shaking. Evacuate safely once the tremors stop.',
    now() - interval '25 days',
    now() - interval '25 days',
    null,
    null,
    'warning-outline',
    '#DC2626',
    '#FEE2E2',
    '[
      "Drop to your hands and knees, cover your head and neck under sturdy furniture.",
      "Hold on to your shelter until the shaking stops.",
      "Stay away from windows, exterior walls, and anything that could fall.",
      "If in a vehicle, pull over and stay inside until shaking stops.",
      "Check for injuries and damages after; do not use elevators."
    ]'::jsonb,
    2,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000e102',
    '00000000-0000-0000-0000-000000000001',
    'guidelines',
    'Fire Emergency Response',
    'Act quickly: raise the alarm, evacuate low, and meet at your assembly point.',
    now() - interval '20 days',
    now() - interval '20 days',
    null,
    null,
    'flame-outline',
    '#DC2626',
    '#FEE2E2',
    '[
      "Activate the nearest fire alarm and call the fire department immediately.",
      "If smoke is present, stay low to the ground where air is cleaner.",
      "Do not open doors that are warm to the touch; find an alternate escape route.",
      "Once outside, meet at your designated assembly point.",
      "Never re-enter a burning building."
    ]'::jsonb,
    3,
    true
  ),
  -- Hotlines
  (
    '00000000-0000-0000-0000-00000000a100',
    '00000000-0000-0000-0000-000000000001',
    'hotlines',
    'Police',
    'Emergency police response and assistance.',
    now() - interval '15 days',
    now() - interval '15 days',
    null,
    null,
    'shield-outline',
    '#1D4ED8',
    '#DBEAFE',
    '[{"label": "117", "number": "117"}, {"label": "(02) 8123-4567", "number": "021234567"}]'::jsonb,
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000a101',
    '00000000-0000-0000-0000-000000000001',
    'hotlines',
    'Fire Department',
    'Fire emergencies and rescue operations.',
    now() - interval '10 days',
    now() - interval '10 days',
    null,
    null,
    'flame-outline',
    '#DC2626',
    '#FEE2E2',
    '[{"label": "911", "number": "911"}, {"label": "(02) 8765-4321", "number": "0287654321"}]'::jsonb,
    2,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000a102',
    '00000000-0000-0000-0000-000000000001',
    'hotlines',
    'Barangay DRRM Office',
    'Local disaster risk reduction and management coordination.',
    now() - interval '5 days',
    now() - interval '5 days',
    null,
    null,
    'call-outline',
    '#0F6E5B',
    '#E6F2EF',
    '[{"label": "0917 123 4567", "number": "09171234567"}]'::jsonb,
    3,
    true
  )
on conflict (id) do nothing;

-- ============================================================================
-- 2. Profile-dependent seed data (household_members, checkins, confirmations)
--    Uses a DO block so we can resolve or create the resident user/profile
--    before inserting FK-dependent rows.
-- ============================================================================
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'alex@gmaiil.com';

  if v_user_id is null then
    insert into auth.users
      (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at,
       last_sign_in_at, raw_user_meta_data, created_at, updated_at,
       is_super_admin, is_anonymous, aud, role)
    values
      (
        '00000000-0000-0000-0000-000000000010',
        'alex@gmaiil.com',
        'Alex1234!',
        now(), now(), now(),
        jsonb_build_object(
          'full_name',    'Alex Reyes',
          'barangay_id',  '00000000-0000-0000-0000-000000000001',
          'mobile_number','+639175551234',
          'home_address', 'Purok 3, Sitio Pag-asa, Barangay Ampid I'
        ),
        now(), now(),
        false, false, 'authenticated', 'authenticated'
      )
    returning id into v_user_id;
  end if;

  insert into auth.identities
    (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (
      v_user_id,
      v_user_id,
      'alex@gmaiil.com',
      jsonb_build_object('sub', v_user_id::text, 'email', 'alex@gmaiil.com'),
      'email',
      now(), now(), now()
    )
  on conflict (id) do nothing;

  update public.profiles
    set email_verification_status = 'verified',
        accent_color              = '#0F6E5B',
        theme_preference          = 'light',
        updated_at                = now()
  where id = v_user_id;

  -- household_members
  insert into public.household_members
    (id, profile_id, name, relation, role, avatar_url, is_checked_in, checked_in_at, checked_in_center_id, checked_in_center_name, sort_order)
  values
    (
      '00000000-0000-0000-0000-00000000f001',
      v_user_id,
      'Maria Dela Cruz',
      'Wife',
      'member',
      null,
      true,
      now() - interval '2 hours',
      '00000000-0000-0000-0000-00000000c002',
      'San Mateo Civic Center',
      0
    ),
    (
      '00000000-0000-0000-0000-00000000f002',
      v_user_id,
      'Miguel Dela Cruz',
      'Son',
      'member',
      null,
      false,
      null,
      null,
      null,
      1
    ),
    (
      '00000000-0000-0000-0000-00000000f003',
      v_user_id,
      'Sofia Dela Cruz',
      'Daughter',
      'member',
      null,
      false,
      null,
      null,
      null,
      2
    ),
    (
      '00000000-0000-0000-0000-00000000f004',
      v_user_id,
      'Lolo Ramon',
      'Grandfather',
      'member',
      null,
      false,
      null,
      null,
      null,
      3
    )
  on conflict (id) do nothing;

  -- evacuation_center_checkins
  insert into public.evacuation_center_checkins
    (id, evacuation_center_id, user_id, barangay_id, checked_in_at, created_at)
  values
    (
      '00000000-0000-0000-0000-00000000b001',
      '00000000-0000-0000-0000-00000000c002',
      v_user_id,
      '00000000-0000-0000-0000-000000000001',
      now() - interval '2 hours',
      now() - interval '2 hours'
    ),
    (
      '00000000-0000-0000-0000-00000000b002',
      '00000000-0000-0000-0000-00000000c001',
      v_user_id,
      '00000000-0000-0000-0000-000000000001',
      now() - interval '5 hours',
      now() - interval '5 hours'
    ),
    (
      '00000000-0000-0000-0000-00000000b003',
      '00000000-0000-0000-0000-00000000c003',
      v_user_id,
      '00000000-0000-0000-0000-000000000001',
      now() - interval '1 day',
      now() - interval '1 day'
    )
  on conflict (evacuation_center_id, user_id, checked_in_at) do nothing;

  -- incident_confirmations (only if the referenced incidents exist)
  insert into public.incident_confirmations
    (incident_id, user_id, created_at)
  select v.id::uuid, v_user_id, v.created_at
  from (values
      ('00000000-0000-0000-0000-000000000201', now() - interval '36 hours'),
      ('00000000-0000-0000-0000-000000000204', now() - interval '24 hours'),
      ('00000000-0000-0000-0000-000000000206', now() - interval '12 hours')
    ) as v(id, created_at)
  where exists (select 1 from public.incidents where id = v.id::uuid and deleted_at is null)
  on conflict (incident_id, user_id) do nothing;

  -- Sync confirmation_count to match inserted rows
  update public.incidents
    set confirmation_count = confirmation_count + 1
  where id in (
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000204',
      '00000000-0000-0000-0000-000000000206'
    )
    and deleted_at is null;
end $$;
