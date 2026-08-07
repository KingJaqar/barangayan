-- Adds a security-definer RPC that lets a resident stamp their chosen payment method
-- onto their own service_request row.
--
-- Why a function instead of a plain UPDATE policy?
-- The 0002 migration deliberately omitted a resident UPDATE policy on service_requests
-- ("status transitions are an admin/backend concern"). A blanket resident UPDATE policy
-- would let clients modify status, payment_status, barangay_id, or any other column —
-- none of which should be resident-writable. Postgres RLS has no "allow UPDATE only on
-- column X" mechanism (that is column-level privilege, not row-level security). A
-- security-definer function is the standard pattern for "residents may change exactly
-- this one field on rows they own" without any of the above risks.
--
-- The function validates:
--   • p_method is one of the two allowed values (matches the check constraint on the
--     column itself — belt AND suspenders).
--   • The row being updated belongs to the calling user (resident_id = auth.uid()).
-- If either check fails it raises an exception, which the mobile client surfaces as an
-- error rather than a silent no-op.

create or replace function public.set_service_request_payment_method(
  p_request_id uuid,
  p_method     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_method not in ('cash', 'qrph') then
    raise exception 'invalid payment method "%"; expected ''cash'' or ''qrph''', p_method;
  end if;

  update public.service_requests
     set payment_method = p_method
   where id            = p_request_id
     and resident_id   = auth.uid();

  if not found then
    raise exception 'service request % not found or does not belong to the current user',
      p_request_id;
  end if;
end;
$$;

-- Residents (authenticated users) may call this function; no other grants are needed
-- because security definer already bypasses RLS on the table itself.
grant execute on function public.set_service_request_payment_method(uuid, text)
  to authenticated;
