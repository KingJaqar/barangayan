-- Three changes to the payment flow, per the "instant payment + refunds + shipping fee" plan:
--
-- 1. Removes the implicit dependency on service_requests.status = 'in_progress' for
--    payment (that check lived only in the create-payment-source Edge Function, not
--    here — nothing in the DB schema itself required it). This migration doesn't need
--    to touch that gate; it's noted here for context since it's the reason refunds are
--    now needed at all: a resident can now pay before an admin has reviewed the
--    request, so a rejected/cancelled request may already be paid.
--
-- 2. Adds refund support: payments.paymongo_payment_id (the real PayMongo Payment
--    resource id — the existing paymongo_source_id is not refundable via PayMongo's
--    Refunds API, only a payment_id is), and refund bookkeeping columns.
--
-- 3. Adds a flat, barangay-configurable shipping/delivery fee. Every request goes
--    through out_for_delivery -> completed (there is no in-person-pickup status), so
--    this applies to both QR Ph and Cash on Delivery, not just digital payment. The
--    payments row now records the fee breakdown (document + shipping) in addition to
--    the existing amount_centavos total, so the admin ledger and resident receipt can
--    show both instead of a lump sum.

alter table public.payments
  add column paymongo_payment_id text,
  add column refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'refunded', 'failed')),
  add column refund_amount_centavos integer check (refund_amount_centavos >= 0),
  add column refund_reason text,
  add column refunded_at timestamptz,
  add column refunded_by uuid references public.profiles (id);

-- 'refunded' is a terminal payment status distinct from 'paid' — the money has been
-- returned, not just collected. Full-amount-only refunds per the plan, so a payment
-- is either fully 'paid' or fully 'refunded', never partially.
alter table public.payments
  drop constraint payments_status_check;
alter table public.payments
  add constraint payments_status_check
    check (status in ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'));

alter table public.service_requests
  drop constraint service_requests_payment_status_check;
alter table public.service_requests
  add constraint service_requests_payment_status_check
    check (payment_status in ('pending', 'paid', 'waived', 'refunded'));

-- Extend the existing paid-sync trigger (0007 migration) to also mirror a refund onto
-- service_requests.payment_status, the same way it already mirrors 'paid'.
create or replace function public.sync_service_request_payment_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    update public.service_requests
      set payment_status = 'paid'
      where id = new.service_request_id;
  elsif new.status = 'refunded' and (old.status is distinct from 'refunded') then
    update public.service_requests
      set payment_status = 'refunded'
      where id = new.service_request_id;
  end if;
  return new;
end;
$$;

comment on column public.payments.paymongo_payment_id is
  'The actual PayMongo Payment resource id (pay_...), captured from the payment.paid webhook event — distinct from paymongo_source_id (src_...), which the Refunds API does not accept.';
comment on column public.payments.refund_status is
  'none = never refunded. pending = refund-payment Edge Function called PayMongo successfully, awaiting the async refund.updated webhook confirmation. refunded/failed = terminal, set by that webhook.';

-- ============================================================================
-- Shipping fee — flat, per-barangay, admin-configurable (Settings page). Defaults to
-- 0 (no charge) until an admin explicitly sets one.
-- ============================================================================
alter table public.barangays
  add column shipping_fee_centavos integer not null default 0 check (shipping_fee_centavos >= 0);

comment on column public.barangays.shipping_fee_centavos is
  'Flat delivery fee added to every request''s document fee (both QR Ph and Cash on Delivery — every request is delivered, there is no pickup path). Admin-configurable on the web Settings page.';

alter table public.payments
  add column document_fee_centavos integer,
  add column shipping_fee_centavos integer;

comment on column public.payments.document_fee_centavos is
  'The document_types.fee_centavos portion of amount_centavos, captured at payment time for receipt/ledger breakdown. Nullable: rows created before this migration have no breakdown, only the lump-sum amount_centavos.';
comment on column public.payments.shipping_fee_centavos is
  'The barangays.shipping_fee_centavos portion of amount_centavos, captured at payment time. See document_fee_centavos.';
