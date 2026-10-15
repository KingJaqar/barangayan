-- R8 of plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md:
-- storage for the BFS shadow model's output.
--
-- * Shadow runs are reports, never routing input: nothing here is read by the public
--   conditions snapshot or the route service (plan 3.8 stages 3-4 stay disabled).
-- * Only the flood-shadow Edge Function (service_role) publishes, through one RPC that
--   serializes publishers per area, refuses a run computed for a graph that is no longer
--   active and refuses a run older than the newest stored one (superseded computations
--   cannot publish).
-- * Administrators read their own area's runs for the model-health view.
begin;

create table public.flood_shadow_runs (
  id            uuid        primary key default gen_random_uuid(),
  area_id       text        not null references public.routing_areas(id) on delete cascade,
  graph_version text        not null,
  snapshot_id   text        not null check (snapshot_id ~ '^[0-9a-f]{64}$'),
  evaluated_at  timestamptz not null,
  model_status  text        not null check (model_status in ('unavailable', 'degraded', 'ok')),
  report        jsonb       not null check (jsonb_typeof(report) = 'object' and octet_length(report::text) <= 262144),
  published_at  timestamptz not null default now(),
  constraint flood_shadow_runs_graph_fkey
    foreign key (area_id, graph_version) references public.routing_graph_versions(area_id, graph_version),
  constraint flood_shadow_runs_snapshot_unique unique (area_id, snapshot_id)
);

create index flood_shadow_runs_area_evaluated_idx on public.flood_shadow_runs (area_id, evaluated_at desc);

comment on table public.flood_shadow_runs is
  'BFS shadow-model reports per sensor snapshot (plan R8). Advisory records only; never routing input.';

alter table public.flood_shadow_runs enable row level security;

create policy "admins read own flood shadow runs"
  on public.flood_shadow_runs for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

revoke all on public.flood_shadow_runs from anon;
revoke insert, update, delete, truncate on public.flood_shadow_runs from authenticated, service_role;

-- Publishes one run. Rejections are returned, not raised, so the function can tell a
-- superseded or stale computation from a fault:
--   {status: 'published', id} | {status: 'duplicate', id} | {status: 'rejected', reason}
-- Reasons: graph_not_active (the area's active graph differs from the one computed on),
-- superseded (an equal or newer evaluation is already stored), evaluated_in_future.
create function public.publish_flood_shadow_run(
  p_area_id       text,
  p_graph_version text,
  p_snapshot_id   text,
  p_evaluated_at  timestamptz,
  p_model_status  text,
  p_report        jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_active text;
  v_latest timestamptz;
  v_existing uuid;
  v_id uuid;
begin
  if p_area_id is null or p_area_id !~ '^[a-z0-9][a-z0-9-]{0,62}$'
     or p_snapshot_id is null or p_snapshot_id !~ '^[0-9a-f]{64}$'
     or p_graph_version is null or p_evaluated_at is null
     or p_model_status is null or p_model_status not in ('unavailable', 'degraded', 'ok')
     or p_report is null or jsonb_typeof(p_report) <> 'object' or octet_length(p_report::text) > 262144 then
    raise exception 'Invalid shadow run.' using errcode = '22023';
  end if;
  -- The report must describe exactly the run it is stored as, and never claim influence.
  if p_report->>'areaId' is distinct from p_area_id
     or p_report->>'graphVersion' is distinct from p_graph_version
     or p_report->>'snapshotId' is distinct from p_snapshot_id
     or p_report->>'modelStatus' is distinct from p_model_status
     or p_report->>'residentInfluence' is distinct from 'none' then
    raise exception 'Shadow run report does not match its identity.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('barangayan.flood_shadow:' || p_area_id));

  select a.active_graph_version into v_active from public.routing_areas a where a.id = p_area_id;
  if not found then
    raise exception 'Unknown routing area.' using errcode = 'P0002';
  end if;
  if v_active is distinct from p_graph_version then
    return jsonb_build_object('status', 'rejected', 'reason', 'graph_not_active');
  end if;
  if p_evaluated_at > now() + interval '5 minutes' then
    return jsonb_build_object('status', 'rejected', 'reason', 'evaluated_in_future');
  end if;

  select r.id into v_existing from public.flood_shadow_runs r
    where r.area_id = p_area_id and r.snapshot_id = p_snapshot_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'id', v_existing);
  end if;

  select max(r.evaluated_at) into v_latest from public.flood_shadow_runs r where r.area_id = p_area_id;
  if v_latest is not null and p_evaluated_at <= v_latest then
    return jsonb_build_object('status', 'rejected', 'reason', 'superseded');
  end if;

  insert into public.flood_shadow_runs (area_id, graph_version, snapshot_id, evaluated_at, model_status, report)
  values (p_area_id, p_graph_version, p_snapshot_id, p_evaluated_at, p_model_status, p_report)
  returning id into v_id;

  -- Bounded history: the newest 500 runs per area are enough for stage-3 comparisons.
  delete from public.flood_shadow_runs r
   where r.area_id = p_area_id
     and r.id not in (
       select k.id from public.flood_shadow_runs k where k.area_id = p_area_id
        order by k.evaluated_at desc limit 500);

  return jsonb_build_object('status', 'published', 'id', v_id);
end;
$$;

comment on function public.publish_flood_shadow_run(text, text, text, timestamptz, text, jsonb) is
  'Stores one BFS shadow report for the area unless it is superseded or for a no-longer-active graph (service_role only).';

-- Raw readings of the newest runs, newest first: the validators' temporal and outlier history.
create function public.get_flood_shadow_history(p_area_id text, p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_area_id is null or p_area_id !~ '^[a-z0-9][a-z0-9-]{0,62}$' or p_limit is null or p_limit not between 1 and 24 then
    raise exception 'Invalid history request.' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(k.readings order by k.evaluated_at desc)
      from (
        select r.evaluated_at, r.report->'readings' as readings
          from public.flood_shadow_runs r
         where r.area_id = p_area_id
         order by r.evaluated_at desc
         limit p_limit) k), '[]'::jsonb);
end;
$$;

comment on function public.get_flood_shadow_history(text, integer) is
  'Raw sensor readings of the newest shadow runs of an area, newest first (service_role only).';

revoke all on function public.publish_flood_shadow_run(text, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_flood_shadow_history(text, integer) from public, anon, authenticated;
grant execute on function public.publish_flood_shadow_run(text, text, text, timestamptz, text, jsonb) to service_role;
grant execute on function public.get_flood_shadow_history(text, integer) to service_role;

commit;
