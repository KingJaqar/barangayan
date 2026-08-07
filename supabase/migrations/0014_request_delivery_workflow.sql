-- Replace the former "Ready for Pickup" state with a delivery workflow:
-- submitted -> in_progress -> out_for_delivery -> completed.
-- Existing completed rows represented the former ready-for-pickup state, so they
-- are migrated to out_for_delivery rather than being treated as delivered.

alter table public.service_requests
  drop constraint if exists service_requests_status_check;

alter table public.service_requests
  add constraint service_requests_status_check
  check (status in ('submitted', 'in_progress', 'out_for_delivery', 'completed', 'cancelled'));

-- Preserve the existing audit timeline while renaming its legacy status entries.
-- Disable only the status-history trigger while converting historical rows so the
-- migration does not append a misleading new event at migration time.
alter table public.service_requests disable trigger track_service_requests_status;

update public.service_requests
set
  status = 'out_for_delivery',
  status_history = (
    select jsonb_agg(
      case
        when entry->>'status' = 'completed'
          then jsonb_set(entry, '{status}', '"out_for_delivery"'::jsonb)
        else entry
      end
    )
    from jsonb_array_elements(status_history) as entry
  )
where status = 'completed';

alter table public.service_requests enable trigger track_service_requests_status;

-- Completion is intentionally performed through the RPC below, rather than a generic
-- client-side update, so the final delivery event remains an authorized workflow step.
create or replace function public.guard_request_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and current_setting('barangayan.allow_request_completion', true) is distinct from 'true' then
    raise exception 'use complete_service_request to mark a request completed';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_service_request_completion on public.service_requests;

create trigger guard_service_request_completion
  before update of status on public.service_requests
  for each row execute function public.guard_request_completion();

-- Only an admin in the request's barangay can record delivery completion. The
-- existing status-history trigger appends the audit event and records this note.
create or replace function public.complete_service_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_status text;
begin
  if public.current_role() != 'admin' then
    raise exception 'only admins can complete a request';
  end if;

  select barangay_id, status
    into v_barangay_id, v_status
    from public.service_requests
    where id = p_request_id;

  if v_barangay_id is null or v_barangay_id != public.current_barangay_id() then
    raise exception 'request not found in your barangay';
  end if;

  if v_status != 'out_for_delivery' then
    raise exception 'only out-for-delivery requests can be marked completed';
  end if;

  perform set_config('barangayan.status_note', 'Marked as completed/delivered', true);
  perform set_config('barangayan.allow_request_completion', 'true', true);

  update public.service_requests
    set status = 'completed'
    where id = p_request_id;
end;
$$;
