-- Operator-only recovery action; not a migration. Obtain target authorization.
-- Does not cancel in-flight statements. Drain them before recovery/backup.
begin;
set local lock_timeout = '5s';
revoke execute on function public.check_in_household_members(uuid,uuid,jsonb,uuid),
  public.check_out_household_attendance(uuid[],uuid),
  barangayan_private.check_in_household_members(uuid,uuid,jsonb,uuid),
  barangayan_private.check_out_household_attendance(uuid[],uuid)
  from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
