-- Announcements sub-tab of the Reports screen ("Reports and Announcements"), and the
-- Home Dashboard's announcement preview card. Category values match the design file's
-- filter chips (All / General / Emergency / Health / Events).

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays (id),
  title text not null,
  body text not null,
  category text not null default 'general'
    check (category in ('general', 'emergency', 'health', 'events')),
  image_url text,
  published_at timestamptz not null default now(),
  -- Nullable: the admin compose UI (apps/web) doesn't exist yet, so seeded/manually
  -- inserted rows won't have an author profile.
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "residents can read their own barangay's announcements"
  on public.announcements for select
  to authenticated
  using (barangay_id = public.current_barangay_id());

-- No client insert/update/delete policy: composing announcements is an apps/web admin
-- feature (deferred). Rows come from seed.sql until that lands.

-- Realtime: the Home Dashboard preview card and the Announcements sub-tab should reflect
-- a new announcement without a manual refresh.
alter publication supabase_realtime add table public.announcements;
