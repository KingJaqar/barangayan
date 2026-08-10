-- ============================================================================
-- Emergency QR & Content Management System
-- ============================================================================
-- Creates emergency_qr_content and evacuation_center_qr_codes tables
-- with RLS policies, updated_at triggers, and realtime replication.

-- ============================================================================
-- 1. instructional content (Why Scan / How It Works)
-- ============================================================================
create table public.emergency_qr_content (
  id            uuid        primary key default gen_random_uuid(),
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  section       text        not null check (section in ('why_scan', 'how_it_works')),
  title         text        not null,
  body          text        not null default '',
  content       jsonb       not null default '[]'::jsonb,
  icon          text        default 'qr-code-outline',
  icon_color    text        default '#2563EB',
  icon_bg       text        default '#DBEAFE',
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint unique_barangay_section unique (barangay_id, section)
);

-- ============================================================================
-- 2. evacuation center qr code payloads
-- ============================================================================
create table public.evacuation_center_qr_codes (
  id                     uuid        primary key default gen_random_uuid(),
  evacuation_center_id   uuid        not null references public.evacuation_centers(id) on delete cascade,
  qr_payload             jsonb       not null,
  qr_image_url           text,
  is_active              boolean     not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint unique_center_qr unique (evacuation_center_id)
);

-- ============================================================================
-- 3. indexes
-- ============================================================================
create index idx_emergency_qr_content_barangay on public.emergency_qr_content (barangay_id);
create index idx_evacuation_center_qr_center  on public.evacuation_center_qr_codes (evacuation_center_id);

-- ============================================================================
-- 4. updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_emergency_qr_content_modtime
  before update on public.emergency_qr_content
  for each row execute function public.set_updated_at_column();

create trigger update_evacuation_center_qr_modtime
  before update on public.evacuation_center_qr_codes
  for each row execute function public.set_updated_at_column();

-- ============================================================================
-- 5. row level security
-- ============================================================================
alter table public.emergency_qr_content        enable row level security;
alter table public.evacuation_center_qr_codes  enable row level security;

-- read: authenticated users see active, non-deleted content
create policy "Allow read access to emergency_qr_content for authenticated users"
  on public.emergency_qr_content
  for select
  to authenticated
  using (deleted_at is null and is_active = true);

create policy "Allow read access to evacuation_center_qr_codes for authenticated users"
  on public.evacuation_center_qr_codes
  for select
  to authenticated
  using (is_active = true);

-- write: barangay admins / staff only
create policy "Allow full access to emergency_qr_content for barangay admins"
  on public.emergency_qr_content
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.barangay_id = emergency_qr_content.barangay_id
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "Allow full access to evacuation_center_qr_codes for barangay admins"
  on public.evacuation_center_qr_codes
  for all
  to authenticated
  using (
    exists (
      select 1 from public.evacuation_centers ec
      join public.profiles p on p.barangay_id = ec.barangay_id
      where ec.id = evacuation_center_qr_codes.evacuation_center_id
        and p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

-- ============================================================================
-- 6. realtime replication
-- ============================================================================
alter table public.emergency_qr_content        replica identity full;
alter table public.evacuation_center_qr_codes  replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.emergency_qr_content,
      public.evacuation_center_qr_codes;
  end if;
end $$;
