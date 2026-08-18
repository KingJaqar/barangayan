-- Corrects the QR Ph integration's core assumption.
--
-- The original implementation (migration 0064 and the create-payment-source Edge
-- Function) modelled QR Ph on PayMongo's Sources API — POST /v1/sources with
-- type='qrph'. That endpoint does not support QR Ph at all (Sources covers gcash /
-- grab_pay / paymaya), so every attempt failed with a PayMongo error and the app showed
-- "Could not start a QR Ph payment".
--
-- QR Ph is a PaymentIntent flow:
--   1. POST /v1/payment_intents  (payment_method_allowed: ['qrph'])
--   2. POST /v1/payment_methods  (type: 'qrph')
--   3. POST /v1/payment_intents/{id}/attach  -> next_action.code.image_url (base64 QR)
-- Confirmation arrives as `payment.paid` / `payment.failed` / `qrph.expired` webhooks —
-- `source.chargeable` never fires for QR Ph, which is why the old webhook wiring could
-- never have marked anything paid either.
--
-- paymongo_source_id is kept (not dropped) so existing rows and the admin ledger's
-- "Collected By / Source" column stay readable; new QR Ph rows populate the intent id
-- instead.

alter table public.payments
  add column paymongo_payment_intent_id text;

comment on column public.payments.paymongo_payment_intent_id is
  'PayMongo PaymentIntent id (pi_...) — the resource QR Ph actually uses. Polled by check-payment-status and matched by the payment.paid webhook. Supersedes paymongo_source_id, which only ever applied to the Sources API and is retained for historical rows.';

-- QRPH refunds are not credited back silently: PayMongo returns a transfer_link the
-- payer must open to claim the money (valid ~3 days). Staff need that link to hand back
-- to the resident, so it has to be stored rather than discarded.
alter table public.payments
  add column refund_transfer_link text;

comment on column public.payments.refund_transfer_link is
  'PayMongo QRPH refund claim URL returned by the refunds API. The resident must open this to receive the money; valid roughly 3 days. Surfaced to admins in the Transactions ledger.';

-- QRPH refunds report processing -> refunding -> succeeded/failed. The 0064 constraint
-- only allowed none/pending/refunded/failed, so a 'processing'/'refunding' webhook would
-- violate it and the refund status would silently stall.
--
-- 0064 declared that check inline on ADD COLUMN, so its name is Postgres-generated;
-- look it up rather than assuming, then re-add under an explicit name.
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'payments'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%refund_status%';

  if v_constraint_name is not null then
    execute format('alter table public.payments drop constraint %I', v_constraint_name);
  end if;
end;
$$;

alter table public.payments
  add constraint payments_refund_status_check
    check (refund_status in ('none', 'pending', 'processing', 'refunding', 'refunded', 'failed'));
