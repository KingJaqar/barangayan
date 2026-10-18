-- Request submission accepts active admin profiles as residents (0127).
-- Apply that same eligibility to the record editor without changing snapshot,
-- workflow, tenant, optimistic concurrency, or incident reporter restrictions.
begin;
do $$
declare definition text; old_check text; new_check text;
begin
 definition := pg_get_functiondef('public.admin_mutate_record(text,uuid,text,jsonb,timestamptz)'::regprocedure);
 foreach old_check in array array[
  'id=(p_patch->>''resident_id'')::uuid and barangay_id=actor.barangay_id and role=''resident''',
  'id=(p_patch->>''linked_resident_id'')::uuid and barangay_id=actor.barangay_id and role=''resident'''
 ] loop
  if strpos(definition,old_check)=0 then
   raise exception 'Request resident check missing: %',old_check;
  end if;
  new_check := replace(old_check,'role=''resident''','role in (''resident'',''admin'')');
  definition := replace(definition,old_check,new_check);
 end loop;
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
