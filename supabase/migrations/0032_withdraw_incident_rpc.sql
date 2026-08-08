-- withdraw_incident — the resident app's "Withdraw report" action.
--
-- THE BUG THIS FIXES
-- ------------------
-- The mobile detail screen called `soft_delete_incident`, which branches on the
-- CALLER'S ROLE before it looks at who filed the report:
--
--     if v_role = 'admin' then
--       update incidents set deleted_at = now();   -- admin "Remove"
--       return;
--     end if;
--     if v_reporter_id = auth.uid() then
--       update incidents set status = 'withdrawn'; -- resident "Withdraw"
--       ...
--
-- For an ordinary resident that is correct. But a barangay staff account (role =
-- 'admin') who files a report in the RESIDENT app and then taps "Withdraw report"
-- takes the FIRST branch — so their own withdrawal set `deleted_at` instead of
-- `status = 'withdrawn'`. Because every query in both apps filters on
-- `deleted_at is null`, the report then vanished everywhere: from My Incident
-- Reports, from the All/Withdrawn filters, and from the admin panel. It looked
-- exactly like the row had been deleted.
--
-- The role of the person tapping the button should not decide what the button
-- MEANS. "Withdraw my own report" and "Remove someone's report" are two different
-- operations, so they now get two different functions:
--
--   withdraw_incident   — this one. Reporter-only, always status = 'withdrawn',
--                         never touches deleted_at, and does not look at role at
--                         all. Called by the resident app.
--   soft_delete_incident — unchanged. Admin "Remove" in the web panel, still sets
--                         deleted_at (including for an admin's own report, which
--                         is what that button is for).
create or replace function public.withdraw_incident(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_reporter_id uuid;
  v_status      text;
  v_created_at  timestamptz;
begin
  select barangay_id, reporter_id, status, created_at
    into v_barangay_id, v_reporter_id, v_status, v_created_at
    from public.incidents
    where id = p_incident_id and deleted_at is null;

  if v_barangay_id is null then
    raise exception 'incident not found';
  end if;

  if v_barangay_id != public.current_barangay_id() then
    raise exception 'incident is not in your barangay';
  end if;

  -- Deliberately NO role branch: staff withdrawing a report they filed themselves
  -- must get resident semantics, same as everybody else.
  if v_reporter_id is distinct from auth.uid() then
    raise exception 'you can only withdraw a report you filed yourself';
  end if;

  if v_status != 'open' then
    raise exception 'you can only withdraw a report that is still open';
  end if;

  if v_created_at < now() - interval '24 hours' then
    raise exception 'the 24-hour withdrawal window for this report has closed';
  end if;

  update public.incidents
    set status = 'withdrawn'
    where id = p_incident_id;
end;
$$;

comment on function public.withdraw_incident(uuid) is
  'Resident-app "Withdraw report". The reporter moves their own still-open report to status = withdrawn within 24 hours. Never sets deleted_at and never branches on the caller''s role, so barangay staff withdrawing their own report behave like any other resident. Admin removal is soft_delete_incident.';
