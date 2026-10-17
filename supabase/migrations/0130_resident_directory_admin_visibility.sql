begin;

-- Admin is an access role, not a reason to disappear from the resident directory.
-- Keep both the table and its detail/archive projection consistent. Summaries
-- already aggregate admin_residents_browse, so their totals follow this change.
do $$
declare view_name text; definition text; updated_definition text;
begin
 foreach view_name in array array['admin_residents_browse','admin_residents_records'] loop
  definition := pg_get_viewdef(format('public.%I',view_name)::regclass, true);
  -- pg_get_viewdef qualifies b.role only when the view's nesting requires it.
  updated_definition := replace(definition, 'role = ''resident''::text',
   'role = ANY (ARRAY[''resident''::text, ''admin''::text])');
  if updated_definition = definition then
   raise exception 'Resident role predicate missing in %',view_name;
  end if;
  execute format('create or replace view public.%I with (security_invoker=true) as %s',view_name,updated_definition);
 end loop;
end $$;

-- Viewing an admin in the directory must not introduce another account-removal
-- path (in particular for the signed-in admin). Keep these actions in Staff.
do $$
declare definition text; anchor text := 'if p_screen=''staff'' and';
begin
 definition := pg_get_functiondef('public.admin_mutate_record(text,uuid,text,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then
  raise exception 'Admin lifecycle guard insertion point missing';
 end if;
 definition := replace(definition,anchor,
  'if p_screen=''residents'' and current_record->>''role''=''admin'' and p_operation<>''save'' then
   raise exception ''Manage admin account removal through Staff'' using errcode=''42501'';
  end if;
  ' || anchor);
 execute definition;
end $$;

notify pgrst,'reload schema';
commit;
