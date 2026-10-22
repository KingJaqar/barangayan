-- Operator-only; use only after the candidate's acceptance and recovery gates.
-- Restore only the authenticated grants from the attendance migration.
begin;
set local lock_timeout = '5s';
grant execute on function public.check_in_household_members(uuid,uuid,jsonb,uuid),
  public.check_out_household_attendance(uuid[],uuid),
  barangayan_private.check_in_household_members(uuid,uuid,jsonb,uuid),
  barangayan_private.check_out_household_attendance(uuid[],uuid)
  to authenticated;
notify pgrst,'reload schema';
commit;
