-- Document delivery is discontinued — barangays don't deliver documents to residents'
-- homes. Residents now pick up their requested document in person at the Barangay Hall.
-- This migration:
--   1. Renames service_requests.status value 'out_for_delivery' -> 'ready_for_pickup'
--      (including the RPC that performs the transition, and existing rows' status +
--      status_history audit trail).
--   2. Renames payment_method/payments.method value 'cash' -> 'pickup' (it's still a
--      cash payment, just collected at pickup instead of "on delivery").
--   3. Removes the flat delivery/shipping fee entirely (barangays.shipping_fee_centavos,
--      payments.shipping_fee_centavos) — pickup has no extra cost, only the document's
--      own fee applies.
-- Pre-launch: no real production data exists yet, so this migration updates/drops
-- directly rather than needing a careful backward-compatible rollout.
--
-- Ordering note: unlike migration 0014 (which only ever *widened* the status check
-- constraint, so it could add the new value before migrating data), steps 1 and 4 below
-- are true renames — the old value is being removed from the allowed set — so each
-- constraint is dropped *before* any row is updated, and only re-added *after*, or the
-- UPDATE itself would violate the still-active old constraint.

-- ============================================================================
-- 1. service_requests.status: 'out_for_delivery' -> 'ready_for_pickup'
-- ============================================================================
alter table public.service_requests
  drop constraint if exists service_requests_status_check;

-- Preserve the existing audit timeline while renaming its legacy status entries.
-- Disable only the status-history trigger while converting historical rows so the
-- migration does not append a misleading new event at migration time.
alter table public.service_requests disable trigger track_service_requests_status;

update public.service_requests
set
  status = 'ready_for_pickup',
  status_history = (
    select jsonb_agg(
      case
        when entry->>'status' = 'out_for_delivery'
          then jsonb_set(entry, '{status}', '"ready_for_pickup"'::jsonb)
        else entry
      end
    )
    from jsonb_array_elements(status_history) as entry
  )
where status = 'out_for_delivery';

-- Also relabel any historical 'out_for_delivery' entries on rows whose *current* status
-- has already moved on (e.g. a row already 'completed' but its history still says
-- out_for_delivery), so no row is left with a stale label in its audit trail.
update public.service_requests
set status_history = (
  select jsonb_agg(
    case
      when entry->>'status' = 'out_for_delivery'
        then jsonb_set(entry, '{status}', '"ready_for_pickup"'::jsonb)
      else entry
    end
  )
  from jsonb_array_elements(status_history) as entry
)
where status_history::text like '%out_for_delivery%';

alter table public.service_requests enable trigger track_service_requests_status;

alter table public.service_requests
  add constraint service_requests_status_check
  check (status in ('submitted', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled'));

-- ============================================================================
-- 2. complete_service_request (0014) — now guards on 'ready_for_pickup'.
-- ============================================================================
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

  if v_status != 'ready_for_pickup' then
    raise exception 'only requests ready for pickup can be marked completed';
  end if;

  perform set_config('barangayan.status_note', 'Marked as completed', true);
  perform set_config('barangayan.allow_request_completion', 'true', true);

  update public.service_requests
    set status = 'completed'
    where id = p_request_id;
end;
$$;

-- ============================================================================
-- 3. Rename RPC mark_request_out_for_delivery -> mark_request_ready_for_pickup
-- ============================================================================
drop function if exists public.mark_request_out_for_delivery(uuid);

create function public.mark_request_ready_for_pickup(p_request_id uuid)
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
    raise exception 'only admins can mark a request ready for pickup';
  end if;

  select barangay_id, status
    into v_barangay_id, v_status
    from public.service_requests
    where id = p_request_id;

  if v_barangay_id is null or v_barangay_id != public.current_barangay_id() then
    raise exception 'request not found in your barangay';
  end if;

  if v_status != 'in_progress' then
    raise exception 'only processing requests can be marked ready for pickup';
  end if;

  perform set_config('barangayan.status_note', 'Marked as ready for pickup', true);

  update public.service_requests
    set status = 'ready_for_pickup'
    where id = p_request_id;
end;
$$;

-- ============================================================================
-- 4. cancel_own_service_request (0066) — blocked-status list updated.
-- ============================================================================
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

  if v_status in ('ready_for_pickup', 'completed', 'cancelled') then
    raise exception 'this request can no longer be cancelled';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'a paid request cannot be self-cancelled; contact the barangay office';
  end if;

  perform set_config('barangayan.status_note', coalesce(p_note, 'Cancelled by resident'), true);

  update public.service_requests set status = 'cancelled' where id = p_request_id;
end;
$$;

-- ============================================================================
-- 5. payment_method / payments.method: 'cash' -> 'pickup'
-- ============================================================================
do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and pg_get_constraintdef(oid) like '%payment_method%';
  if v_conname is not null then
    execute format('alter table public.service_requests drop constraint %I', v_conname);
  end if;
end $$;

do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and pg_get_constraintdef(oid) like '%method%'
      and pg_get_constraintdef(oid) not like '%refund_status%'
      and pg_get_constraintdef(oid) not like '%payments_status_check%';
  if v_conname is not null then
    execute format('alter table public.payments drop constraint %I', v_conname);
  end if;
end $$;

update public.service_requests set payment_method = 'pickup' where payment_method = 'cash';
update public.payments set method = 'pickup' where method = 'cash';

alter table public.service_requests
  add constraint service_requests_payment_method_check
  check (payment_method in ('pickup', 'qrph'));

alter table public.payments
  add constraint payments_method_check
  check (method in ('pickup', 'qrph'));

-- ============================================================================
-- 6. set_service_request_payment_method (0010) — validates the new value.
-- ============================================================================
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
  if p_method not in ('pickup', 'qrph') then
    raise exception 'invalid payment method "%"; expected ''pickup'' or ''qrph''', p_method;
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

-- ============================================================================
-- 7. Drop the delivery/shipping fee columns entirely — pickup has no extra cost.
-- ============================================================================
alter table public.barangays drop column if exists shipping_fee_centavos;
alter table public.payments drop column if exists shipping_fee_centavos;

-- ============================================================================
-- 8. Comment updates.
-- ============================================================================
comment on column public.payments.collected_by is
  'Pickup-payment only: which admin marked it collected at pickup.';
