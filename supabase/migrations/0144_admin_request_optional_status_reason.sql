-- Repair inline and full-record status edits for versioned requests.
-- Preserve the existing function owner, grants, guards, and edit-patch semantics.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create or replace function barangayan_private.admin_edit_request_details(p_id uuid,p_patch jsonb,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles; request public.service_requests; before_record jsonb; payment_patch jsonb;
 target_status text; action text; reason text; submitted_at timestamptz;
 previous_operation text := current_setting('barangayan.foundation_operation',true);
begin
 actor := barangayan_private.assert_actor(true);
 perform barangayan_private.check_keys(p_patch,array['reference_number','created_at','requester_notes','status','status_change_reason','payment_method','payment_status']);
 if p_patch='{}'::jsonb then raise exception 'Enter changes to save.' using errcode='22023'; end if;
 select * into request from public.service_requests where id=p_id and barangay_id=actor.barangay_id and contract_version=2 for update;
 if not found then raise exception 'Request unavailable.' using errcode='42501'; end if;
 if p_expected is null or request.updated_at is distinct from p_expected then
  raise exception 'Record changed. Reload details.' using errcode='40001'; end if;
 select jsonb_object_agg(key,to_jsonb(request)->key) into before_record from jsonb_object_keys(p_patch) key;
 if exists(select 1 from jsonb_each(p_patch) where value<>'null'::jsonb and jsonb_typeof(value)<>'string') then
  raise exception 'Request fields must contain text.' using errcode='22023'; end if;
 if p_patch?'reference_number' and coalesce(length(btrim(p_patch->>'reference_number')),0) not between 1 and 200 then
  raise exception 'Enter a reference number of 1 to 200 characters.' using errcode='22023'; end if;
 if length(coalesce(p_patch->>'requester_notes',''))>10000 or length(coalesce(p_patch->>'status_change_reason',''))>1000 then
  raise exception 'Notes or status reason is too long.' using errcode='22023'; end if;
 if p_patch?'created_at' then
  submitted_at := (p_patch->>'created_at')::timestamptz;
  if submitted_at is null or not isfinite(submitted_at) or submitted_at>least(clock_timestamp(),request.accepted_at,request.ready_at,request.released_at,request.cancelled_at) then
   raise exception 'Submitted date cannot be later than the request processing history.' using errcode='22023'; end if;
 end if;
 target_status := case when p_patch?'status' then p_patch->>'status' else request.status end;
 if target_status is null or target_status not in ('submitted','in_progress','ready_for_pickup','completed','cancelled') then
  raise exception 'Select a valid request status.' using errcode='22023'; end if;
 reason := nullif(btrim(p_patch->>'status_change_reason'),'');
 if target_status='cancelled' and request.status<>'cancelled' and reason is null then
  raise exception 'Enter a reason for cancelling the request.' using errcode='22023'; end if;

 select jsonb_object_agg(key,value) into payment_patch from jsonb_each(p_patch) where key in ('payment_method','payment_status');
 if payment_patch is not null then
  perform barangayan_private.admin_edit_request_payment(p_id,payment_patch,request.updated_at);
 end if;
 perform set_config('barangayan.foundation_operation','admin_record_correction',true);
 if p_patch ?| array['reference_number','requester_notes','created_at'] then
  update public.service_requests set
   reference_number=case when p_patch?'reference_number' then btrim(p_patch->>'reference_number') else reference_number end,
   requester_notes=case when p_patch?'requester_notes' then nullif(btrim(p_patch->>'requester_notes'),'') else requester_notes end,
   created_at=case when p_patch?'created_at' then submitted_at else created_at end
  where id=request.id;
 end if;
 if target_status is distinct from request.status then
  action := case target_status when 'in_progress' then 'accept' when 'ready_for_pickup' then 'ready'
    when 'completed' then 'release' when 'cancelled' then 'cancel' else null end;
  if action is null then raise exception 'This status transition is unavailable.' using errcode='22023'; end if;
  -- optional_text accepts an omitted reason, but rejects an explicit JSON null.
  -- Strip nulls only from the transition payload; edit-patch nulls can clear fields.
  perform barangayan_private.transition_service_request_sla(jsonb_strip_nulls(jsonb_build_object(
    'requestId',request.id,'action',action,'reason',reason)));
 end if;
 select * into request from public.service_requests where id=p_id;
 insert into public.admin_audit_log(barangay_id,admin_id,action,entity_type,entity_id,entity_label,changes,metadata)
 values(actor.barangay_id,actor.id,'update','service_request',request.id,request.reference_number,
  jsonb_build_object('before',before_record,'after',p_patch),
  jsonb_build_object('operation','request_record_edit','admin_name',actor.full_name));
 perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
 return jsonb_build_object('id',request.id,'row',to_jsonb(request),'record_audited',true);
end $$;

notify pgrst,'reload schema';
commit;
