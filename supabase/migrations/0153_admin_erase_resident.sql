-- Admin "Erase": permanently remove a resident's sign-in, profile and every record they made.
--
-- Unlike the generic Delete (admin_mutate_record), which only deletes the profiles row and is
-- blocked by any request, payment or ID submission, this removes those records first. Unlike
-- self-service deletion (erase_own_account_records), nothing is retained or de-identified.
--
-- Storage objects live under "<user id>/" in each bucket and cannot be removed from SQL; the
-- admin-web server action removes them with the service role after this function succeeds.
begin;

create or replace function public.admin_erase_resident(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.profiles;
  target public.profiles;
  request_ids uuid[];
begin
  select * into actor from public.profiles where id = (select auth.uid()) and role = 'admin' and deleted_at is null;
  if actor.id is null or actor.barangay_id is null then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;

  -- Same lock order as attendance identity changes: auth user, then profile.
  perform 1 from auth.users where id = p_id for update;
  select * into target from public.profiles where id = p_id for update;
  if target.id is null or target.barangay_id is distinct from actor.barangay_id then
    raise exception 'Record unavailable' using errcode = '42501';
  end if;
  if target.id = actor.id or target.role <> 'resident' then
    raise exception 'Only resident accounts can be erased' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}') into request_ids from public.service_requests where resident_id = p_id;

  -- Document requests and everything hanging off them.
  delete from public.payments where service_request_id = any(request_ids);
  delete from public.request_attachments where request_id = any(request_ids) or resident_id = p_id;
  delete from public.service_request_pauses where request_id = any(request_ids);
  delete from public.service_request_sla_alerts where request_id = any(request_ids);
  delete from barangayan_private.legacy_submission_keys where request_id = any(request_ids) or resident_id = p_id;
  delete from public.service_requests where id = any(request_ids);

  -- Incident reports (confirmations on them cascade).
  delete from public.incidents where reporter_id = p_id;

  -- Medical drive registrations (scores cascade).
  delete from public.drive_registrations where user_id = p_id;

  -- Household and evacuation attendance, including an open check-in.
  delete from barangayan_private.household_attendance_receipts where household_profile_id = p_id or actor_profile_id = p_id;
  delete from public.household_attendance where household_profile_id = p_id;
  delete from public.household_members where profile_id = p_id;

  delete from public.account_deletion_requests where user_id = p_id;
  delete from barangayan_private.notification_read_restore where resident_id = p_id;

  -- profiles and id_submissions reference each other with NO ACTION keys, which are checked at the
  -- end of the statement, so both go in one statement. Deleting the auth user cascades to the
  -- profile, sessions, identities, push tokens, notifications, check-ins and the other cascading rows.
  with erased_ids as (delete from public.id_submissions where resident_id = p_id)
  delete from auth.users where id = p_id;

  return jsonb_build_object('id', p_id, 'requests', coalesce(array_length(request_ids, 1), 0));
end
$function$;

revoke all on function public.admin_erase_resident(uuid) from public, anon;
grant execute on function public.admin_erase_resident(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
