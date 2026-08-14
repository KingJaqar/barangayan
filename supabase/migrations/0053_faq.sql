-- ============================================================================
-- FAQ Articles Module — migration 0053
-- ============================================================================
-- Powers the web admin FAQ Content screen and the mobile Help Center.
-- Admins and staff manage articles scoped to their barangay;
-- all authenticated residents can read active articles.

create table public.faq_articles (
  id           uuid        primary key default gen_random_uuid(),
  barangay_id  uuid        not null references public.barangays(id) on delete cascade,
  question     text        not null,
  answer       text        not null default '',
  category     text        not null default 'general'
                 check (category in ('general', 'services', 'emergency', 'health', 'billing', 'account')),
  is_active    boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index idx_faq_articles_barangay   on public.faq_articles (barangay_id);
create index idx_faq_articles_category   on public.faq_articles (category);
create index idx_faq_articles_active     on public.faq_articles (is_active) where is_active = true;
create index idx_faq_articles_sort       on public.faq_articles (sort_order);

alter table public.faq_articles enable row level security;

create policy "residents read active faq articles"
  on public.faq_articles for select
  to authenticated
  using (deleted_at is null and is_active = true);

create policy "admins manage faq articles"
  on public.faq_articles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = faq_articles.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = faq_articles.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  );

create or replace function public.set_faq_articles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger faq_articles_set_updated_at
  before update on public.faq_articles
  for each row execute function public.set_faq_articles_updated_at();

alter table public.faq_articles replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.faq_articles;
  end if;
end $$;

insert into public.faq_articles
  (id, barangay_id, question, answer, category, is_active, sort_order, created_at, updated_at, deleted_at)
values
  (
    '00000000-0000-0000-0000-00000000f001',
    '00000000-0000-0000-0000-000000000001',
    'How do I request a Barangay Clearance?',
    'Open the Services tab in the app, select Barangay Clearance, fill in the required details and submit. You will receive a reference number to track your request status.',
    'services',
    true,
    1,
    now() - interval '30 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f002',
    '00000000-0000-0000-0000-000000000001',
    'What should I bring when picking up my document?',
    'Bring a valid government-issued ID and the reference number sent to you via SMS or email. For certain document types you may also need proof of residency such as a utility bill.',
    'services',
    true,
    2,
    now() - interval '25 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f003',
    '00000000-0000-0000-0000-000000000001',
    'Where are the evacuation centers in my barangay?',
    'Go to the Emergency & DRRM Info tab and select the Centers view. The map and list show all accredited centers with real-time occupancy and contact numbers.',
    'emergency',
    true,
    1,
    now() - interval '20 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f004',
    '00000000-0000-0000-0000-000000000001',
    'How do I report an incident in my area?',
    'Use the Incident Reports tab. Choose the category, describe what happened, and optionally attach photos. You can track the status and confirm other residents'' reports.',
    'emergency',
    true,
    2,
    now() - interval '18 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f005',
    '00000000-0000-0000-0000-000000000001',
    'How can I update my profile information?',
    'Open Settings, tap Profile, then Edit Profile. You can update your full name, mobile number, home address, and profile photo. Some fields require re-verification.',
    'account',
    true,
    1,
    now() - interval '15 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f006',
    '00000000-0000-0000-0000-000000000001',
    'How do I pay for my document requests?',
    'Payments are processed through the Transactions tab. Supported methods include GCash and cash payment at the barangay hall. Your request will be updated once payment is confirmed.',
    'billing',
    true,
    1,
    now() - interval '12 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f007',
    '00000000-0000-0000-0000-000000000001',
    'Where can I find free health services?',
    'Check the Health tab for upcoming medical drives, vaccination schedules, and free consultation events. You can also view the Emergency Info Hub for health guidelines.',
    'health',
    true,
    1,
    now() - interval '10 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f008',
    '00000000-0000-0000-0000-000000000001',
    'Is my personal information secure in this app?',
    'Yes. All data is stored in a secure Supabase cloud database with Row-Level Security. Only you and authorized barangay staff can access your information. We never share your data with third parties.',
    'account',
    true,
    2,
    now() - interval '8 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f009',
    '00000000-0000-0000-0000-000000000001',
    'What should I do during a typhoon or flood?',
    'Monitor official updates in the Alerts section of the Emergency & DRRM Info tab. Follow evacuation orders, move valuables to higher ground, and proceed to the nearest designated evacuation center.',
    'emergency',
    true,
    3,
    now() - interval '6 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f010',
    '00000000-0000-0000-0000-000000000001',
    'How do I register for waste collection services?',
    'Visit the Waste Management section in the admin portal or contact your barangay office to confirm your zone and pickup schedule. Residents can view their zone schedule in the app under Services.',
    'services',
    true,
    3,
    now() - interval '4 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f011',
    '00000000-0000-0000-0000-000000000001',
    'How do I register household members?',
    'Go to Settings > Household Members in the app. You can add family members with their names and relationships. This helps barangay staff assist your household during emergencies.',
    'account',
    true,
    3,
    now() - interval '3 days',
    now() - interval '5 days',
    null
  ),
  (
    '00000000-0000-0000-0000-00000000f012',
    '00000000-0000-0000-0000-000000000001',
    'What are the barangay health center operating hours?',
    'The Barangay Health Center is open Monday to Friday from 8:00 AM to 5:00 PM, and Saturday from 8:00 AM to 12:00 PM. Walk-in consultations and vaccination drives are announced in the Health tab.',
    'health',
    true,
    2,
    now() - interval '2 days',
    now() - interval '5 days',
    null
  )
on conflict (id) do nothing;
