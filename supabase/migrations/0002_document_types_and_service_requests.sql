-- Modules 1 (Document/Service Request) + 2 (Automated Service Tracking).
-- Payment is a stub for this milestone — see the "payment_status" comment below; the full
-- payments table lands with the real PayMongo integration in a later migration.
-- Appointments (pickup scheduling) are deferred too — the Request Form doesn't need
-- scheduling yet for this milestone.

-- ============================================================================
-- document_types — the barangay-configurable service catalog (AGENTS.md §0: never
-- hardcode an instance of this anywhere outside seed.sql).
-- ============================================================================
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays (id),
  name text not null,
  description text,
  fee_centavos integer not null default 0 check (fee_centavos >= 0),
  processing_target_hours integer not null default 24 check (processing_target_hours > 0),
  requirements text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Also gives seed.sql a natural idempotency key (ON CONFLICT (barangay_id, name)).
  unique (barangay_id, name)
);

alter table public.document_types enable row level security;

create policy "residents can read their own barangay's active document types"
  on public.document_types for select
  to authenticated
  using (barangay_id = public.current_barangay_id() and is_active = true);

-- No client insert/update/delete policy: the catalog-configuration UI is an apps/web
-- admin feature (deferred). Changes go through seed.sql or a service_role connection
-- until that lands.

-- ============================================================================
-- service_requests — Module 1 submission + Module 2 tracking state, combined into one
-- table for now (the full FSM + pg_cron threshold-flag machinery from AGENTS.md §3 lands
-- with a later migration; status_history below gives the Request Tracking screen a real
-- timeline to render in the meantime without that machinery).
-- ============================================================================
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays (id),
  resident_id uuid not null references public.profiles (id),
  document_type_id uuid not null references public.document_types (id),
  reference_number text not null unique,
  requester_notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_progress', 'completed', 'cancelled')),
  -- Stub for this milestone: no live PayMongo/QR Ph call, no payments table yet. The
  -- Payment screen just shows "Payment Pending — settle at Barangay Hall" and this field
  -- stays 'pending' until manually/administratively updated. Real payment integration
  -- replaces this with a proper payments table + webhook cascade (AGENTS.md §2/§5).
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'waived')),
  -- Status-history timeline for the Request Tracking detail screen, e.g.
  -- [{"status": "submitted", "at": "...", "note": "Request submitted"}, ...].
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

create policy "residents can read their own service requests"
  on public.service_requests for select
  to authenticated
  using (resident_id = auth.uid());

create policy "residents can create their own service requests"
  on public.service_requests for insert
  to authenticated
  with check (
    resident_id = auth.uid()
    and barangay_id = public.current_barangay_id()
  );

-- No client update/delete policy: status transitions are an admin/backend concern
-- (deferred to the full Module 2 FSM work) — a resident cannot flip their own status.

create trigger set_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- Human-friendly reference numbers, e.g. REQ-2026-00001. (The design mockups show a few
-- different placeholder formats — those are not a spec; this is the actual generated
-- value, formatted for display in the UI layer however's needed.)
create sequence public.service_request_ref_seq;

create function public.set_service_request_reference_number()
returns trigger
language plpgsql
as $$
begin
  if new.reference_number is null then
    new.reference_number := 'REQ-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.service_request_ref_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_service_requests_reference_number
  before insert on public.service_requests
  for each row execute function public.set_service_request_reference_number();

-- Seed the initial status_history entry and append one on every status change, so the
-- Request Tracking screen always has a real timeline to render.
create function public.track_service_request_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.status_history := jsonb_build_array(
      jsonb_build_object('status', new.status, 'at', now(), 'note', 'Request submitted')
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_history := old.status_history || jsonb_build_object(
      'status', new.status, 'at', now(), 'note', null
    );
  end if;
  return new;
end;
$$;

create trigger track_service_requests_status
  before insert or update on public.service_requests
  for each row execute function public.track_service_request_status();

-- Realtime: the Requests sub-tab / Request Tracking detail screen must update live
-- without a manual refresh (Publish-Subscribe via PostgreSQL WAL — AGENTS.md §3).
alter publication supabase_realtime add table public.service_requests;
