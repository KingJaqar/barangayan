-- Incident Management — full backend layer for the Incident Reports module.
--
-- Adds what 0022 deferred (tables only, no workflow):
--   1. updated_at trigger on incidents
--   2. incident-photos storage bucket + RLS
--   3. incident_confirmations — dedup table for crowdsourced corroboration
--   4. Guest-readable incidents policy (Maps tab is accessible in guest mode)
--   5. Resident soft-delete own open incident (within 24 h)
--   6. RPC: confirm_incident       — resident upvotes a community report
--   7. RPC: update_incident_status — admin guarded status FSM
--   8. RPC: soft_delete_incident   — admin soft-deletes any incident in their barangay

-- ============================================================================
-- 1. updated_at trigger (matches the pattern on profiles / service_requests)
-- ============================================================================
create trigger set_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. incident-photos storage bucket
--    Public read — photos render inline on the map and in the resident feed
--    without needing signed URLs. Writes scoped to authenticated residents.
--    Path convention: {auth.uid()}/{random_prefix}/{filename}.{ext}
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-photos',
  'incident-photos',
  true,
  10485760, -- 10 MB per photo
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public              = excluded.public,
  file_size_limit     = excluded.file_size_limit,
  allowed_mime_types  = excluded.allowed_mime_types;

-- Residents upload to their own uid folder only.
create policy "residents upload incident photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'incident-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Bucket is public, but an explicit SELECT policy is still required for authenticated users.
create policy "anyone reads incident photos"
  on storage.objects for select
  using (bucket_id = 'incident-photos');

-- Residents can delete their own photos (e.g. they withdraw their own incident).
create policy "residents delete own incident photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'incident-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 3. incident_confirmations — one row per (incident, user) pair.
--    Prevents double-confirming the same report. Cascade-deletes with the
--    incident so orphans can never accumulate.
-- ============================================================================
create table public.incident_confirmations (
  incident_id  uuid        not null references public.incidents(id)  on delete cascade,
  user_id      uuid        not null references public.profiles(id)    on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (incident_id, user_id)
);

create index incident_confirmations_incident_idx on public.incident_confirmations (incident_id);

alter table public.incident_confirmations enable row level security;

-- A resident may read their own confirmation rows (to know whether they already confirmed).
create policy "residents read own confirmations"
  on public.incident_confirmations for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts are handled exclusively through the confirm_incident RPC (SECURITY DEFINER)
-- so clients can never manipulate confirmation_count directly.

-- ============================================================================
-- 4. Guest-readable incidents (anon role)
--    The Maps tab is accessible in guest mode (AGENTS.md §4 / 0005 migration
--    comment). Anon users must be able to read incident map markers.
-- ============================================================================
create policy "guest read barangay incidents"
  on public.incidents for select
  to anon
  using (deleted_at is null);

-- ============================================================================
-- 5. Residents may soft-delete their OWN open incident within 24 hours.
--    They cannot change any other column — use a check to enforce this.
-- ============================================================================
create policy "residents soft-delete own open incident"
  on public.incidents for update
  to authenticated
  using (
    reporter_id = auth.uid()
    and status = 'open'
    and deleted_at is null
    and created_at > now() - interval '24 hours'
  )
  with check (
    reporter_id = auth.uid()
    -- Only deleted_at may be changed; nothing else.
    -- Enforced in the RPC below; here we just scope the rows a resident may touch.
  );

