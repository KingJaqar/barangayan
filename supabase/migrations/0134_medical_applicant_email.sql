begin;

-- Include the resident's current email in both table and detail/archive reads.
-- Retain each view's existing joins, tenant checks, archive filters and grants.
do $$
declare view_name text; definition text; updated_definition text;
begin
 foreach view_name in array array['admin_applicants_browse','admin_applicants_records'] loop
  definition := pg_get_viewdef(format('public.%I',view_name)::regclass, true);
  updated_definition := replace(definition,
   'jsonb_build_object(''full_name'', p.full_name)',
   'jsonb_build_object(''full_name'', p.full_name, ''email'', p.email)');
  if updated_definition = definition then
   raise exception 'Applicant profile projection missing in %',view_name;
  end if;
  execute format('create or replace view public.%I with (security_invoker=true) as %s',view_name,updated_definition);
 end loop;
end $$;

notify pgrst,'reload schema';
commit;
