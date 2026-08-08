-- TEMPORARY diagnostic — dropped immediately by the next migration.
create or replace function public.__diag_incident_env()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profiles', (
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role))
      from public.profiles p
    ),
    'triggers', (
      select jsonb_agg(jsonb_build_object(
        'name', t.tgname,
        'fn', pn.nspname || '.' || pp.proname,
        'enabled', t.tgenabled
      ))
      from pg_trigger t
      join pg_class c  on c.oid = t.tgrelid
      join pg_proc pp  on pp.oid = t.tgfoid
      join pg_namespace pn on pn.oid = pp.pronamespace
      where c.relname = 'incidents' and not t.tgisinternal
    ),
    'incidents', (
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'status', i.status,
        'deleted_at', i.deleted_at, 'reporter', i.reporter_id
      ) order by i.created_at desc)
      from public.incidents i
    ),
    'fk_policies', (
      select jsonb_agg(jsonb_build_object('policy', pol.polname, 'cmd', pol.polcmd))
      from pg_policy pol join pg_class c on c.oid = pol.polrelid
      where c.relname = 'incidents'
    )
  );
$$;

grant execute on function public.__diag_incident_env() to authenticated;
