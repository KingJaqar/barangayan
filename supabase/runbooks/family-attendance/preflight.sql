-- Read-only release inspection. Run with psql -X -v ON_ERROR_STOP=1.
-- A successful catalog check does not replace authenticated behavioral tests.
begin read only;

do $$
declare
  signature text;
  schema_name text;
  client_role text;
  function_oid oid;
  item record;
begin
  if not (select relrowsecurity from pg_class where oid='public.household_attendance'::regclass)
    or not (select relrowsecurity from pg_class where oid='barangayan_private.household_attendance_receipts'::regclass) then
    raise exception 'Attendance and receipt RLS must both be enabled';
  end if;

  foreach client_role in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(client_role,'public.household_attendance','INSERT,UPDATE,DELETE')
      or has_any_column_privilege(client_role,'public.household_attendance','INSERT,UPDATE')
      or has_table_privilege(client_role,'barangayan_private.household_attendance_receipts','SELECT,INSERT,UPDATE,DELETE')
      or has_any_column_privilege(client_role,'barangayan_private.household_attendance_receipts','SELECT,INSERT,UPDATE') then
      raise exception 'Unexpected direct attendance/receipt privilege for %',client_role;
    end if;
  end loop;
  if has_table_privilege('authenticated','public.household_members','UPDATE')
    or has_column_privilege('authenticated','public.household_members','is_checked_in','UPDATE')
    or has_column_privilege('authenticated','public.household_members','checked_in_at','UPDATE')
    or has_column_privilege('authenticated','public.household_members','checked_in_center_id','UPDATE')
    or has_column_privilege('authenticated','public.household_members','checked_in_center_name','UPDATE') then
    raise exception 'Compatibility attendance fields permit direct member updates';
  end if;

  foreach signature in array array[
    'get_my_household_attendance()',
    'lookup_household_for_attendance(text)',
    'check_in_household_members(uuid,uuid,jsonb,uuid)',
    'check_out_household_attendance(uuid[],uuid)'
  ] loop
    foreach schema_name in array array['public','barangayan_private'] loop
      function_oid:=to_regprocedure(schema_name||'.'||signature);
      if function_oid is null then
        raise exception 'Missing function %.%',schema_name,signature;
      end if;
      if not has_function_privilege('authenticated',function_oid,'EXECUTE') then
        raise exception 'Attendance is paused or authenticated execute is missing: %.%',schema_name,signature;
      end if;
      if has_function_privilege('anon',function_oid,'EXECUTE')
        or has_function_privilege('service_role',function_oid,'EXECUTE') then
        raise exception 'Unexpected anonymous/service-role function access: %.%',schema_name,signature;
      end if;
      if exists(select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid=function_oid and a.grantee=0 and a.privilege_type='EXECUTE') then
        raise exception 'Unexpected PUBLIC execute: %.%',schema_name,signature;
      end if;
      if (select prosecdef from pg_proc where oid=function_oid)<>(schema_name='barangayan_private') then
        raise exception 'Unexpected invoker/definer boundary: %.%',schema_name,signature;
      end if;
    end loop;
  end loop;

  for item in select * from (values
    ('public.profiles'::regclass,'attendance_profile_identity'),
    ('auth.users'::regclass,'attendance_auth_identity'),
    ('public.profiles'::regclass,'sync_household_members_from_jsonb'),
    ('public.profiles'::regclass,'initialize_attendance_household'),
    ('public.household_members'::regclass,'guard_household_archive'),
    ('public.profiles'::regclass,'guard_attendance_household'),
    ('public.evacuation_centers'::regclass,'guard_attendance_center'),
    ('public.evacuation_center_checkins'::regclass,'reject_legacy_attendance')
  ) expected(table_oid,trigger_name) loop
    if not exists(select 1 from pg_trigger where tgrelid=item.table_oid
      and tgname=item.trigger_name and tgenabled='O' and not tgisinternal) then
      raise exception 'Missing or disabled trigger % on %',item.trigger_name,item.table_oid;
    end if;
  end loop;

  foreach signature in array array['public.household_attendance_active_holder','public.household_attendance_active_member'] loop
    if not exists(select 1 from pg_index where indexrelid=to_regclass(signature)
      and indisunique and indisvalid and indpred is not null) then
      raise exception 'Missing valid partial unique index %',signature;
    end if;
  end loop;
  if not exists(select 1 from pg_class where oid='public.household_attendance_receipt_exports'::regclass
    and reloptions @> array['security_invoker=true','security_barrier=true']) then
    raise exception 'Receipt export view must enforce invoker permissions and security barrier';
  end if;
end
$$;

select jsonb_build_object(
  'database',current_database(),
  'postgresql',current_setting('server_version'),
  'profiles',(select count(*) from public.profiles),
  'members',(select count(*) from public.household_members),
  'legacy_checkins',(select count(*) from public.evacuation_center_checkins),
  'stays',(select count(*) from public.household_attendance),
  'active_stays',(select count(*) from public.household_attendance where checked_out_at is null),
  'receipts',(select count(*) from barangayan_private.household_attendance_receipts)
) as release_inventory;
commit;
