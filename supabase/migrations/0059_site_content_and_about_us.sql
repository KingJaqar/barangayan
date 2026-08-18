-- ============================================================================
-- Terms & Privacy Policy + About Us — migration 0059
-- ============================================================================
-- Powers the web admin "Terms & Privacy" and "About Us" screens and the
-- resident-facing mobile settings screens of the same name.

-- ---------------------------------------------------------------------------
-- 1a. site_content — Terms of Service / Privacy Policy, one active row per
--     (barangay_id, section)
-- ---------------------------------------------------------------------------
create table public.site_content (
  id            uuid        primary key default gen_random_uuid(),
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  section       text        not null check (section in ('terms_of_service', 'privacy_policy')),
  title         text        not null default '',
  body          text        not null default '',
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Partial unique index — allows one active row per (barangay_id, section);
-- soft-deleted rows don't block re-creation or restoration.
create unique index idx_unique_active_site_content
  on public.site_content (barangay_id, section)
  where deleted_at is null;

create index idx_site_content_barangay on public.site_content (barangay_id);

-- ---------------------------------------------------------------------------
-- 1b. about_us — one active row per barangay
-- ---------------------------------------------------------------------------
create table public.about_us (
  id            uuid        primary key default gen_random_uuid(),
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  mission       text        not null default '',
  vision        text        not null default '',
  history       text        not null default '',
  contact_email text,
  contact_phone text,
  address       text,
  logo_url      text,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create unique index idx_unique_active_about_us
  on public.about_us (barangay_id)
  where deleted_at is null;

create index idx_about_us_barangay on public.about_us (barangay_id);

-- ---------------------------------------------------------------------------
-- 1c. developer_profiles — child rows of about_us
-- ---------------------------------------------------------------------------
create table public.developer_profiles (
  id            uuid        primary key default gen_random_uuid(),
  about_us_id   uuid        not null references public.about_us(id) on delete cascade,
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  name          text        not null default '',
  role          text        not null default '',
  bio           text        not null default '',
  photo_url     text,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create unique index idx_unique_active_developer_profiles_per_parent
  on public.developer_profiles (about_us_id, sort_order)
  where deleted_at is null;

create index idx_developer_profiles_barangay on public.developer_profiles (barangay_id);

-- ---------------------------------------------------------------------------
-- 1e. updated_at triggers
-- ---------------------------------------------------------------------------
create trigger update_site_content_modtime
  before update on public.site_content
  for each row execute function public.set_updated_at_column();

create trigger update_about_us_modtime
  before update on public.about_us
  for each row execute function public.set_updated_at_column();

create trigger update_developer_profiles_modtime
  before update on public.developer_profiles
  for each row execute function public.set_updated_at_column();

-- ---------------------------------------------------------------------------
-- 1f. Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.site_content       enable row level security;
alter table public.about_us           enable row level security;
alter table public.developer_profiles enable row level security;

-- Authenticated resident reads — scoped to the reader's own barangay.
create policy "residents read active site_content"
  on public.site_content for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active about_us"
  on public.about_us for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active developer_profiles"
  on public.developer_profiles for select to authenticated
  using (deleted_at is null and barangay_id = public.current_barangay_id());

-- Guest/anonymous reads — no barangay filter, matching the project convention
-- established in migrations 0005/0055 (client scopes queries by barangay_id).
create policy "guests read active site_content"
  on public.site_content for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active about_us"
  on public.about_us for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active developer_profiles"
  on public.developer_profiles for select to anon
  using (deleted_at is null);

-- Admin/staff full management, scoped to their own barangay.
create policy "admins manage site_content"
  on public.site_content for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins manage about_us"
  on public.about_us for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins manage developer_profiles"
  on public.developer_profiles for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- ---------------------------------------------------------------------------
-- 1g. Realtime publication
-- ---------------------------------------------------------------------------
alter table public.site_content        replica identity full;
alter table public.about_us            replica identity full;
alter table public.developer_profiles  replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.site_content,
      public.about_us,
      public.developer_profiles;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1h. Seed data — all existing barangays
-- ---------------------------------------------------------------------------
insert into public.site_content (barangay_id, section, title, body)
select id, 'terms_of_service', 'Terms of Service', 'Your terms of service content here.' from public.barangays
on conflict (barangay_id, section) where deleted_at is null do nothing;

insert into public.site_content (barangay_id, section, title, body)
select id, 'privacy_policy', 'Privacy Policy', 'Your privacy policy content here.' from public.barangays
on conflict (barangay_id, section) where deleted_at is null do nothing;
