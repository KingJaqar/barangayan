-- R5 of plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md:
-- per-client request limit for the public evacuation-route Edge Function.
--
-- * Edge Functions have no built-in limiter (plan section 4). The function counts each
--   route request against a keyed hash (HMAC-SHA-256) of the client address in fixed
--   one-minute windows. The key stays in the function, so the stored hashes cannot be
--   reversed by enumerating addresses.
-- * Only service_role (the Edge Function) may count. The table is private and holds no
--   address, coordinate or route data; finished windows are pruned as new ones open.
begin;

create table barangayan_private.routing_rate_limits (
  client_hash   text        not null check (client_hash ~ '^[0-9a-f]{64}$'),
  window_start  timestamptz not null,
  request_count integer     not null default 1 check (request_count > 0),
  primary key (client_hash, window_start)
);

create index routing_rate_limits_window_start_idx on barangayan_private.routing_rate_limits (window_start);

comment on table barangayan_private.routing_rate_limits is
  'Route requests per hashed client address and one-minute window (evacuation-route Edge Function).';

alter table barangayan_private.routing_rate_limits enable row level security;
revoke all on barangayan_private.routing_rate_limits from public, anon, authenticated, service_role;

-- Counts one request. Returns 0 while the client is within p_limit for the current
-- window, otherwise the whole seconds until the next window opens (at least 1).
create function public.consume_routing_rate_limit(p_client_hash text, p_limit integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_window timestamptz := date_bin('1 minute', v_now, timestamptz '2000-01-01 00:00:00+00');
  v_count  integer;
begin
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid client hash.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100000 then
    raise exception 'Invalid request limit.' using errcode = '22023';
  end if;

  insert into barangayan_private.routing_rate_limits as l (client_hash, window_start)
  values (p_client_hash, v_window)
  on conflict (client_hash, window_start)
    do update set request_count = l.request_count + 1
  returning l.request_count into v_count;

  -- A client's first request in a window prunes finished windows; concurrent pruners
  -- skip instead of waiting on each other.
  if v_count = 1 and pg_try_advisory_xact_lock(hashtext('barangayan_private.routing_rate_limits')) then
    delete from barangayan_private.routing_rate_limits where window_start < v_window;
  end if;

  if v_count <= p_limit then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_window + interval '1 minute' - v_now)))::integer);
end;
$$;

comment on function public.consume_routing_rate_limit(text, integer) is
  'Counts one evacuation-route request for a hashed client address; returns seconds to wait (0 = allowed).';

revoke all on function public.consume_routing_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_routing_rate_limit(text, integer) to service_role;

commit;
