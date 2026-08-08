-- Incident Reports admin workflow — five-stage status model.
--
-- The admin Incident Reports screen (apps/web) needs a segmented workflow that mirrors
-- the Requests screen's Active/Delivery/Completed/Cancelled tabs: Open, In Progress,
-- Resolved, Withdrawn (resident-cancelled), Unresolved (admin-cancelled). 0025 only
-- modeled three forward statuses and folded "withdrawn" into a hard soft-delete
-- (deleted_at), which hid the report from the admin panel entirely — there was no way
-- to review or report on withdrawn incidents. This migration:
--   1. Widens incidents.status to the five-value set.
--   2. Rewrites update_incident_status's guarded FSM to branch into unresolved from
--      open/in_progress (previously a strictly-increasing rank comparison).
--   3. Splits soft_delete_incident's resident branch off from the admin branch: a
--      resident withdrawing their own open report now sets status = 'withdrawn'
--      (visible to admins) instead of deleted_at (invisible to everyone). The admin
--      branch is untouched — "Remove" in the admin panel still hard-hides the row.

-- ============================================================================
-- 1. Widen the status check constraint.
-- ============================================================================
alter table public.incidents
  drop constraint incidents_status_check;

alter table public.incidents
  add constraint incidents_status_check
  check (status in ('open', 'in_progress', 'resolved', 'withdrawn', 'unresolved'));

-- ============================================================================
-- 2. update_incident_status — admin-guarded FSM, now branching.
--    open        -> in_progress | unresolved
--    in_progress -> resolved    | unresolved
--    resolved / withdrawn / unresolved are terminal.
--    (Admins may still hand-correct any field, including status, via a direct
--    table update — see incident-table.tsx's EditableDataTable column — which is
--    covered by the "admins manage incidents" RLS policy rather than this RPC.
--    This RPC remains the guardrail behind the guided workflow buttons.)
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
  v_allowed        boolean := false;
begin
  if public.current_role() != 'admin' then
    raise exception 'only admins can update incident status';
  end if;

  if p_status not in ('open', 'in_progress', 'resolved', 'withdrawn', 'unresolved') then
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

  -- No-op if already at the target status.
  if v_current_status = p_status then
    return;
  end if;

  if v_current_status = 'open' and p_status in ('in_progress', 'unresolved') then
    v_allowed := true;
  elsif v_current_status = 'in_progress' and p_status in ('resolved', 'unresolved') then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'cannot move incident from % to %', v_current_status, p_status;
  end if;

  update public.incidents
    set status = p_status
    where id = p_incident_id;
end;
$$;

comment on function public.update_incident_status(uuid, text) is
  'Admin-only guarded incident status transition. open -> in_progress | unresolved; in_progress -> resolved | unresolved. Raises on invalid transition or cross-barangay access.';

-- ============================================================================
-- 3. soft_delete_incident — split resident withdrawal from admin removal.
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
    -- Admins hard-hide any incident (spam, duplicates, etc).
    update public.incidents
      set deleted_at = now()
      where id = p_incident_id;
    return;
  end if;

  if v_reporter_id = auth.uid() then
    -- Residents may only withdraw their own open reports within 24 hours.
    -- This now moves the report to the 'withdrawn' status instead of soft-deleting
    -- it, so it stays visible (and actionable-on-record) in the admin panel's
    -- Withdrawn tab rather than disappearing without a trace.
    if v_status != 'open' then
      raise exception 'you can only withdraw a report that is still open';
    end if;
    if v_created_at < now() - interval '24 hours' then
      raise exception 'the 24-hour withdrawal window for this report has closed';
    end if;

    update public.incidents
      set status = 'withdrawn'
      where id = p_incident_id;
    return;
  end if;

  raise exception 'you are not allowed to delete this incident';
end;
$$;

comment on function public.soft_delete_incident(uuid) is
  'Admins hard-hide (soft-delete) any incident in their barangay. Residents withdrawing their own open report within 24 hours instead move it to status = withdrawn, which stays visible to admins.';

-- ============================================================================
-- 4. Admin insert — 0022 only granted residents insert; the admin Incident
--    Reports screen needs to log walk-in/phoned-in reports directly (full CRUD).
-- ============================================================================
create policy "admins insert incidents"
  on public.incidents for insert
  to authenticated
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());
