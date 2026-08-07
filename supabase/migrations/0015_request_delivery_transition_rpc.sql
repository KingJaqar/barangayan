-- The admin delivery action is an explicit workflow transition, not a generic table
-- edit. This RPC mirrors complete_service_request and works with the caller's normal
-- authenticated browser session while validating role, barangay, and current state.

create or replace function public.mark_request_out_for_delivery(p_request_id uuid)
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
    raise exception 'only admins can mark a request out for delivery';
  end if;

  select barangay_id, status
    into v_barangay_id, v_status
    from public.service_requests
    where id = p_request_id;

  if v_barangay_id is null or v_barangay_id != public.current_barangay_id() then
    raise exception 'request not found in your barangay';
  end if;

  if v_status != 'in_progress' then
    raise exception 'only processing requests can be marked out for delivery';
  end if;

  perform set_config('barangayan.status_note', 'Marked as out for delivery', true);

  update public.service_requests
    set status = 'out_for_delivery'
    where id = p_request_id;
end;
$$;
