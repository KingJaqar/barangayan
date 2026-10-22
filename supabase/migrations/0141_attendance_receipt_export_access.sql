-- Preserve caller-owned receipt exports while keeping auth.users and the
-- private receipt table behind a narrow, checked private function.
begin;
set local lock_timeout='5s';

create function barangayan_private.get_my_household_attendance_receipt_exports()
returns table(id uuid,household_profile_id uuid,request_id uuid,operation text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.household_profile_id,r.request_id,r.operation,r.created_at
 from barangayan_private.household_attendance_receipts r
 where r.household_profile_id=(select auth.uid()) and exists(
  select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=(select auth.uid())
  and p.role='resident' and p.deleted_at is null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and (u.banned_until is null or u.banned_until<=now()))
$$;
revoke all on function barangayan_private.get_my_household_attendance_receipt_exports()
 from public,anon,authenticated,service_role;
grant execute on function barangayan_private.get_my_household_attendance_receipt_exports() to authenticated;

create or replace view public.household_attendance_receipt_exports
with (security_barrier=true,security_invoker=true) as
 select id,household_profile_id,request_id,operation,created_at
 from barangayan_private.get_my_household_attendance_receipt_exports();
revoke all on public.household_attendance_receipt_exports from public,anon,authenticated,service_role;
grant select on public.household_attendance_receipt_exports to authenticated;

notify pgrst,'reload schema';
commit;
