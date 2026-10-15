-- R5 route request limit (0114): only the Edge Function's service role counts;
-- per-client windows, limit replies, pruning and input validation.
begin;
select plan(19);

-- ---------------------------------------------------------------------------
-- Only service_role may count; nobody reads the private table through the API roles.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.consume_routing_rate_limit(repeat('a', 64), 2) $$, '42501', null, 'Anonymous callers cannot count requests');
select throws_ok($$ select * from barangayan_private.routing_rate_limits $$, '42501', null, 'Anonymous callers cannot read the counters');
reset role;

set local role authenticated;
select throws_ok($$ select public.consume_routing_rate_limit(repeat('a', 64), 2) $$, '42501', null, 'Signed-in callers cannot count requests');
select throws_ok($$ select * from barangayan_private.routing_rate_limits $$, '42501', null, 'Signed-in callers cannot read the counters');
reset role;

-- ---------------------------------------------------------------------------
-- Counting within one window (one transaction = one window).
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok($$ select * from barangayan_private.routing_rate_limits $$, '42501', null, 'The service role reaches counters only through the function');
select is(public.consume_routing_rate_limit(repeat('a', 64), 2), 0, 'First request is allowed');
select is(public.consume_routing_rate_limit(repeat('a', 64), 2), 0, 'Second request within the limit is allowed');
select cmp_ok(public.consume_routing_rate_limit(repeat('a', 64), 2), '>=', 1, 'A request over the limit waits at least one second');
select cmp_ok(public.consume_routing_rate_limit(repeat('a', 64), 2), '<=', 60, 'A request over the limit waits at most until the next window');
select is(public.consume_routing_rate_limit(repeat('b', 64), 2), 0, 'Another client has its own count');

select throws_ok($$ select public.consume_routing_rate_limit('203.0.113.7', 2) $$, '22023', null, 'A raw address is refused; only hashes are stored');
select throws_ok($$ select public.consume_routing_rate_limit(repeat('A', 64), 2) $$, '22023', null, 'Hashes are lowercase hex');
select throws_ok($$ select public.consume_routing_rate_limit(null, 2) $$, '22023', null, 'A missing hash is refused');
select throws_ok($$ select public.consume_routing_rate_limit(repeat('a', 64), 0) $$, '22023', null, 'A zero limit is refused');
select throws_ok($$ select public.consume_routing_rate_limit(repeat('a', 64), null) $$, '22023', null, 'A missing limit is refused');
reset role;

select is(
  (select request_count from barangayan_private.routing_rate_limits where client_hash = repeat('a', 64)),
  4,
  'Refused requests still count'
);
select is(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
    where table_schema = 'barangayan_private' and table_name = 'routing_rate_limits'),
  array['client_hash', 'request_count', 'window_start'],
  'Counters store only a hash, a window and a count'
);

-- ---------------------------------------------------------------------------
-- A new client's first request prunes finished windows.
-- ---------------------------------------------------------------------------
insert into barangayan_private.routing_rate_limits (client_hash, window_start, request_count)
values (repeat('c', 64), now() - interval '5 minutes', 7);

set local role service_role;
select is(public.consume_routing_rate_limit(repeat('d', 64), 2), 0, 'A new client is allowed');
reset role;

select is(
  (select count(*)::int from barangayan_private.routing_rate_limits
    where window_start < date_bin('1 minute', now(), timestamptz '2000-01-01 00:00:00+00')),
  0,
  'Finished windows are pruned'
);

select * from finish();
rollback;
