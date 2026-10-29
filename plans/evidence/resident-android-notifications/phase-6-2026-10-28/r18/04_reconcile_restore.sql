\set ON_ERROR_STOP on
create table r18_snap.ev_after_migration as select (select count(*) from barangayan_private.notification_events) ev,(select count(*) from barangayan_private.notification_outbox) ob,(select count(*) from public.notification_inbox) ib;
set role service_role;
create temp table b1 as select * from public.notification_reconcile_announcement_reads(100);
create temp table b2 as select * from public.notification_reconcile_announcement_reads(100);
reset role;
do $$
declare a record; b record;
begin
  select * into a from b1; select * into b from b2;
  assert (a.reads_added,a.mirrors_marked,a.remaining)=(1,1,0), format('first reconcile: %s/%s/%s',a.reads_added,a.mirrors_marked,a.remaining);
  assert (b.reads_added,b.mirrors_marked,b.remaining)=(0,0,0), 'second reconcile must be a no-op';
  assert (select announcement_reads_reconciled_at is not null from barangayan_private.notification_hub_settings), 'boundary recorded';
  -- r1 now has a read marker, r2 has a read mirror, r3 untouched
  assert exists(select 1 from public.announcement_reads where resident_id='c1800000-0000-4000-8000-000000000001' and announcement_id='c1800000-0000-4000-8000-000000000101');
  assert (select read_at is not null from public.notification_inbox where recipient_id='c1800000-0000-4000-8000-000000000002' and destination->>'id'='c1800000-0000-4000-8000-000000000102');
end $$;
-- A resident acts after the batch: r1 marks the announcement unread again (newer user action).
select set_config('request.jwt.claims','{"sub":"c1800000-0000-4000-8000-000000000001","role":"authenticated"}',false), set_config('request.jwt.claim.sub','c1800000-0000-4000-8000-000000000001',false) \gset
set role authenticated;
delete from public.announcement_reads where resident_id='c1800000-0000-4000-8000-000000000001' and announcement_id='c1800000-0000-4000-8000-000000000101';
reset role;
-- Targeted restore of batch 1: r2's mirror (untouched since) is restored; r1's (changed by the resident) is skipped and stays as they left it.
set role service_role;
create temp table rr as select * from public.notification_restore_announcement_reads((select batch_id from b1));
reset role;
do $$
declare r record;
begin
  select * into r from rr;
  assert (r.restored,r.skipped)=(1,1), format('restore: %s restored / %s skipped', r.restored, r.skipped);
  assert (select read_at is null from public.notification_inbox where recipient_id='c1800000-0000-4000-8000-000000000002' and destination->>'id'='c1800000-0000-4000-8000-000000000102'), 'r2 mirror restored to its pre-batch value';
  assert not exists(select 1 from public.announcement_reads where resident_id='c1800000-0000-4000-8000-000000000001' and announcement_id='c1800000-0000-4000-8000-000000000101'), 'r1 newer action preserved';
  assert (select count(*) from public.announcement_reads where resident_id='c1800000-0000-4000-8000-000000000003')=1, 'r3 untouched';
  assert (select (ev,ob,ib) from r18_snap.ev_after_migration)=(select (select count(*) from barangayan_private.notification_events),(select count(*) from barangayan_private.notification_outbox),(select count(*) from public.notification_inbox)), 'reads/restores created events, outbox or inbox rows';
  raise notice 'reconcile x2 idempotent; restore: 1 restored, 1 skipped (newer action kept); no events/outbox created';
end $$;
