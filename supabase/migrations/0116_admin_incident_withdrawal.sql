begin;

-- Admin withdrawal is a status transition for any active report in the actor's
-- barangay. Resident self-withdrawal keeps its separate reporter/time guards.
create or replace function public.update_incident_status(p_incident_id uuid, p_status text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  actor_barangay uuid;
  current_status text;
  affected integer;
begin
  select p.barangay_id into actor_barangay from public.profiles p
  where p.id=(select auth.uid()) and p.role='admin' and p.deleted_at is null
  for share;
  if actor_barangay is null then
    raise exception 'An active administrator account is required.' using errcode='42501';
  end if;

  if p_status is null or p_status not in ('open','in_progress','resolved','withdrawn','unresolved') then
    raise exception 'Select a valid incident status.' using errcode='22023';
  end if;

  select i.status into current_status from public.incidents i
  where i.id=p_incident_id and i.barangay_id=actor_barangay and i.deleted_at is null
  for update;
  if not found then
    raise exception 'This incident is unavailable or outside your barangay.' using errcode='42501';
  end if;

  if current_status=p_status then return; end if;
  if not (
    (current_status='open' and p_status in ('in_progress','withdrawn','unresolved'))
    or (current_status='in_progress' and p_status in ('resolved','withdrawn','unresolved'))
  ) then
    raise exception 'Cannot move incident from % to %.',current_status,p_status using errcode='22023';
  end if;

  update public.incidents set status=p_status
  where id=p_incident_id and barangay_id=actor_barangay and deleted_at is null;
  get diagnostics affected=row_count;
  if affected<>1 then
    raise exception 'The incident status was not updated. Check your access.' using errcode='42501';
  end if;
end $$;
revoke all on function public.update_incident_status(uuid,text) from public,anon;
grant execute on function public.update_incident_status(uuid,text) to authenticated;
comment on function public.update_incident_status(uuid,text) is
  'Active-admin, same-barangay incident workflow under RLS. Open -> in progress/withdrawn/unresolved; in progress -> resolved/withdrawn/unresolved. Withdrawal preserves the record. Resident self-withdrawal remains separate.';
notify pgrst,'reload schema';
commit;
