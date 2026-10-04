begin;
alter table public.service_requests add constraint agency_sla_clock_shape check (
 timing_model <> 'agency_minutes_v1' or (
 (accepted_at is null or accepted_at >= created_at) and
 (ready_at is null or (accepted_at is not null and ready_at >= accepted_at)) and
 (released_at is null or (ready_at is not null and released_at >= ready_at)) and
 (cancelled_at is null or cancelled_at >= coalesce(ready_at,accepted_at,created_at)) and
 ((sla_state='pre_processing' and accepted_at is null and ready_at is null and released_at is null and cancelled_at is null) or
 (sla_state in ('running','paused') and accepted_at is not null and ready_at is null and released_at is null and cancelled_at is null) or
 (sla_state='ready' and ready_at is not null and released_at is null and cancelled_at is null) or
 (sla_state='released' and released_at is not null and cancelled_at is null) or
 (sla_state='cancelled' and cancelled_at is not null and released_at is null))));

create function barangayan_private.guard_sla_pause() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.service_requests;
begin
 if current_setting('barangayan.foundation_operation',true) is distinct from 'sla' then
  raise exception 'use_controlled_SLA_transition' using errcode='42501';
 end if;
 select * into r from public.service_requests where id=new.request_id for update;
 if r.timing_model <> 'agency_minutes_v1' or r.accepted_at is null or new.started_at < r.accepted_at then
  raise exception 'invalid_pause_start' using errcode='22023';
 end if;
 if tg_op='UPDATE' and (new.request_id<>old.request_id or new.started_at<>old.started_at or new.started_by<>old.started_by
   or new.reason<>old.reason or old.resumed_at is not null or new.resumed_at is null) then
  raise exception 'immutable_pause_or_repeated_resume' using errcode='22023';
 end if;
 if tg_op='INSERT' and (r.sla_state<>'running' or new.resumed_at is not null) then
  raise exception 'running_clock_required' using errcode='22023';
 end if;
 if exists(select 1 from public.service_request_pauses p where p.request_id=new.request_id and p.id<>new.id
  and tstzrange(p.started_at,p.resumed_at,'[)') && tstzrange(new.started_at,new.resumed_at,'[)')) then
  raise exception 'overlapping_resident_wait' using errcode='22023';
 end if;
 return new;
end $$;
create trigger guard_sla_pause before insert or update on public.service_request_pauses
for each row execute function barangayan_private.guard_sla_pause();

create function public.service_request_sla_metrics(p_request_id uuid, p_at timestamptz default clock_timestamp())
returns jsonb language sql stable security invoker set search_path='' as $$
 with r as (select * from public.service_requests where id=p_request_id and deleted_at is null),
 elapsed as (select r.*, greatest(0,extract(epoch from (coalesce(ready_at,cancelled_at,p_at)-accepted_at))) gross,
  coalesce((select sum(greatest(0,extract(epoch from (least(coalesce(p.resumed_at,p_at),coalesce(r.ready_at,r.cancelled_at,p_at))-
   greatest(p.started_at,r.accepted_at))))) from public.service_request_pauses p where p.request_id=r.id),0) wait_seconds from r),
 measured as (select *,greatest(0,coalesce(gross,0)-wait_seconds) agency_seconds from elapsed)
 select jsonb_build_object('agencySeconds',agency_seconds,'residentWaitSeconds',wait_seconds,
 'turnaroundSeconds',greatest(0,extract(epoch from (coalesce(released_at,cancelled_at,p_at)-created_at))),
 'targetSeconds',coalesce(target_minutes_snapshot,0)*60,
 'position',case when timing_model<>'agency_minutes_v1' then 'legacy' when sla_state='cancelled' then 'cancelled'
  when accepted_at is null then 'pre_processing' when ready_at is not null then
   case when agency_seconds<=target_minutes_snapshot*60 then 'completed_within' else 'completed_beyond' end
  when agency_seconds>target_minutes_snapshot*60 then 'overdue'
  when agency_seconds>=target_minutes_snapshot*48 then 'near_target' else 'on_track' end,
 'waitingReason',case when sla_state='paused' then (select reason from public.service_request_pauses where request_id=measured.id and resumed_at is null) end)
 from measured;
