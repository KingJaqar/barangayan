-- Adds: (1) a real payments ledger (COD + QR Ph) so the admin Financial Transactions
-- view has something to read; (2) admin RLS on service_requests/document_types — the
-- write path explicitly deferred by the 0002 migration's "no client update/delete
-- policy: status transitions are an admin/backend concern" comment; (3) a
-- cancel_service_request RPC so admin cancellations can attach a note in one
-- transaction (the existing track_service_request_status trigger only ever writes
-- note: null on UPDATE).

-- ============================================================================
-- service_requests — payment_method column (resident picks Cash or QR Ph on the
-- mobile Payment screen; see the "Dual Payment Methods" plan).
-- ============================================================================
alter table public.service_requests
  add column payment_method text check (payment_method in ('cash', 'qrph'));

-- ============================================================================
-- payments — one row per payment attempt/settlement on a service_request.
-- Distinct from service_requests.payment_status (which stays the quick-glance
-- summary the mobile app already reads) so COD collections and QR Ph transactions
-- both get a real, queryable financial record: multiple attempts, failure/expiry
-- states, and a collected_by audit trail for COD, none of which fits in one enum
-- column on service_requests.
-- ============================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id),
  barangay_id uuid not null references public.barangays (id),
  method text not null check (method in ('cash', 'qrph')),
  amount_centavos integer not null check (amount_centavos >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'cancelled')),
  -- QR Ph only: PayMongo source id, populated by the create-payment-source Edge
  -- Function once EXPO_PUBLIC_QRPH_SETTLEMENT_READY is flipped on.
  paymongo_source_id text,
  paid_at timestamptz,
  -- COD only: which admin marked it collected at pickup.
  collected_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "residents can read payments on their own requests"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id and sr.resident_id = auth.uid()
    )
  );

create policy "residents can create a payment on their own request"
  on public.payments for insert
  to authenticated
  with check (
    barangay_id = public.current_barangay_id()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id and sr.resident_id = auth.uid()
    )
  );

create policy "admins can read all payments in their barangay"
  on public.payments for select
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins can update payments in their barangay"
  on public.payments for update
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Realtime: the admin Transactions ledger and (later) any resident-facing receipt
-- screen should reflect a status flip (e.g. pending -> paid) live.
alter publication supabase_realtime add table public.payments;

-- Keep service_requests.payment_status in sync whenever a payments row is marked
-- paid, so the mobile app's existing fast-glance reads (Home, RequestsList,
-- LogsList) stay correct without themselves querying the payments table.
create function public.sync_service_request_payment_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    update public.service_requests
      set payment_status = 'paid'
      where id = new.service_request_id;
  end if;
  return new;
end;
$$;

create trigger sync_payments_to_service_request
  after insert or update on public.payments
  for each row execute function public.sync_service_request_payment_status();

-- ============================================================================
-- service_requests — admin read/write, scoped to the admin's own barangay.
-- ============================================================================
create policy "admins can read all requests in their barangay"
  on public.service_requests for select
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins can update requests in their barangay"
  on public.service_requests for update
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

-- Cancellation needs a note attached atomically with the status flip. The existing
-- track_service_request_status trigger (0002 migration) fires BEFORE UPDATE and
-- unconditionally overwrites new.status_history with a `note: null` entry — a plain
-- `status_history = ... || jsonb_build_object(..., 'note', p_note)` in this RPC's own
-- UPDATE would just get clobbered by that trigger re-deriving new.status_history from
-- old.status_history. So the trigger is extended to read an optional note from a
-- transaction-local session variable instead, which this RPC sets right before the
-- UPDATE — `set_config(..., true)` scopes it to the current transaction only, so it
-- can never leak into an unrelated statement.
create or replace function public.track_service_request_status()
returns trigger
language plpgsql
as $$
declare
  v_note text;
begin
  if tg_op = 'INSERT' then
    new.status_history := jsonb_build_array(
      jsonb_build_object('status', new.status, 'at', now(), 'note', 'Request submitted')
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_note := nullif(current_setting('barangayan.status_note', true), '');
    new.status_history := old.status_history || jsonb_build_object(
      'status', new.status, 'at', now(), 'note', v_note
    );
  end if;
  return new;
end;
$$;

create function public.cancel_service_request(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
begin
  if public.current_role() != 'admin' then
    raise exception 'only admins can cancel a request';
  end if;

  select barangay_id into v_barangay_id
    from public.service_requests
    where id = p_request_id;

  if v_barangay_id is null or v_barangay_id != public.current_barangay_id() then
    raise exception 'request not found in your barangay';
  end if;

  perform set_config('barangayan.status_note', coalesce(p_note, ''), true);

  update public.service_requests
    set status = 'cancelled'
    where id = p_request_id;
end;
$$;

-- ============================================================================
-- document_types — admin CRUD (previously "no client insert/update/delete
-- policy" per the 0002 migration's comment; this is that deferred admin UI).
-- ============================================================================
create policy "admins can manage document types in their barangay"
  on public.document_types for all
  to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());
