-- Fix: reference_number needs a real column DEFAULT, not just a BEFORE INSERT trigger.
-- A trigger-only "fill if null" still requires clients to pass *something* non-null to
-- satisfy the generated TypeScript Insert type (which reflects NOT NULL + no DEFAULT as
-- required), defeating the whole point of server-side auto-generation.
alter table public.service_requests
  alter column reference_number set default (
    'REQ-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.service_request_ref_seq')::text, 5, '0')
  );

-- The BEFORE INSERT trigger is now redundant (the column DEFAULT already fills the
-- value before the trigger would fire) — dropped for clarity, not left as dead code.
drop trigger if exists set_service_requests_reference_number on public.service_requests;
drop function if exists public.set_service_request_reference_number();
