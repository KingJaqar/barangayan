-- Measured Phase 2 prerequisite: 10k-row reference/join reads exceeded 500ms.
-- Cache stable session lookups once per statement in existing SELECT policies.
-- Predicates, roles, membership, ALL/write policies and helpers stay unchanged.
begin;
set local search_path=public,pg_catalog;
do $$
declare p record; rewritten text;
begin
  for p in
    select tablename,policyname,qual from pg_policies
    where schemaname='public' and cmd='SELECT' and tablename in (
      'profiles','service_requests','document_types','payments','incidents',
      'incident_categories','medical_drives','drive_registrations',
      'drive_registration_scores','household_members','barangay_officials'
    )
  loop
    rewritten := replace(replace(p.qual,
      '"current_role"()', '(select public.current_role())'),
      'current_barangay_id()', '(select public.current_barangay_id())');
    if rewritten is distinct from p.qual then
      execute format('alter policy %I on public.%I using (%s)',p.policyname,p.tablename,rewritten);
    end if;
  end loop;
end $$;

-- The natural key previously ran for every candidate before sort, including
-- deep pages. Separate directions retain ascending base-ID ties and nulls last.
create index admin_requests_reference_asc_idx on public.service_requests
  (barangay_id, (admin_table_keys.reference_key(reference_number) collate "C") asc nulls last, id asc)
  where deleted_at is null;
create index admin_requests_reference_desc_idx on public.service_requests
  (barangay_id, (admin_table_keys.reference_key(reference_number) collate "C") desc nulls last, id asc)
  where deleted_at is null;
commit;