$$;
revoke all on function public.service_request_sla_metrics(uuid,timestamptz) from public,anon;
grant execute on function public.service_request_sla_metrics(uuid,timestamptz) to authenticated,service_role;
create function public.service_request_sla_tracking(p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('request',to_jsonb(r),'pauses',coalesce((select jsonb_agg(to_jsonb(p) order by p.started_at)
 from public.service_request_pauses p where p.request_id=r.id),'[]'::jsonb),'evaluated_at',clock_timestamp())
 from public.service_requests r where r.id=p_request_id and r.deleted_at is null;
$$;
revoke all on function public.service_request_sla_tracking(uuid) from public,anon;
grant execute on function public.service_request_sla_tracking(uuid) to authenticated;

create table public.service_request_sla_alerts (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.service_requests(id),
 threshold text not null check(threshold in ('near_target','overdue')), evaluated_at timestamptz not null,
 agency_seconds numeric not null check(agency_seconds>=0), unique(request_id,threshold)
);
alter table public.service_request_sla_alerts enable row level security;
revoke all on public.service_request_sla_alerts from anon,authenticated;
grant select on public.service_request_sla_alerts to authenticated;
create policy "tenant administrators read SLA alerts" on public.service_request_sla_alerts for select to authenticated
using(public.current_role()='admin' and exists(select 1 from public.service_requests r where r.id=request_id and r.barangay_id=public.current_barangay_id() and r.deleted_at is null));
create function barangayan_private.evaluate_service_request_slas() returns integer
language plpgsql security definer set search_path='' as $$
declare r public.service_requests; m jsonb; v_at timestamptz:=clock_timestamp(); n integer:=0; inserted integer;
begin
 for r in select * from public.service_requests where timing_model='agency_minutes_v1' and sla_state in ('running','paused') and deleted_at is null
 for update skip locked loop
  m:=public.service_request_sla_metrics(r.id,v_at);
  insert into public.service_request_sla_alerts(request_id,threshold,evaluated_at,agency_seconds)
  select r.id,t,v_at,(m->>'agencySeconds')::numeric from unnest(array['near_target','overdue']) t
  where (t='near_target' and (m->>'agencySeconds')::numeric>=r.target_minutes_snapshot*48)
   or (t='overdue' and (m->>'agencySeconds')::numeric>r.target_minutes_snapshot*60)
  on conflict(request_id,threshold) do nothing;
  get diagnostics inserted=row_count; n:=n+inserted;
 end loop;
 return n;
end $$;
revoke all on function barangayan_private.evaluate_service_request_slas() from public,anon,authenticated;
grant execute on function barangayan_private.evaluate_service_request_slas() to service_role;
create function barangayan_private.service_sla_report_rows() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.profiles; result jsonb;
begin
 a:=barangayan_private.assert_actor(true);
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('document_type_name',d.name,'legacy_target_hours',d.processing_target_hours,'pauses',coalesce((select jsonb_agg(to_jsonb(p) order by p.started_at)
  from public.service_request_pauses p where p.request_id=r.id),'[]'::jsonb))),'[]'::jsonb) into result
 from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.barangay_id=a.barangay_id and r.deleted_at is null;
 return jsonb_build_object('requests',result,'evaluated_at',clock_timestamp(), 'alerts',
  coalesce((select jsonb_agg(to_jsonb(e) order by e.evaluated_at desc) from public.service_request_sla_alerts e
   join public.service_requests r on r.id=e.request_id where r.barangay_id=a.barangay_id and r.deleted_at is null),'[]'::jsonb));
end $$;
create function public.service_sla_report_rows() returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.service_sla_report_rows();
$$;
revoke all on function barangayan_private.service_sla_report_rows(), public.service_sla_report_rows() from public,anon;
grant execute on function barangayan_private.service_sla_report_rows(), public.service_sla_report_rows() to authenticated;
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema extensions;
  perform cron.schedule('service-request-sla-minute','* * * * *','select barangayan_private.evaluate_service_request_slas()');
 else
  raise notice 'pg_cron unavailable: SLA requires an external once-per-minute SQL scheduler before release';
 end if;
end $$;
revoke all on function barangayan_private.guard_sla_pause() from public,anon,authenticated;
commit;
