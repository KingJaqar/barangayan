CREATE OR REPLACE FUNCTION barangayan_private.transition_service_request_sla(p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.profiles; r public.service_requests; v_id uuid; v_action text; v_reason text; v_at timestamptz;
  v_previous text; v_completion text; v_status_note text;
begin
  perform barangayan_private.check_keys(p_input,array['requestId','action','reason','requirementsComplete','personalAppearanceReady']);
  v_id := barangayan_private.required_text(p_input,'requestId',36)::uuid;
  v_action := barangayan_private.required_text(p_input,'action',20);
  v_reason := barangayan_private.optional_text(p_input,'reason',1000);
  a := barangayan_private.assert_actor(public.current_role() = 'admin');
  if a.role <> 'admin' and v_action <> 'cancel' then raise exception 'forbidden' using errcode='42501'; end if;
  if (p_input ? 'requirementsComplete' and jsonb_typeof(p_input->'requirementsComplete') <> 'boolean') or
    (p_input ? 'personalAppearanceReady' and jsonb_typeof(p_input->'personalAppearanceReady') <> 'boolean') then raise exception 'invalid_readiness_confirmation' using errcode='22023'; end if;
  select * into r from public.service_requests where id=v_id and barangay_id=a.barangay_id and contract_version=2 and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if a.role = 'resident' and (r.resident_id <> a.id or r.status in ('ready_for_pickup','completed','cancelled') or r.payment_status='paid') then
    raise exception 'request_cannot_be_self_cancelled' using errcode='42501';
  end if;
  v_at := clock_timestamp();
  v_previous := current_setting('barangayan.foundation_operation',true);
  perform set_config('barangayan.foundation_operation','sla',true);
  v_status_note := current_setting('barangayan.status_note',true);
  perform set_config('barangayan.status_note',coalesce(v_reason,'SLA ' || v_action),true);
  if v_action='accept' and r.sla_state='pre_processing' then
    if r.requirements_review_state <> 'complete' or r.eligibility_state <> 'eligible' or r.requirements_reviewed_by is null or
      not coalesce((p_input->>'requirementsComplete')::boolean,false) or
      (r.personal_appearance_required and (r.personal_appearance_at is null or not coalesce((p_input->>'personalAppearanceReady')::boolean,false))) then
      raise exception 'complete_requirements_and_appearance_required' using errcode='22023';
    end if;
    update public.service_requests set requirements_review_state='complete',accepted_at=v_at,sla_state='running',status='in_progress',
      personal_appearance_at=r.personal_appearance_at where id=r.id;
  elsif v_action='pause' and r.sla_state='running' then
    if v_reason is null then raise exception 'resident_wait_reason_required' using errcode='22023'; end if;
    insert into public.service_request_pauses(request_id,reason,started_by,started_at) values(r.id,v_reason,a.id,v_at);
    update public.service_requests set sla_state='paused' where id=r.id;
  elsif v_action='resume' and r.sla_state='paused' then
    update public.service_request_pauses set resumed_by=a.id,resumed_at=v_at where request_id=r.id and resumed_at is null;
    if not found then raise exception 'open_pause_required' using errcode='22023'; end if;
    update public.service_requests set sla_state='running' where id=r.id;
  elsif v_action='ready' and r.sla_state='running' then
    update public.service_requests set sla_state='ready',ready_at=v_at,status='ready_for_pickup' where id=r.id;
  elsif v_action='release' and r.sla_state='ready' then
    if r.payment_status not in ('paid','waived') and not (r.fee_assessment_state='assessed' and r.assessed_amount_centavos=0) then
      raise exception 'confirmed_payment_or_waiver_required' using errcode='22023';
    end if;
    v_completion := current_setting('barangayan.allow_request_completion',true);
    perform set_config('barangayan.allow_request_completion','true',true);
    update public.service_requests set sla_state='released',released_at=v_at,status='completed' where id=r.id;
    perform set_config('barangayan.allow_request_completion',coalesce(v_completion,''),true);
  elsif v_action='cancel' and r.sla_state in ('pre_processing','running','paused','ready') then
    if v_reason is null then raise exception 'cancellation_reason_required' using errcode='22023'; end if;
    update public.service_request_pauses set resumed_by=a.id,resumed_at=v_at where request_id=r.id and resumed_at is null;
    update public.service_requests set sla_state='cancelled',cancelled_at=v_at,status='cancelled' where id=r.id;
  else raise exception 'invalid_SLA_transition' using errcode='22023'; end if;
  perform set_config('barangayan.foundation_operation',coalesce(v_previous,''),true);
  perform set_config('barangayan.status_note',coalesce(v_status_note,''),true);
  return r.id;
end $function$

