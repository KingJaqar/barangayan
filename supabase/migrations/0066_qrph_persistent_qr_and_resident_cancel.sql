-- Persist the generated QR Ph image + its expiry on the payments row so the QR can be
-- resumed (same image, same countdown) instead of re-minted every time the resident
-- reopens the payment screen. See create-payment-source's resume check.
alter table public.payments
  add column qr_image_url text,
  add column expires_at timestamptz;

-- Lets a resident cancel their OWN request (mirrors set_service_request_payment_method's
-- ownership-check pattern and cancel_service_request's status_history note pattern —
-- see migrations 0010 and 0007). Blocked once out for delivery/completed/cancelled, or
-- once payment_status is 'paid' (a paid request needs the admin refund flow, not a
-- self-serve cancel).
create or replace function public.cancel_own_service_request(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_payment_status text;
begin
  select status, payment_status into v_status, v_payment_status
    from public.service_requests
    where id = p_request_id and resident_id = auth.uid()
    for update;

  if not found then
    raise exception 'service request % not found or does not belong to the current user', p_request_id;
  end if;

  if v_status in ('out_for_delivery', 'completed', 'cancelled') then
    raise exception 'this request can no longer be cancelled';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'a paid request cannot be self-cancelled; contact the barangay office';
  end if;

  perform set_config('barangayan.status_note', coalesce(p_note, 'Cancelled by resident'), true);

  update public.service_requests set status = 'cancelled' where id = p_request_id;
end;
$$;

grant execute on function public.cancel_own_service_request(uuid, text) to authenticated;
