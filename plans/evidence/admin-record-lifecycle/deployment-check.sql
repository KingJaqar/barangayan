-- Read-only verification; no application records are read or changed.
select 'Lifecycle/withdrawal/request migrations applied' as check,
  (select count(*)=3 from supabase_migrations.schema_migrations where version in ('0115','0116','0117')) as passed
union all
select 'All eight record views enforce caller permissions', count(*)=8 and bool_and('security_invoker=true'=any(reloptions))
from pg_class where relnamespace='public'::regnamespace and relname in (
 'admin_requests_records','admin_transactions_records','admin_residents_records','admin_incidents_records',
 'admin_health_records','admin_applicants_records','admin_households_records','admin_staff_records')
union all
select 'Lifecycle mutation enforces caller permissions and denies anonymous execution',
 not prosecdef and not has_function_privilege('anon',oid,'execute')
from pg_proc where oid='public.admin_mutate_record(text,uuid,text,jsonb,timestamp with time zone)'::regprocedure
union all
select 'Incident workflow supports withdrawal with active-admin and tenant guards',
 not prosecdef and not has_function_privilege('anon',oid,'execute')
 and position('withdrawn' in prosrc)>0 and position('p.deleted_at is null' in prosrc)>0
 and position('i.barangay_id=actor_barangay' in prosrc)>0
from pg_proc where oid='public.update_incident_status(uuid,text)'::regprocedure
union all
select 'Request actions require active admin, unarchived same-tenant requests and controlled versioned transitions',
 position('assert_actor(true)' in prosrc)>0 and position('deleted_at is null for update' in prosrc)>0
 and position('barangay_id=actor.barangay_id' in prosrc)>0
 and position('transition_service_request_sla' in prosrc)>0
from pg_proc where oid='barangayan_private.admin_request_transition(uuid,text,text)'::regprocedure
union all
select 'All four request RPC wrappers deny anonymous execution',
 bool_and(not has_function_privilege('anon',signature,'execute'))
from unnest(array['public.begin_processing_request(uuid)','public.mark_request_ready_for_pickup(uuid)',
 'public.complete_service_request(uuid)','public.cancel_service_request(uuid,text)']) signature
union all
select 'Active and archived request controls receive catalog fees',
 bool_and(position('fee_centavos' in pg_get_viewdef(('public.'||projection)::regclass,true))>0)
from unnest(array['admin_requests_browse','admin_requests_records']) projection;
