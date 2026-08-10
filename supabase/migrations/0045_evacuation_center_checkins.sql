-- QR Check-In / Attendance for Evacuation Centers
--
-- Records when a resident scans a barangay QR code at an evacuation center.
-- The QR payload is expected to be a simple JSON or text token containing the
-- evacuation center's UUID; the app resolves it server-side before inserting.

create table public.evacuation_center_checkins (
  id                  uuid        primary key default gen_random_uuid(),
  evacuation_center_id uuid       not null references public.evacuation_centers(id) on delete cascade,
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  barangay_id         uuid        not null references public.barangays(id) on delete cascade,
  checked_in_at       timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  unique (evacuation_center_id, user_id, checked_in_at)
);

create index evacuation_center_checkins_center_idx on public.evacuation_center_checkins (evacuation_center_id);
create index evacuation_center_checkins_user_idx    on public.evacuation_center_checkins (user_id);
create index evacuation_center_checkins_barangay_idx on public.evacuation_center_checkins (barangay_id);
create index evacuation_center_checkins_checked_in_idx on public.evacuation_center_checkins (checked_in_at);

alter table public.evacuation_center_checkins enable row level security;

-- Residents may insert their own check-ins.
create policy "residents insert own checkins"
  on public.evacuation_center_checkins for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and barangay_id = public.current_barangay_id()
  );

-- Residents may read their own check-ins.
create policy "residents read own checkins"
  on public.evacuation_center_checkins for select
  to authenticated
  using (
    user_id = auth.uid()
    and barangay_id = public.current_barangay_id()
  );

-- Admins may read all check-ins in their barangay.
create policy "admins read barangay checkins"
  on public.evacuation_center_checkins for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
  );
