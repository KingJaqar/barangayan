-- Emergency Information: unified table for guidelines and hotlines
-- Replaces separate emergency_guidelines / emergency_hotlines tables for the
-- Emergency & DRRM Info Hub tab. Public read (authenticated users), admin full
-- management scoped to their barangay.

create table public.emergency_information (
  id           uuid        primary key default gen_random_uuid(),
  barangay_id  uuid        not null references public.barangays(id) on delete cascade,
  category     text        not null check (category in ('guidelines', 'hotlines')),
  title        text        not null,
  body         text        not null default '',
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  created_by   uuid        references public.profiles(id),
  deleted_at   timestamptz,
  icon         text        not null default 'information-circle-outline',
  icon_color   text        not null default '#0F6E5B',
  icon_bg      text        not null default '#E6F2EF',
  content      jsonb       not null default '[]'::jsonb,
  sort_order   integer     not null default 0,
  is_active    boolean     not null default true
);

create index emergency_information_barangay_id_idx on public.emergency_information (barangay_id);
create index emergency_information_category_idx    on public.emergency_information (category);
create index emergency_information_active_idx      on public.emergency_information (is_active) where is_active = true;

alter table public.emergency_information enable row level security;

create policy "residents read active emergency information"
  on public.emergency_information for select
  to authenticated
  using (deleted_at is null and is_active = true);

create policy "admins manage emergency information"
  on public.emergency_information for all
  to authenticated
  using  (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());
