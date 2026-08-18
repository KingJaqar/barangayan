-- Backs the Reports bottom-tab's three live unread badges (active reports / resolved
-- reports / announcements) and the Home screen's announcements bell.
--
-- "Active reports" needs no read-state at all — it's a live status counter (how many of
-- the resident's own incidents are currently open/in_progress), not an unread notification
-- count, so nothing new is needed for it beyond the existing `incidents` table.
--
-- Resolved reports DO need read-state, but incidents already have `reporter_id` and only
-- the reporter ever sees their own report, so a single nullable column on the row is
-- enough — no join table required.
alter table public.incidents
  add column resolved_read_at timestamptz;

-- Announcements are shared, barangay-wide rows (no per-resident column would make sense
-- on the table itself), so unread/read state needs its own per-resident join table.
create table public.announcement_reads (
  resident_id     uuid        not null references public.profiles (id) on delete cascade,
  announcement_id uuid        not null references public.announcements (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (resident_id, announcement_id)
);

alter table public.announcement_reads enable row level security;

-- A resident may only see/insert/update/delete their own read markers.
create policy "residents manage own announcement reads"
  on public.announcement_reads for all
  to authenticated
  using (resident_id = auth.uid())
  with check (resident_id = auth.uid());

-- Realtime: the announcements badge/bell must update the moment a resident (or another
-- of their own devices) marks announcements read, without a manual refresh.
alter publication supabase_realtime add table public.announcement_reads;
