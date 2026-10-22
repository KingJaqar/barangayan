-- P20-T06: backend rollback of the two pending resident iOS migrations, 0135 (notification inbox/outbox/preferences/worker) and
-- 0136 (account deletion state). REHEARSED ONLY on a disposable database clone (see rollback-rehearsal.sh and
-- P20-T06_2026-10-21_operations-and-rollback.md). It has NOT been applied to any hosted database, and neither migration is applied to
-- the hosted project today (hosted is at 0134), so there is nothing to roll back there until the owner approves a deployment.
--
-- Not a migration: it does not live under supabase/migrations and must never be renumbered into the repository's sequence. If a deployed
-- 0135/0136 ever has to be withdrawn, the owner approves running this file (or its content) as an explicit, reviewed change.
--
-- Order of withdrawal when 0135/0136 are live (the database comes last, never first):
--   1. Stop callers: unschedule/undeploy `send-notifications`; redeploy the v1 `export-my-data` and `delete-my-account` function code.
--   2. Run this file.
--   3. Android and web keep working throughout: they use only objects that migrations 0001-0134 created and this file does not touch
--      (the v1 `request_own_account_deletion` RPC, `push_tokens`, `upsert_push_token`, `profiles.push_notifications_enabled`).
--
-- Data consequences (irreversible, by design):
--   * notification history (events, inbox, outbox, delivery tickets) and per-kind preferences are deleted;
--   * account_deletion_requests is deleted. Records already erased or de-identified by `erase_own_account_records()` stay erased:
--     withdrawing the function cannot restore them. The guard below refuses to run while a deletion is unfinished, because dropping the
--     state table then would lose the only record that a resident's deletion needs to be resumed.
begin;

do $$
begin
  if to_regclass('public.account_deletion_requests') is not null
     and exists (select 1 from public.account_deletion_requests where state <> 'completed') then
    raise exception 'rollback_refused: unfinished account deletions exist; finish or resolve them first' using errcode = 'P0001';
  end if;
end $$;

-- ===== 0136: account deletion state =====
drop function if exists public.erase_own_account_records();
drop function if exists public.set_account_deletion_state(uuid, text, text);
drop function if exists barangayan_private.deletion_state_rank(text);
drop table if exists public.account_deletion_requests;

-- ===== 0135: notifications =====
drop trigger if exists z_notify_request_change on public.service_requests;
drop trigger if exists z_notify_incident_change on public.incidents;
drop trigger if exists z_notify_announcement on public.announcements;
drop trigger if exists z_notify_medical_drive on public.medical_drives;
drop trigger if exists z_notify_drive_registration on public.drive_registrations;

-- Tables before functions (the inbox check constraint calls valid_notification_destination). Dependants first: deliveries -> outbox -> inbox -> events. Dropping the inbox also removes it from the realtime publication.
drop table if exists barangayan_private.notification_deliveries;
drop table if exists barangayan_private.notification_outbox;
drop table if exists public.notification_inbox;
drop table if exists barangayan_private.notification_events;
drop table if exists public.notification_preferences;

-- Functions are dropped by catalog lookup so every overload goes, whatever its argument list.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
            'set_notification_preferences', 'release_push_token', 'notification_worker_claim', 'notification_worker_record_tickets',
            'notification_worker_fail', 'notification_worker_due_receipts', 'notification_worker_record_receipts',
            'notification_worker_health', 'notification_worker_purge'))
       or (n.nspname = 'barangayan_private' and p.proname in (
            'valid_notification_destination', 'emit_notification', 'notify_request_change', 'notify_incident_change',
            'notify_announcement', 'notify_medical_drive', 'notify_drive_registration', 'notification_retry'))
  loop
    execute format('drop function %s', r.signature);
  end loop;
end $$;

commit;
