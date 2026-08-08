-- TEMPORARY read-only diagnostic — dropped by 0034.
-- Returns the deployed body of the incident RPCs so the fix can be verified against
-- the live database rather than against the migration file.
create or replace function public.__diag_fn_src()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_object_agg(p.proname, pg_get_functiondef(p.oid))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('withdraw_incident', 'soft_delete_incident');
$$;

grant execute on function public.__diag_fn_src() to authenticated;
