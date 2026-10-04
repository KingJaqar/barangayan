select jsonb_build_object(
  'private_functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'definer', p.prosecdef, 'settings', p.proconfig,
      'anon_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'execute')
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='barangayan_private'
  ),
  'public_wrappers', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'definer', p.prosecdef, 'settings', p.proconfig,
      'anon_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'execute')
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'complete_resident_profile','publish_id_submission','review_id_submission',
      'submit_service_request','assess_service_request_fee','transition_service_request_sla'
    )
  ),
  'new_tables', (
    select jsonb_agg(jsonb_build_object(
      'name', c.relname, 'rls', c.relrowsecurity,
      'authenticated_insert', has_table_privilege('authenticated',c.oid,'insert'),
      'authenticated_update', has_table_privilege('authenticated',c.oid,'update'),
      'authenticated_delete', has_table_privilege('authenticated',c.oid,'delete')
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('barangay_localities','id_submissions','request_attachments','service_request_pauses')
  ),
  'attachments_bucket', (select to_jsonb(b) from storage.buckets b where id='request-attachments'),
  'anon_private_schema_usage', has_schema_privilege('anon','barangayan_private','usage')
);
