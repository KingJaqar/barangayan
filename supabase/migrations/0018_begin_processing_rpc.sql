-- S0-4: begin_processing_request RPC — replaces the raw client-side
-- `update({ status: 'in_progress' })` call in request-status-actions.tsx with a
-- validated transition: only an admin, only within their own barangay, only from
-- `submitted`. All other status transitions already go through validated RPCs
-- (cancel_service_request, request_delivery transition RPCs) — this closes the one
-- remaining unguarded transition (Finite State Machine — AGENTS.md §3).
--
-- Note: unlike the illustrative SQL in AGENTS.md, this does NOT manually append to
-- status_history — the existing track_service_request_status trigger (0002) already
-- does that on every UPDATE where status changes, so a manual append here would create
-- a duplicate history entry.
create or replace function public.begin_processing_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'forbidden';
  end if;

  update public.service_requests
  set status = 'in_progress'
  where id = request_id
    and barangay_id = public.current_barangay_id()
    and status = 'submitted';

  if not found then
    raise exception 'invalid_transition';
  end if;
end;
$$;

comment on function public.begin_processing_request(uuid) is
  'Validated submitted -> in_progress transition for admins, scoped to their own barangay. See AGENTS.md P1-B / S0-4.';
