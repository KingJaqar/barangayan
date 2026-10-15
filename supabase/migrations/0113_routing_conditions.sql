-- R4 of plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md:
-- canonical routing conditions for an evacuation routing area.
--
-- * One routing area per barangay with a monotonic revision. Every change that a
--   conditions snapshot can show (closures, center availability/entrances/state,
--   graph registration and mappings) takes the next revision under the area's row
--   lock, so concurrent publications serialize and snapshots are never half-applied.
-- * DRRM-verified road closures are hard blocks. They are never deleted or edited;
--   only an explicit reopening (with a reason) removes one (plan invariant 3).
-- * Graph geometry stays in routing packs. The database stores which pack edges /
--   nodes a closure or center entrance maps to, per graph version. A graph version
--   cannot become active while an active closure or center entrance lacks a mapping
--   for it (plan section 4, invariant 6).
-- * Availability is separate from is_active and starts as 'unknown' (invariant 4).
-- * get_routing_conditions_snapshot() is the public, unauthenticated read: one
--   complete, consistent snapshot including deactivations and tombstones.
-- * routing_condition_events is the append-only audit history, written only by
--   these functions and triggers.
begin;

-- ============================================================================
-- 1. Pure validators (immutable; used by check constraints and the RPCs)
-- ============================================================================
create function barangayan_private.routing_ids_valid(p_ids text[], p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_ids is not null
    and cardinality(p_ids) between 1 and p_max
    and array_position(p_ids, null) is null
    and (select count(distinct x) = count(*) and bool_and(x ~ '^[A-Za-z0-9:/._-]{1,160}$') from unnest(p_ids) as x);
$$;

-- GeoJSON MultiLineString of [lng, lat] positions, bounded in size.
create function barangayan_private.routing_multiline_valid(p_geometry jsonb, p_max_lines integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line jsonb;
  v_point jsonb;
  v_points integer := 0;
begin
  if jsonb_typeof(p_geometry) is distinct from 'object'
    or p_geometry->>'type' is distinct from 'MultiLineString'
    or jsonb_typeof(p_geometry->'coordinates') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p_geometry->'coordinates') not between 1 and p_max_lines then
    return false;
  end if;
  for v_line in select value from jsonb_array_elements(p_geometry->'coordinates') loop
    if jsonb_typeof(v_line) is distinct from 'array' then
      return false;
    end if;
    if jsonb_array_length(v_line) not between 2 and 500 then
      return false;
    end if;
    for v_point in select value from jsonb_array_elements(v_line) loop
      v_points := v_points + 1;
      if v_points > 5000 then
        return false;
      end if;
      if jsonb_typeof(v_point) is distinct from 'array' then
        return false;
      end if;
      if jsonb_array_length(v_point) <> 2
        or jsonb_typeof(v_point->0) is distinct from 'number'
        or jsonb_typeof(v_point->1) is distinct from 'number' then
        return false;
      end if;
      if (v_point->>0)::double precision not between -180 and 180
        or (v_point->>1)::double precision not between -90 and 90 then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

revoke all on function barangayan_private.routing_ids_valid(text[], integer) from public, anon;
revoke all on function barangayan_private.routing_multiline_valid(jsonb, integer) from public, anon;
grant execute on function barangayan_private.routing_ids_valid(text[], integer) to authenticated, service_role;
grant execute on function barangayan_private.routing_multiline_valid(jsonb, integer) to authenticated, service_role;

-- ============================================================================
-- 2. Routing areas and registered graph versions
-- ============================================================================
create table public.routing_areas (
  id                   text        primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  barangay_id          uuid        not null unique references public.barangays(id) on delete cascade,
  name                 text        not null check (char_length(btrim(name)) between 1 and 120),
  revision             bigint      not null default 0 check (revision >= 0),
  revised_at           timestamptz not null default now(),
  active_graph_version text,
  created_at           timestamptz not null default now()
);

comment on table public.routing_areas is
  'Evacuation routing area (one per barangay). revision increases on every published routing-condition change.';

create table public.routing_graph_versions (
  area_id       text        not null references public.routing_areas(id) on delete cascade,
  graph_version text        not null
                  check (graph_version ~ '^[a-z0-9][a-z0-9-]{0,62}@[0-9]{4}-[0-9]{2}-[0-9]{2}#[0-9a-f]{12}$'),
  registered_at timestamptz not null default now(),
  registered_by uuid,
  primary key (area_id, graph_version),
  constraint routing_graph_versions_area_prefix check (split_part(graph_version, '@', 1) = area_id)
);

comment on table public.routing_graph_versions is
  'Routing pack graph versions known for an area. Mappings of closures and entrances are stored per version.';

alter table public.routing_areas
  add constraint routing_areas_active_graph_fkey
  foreign key (id, active_graph_version) references public.routing_graph_versions(area_id, graph_version);

-- ============================================================================
-- 3. Verified road closures and their per-graph edge mappings
-- ============================================================================
create table public.road_closures (
  id                 uuid        primary key default gen_random_uuid(),
  area_id            text        not null references public.routing_areas(id) on delete restrict,
  label              text        not null check (char_length(btrim(label)) between 1 and 120),
  reason             text        not null check (char_length(btrim(reason)) between 1 and 500),
  -- [lng, lat] geometry of the closed segments, kept to remap onto later graph versions.
  geometry           jsonb       not null check (barangayan_private.routing_multiline_valid(geometry, 200)),
  -- Stable pack source references (OSM way and segment) of the closed edges.
  source_refs        text[]      not null check (barangayan_private.routing_ids_valid(source_refs, 200)),
  -- When DRRM observed the obstruction; publication time is kept separately.
  observed_at        timestamptz not null,
  published_at       timestamptz not null default clock_timestamp(),
  published_by       uuid,
  published_revision bigint      not null,
  status             text        not null default 'active' check (status in ('active', 'reopened')),
  reopened_at        timestamptz,
  reopened_by        uuid,
  reopen_reason      text,
  reopened_revision  bigint,
  constraint road_closures_reopen_fields check (
    (status = 'active' and reopened_at is null and reopened_by is null and reopen_reason is null and reopened_revision is null)
    or (status = 'reopened' and reopened_at is not null and reopened_revision is not null
        and char_length(btrim(coalesce(reopen_reason, ''))) between 1 and 500)
  )
);

create index road_closures_area_status_idx on public.road_closures (area_id, status);

comment on table public.road_closures is
  'DRRM-verified road closures. Hard blocks for routing; removed only by explicit reopening, never deleted.';

create table public.road_closure_edges (
  closure_id    uuid        not null references public.road_closures(id) on delete restrict,
  area_id       text        not null,
  graph_version text        not null,
  edge_ids      text[]      not null check (barangayan_private.routing_ids_valid(edge_ids, 200)),
  mapped_at     timestamptz not null default clock_timestamp(),
  mapped_by     uuid,
  primary key (closure_id, graph_version),
  foreign key (area_id, graph_version) references public.routing_graph_versions(area_id, graph_version) on delete restrict
);

comment on table public.road_closure_edges is
  'Pack edge ids a closure blocks in one graph version. A closure without a mapping for a graph is unmapped there, never dropped.';

-- ============================================================================
-- 4. Evacuation center availability, entrance, revision; entrance node mappings
-- ============================================================================
alter table public.evacuation_centers
  add column availability text not null default 'unknown'
    check (availability in ('available', 'unknown', 'unavailable')),
  add column availability_updated_at timestamptz,
  add column entrance_position jsonb
    check (
      entrance_position is null
      or (jsonb_typeof(entrance_position) = 'object'
          and jsonb_typeof(entrance_position->'lat') = 'number'
          and jsonb_typeof(entrance_position->'lng') = 'number'
          and case when jsonb_typeof(entrance_position->'lat') = 'number' and jsonb_typeof(entrance_position->'lng') = 'number'
                   then (entrance_position->>'lat')::double precision between -90 and 90
                        and (entrance_position->>'lng')::double precision between -180 and 180
                   else false end)
    ),
  add column routing_revision bigint;

comment on column public.evacuation_centers.availability is
  'Routing availability, separate from is_active. Unknown until confirmed; occupancy alone never promises capacity.';
comment on column public.evacuation_centers.entrance_position is
  'Reviewed walking entrance { lat, lng }. Cleared when the center moves; unroutable until set again.';
comment on column public.evacuation_centers.routing_revision is
  'Routing-area revision of the last routing-relevant change to this center (maintained by trigger).';

create table public.evacuation_center_entrance_nodes (
  center_id     uuid        not null references public.evacuation_centers(id) on delete cascade,
  area_id       text        not null,
  graph_version text        not null,
  node_id       text        not null check (node_id ~ '^[A-Za-z0-9:/._-]{1,160}$'),
  mapped_at     timestamptz not null default clock_timestamp(),
  mapped_by     uuid,
  primary key (center_id, graph_version),
  foreign key (area_id, graph_version) references public.routing_graph_versions(area_id, graph_version) on delete restrict
);

comment on table public.evacuation_center_entrance_nodes is
  'Pack node of a center entrance in one graph version. Missing mapping = unroutable center for that graph.';

-- Hard-deleted centers. Soft-deleted centers are reported from evacuation_centers.deleted_at.
create table public.routing_tombstones (
  area_id     text        not null references public.routing_areas(id) on delete cascade,
  entity_type text        not null check (entity_type = 'evacuation_center'),
  entity_id   uuid        not null,
  revision    bigint      not null,
  removed_at  timestamptz not null default clock_timestamp(),
  primary key (entity_type, entity_id)
);

-- ============================================================================
-- 5. Append-only audit history
-- ============================================================================
create table public.routing_condition_events (
  id          bigint      generated always as identity primary key,
  area_id     text        not null references public.routing_areas(id) on delete cascade,
  revision    bigint      not null,
  entity_type text        not null check (entity_type in ('road_closure', 'evacuation_center', 'routing_graph')),
  entity_id   text        not null,
  action      text        not null
                check (action in ('published', 'reopened', 'mapped', 'created', 'updated', 'deleted', 'registered', 'activated')),
  actor_id    uuid,
  details     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default clock_timestamp()
);

create index routing_condition_events_area_idx on public.routing_condition_events (area_id, id desc);

comment on table public.routing_condition_events is
  'Append-only history of routing-condition changes with the revision each produced.';

-- ============================================================================
-- 6. Integrity guards
-- ============================================================================
-- History rows never change. Direct deletes are refused; deletes cascading from a
-- removed routing area or center (trigger depth > 1) are allowed.
create function barangayan_private.reject_routing_history_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'Routing history is append-only (%).', tg_table_name using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger reject_routing_event_change before update or delete on public.routing_condition_events
  for each row execute function barangayan_private.reject_routing_history_change();
create trigger reject_routing_tombstone_change before update or delete on public.routing_tombstones
  for each row execute function barangayan_private.reject_routing_history_change();
create trigger reject_road_closure_edge_change before update or delete on public.road_closure_edges
  for each row execute function barangayan_private.reject_routing_history_change();

-- A closure is published once and may only make the single active -> reopened transition.
create function barangayan_private.guard_road_closure_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Verified road closures cannot be deleted; reopen them instead.' using errcode = '55000';
  end if;
  if (new.id, new.area_id, new.label, new.reason, new.geometry, new.source_refs, new.observed_at,
      new.published_at, new.published_by, new.published_revision)
     is distinct from
     (old.id, old.area_id, old.label, old.reason, old.geometry, old.source_refs, old.observed_at,
      old.published_at, old.published_by, old.published_revision) then
    raise exception 'A published road closure cannot be edited; reopen it and publish a new one.' using errcode = '55000';
  end if;
  if old.status = 'reopened' then
    raise exception 'A reopened road closure is final.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger guard_road_closure_change before update or delete on public.road_closures
  for each row execute function barangayan_private.guard_road_closure_change();

revoke all on function barangayan_private.reject_routing_history_change() from public, anon, authenticated, service_role;
revoke all on function barangayan_private.guard_road_closure_change() from public, anon, authenticated, service_role;

-- ============================================================================
-- 7. Revision, event and authorization helpers
-- ============================================================================
-- Takes the area row lock until commit, serializing publications per area.
create function barangayan_private.next_routing_revision(p_area_id text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.routing_areas
     set revision = revision + 1, revised_at = clock_timestamp()
   where id = p_area_id
  returning revision;
$$;

create function barangayan_private.record_routing_event(
  p_area_id text, p_revision bigint, p_entity_type text, p_entity_id text, p_action text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.routing_condition_events (area_id, revision, entity_type, entity_id, action, actor_id, details)
  values (p_area_id, p_revision, p_entity_type, p_entity_id, p_action, auth.uid(), coalesce(p_details, '{}'::jsonb));
$$;

-- Caller must be an administrator of the area's barangay. Locks the area row.
create function barangayan_private.lock_routing_area_for_admin(p_area_id text)
returns public.routing_areas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area public.routing_areas;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'Only barangay administrators can manage routing conditions.' using errcode = '42501';
  end if;
  select * into v_area from public.routing_areas where id = p_area_id for update;
  if not found or v_area.barangay_id is distinct from public.current_barangay_id() then
    raise exception 'Routing area not found for your barangay.' using errcode = '42501';
  end if;
  return v_area;
end;
$$;

revoke all on function barangayan_private.next_routing_revision(text) from public, anon, authenticated, service_role;
revoke all on function barangayan_private.record_routing_event(text, bigint, text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function barangayan_private.lock_routing_area_for_admin(text) from public, anon, authenticated, service_role;

-- ============================================================================
-- 8. Evacuation center triggers: revision, availability time, entrance invalidation
-- ============================================================================
create function barangayan_private.stamp_evacuation_center_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_id text;
begin
  select id into v_area_id from public.routing_areas where barangay_id = new.barangay_id;

  if tg_op = 'INSERT' then
    new.availability_updated_at := case when new.availability = 'unknown' then null else clock_timestamp() end;
    new.routing_revision := null;
    if v_area_id is null then
      return new;
    end if;
  else
    new.availability_updated_at := case
      when new.availability is distinct from old.availability then clock_timestamp()
      else old.availability_updated_at end;
    -- A moved center keeps no stale entrance: it stays visible but unroutable until reviewed.
    if new.position is distinct from old.position and new.entrance_position is not distinct from old.entrance_position then
      new.entrance_position := null;
    end if;
    new.routing_revision := old.routing_revision;
    if v_area_id is null
      or (new.name, new.position, new.entrance_position, new.availability, new.is_active, new.deleted_at, new.barangay_id)
         is not distinct from
         (old.name, old.position, old.entrance_position, old.availability, old.is_active, old.deleted_at, old.barangay_id) then
      return new;
    end if;
  end if;

  new.routing_revision := barangayan_private.next_routing_revision(v_area_id);
  return new;
end;
$$;

create function barangayan_private.record_evacuation_center_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_id text;
  v_revision bigint;
  v_changed text[];
begin
  if tg_op = 'DELETE' then
    select id into v_area_id from public.routing_areas where barangay_id = old.barangay_id;
    if v_area_id is null then
      return old;
    end if;
    v_revision := barangayan_private.next_routing_revision(v_area_id);
    insert into public.routing_tombstones (area_id, entity_type, entity_id, revision)
    values (v_area_id, 'evacuation_center', old.id, v_revision)
    on conflict (entity_type, entity_id) do nothing;
    perform barangayan_private.record_routing_event(v_area_id, v_revision, 'evacuation_center', old.id::text, 'deleted',
      jsonb_build_object('name', old.name));
    return old;
  end if;

  if new.routing_revision is null or (tg_op = 'UPDATE' and new.routing_revision is not distinct from old.routing_revision) then
    return new;
  end if;
  select id into v_area_id from public.routing_areas where barangay_id = new.barangay_id;

  if tg_op = 'INSERT' then
    perform barangayan_private.record_routing_event(v_area_id, new.routing_revision, 'evacuation_center', new.id::text, 'created',
      jsonb_build_object('name', new.name, 'availability', new.availability, 'active', new.is_active));
    return new;
  end if;

  if new.entrance_position is distinct from old.entrance_position then
    delete from public.evacuation_center_entrance_nodes where center_id = new.id;
  end if;

  v_changed := array_remove(array[
    case when new.name is distinct from old.name then 'name' end,
    case when new.position is distinct from old.position then 'position' end,
    case when new.entrance_position is distinct from old.entrance_position then 'entrance' end,
    case when new.availability is distinct from old.availability then 'availability' end,
    case when new.is_active is distinct from old.is_active then 'active' end,
    case when new.deleted_at is distinct from old.deleted_at then 'deleted_at' end,
    case when new.barangay_id is distinct from old.barangay_id then 'barangay' end
  ], null);

  perform barangayan_private.record_routing_event(v_area_id, new.routing_revision, 'evacuation_center', new.id::text,
    case when new.deleted_at is not null and old.deleted_at is null then 'deleted' else 'updated' end,
    jsonb_build_object('name', new.name, 'changed', to_jsonb(v_changed), 'availability', new.availability,
      'active', new.is_active, 'entranceSet', new.entrance_position is not null));
  return new;
end;
$$;

create trigger stamp_evacuation_center_routing
  before insert or update on public.evacuation_centers
  for each row execute function barangayan_private.stamp_evacuation_center_routing();
create trigger record_evacuation_center_routing
  after insert or update or delete on public.evacuation_centers
  for each row execute function barangayan_private.record_evacuation_center_routing();

revoke all on function barangayan_private.stamp_evacuation_center_routing() from public, anon, authenticated, service_role;
revoke all on function barangayan_private.record_evacuation_center_routing() from public, anon, authenticated, service_role;

-- ============================================================================
-- 9. Row-level security: administrators read their own area; writes go through RPCs
-- ============================================================================
alter table public.routing_areas                    enable row level security;
alter table public.routing_graph_versions           enable row level security;
alter table public.road_closures                    enable row level security;
alter table public.road_closure_edges               enable row level security;
alter table public.evacuation_center_entrance_nodes enable row level security;
alter table public.routing_tombstones               enable row level security;
alter table public.routing_condition_events         enable row level security;

create policy "admins read own routing area"
  on public.routing_areas for select to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins read own routing graph versions"
  on public.routing_graph_versions for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

create policy "admins read own road closures"
  on public.road_closures for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

create policy "admins read own road closure edges"
  on public.road_closure_edges for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

create policy "admins read own center entrance nodes"
  on public.evacuation_center_entrance_nodes for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

create policy "admins read own routing tombstones"
  on public.routing_tombstones for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

create policy "admins read own routing events"
  on public.routing_condition_events for select to authenticated
  using (public.current_role() = 'admin' and exists (
    select 1 from public.routing_areas a where a.id = area_id and a.barangay_id = public.current_barangay_id()));

revoke all on public.routing_areas, public.routing_graph_versions, public.road_closures, public.road_closure_edges,
  public.evacuation_center_entrance_nodes, public.routing_tombstones, public.routing_condition_events from anon;
revoke insert, update, delete, truncate on public.routing_areas, public.routing_graph_versions, public.road_closures,
  public.road_closure_edges, public.evacuation_center_entrance_nodes, public.routing_tombstones,
  public.routing_condition_events from authenticated;

-- ============================================================================
-- 10. Public conditions snapshot
-- ============================================================================
-- STABLE: every statement reads the caller's snapshot, so the revision and the
-- content always belong together.
create function public.get_routing_conditions_snapshot(p_area_id text, p_graph_version text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area public.routing_areas;
  v_graph text;
begin
  if p_graph_version is not null
    and p_graph_version !~ '^[a-z0-9][a-z0-9-]{0,62}@[0-9]{4}-[0-9]{2}-[0-9]{2}#[0-9a-f]{12}$' then
    raise exception 'Invalid graph version.' using errcode = '22023';
  end if;
  select * into v_area from public.routing_areas where id = p_area_id;
  if not found then
    raise exception 'Unknown routing area.' using errcode = 'P0002';
  end if;
  v_graph := coalesce(p_graph_version, v_area.active_graph_version);

  return jsonb_build_object(
    'schemaVersion', 1,
    'areaId', v_area.id,
    'revision', v_area.revision,
    'revisedAt', v_area.revised_at,
    'generatedAt', now(),
    'graphVersion', v_graph,
    'activeGraphVersion', v_area.active_graph_version,
    'graphStatus', case
      when v_graph is null then 'none'
      when v_graph = v_area.active_graph_version then 'active'
      when exists (select 1 from public.routing_graph_versions g where g.area_id = v_area.id and g.graph_version = v_graph)
        then 'registered'
      else 'unregistered' end,
    -- Active closures. edgeIds is null when the closure has no mapping for this graph:
    -- the client must treat it as an unmapped restriction, never drop it.
    'closures', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'label', c.label,
          'reason', c.reason,
          'observedAt', c.observed_at,
          'publishedAt', c.published_at,
          'revision', c.published_revision,
          'sourceRefs', to_jsonb(c.source_refs),
          'geometry', c.geometry,
          'edgeIds', to_jsonb(e.edge_ids))
        order by c.published_revision, c.id)
      from public.road_closures c
      left join public.road_closure_edges e on e.closure_id = c.id and e.graph_version = v_graph
      where c.area_id = v_area.id and c.status = 'active'), '[]'::jsonb),
    -- Every non-deleted center, inactive ones included so deactivation reaches cached clients.
    'centers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', ec.id,
          'name', ec.name,
          'active', ec.is_active,
          'availability', ec.availability,
          'availabilityUpdatedAt', ec.availability_updated_at,
          'position', case when ec.is_active then ec.position end,
          'entrancePosition', case when ec.is_active then ec.entrance_position end,
          'entranceNodeId', case when ec.is_active and ec.entrance_position is not null then n.node_id end,
          'revision', coalesce(ec.routing_revision, 0))
        order by ec.id)
      from public.evacuation_centers ec
      left join public.evacuation_center_entrance_nodes n on n.center_id = ec.id and n.graph_version = v_graph
      where ec.barangay_id = v_area.barangay_id and ec.deleted_at is null), '[]'::jsonb),
    -- Removed entities: reopened closures, archived centers and hard-deleted centers.
    'tombstones', coalesce((
      select jsonb_agg(jsonb_build_object('entityType', t.entity_type, 'id', t.entity_id, 'revision', t.revision, 'removedAt', t.removed_at)
        order by t.revision, t.entity_id)
      from (
        select 'road_closure'::text as entity_type, c.id::text as entity_id, c.reopened_revision as revision, c.reopened_at as removed_at
          from public.road_closures c where c.area_id = v_area.id and c.status = 'reopened'
        union all
        select 'evacuation_center', ec.id::text, coalesce(ec.routing_revision, 0), ec.deleted_at
          from public.evacuation_centers ec where ec.barangay_id = v_area.barangay_id and ec.deleted_at is not null
        union all
        select rt.entity_type, rt.entity_id::text, rt.revision, rt.removed_at
          from public.routing_tombstones rt where rt.area_id = v_area.id
      ) t), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_routing_conditions_snapshot(text, text) is
  'Public complete routing-conditions snapshot (closures, centers, tombstones) for one area and graph version.';

-- ============================================================================
-- 11. Administrator RPCs
-- ============================================================================
create function public.register_routing_graph_version(p_area_id text, p_graph_version text, p_activate boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area public.routing_areas;
  v_revision bigint;
  v_unmapped_closures integer;
  v_unmapped_entrances integer;
begin
  v_area := barangayan_private.lock_routing_area_for_admin(p_area_id);
  if p_graph_version is null
    or p_graph_version !~ '^[a-z0-9][a-z0-9-]{0,62}@[0-9]{4}-[0-9]{2}-[0-9]{2}#[0-9a-f]{12}$'
    or split_part(p_graph_version, '@', 1) <> v_area.id then
    raise exception 'Invalid graph version for this routing area.' using errcode = '22023';
  end if;

  insert into public.routing_graph_versions (area_id, graph_version, registered_by)
  values (v_area.id, p_graph_version, auth.uid())
  on conflict (area_id, graph_version) do nothing;
  if found then
    v_revision := barangayan_private.next_routing_revision(v_area.id);
    perform barangayan_private.record_routing_event(v_area.id, v_revision, 'routing_graph', p_graph_version, 'registered', '{}'::jsonb);
  end if;

  if coalesce(p_activate, false) and v_area.active_graph_version is distinct from p_graph_version then
    select count(*) into v_unmapped_closures
      from public.road_closures c
     where c.area_id = v_area.id and c.status = 'active'
       and not exists (select 1 from public.road_closure_edges e where e.closure_id = c.id and e.graph_version = p_graph_version);
    select count(*) into v_unmapped_entrances
      from public.evacuation_centers ec
     where ec.barangay_id = v_area.barangay_id and ec.deleted_at is null and ec.entrance_position is not null
       and not exists (select 1 from public.evacuation_center_entrance_nodes n where n.center_id = ec.id and n.graph_version = p_graph_version);
    if v_unmapped_closures > 0 or v_unmapped_entrances > 0 then
      raise exception 'This map data cannot be activated yet: % active closure(s) and % center entrance(s) are not mapped to it.',
        v_unmapped_closures, v_unmapped_entrances using errcode = '55000';
    end if;

    update public.routing_areas set active_graph_version = p_graph_version where id = v_area.id;
    v_revision := barangayan_private.next_routing_revision(v_area.id);
    perform barangayan_private.record_routing_event(v_area.id, v_revision, 'routing_graph', p_graph_version, 'activated',
      jsonb_build_object('previous', v_area.active_graph_version));
    insert into public.admin_audit_log (barangay_id, admin_id, action, entity_type, entity_label, metadata)
    values (v_area.barangay_id, auth.uid(), 'status_change', 'routing_area', 'Routing map data activated',
      jsonb_build_object('graph_version', p_graph_version, 'previous', v_area.active_graph_version, 'revision', v_revision));
  end if;

  select * into v_area from public.routing_areas where id = v_area.id;
  return jsonb_build_object('graphVersion', p_graph_version, 'active', v_area.active_graph_version = p_graph_version,
    'revision', v_area.revision);
end;
$$;

create function public.publish_road_closure(
  p_area_id text,
  p_graph_version text,
  p_edge_ids text[],
  p_source_refs text[],
  p_geometry jsonb,
  p_label text,
  p_reason text,
  p_observed_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area public.routing_areas;
  v_revision bigint;
  v_id uuid;
begin
  v_area := barangayan_private.lock_routing_area_for_admin(p_area_id);
  if v_area.active_graph_version is null then
    raise exception 'Register and activate the routing map data before publishing closures.' using errcode = '55000';
  end if;
  if p_graph_version is distinct from v_area.active_graph_version then
    raise exception 'The routing map data has changed. Reload the page and select the roads again.' using errcode = '55000';
  end if;
  if not barangayan_private.routing_ids_valid(p_edge_ids, 200) then
    raise exception 'Select between 1 and 200 distinct road segments.' using errcode = '22023';
  end if;
  if not barangayan_private.routing_ids_valid(p_source_refs, 200) or cardinality(p_source_refs) <> cardinality(p_edge_ids) then
    raise exception 'Each closed segment needs one source reference.' using errcode = '22023';
  end if;
  if not barangayan_private.routing_multiline_valid(p_geometry, 200)
    or jsonb_array_length(p_geometry->'coordinates') <> cardinality(p_edge_ids) then
    raise exception 'Closure geometry must contain one line per closed segment.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 120 then
    raise exception 'Enter a road label of 1 to 120 characters.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Enter a closure reason of 1 to 500 characters.' using errcode = '22023';
  end if;
  if p_observed_at is null or p_observed_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The observation time cannot be in the future.' using errcode = '22023';
  end if;

  v_revision := barangayan_private.next_routing_revision(v_area.id);
  insert into public.road_closures
    (area_id, label, reason, geometry, source_refs, observed_at, published_by, published_revision)
  values
    (v_area.id, btrim(p_label), btrim(p_reason), p_geometry, p_source_refs, p_observed_at, auth.uid(), v_revision)
  returning id into v_id;
  insert into public.road_closure_edges (closure_id, area_id, graph_version, edge_ids, mapped_by)
  values (v_id, v_area.id, p_graph_version, p_edge_ids, auth.uid());

  perform barangayan_private.record_routing_event(v_area.id, v_revision, 'road_closure', v_id::text, 'published',
    jsonb_build_object('label', btrim(p_label), 'graphVersion', p_graph_version, 'edgeCount', cardinality(p_edge_ids)));
  insert into public.admin_audit_log (barangay_id, admin_id, action, entity_type, entity_id, entity_label, metadata)
  values (v_area.barangay_id, auth.uid(), 'create', 'road_closure', v_id, btrim(p_label),
    jsonb_build_object('reason', btrim(p_reason), 'edge_count', cardinality(p_edge_ids), 'revision', v_revision));

  return jsonb_build_object('id', v_id, 'revision', v_revision);
end;
$$;

create function public.reopen_road_closure(p_closure_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_id text;
  v_area public.routing_areas;
  v_closure public.road_closures;
  v_revision bigint;
begin
  select area_id into v_area_id from public.road_closures where id = p_closure_id;
  if v_area_id is null then
    if auth.uid() is null or public.current_role() is distinct from 'admin' then
      raise exception 'Only barangay administrators can manage routing conditions.' using errcode = '42501';
    end if;
    raise exception 'Road closure not found.' using errcode = 'P0002';
  end if;
  v_area := barangayan_private.lock_routing_area_for_admin(v_area_id);
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Enter a reopening reason of 1 to 500 characters.' using errcode = '22023';
  end if;
  select * into v_closure from public.road_closures where id = p_closure_id for update;
  if v_closure.status <> 'active' then
    raise exception 'This road closure was already reopened.' using errcode = '55000';
  end if;

  v_revision := barangayan_private.next_routing_revision(v_area.id);
  update public.road_closures
     set status = 'reopened', reopened_at = clock_timestamp(), reopened_by = auth.uid(),
         reopen_reason = btrim(p_reason), reopened_revision = v_revision
   where id = p_closure_id;

  perform barangayan_private.record_routing_event(v_area.id, v_revision, 'road_closure', p_closure_id::text, 'reopened',
    jsonb_build_object('label', v_closure.label, 'reason', btrim(p_reason)));
  insert into public.admin_audit_log (barangay_id, admin_id, action, entity_type, entity_id, entity_label, metadata)
  values (v_area.barangay_id, auth.uid(), 'status_change', 'road_closure', p_closure_id, v_closure.label,
    jsonb_build_object('status', 'reopened', 'reason', btrim(p_reason), 'revision', v_revision));

  return jsonb_build_object('id', p_closure_id, 'revision', v_revision);
end;
$$;

-- Caller must administer the barangay of a non-deleted center; locks its routing area.
create function barangayan_private.lock_center_routing_area_for_admin(p_center_id uuid)
returns public.routing_areas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barangay_id uuid;
  v_area_id text;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'Only barangay administrators can manage routing conditions.' using errcode = '42501';
  end if;
  select barangay_id into v_barangay_id from public.evacuation_centers where id = p_center_id and deleted_at is null;
  if v_barangay_id is null then
    raise exception 'Evacuation center not found.' using errcode = 'P0002';
  end if;
  select id into v_area_id from public.routing_areas where barangay_id = v_barangay_id;
  if v_area_id is null then
    raise exception 'Routing is not set up for this barangay.' using errcode = '55000';
  end if;
  return barangayan_private.lock_routing_area_for_admin(v_area_id);
end;
$$;

revoke all on function barangayan_private.lock_center_routing_area_for_admin(uuid) from public, anon, authenticated, service_role;

-- Sets a center's reviewed entrance on the active graph.
create function public.set_evacuation_center_entrance(
  p_center_id uuid, p_graph_version text, p_node_id text, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_center public.evacuation_centers;
  v_area public.routing_areas;
  v_entrance jsonb;
  v_current_node text;
  v_revision bigint;
  v_center_lat double precision;
  v_center_lng double precision;
begin
  v_area := barangayan_private.lock_center_routing_area_for_admin(p_center_id);
  select * into v_center from public.evacuation_centers where id = p_center_id for update;

  if v_area.active_graph_version is null or p_graph_version is distinct from v_area.active_graph_version then
    raise exception 'The routing map data has changed. Reload the page and choose the entrance again.' using errcode = '55000';
  end if;
  if not barangayan_private.routing_ids_valid(array[p_node_id], 1) then
    raise exception 'Invalid entrance node.' using errcode = '22023';
  end if;
  -- NaN sorts above every number, so the range test also rejects it.
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid entrance coordinates.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_center.position->'lat') is distinct from 'number'
    or jsonb_typeof(v_center.position->'lng') is distinct from 'number' then
    raise exception 'The center has no valid position.' using errcode = '55000';
  end if;
  v_center_lat := (v_center.position->>'lat')::double precision;
  v_center_lng := (v_center.position->>'lng')::double precision;
  -- Equirectangular distance; an entrance more than 250 m from the center is a misplacement.
  if 6371008.8 * sqrt(power(radians(p_lat - v_center_lat), 2)
       + power(radians(p_lng - v_center_lng) * cos(radians((p_lat + v_center_lat) / 2)), 2)) > 250 then
    raise exception 'The entrance must be within 250 m of the center''s position.' using errcode = '22023';
  end if;

  v_entrance := jsonb_build_object('lat', p_lat, 'lng', p_lng);
  select node_id into v_current_node from public.evacuation_center_entrance_nodes
   where center_id = p_center_id and graph_version = p_graph_version;
  if v_entrance = v_center.entrance_position and v_current_node is not distinct from p_node_id then
    select revision into v_revision from public.routing_areas where id = v_area.id;
    return jsonb_build_object('id', p_center_id, 'revision', v_revision);
  end if;

  if v_entrance is distinct from v_center.entrance_position then
    -- The center trigger takes the revision, clears every old mapping and records the event.
    update public.evacuation_centers set entrance_position = v_entrance where id = p_center_id;
  else
    delete from public.evacuation_center_entrance_nodes where center_id = p_center_id;
    v_revision := barangayan_private.next_routing_revision(v_area.id);
    perform barangayan_private.record_routing_event(v_area.id, v_revision, 'evacuation_center', p_center_id::text, 'updated',
      jsonb_build_object('name', v_center.name, 'changed', jsonb_build_array('entrance_node')));
  end if;
  insert into public.evacuation_center_entrance_nodes (center_id, area_id, graph_version, node_id, mapped_by)
  values (p_center_id, v_area.id, p_graph_version, p_node_id, auth.uid());

  insert into public.admin_audit_log (barangay_id, admin_id, action, entity_type, entity_id, entity_label, metadata)
  values (v_area.barangay_id, auth.uid(), 'update', 'evacuation_center', p_center_id, v_center.name,
    jsonb_build_object('entrance', v_entrance, 'node_id', p_node_id, 'graph_version', p_graph_version));

  select revision into v_revision from public.routing_areas where id = v_area.id;
  return jsonb_build_object('id', p_center_id, 'revision', v_revision);
end;
$$;

-- Removes a center's entrance: the center stays listed but becomes unroutable.
create function public.clear_evacuation_center_entrance(p_center_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_center public.evacuation_centers;
  v_area public.routing_areas;
  v_revision bigint;
begin
  v_area := barangayan_private.lock_center_routing_area_for_admin(p_center_id);
  select * into v_center from public.evacuation_centers where id = p_center_id for update;
  if v_center.entrance_position is not null then
    -- The center trigger takes the revision, clears every mapping and records the event.
    update public.evacuation_centers set entrance_position = null where id = p_center_id;
    insert into public.admin_audit_log (barangay_id, admin_id, action, entity_type, entity_id, entity_label, metadata)
    values (v_area.barangay_id, auth.uid(), 'update', 'evacuation_center', p_center_id, v_center.name,
      jsonb_build_object('entrance', null));
  end if;
  select revision into v_revision from public.routing_areas where id = v_area.id;
  return jsonb_build_object('id', p_center_id, 'revision', v_revision);
end;
$$;

-- Maps an active closure onto a registered graph version that is not active yet
-- (prerequisite for activating it). Mappings on the active graph never change.
create function public.map_road_closure_edges(p_closure_id uuid, p_graph_version text, p_edge_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_id text;
  v_area public.routing_areas;
  v_closure public.road_closures;
  v_revision bigint;
begin
  select area_id into v_area_id from public.road_closures where id = p_closure_id;
  if v_area_id is null then
    if auth.uid() is null or public.current_role() is distinct from 'admin' then
      raise exception 'Only barangay administrators can manage routing conditions.' using errcode = '42501';
    end if;
    raise exception 'Road closure not found.' using errcode = 'P0002';
  end if;
  v_area := barangayan_private.lock_routing_area_for_admin(v_area_id);
  select * into v_closure from public.road_closures where id = p_closure_id;
  if v_closure.status <> 'active' then
    raise exception 'Reopened closures are not remapped.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.routing_graph_versions g where g.area_id = v_area.id and g.graph_version = p_graph_version) then
    raise exception 'Register the map data before mapping closures to it.' using errcode = '55000';
  end if;
  if p_graph_version = v_area.active_graph_version then
    raise exception 'Closures on the active map data cannot be remapped; reopen and publish again.' using errcode = '55000';
  end if;
  if not barangayan_private.routing_ids_valid(p_edge_ids, 200) then
    raise exception 'Select between 1 and 200 distinct road segments.' using errcode = '22023';
  end if;
  if exists (select 1 from public.road_closure_edges e where e.closure_id = p_closure_id and e.graph_version = p_graph_version) then
    raise exception 'This closure is already mapped to that map data.' using errcode = '55000';
  end if;

  v_revision := barangayan_private.next_routing_revision(v_area.id);
  insert into public.road_closure_edges (closure_id, area_id, graph_version, edge_ids, mapped_by)
  values (p_closure_id, v_area.id, p_graph_version, p_edge_ids, auth.uid());
  perform barangayan_private.record_routing_event(v_area.id, v_revision, 'road_closure', p_closure_id::text, 'mapped',
    jsonb_build_object('graphVersion', p_graph_version, 'edgeCount', cardinality(p_edge_ids)));
  return jsonb_build_object('id', p_closure_id, 'revision', v_revision);
end;
$$;

create function public.map_evacuation_center_entrance(p_center_id uuid, p_graph_version text, p_node_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_center public.evacuation_centers;
  v_area public.routing_areas;
  v_revision bigint;
begin
  v_area := barangayan_private.lock_center_routing_area_for_admin(p_center_id);
  select * into v_center from public.evacuation_centers where id = p_center_id for update;
  if v_center.entrance_position is null then
    raise exception 'Set the center''s entrance on the active map data first.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.routing_graph_versions g where g.area_id = v_area.id and g.graph_version = p_graph_version) then
    raise exception 'Register the map data before mapping entrances to it.' using errcode = '55000';
  end if;
  if p_graph_version = v_area.active_graph_version then
    raise exception 'Use the entrance editor for the active map data.' using errcode = '55000';
  end if;
  if not barangayan_private.routing_ids_valid(array[p_node_id], 1) then
    raise exception 'Invalid entrance node.' using errcode = '22023';
  end if;
  if exists (select 1 from public.evacuation_center_entrance_nodes n where n.center_id = p_center_id and n.graph_version = p_graph_version) then
    raise exception 'This entrance is already mapped to that map data.' using errcode = '55000';
  end if;

  v_revision := barangayan_private.next_routing_revision(v_area.id);
  insert into public.evacuation_center_entrance_nodes (center_id, area_id, graph_version, node_id, mapped_by)
  values (p_center_id, v_area.id, p_graph_version, p_node_id, auth.uid());
  perform barangayan_private.record_routing_event(v_area.id, v_revision, 'evacuation_center', p_center_id::text, 'mapped',
    jsonb_build_object('name', v_center.name, 'graphVersion', p_graph_version));
  return jsonb_build_object('id', p_center_id, 'revision', v_revision);
end;
$$;

revoke all on function public.get_routing_conditions_snapshot(text, text) from public;
revoke all on function public.register_routing_graph_version(text, text, boolean) from public, anon;
revoke all on function public.publish_road_closure(text, text, text[], text[], jsonb, text, text, timestamptz) from public, anon;
revoke all on function public.reopen_road_closure(uuid, text) from public, anon;
revoke all on function public.set_evacuation_center_entrance(uuid, text, text, double precision, double precision) from public, anon;
revoke all on function public.clear_evacuation_center_entrance(uuid) from public, anon;
revoke all on function public.map_road_closure_edges(uuid, text, text[]) from public, anon;
revoke all on function public.map_evacuation_center_entrance(uuid, text, text) from public, anon;

grant execute on function public.get_routing_conditions_snapshot(text, text) to anon, authenticated, service_role;
grant execute on function public.register_routing_graph_version(text, text, boolean) to authenticated;
grant execute on function public.publish_road_closure(text, text, text[], text[], jsonb, text, text, timestamptz) to authenticated;
grant execute on function public.reopen_road_closure(uuid, text) to authenticated;
grant execute on function public.set_evacuation_center_entrance(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.clear_evacuation_center_entrance(uuid) to authenticated;
grant execute on function public.map_road_closure_edges(uuid, text, text[]) to authenticated;
grant execute on function public.map_evacuation_center_entrance(uuid, text, text) to authenticated;

-- ============================================================================
-- 12. Pilot routing area (Barangay Ampid I). Fresh local installs get it from seed.sql.
-- ============================================================================
insert into public.routing_areas (id, barangay_id, name)
select 'ampid-1', b.id, 'Barangay Ampid I'
  from public.barangays b
 where b.id = '00000000-0000-0000-0000-000000000001'
on conflict do nothing;

commit;
