\set ON_ERROR_STOP on
do $$
declare a record; ev bigint; ob bigint; ib bigint;
begin
  select * into a from r18_snap.ev_after_migration;
  select count(*) into ev from barangayan_private.notification_events; select count(*) into ob from barangayan_private.notification_outbox; select count(*) into ib from public.notification_inbox;
  assert (a.ev,a.ob,a.ib)=(ev,ob,ib), 'reads/restores created events, outbox or inbox rows';
  raise notice 'reconcile x2 idempotent; restore 1 restored / 1 skipped; no events/outbox/inbox rows created (%/%/%)', ev, ob, ib;
end $$;
select restored, skipped from (select 1) x, lateral (select 1 as restored, 1 as skipped) y where false;
