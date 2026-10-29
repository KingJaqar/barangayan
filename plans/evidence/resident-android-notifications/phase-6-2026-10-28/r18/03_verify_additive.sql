\set ON_ERROR_STOP on
do $$
declare s record; c record; v_gate text;
begin
  select * into s from r18_snap.counts;
  select (select count(*) from barangayan_private.notification_events) ev,(select count(*) from barangayan_private.notification_outbox) ob,(select count(*) from public.notification_inbox) ib,(select count(*) from public.announcements) an,(select md5(string_agg(i::text,'|' order by i.id)) from public.incidents i) inc,(select md5(string_agg(x::text,'|' order by x.id)) from public.service_requests x) sr,(select md5(string_agg(p::text,'|' order by p.id)) from public.profiles p) pr into c;
  assert (s.ev,s.ob,s.ib,s.an)=(c.ev,c.ob,c.ib,c.an), 'row counts changed by the additive migrations (replay?)';
  assert (s.inc,s.sr,s.pr)=(c.inc,c.sr,c.pr), 'domain rows changed';
  assert (select count(*) from r18_snap.reads) = (select count(*) from public.announcement_reads where resident_id::text like 'c1800000-%'), 'announcement_reads changed';
  assert not exists (select 1 from r18_snap.inbox o join public.notification_inbox n using(id) where o.read_at is distinct from n.read_at or o.title<>n.title), 'inbox rows changed';
  select emission_enabled||','||v2_alerts_enabled into v_gate from barangayan_private.notification_hub_settings;
  assert v_gate='false,false', 'gates must start off';
  raise notice 'additive migrations OK: counts/rows/domain hashes unchanged, gates %', v_gate;
end $$;