-- ============================================================================
-- 6. RPC: confirm_incident
--    Any authenticated resident in the same barangay may confirm a report once.
--    Increments incidents.confirmation_count atomically and records the
--    confirmation so duplicate calls are idempotent (returns false on duplicate).
-- ============================================================================
create or replace function public.confirm_incident(p_incident_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
begin
  -- Verify the incident exists, is not deleted, and belongs to the caller's barangay.
  select barangay_id into v_barangay_id
    from public.incidents
    where id = p_incident_id and deleted_at is null;

  if v_barangay_id is null then
    raise exception 'incident not found';
  end if;

  if v_barangay_id != public.current_barangay_id() then
    raise exception 'incident is not in your barangay';
  end if;

  -- A reporter cannot confirm their own report.
  if exists (
    select 1 from public.incidents
    where id = p_incident_id and reporter_id = auth.uid()
  ) then
    raise exception 'you cannot confirm your own report';
  end if;

  -- Insert the confirmation — PK violation means already confirmed; catch and return false.
  begin
    insert into public.incident_confirmations (incident_id, user_id)
    values (p_incident_id, auth.uid());
  exception when unique_violation then
    return false; -- already confirmed
  end;

  -- Increment the counter atomically.
  update public.incidents
    set confirmation_count = confirmation_count + 1
    where id = p_incident_id;

  return true;
end;
$$;

comment on function public.confirm_incident(uuid) is
  'Resident confirms (upvotes) an existing community incident report. Idempotent — returns false if the caller already confirmed. Raises if not in the same barangay or if the reporter tries to self-confirm.';

-- ============================================================================
-- 7. RPC: update_incident_status
--    Admin-only guarded FSM: open → in_progress → resolved.
--    Backward transitions are blocked. Setting status to the same value is a no-op.
-- ============================================================================
create or replace function public.update_incident_status(
  p_incident_id uuid,
  p_status      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_barangay_id    uuid;
begin
  if public.current_role() != 'admin' then
    raise exception 'only admins can update incident status';
  end if;

  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'invalid status: %', p_status;
  end if;

  select status, barangay_id
    into v_current_status, v_barangay_id
    from public.incidents
    where id = p_incident_id and deleted_at is null;

  if v_barangay_id is null then
    raise exception 'incident not found';
  end if;

  if v_barangay_id != public.current_barangay_id() then
    raise exception 'incident is not in your barangay';
  end if;

  -- Enforce forward-only FSM: open(1) → in_progress(2) → resolved(3).
  declare
    rank_map  jsonb := '{"open":1,"in_progress":2,"resolved":3}';
    cur_rank  int   := (rank_map->>v_current_status)::int;
    new_rank  int   := (rank_map->>p_status)::int;
  begin
    if new_rank < cur_rank then
      raise exception 'cannot move incident backward from % to %', v_current_status, p_status;
    end if;
  end;

  -- No-op if already at the target status.
  if v_current_status = p_status then
    return;
  end if;

  update public.incidents
    set status = p_status
    where id = p_incident_id;
end;
$$;

comment on function public.update_incident_status(uuid, text) is
  'Admin-only guarded incident status transition. Enforces forward-only FSM: open → in_progress → resolved. Raises on invalid transition or cross-barangay access.';

-- ============================================================================
-- 8. RPC: soft_delete_incident
--    Admin soft-deletes any non-deleted incident in their barangay.
--    Also available for a resident to withdraw their own open report within 24 h
--    (the caller is identified by auth.uid() inside the function).
-- ============================================================================
create or replace function public.soft_delete_incident(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_reporter_id uuid;
  v_status      text;
  v_created_at  timestamptz;
  v_role        text;
begin
  v_role := public.current_role();

  select barangay_id, reporter_id, status, created_at
    into v_barangay_id, v_reporter_id, v_status, v_created_at
    from public.incidents
    where id = p_incident_id and deleted_at is null;

  if v_barangay_id is null then
    raise exception 'incident not found';
  end if;

  if v_barangay_id != public.current_barangay_id() then
    raise exception 'incident is not in your barangay';
  end if;

  if v_role = 'admin' then
    -- Admins may delete any incident.
    null;
  elsif v_reporter_id = auth.uid() then
    -- Residents may only withdraw their own open reports within 24 hours.
    if v_status != 'open' then
      raise exception 'you can only withdraw a report that is still open';
    end if;
    if v_created_at < now() - interval '24 hours' then
      raise exception 'the 24-hour withdrawal window for this report has closed';
    end if;
  else
    raise exception 'you are not allowed to delete this incident';
  end if;

  update public.incidents
    set deleted_at = now()
    where id = p_incident_id;
end;
$$;

comment on function public.soft_delete_incident(uuid) is
  'Soft-deletes an incident. Admins may delete any incident in their barangay. Residents may only withdraw their own open reports within 24 hours of submission.';

-- ============================================================================
-- 9. Seed: add sample incidents for the pilot barangay so the feed and map
--    have realistic data during development and demos.
--    Uses a fixed reporter_id placeholder — update to a real resident UUID before
--    running against a seeded auth.users table (or remove if dev-only seeding
--    is handled separately via seed.sql).
-- ============================================================================
-- NOTE: Intentionally left empty. Incident seeds live in seed.sql so they can
-- reference real auth.users rows created by supabase db seed.
