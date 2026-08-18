-- Fix BUG-10: add FK indexes to the earliest tables (migrations 0001-0011),
-- which predate the FK-indexing convention every table from migration 0022
-- onward already follows. These columns back the most-hit RLS policies and
-- joins in the app (profiles/service_requests/payments lookups on every
-- authenticated request), so they were the highest-value gap to close.
--
-- Purely additive, no app-code coordination required — safe to ship
-- independently and first, per the audit report's sequencing rule #1.
-- `concurrently` is intentionally omitted: Supabase migrations run inside a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run inside one.

create index if not exists profiles_barangay_id_idx
  on public.profiles (barangay_id);

create index if not exists service_requests_barangay_id_idx
  on public.service_requests (barangay_id);
create index if not exists service_requests_resident_id_idx
  on public.service_requests (resident_id);
create index if not exists service_requests_document_type_id_idx
  on public.service_requests (document_type_id);

create index if not exists payments_service_request_id_idx
  on public.payments (service_request_id);
create index if not exists payments_barangay_id_idx
  on public.payments (barangay_id);
create index if not exists payments_collected_by_idx
  on public.payments (collected_by);
create index if not exists payments_refunded_by_idx
  on public.payments (refunded_by);

create index if not exists announcements_barangay_id_idx
  on public.announcements (barangay_id);
create index if not exists announcements_created_by_idx
  on public.announcements (created_by);

create index if not exists incidents_reporter_id_idx
  on public.incidents (reporter_id);
