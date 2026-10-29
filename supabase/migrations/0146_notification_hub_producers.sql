-- Resident Android notifications and announcements, Phase 2: trusted producers for the enabled
-- Account events (plan §1.2), occurrence keys for repeated genuine transitions, a bounded
-- reconciliation path and catch-up delivery of active System notices. Additive: migration 0135
-- and 0145 are not edited, version-1 destinations and existing event ids are unchanged.
--
--   * Every new producer is an AFTER trigger that reads the committed change, writes only generic
--     text from account_event_copy (never a source row's content) and goes through
--     emit_notification_v2, so nothing is written while the activation gate is off (D20).
--   * A producer never rolls back the change that caused it; a failure becomes a warning. The
--     events whose key is derived from the source row are therefore also repaired by
--     notification_reconcile_account_events (service_role, ≤100 per call, history only).
--   * A resident's own action is kept as history without a phone alert (D18); a change made by
--     staff, a provider callback or the service role (no resident session) may alert.
--   * The existing request/payment/incident producers keep their ids and text. A repeat of the
--     same transition gets an occurrence suffix instead of colliding with the first one.

-- ===== Copy and recipient rule =====
create or replace function barangayan_private.account_event_copy(p_code text)
returns table(code text, kind text, title text, body text, screen text)
language sql immutable set search_path='' as $$
  select c.code,c.kind,c.title,c.body,c.screen from (values
    ('A01','account_profile','Your account is ready','You can now use Barangayan with your resident account.','settings'),
    ('A03','account_profile','Your profile was updated','Your resident details changed. Open your profile to review them.','profile'),
    ('A05','account_profile','Household details updated','Your household information changed. Review the saved details in your profile.','profile'),
    ('A07','account_verification','ID submitted for review','Barangay staff will review your submitted ID. You can check its status in Valid ID.','valid_id'),
    ('A08','account_verification','Your ID is verified','Your submitted ID has been approved. Open Valid ID to review your status.','valid_id'),
    ('A09','account_verification','Your ID needs attention','Your ID could not be verified. Open Valid ID to review the reason and submit a replacement.','valid_id'),
    ('A10','account_verification','ID verification changed','Your ID verification is no longer active. Review the reason and the next steps in Valid ID.','valid_id'),
    ('A11','account_verification','Replacement ID submitted','Your replacement ID is pending review. Your current status is available in Valid ID.','valid_id'),
    ('A12','account_verification','Resubmit your ID','Your ID record needs an update. Please submit a clear front photo and confirm its details.','valid_id'),
    ('A14','account_verification','Email verified','Your current email address has been confirmed.','email_verification'),
    ('A15','account_verification','Verify your updated email','Your contact email changed. Confirm the new address in Email Verification.','email_verification'),
    ('A18','account_security','Password added','You can now sign in with your email and password.','change_password'),
    ('A19','account_security','Password updated','Your Barangayan password was updated. If this wasn''t you, recover your account.','change_password'),
    ('A31','request_status','Document request received','Your document request was submitted. Open it to check its status and next steps.',null),
    ('A32','request_status','Your request needs attention','Processing of your document request is on hold until you respond. Open it to see what is needed.',null),
    ('A33','payment','Payment is needed for your request','Your document request has a confirmed fee. Open the request to review the amount and available payment methods.',null),
    ('A37','request_status','Request processing updated','Processing of your document request has an update. Open it to review the reason and next steps.',null),
    ('A40','request_status','Document request cancelled','Your document request was cancelled. Open it to review the details.',null),
    ('A43','payment','Your payment needs attention','Your payment attempt was not completed. Check the request''s latest payment status before trying again.',null),
    ('A44P','payment','Your refund has an update','A refund for your document request was started. Open the request to follow its status.',null),
    ('A44S','payment','Your refund has an update','A refund for your document request is being processed. It has not been returned yet.',null),
    ('A44D','payment','Your refund has an update','A refund for your document request was confirmed. Open the request to review the details.',null),
    ('A44F','payment','Your refund has an update','A refund for your document request could not be completed. Open the request to review what to do next.',null),
    ('A45','request_status','Document request details updated','Details of your document request changed. Open it to review the latest information.',null),
    ('A46','incident_status','Incident report submitted','Your incident report was submitted to the barangay. Open it to check its status.',null),
    ('A50','incident_status','Incident report withdrawn','Your incident report was withdrawn. The barangay will no longer act on it.',null)
  ) c(code,kind,title,body,screen) where c.code=p_code
$$;

-- The barangay of a usable resident account (resident, not deleted, profile completed); null otherwise.
create or replace function barangayan_private.account_recipient_barangay(p_recipient uuid) returns uuid
language sql volatile set search_path='' as $$
  select p.barangay_id from public.profiles p
   where p.id=p_recipient and p.role='resident' and p.deleted_at is null and p.profile_completed_at is not null
$$;

-- Writes one account event for one resident. Silent (history only) when asked to be, and whenever
-- the change was made by the resident themselves. Returns the number of inbox rows written.
create or replace function barangayan_private.account_notify(
  p_code text, p_recipient uuid, p_key text, p_subject_type text, p_subject_id uuid, p_destination jsonb, p_silent boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare c record; v_barangay uuid:=barangayan_private.account_recipient_barangay(p_recipient);
begin
  select * into c from barangayan_private.account_event_copy(p_code);
  if c.code is null or v_barangay is null then return 0; end if;
  return barangayan_private.emit_notification_v2(array[p_recipient],v_barangay,c.kind,p_subject_type,p_subject_id,p_key,c.title,c.body,
    coalesce(p_destination,jsonb_build_object('v',2,'kind','account','screen',c.screen)),
    not coalesce(p_silent,false) and (select auth.uid()) is distinct from p_recipient);
end $$;

-- One occurrence token per client command: every row a single UPDATE touches shares it, a later
-- command gets a new one. A retried command that failed left nothing behind to collide with.
create or replace function barangayan_private.occurrence_token() returns text
language sql stable set search_path='' as $$
  select (extract(epoch from statement_timestamp())*1000000)::bigint::text
$$;

-- A genuine repeat of a transition is a new occurrence. The first occurrence keeps the plain key
-- (so existing event ids are unchanged); a later one gets the occurrence token as a suffix.
create or replace function barangayan_private.occurrence_key(p_recipient uuid, p_base text) returns text
language sql volatile security definer set search_path='' as $$
  select case when exists(select 1 from barangayan_private.notification_events e where e.recipient_id=p_recipient and e.dedupe_key=p_base)
              then left(p_base,170)||':x'||barangayan_private.occurrence_token() else p_base end
$$;

-- A resubmission after any earlier verified evidence is a replacement, not a first submission.
create or replace function barangayan_private.id_submission_is_replacement(p_resident uuid, p_version integer) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.id_submissions o where o.resident_id=p_resident and o.version<p_version and o.decision in ('verified','revoked'))
$$;

revoke all on function barangayan_private.account_event_copy(text),barangayan_private.account_recipient_barangay(uuid),
  barangayan_private.account_notify(text,uuid,text,text,uuid,jsonb,boolean),barangayan_private.occurrence_token(),
  barangayan_private.occurrence_key(uuid,text),barangayan_private.id_submission_is_replacement(uuid,integer)
  from public,anon,authenticated,service_role;

-- ===== Profile, email and ID repair (A01, A03, A12, A14, A15) =====
create or replace function barangayan_private.notify_profile_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_x text:=barangayan_private.occurrence_token();
begin
  if tg_op='INSERT' then
    if new.profile_completed_at is not null then
      perform barangayan_private.account_notify('A01',new.id,'account_ready:'||new.id,'account',new.id,null,true);
    end if;
    return null;
  end if;
  if old.profile_completed_at is null then
    if new.profile_completed_at is not null then
      perform barangayan_private.account_notify('A01',new.id,'account_ready:'||new.id,'account',new.id,null,true);
    end if;
    return null;
  end if;
  if (old.first_name,old.last_name,old.middle_name,old.suffix,old.sex,old.mobile_number,old.house_no,old.street,old.city,old.province,old.birth_date,old.employment_status,old.occupation)
     is distinct from (new.first_name,new.last_name,new.middle_name,new.suffix,new.sex,new.mobile_number,new.house_no,new.street,new.city,new.province,new.birth_date,new.employment_status,new.occupation) then
    perform barangayan_private.account_notify('A03',new.id,'profile:'||new.id||':'||v_x,'account',new.id,null,false);
  end if;
  if lower(btrim(coalesce(new.email,''))) is distinct from lower(btrim(coalesce(old.email,''))) and btrim(coalesce(new.email,''))<>'' then
    perform barangayan_private.account_notify('A15',new.id,'email:'||new.id||':changed:'||v_x,'account',new.id,null,false);
  end if;
  if old.email_verification_status is distinct from 'verified' and new.email_verification_status='verified' then
    perform barangayan_private.account_notify('A14',new.id,'email:'||new.id||':verified:'||(extract(epoch from coalesce(new.email_verified_at,now()))*1000000)::bigint,'account',new.id,null,false);
  end if;
  if coalesce(new.id_repair_required,false) and not coalesce(old.id_repair_required,false) then
    perform barangayan_private.account_notify('A12',new.id,'id_repair:'||new.id||':'||coalesce(new.current_id_submission_id::text,'none'),'account',new.id,null,false);
  end if;
  return null;
exception when others then
  raise warning 'notify_profile_account failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_profile_account_ins on public.profiles;
create trigger z_notify_profile_account_ins after insert on public.profiles
  for each row when (new.role='resident' and new.profile_completed_at is not null)
  execute function barangayan_private.notify_profile_account();
drop trigger if exists z_notify_profile_account on public.profiles;
create trigger z_notify_profile_account after update of profile_completed_at,first_name,last_name,middle_name,suffix,sex,mobile_number,
  house_no,street,city,province,birth_date,employment_status,occupation,email,email_verification_status,id_repair_required on public.profiles
  for each row when (new.role='resident' and new.deleted_at is null and old.deleted_at is null)
  execute function barangayan_private.notify_profile_account();

-- ===== Household members (A05): one event per transaction however many rows changed =====
create or replace function barangayan_private.notify_household_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_profile uuid:=case when tg_op='DELETE' then old.profile_id else new.profile_id end;
begin
  perform barangayan_private.account_notify('A05',v_profile,'household:'||v_profile||':'||barangayan_private.occurrence_token(),'account',v_profile,null,false);
  return null;
exception when others then
  raise warning 'notify_household_change failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_household_ins on public.household_members;
create trigger z_notify_household_ins after insert on public.household_members
  for each row when (new.deleted_at is null) execute function barangayan_private.notify_household_change();
drop trigger if exists z_notify_household_upd on public.household_members;
create trigger z_notify_household_upd after update of name,relation,role,deleted_at on public.household_members
  for each row when ((old.name,old.relation,old.role,old.deleted_at) is distinct from (new.name,new.relation,new.role,new.deleted_at))
  execute function barangayan_private.notify_household_change();
drop trigger if exists z_notify_household_del on public.household_members;
create trigger z_notify_household_del after delete on public.household_members
  for each row when (old.deleted_at is null) execute function barangayan_private.notify_household_change();

-- ===== Valid ID evidence versions (A07–A11) =====
create or replace function barangayan_private.notify_id_submission() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
  if new.evidence_origin<>'resident_upload' then return null; end if;
  if tg_op='INSERT' then
    perform barangayan_private.account_notify(
      case when barangayan_private.id_submission_is_replacement(new.resident_id,new.version) then 'A11' else 'A07' end,
      new.resident_id,'id:'||new.id||':submitted','account',new.resident_id,null,true);
  else
    v_code:=case when old.decision='pending' and new.decision='verified' then 'A08'
                 when old.decision='pending' and new.decision='verification_failed' then 'A09'
                 when old.decision='verified' and new.decision='revoked' then 'A10' end;
    if v_code is not null then
      perform barangayan_private.account_notify(v_code,new.resident_id,'id:'||new.id||':'||new.decision,'account',new.resident_id,null,false);
    end if;
  end if;
  return null;
exception when others then
  raise warning 'notify_id_submission failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_id_submission_ins on public.id_submissions;
create trigger z_notify_id_submission_ins after insert on public.id_submissions
  for each row execute function barangayan_private.notify_id_submission();
drop trigger if exists z_notify_id_submission_upd on public.id_submissions;
create trigger z_notify_id_submission_upd after update of decision on public.id_submissions
  for each row when (old.decision is distinct from new.decision) execute function barangayan_private.notify_id_submission();

-- ===== Password (A18–A20): a completed write observed by 0122; intent is unknown (D16) =====
create or replace function barangayan_private.notify_password_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.password_observed_at is null or new.password_observed_at is not distinct from old.password_observed_at or not coalesce(new.password_set,false) then
    return null;
  end if;
  perform barangayan_private.account_notify(case when old.password_set is false then 'A18' else 'A19' end,new.user_id,
    'password:'||new.user_id||':'||(extract(epoch from new.password_observed_at)*1000000)::bigint,'account',new.user_id,null,false);
  return null;
exception when others then
  raise warning 'notify_password_change failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_password_change on barangayan_private.resident_account_lifecycle;
create trigger z_notify_password_change after update of password_observed_at on barangayan_private.resident_account_lifecycle
  for each row when (old.password_observed_at is distinct from new.password_observed_at)
  execute function barangayan_private.notify_password_change();

-- ===== Document requests: submission (A31), existing events with occurrence keys, fee (A33), own cancel (A40) =====
create or replace function barangayan_private.notify_request_submitted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform barangayan_private.account_notify('A31',new.resident_id,'request:'||new.id||':submitted','request',new.id,
    jsonb_build_object('v',1,'kind','request','id',new.id),true);
  return null;
exception when others then
  raise warning 'notify_request_submitted failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_request_submitted on public.service_requests;
create trigger z_notify_request_submitted after insert on public.service_requests
  for each row when (new.deleted_at is null) execute function barangayan_private.notify_request_submitted();

create or replace function barangayan_private.notify_request_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_title text; v_body text; v_kind text; v_key text; v_dest jsonb;
begin
  if new.deleted_at is not null then return null; end if;
  v_dest:=jsonb_build_object('v',1,'kind','request','id',new.id);
  if v_actor is not distinct from new.resident_id then
    if new.status is distinct from old.status and new.status='cancelled' then
      perform barangayan_private.account_notify('A40',new.resident_id,
        barangayan_private.occurrence_key(new.resident_id,'request:'||new.id||':status:cancelled:self'),'request',new.id,v_dest,true);
    end if;
    return null;
  end if;
  if new.payment_status is distinct from old.payment_status and new.payment_status in ('paid','waived') then
    v_kind:='payment'; v_title:='Payment update';
    v_body:=case new.payment_status when 'paid' then 'Your payment was received.' else 'No payment is due for your request.' end;
    v_key:=barangayan_private.occurrence_key(new.resident_id,'request:'||new.id||':payment:'||new.payment_status);
    perform barangayan_private.emit_notification(array[new.resident_id],new.barangay_id,v_kind,'request',new.id,v_key,v_title,v_body);
  end if;
  if new.status is distinct from old.status and new.status in ('in_progress','ready_for_pickup','completed','cancelled') then
    v_kind:='request_status';
    v_title:=case new.status when 'ready_for_pickup' then 'Request ready' else 'Request update' end;
    v_body:=case new.status
      when 'in_progress' then 'Your document request is being processed.'
      when 'ready_for_pickup' then 'Your document is ready for pickup.'
      when 'completed' then 'Your document request is complete.'
      else 'Your document request was cancelled.' end;
    v_key:=barangayan_private.occurrence_key(new.resident_id,'request:'||new.id||':status:'||new.status);
    perform barangayan_private.emit_notification(array[new.resident_id],new.barangay_id,v_kind,'request',new.id,v_key,v_title,v_body);
  end if;
  -- A33: a confirmed, payable fee that is new or materially revised; never an estimate or a settled request.
  if new.fee_assessment_state='assessed' and coalesce(new.assessed_amount_centavos,0)>0
     and new.payment_status not in ('paid','waived','refunded') and new.status not in ('completed','cancelled')
     and (old.fee_assessment_state is distinct from 'assessed' or old.assessed_amount_centavos is distinct from new.assessed_amount_centavos) then
    perform barangayan_private.account_notify('A33',new.resident_id,
      barangayan_private.occurrence_key(new.resident_id,'request:'||new.id||':fee:'||new.assessed_amount_centavos),'request',new.id,v_dest,false);
  end if;
  return null;
exception when others then
  raise warning 'notify_request_change failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_request_change on public.service_requests;
create trigger z_notify_request_change after update of status,payment_status,fee_assessment_state,assessed_amount_centavos on public.service_requests
  for each row when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status
                     or old.fee_assessment_state is distinct from new.fee_assessment_state
                     or old.assessed_amount_centavos is distinct from new.assessed_amount_centavos)
  execute function barangayan_private.notify_request_change();

-- A45: a staff edit of resident-facing record fields. Evaluated at commit so it can step aside when
-- the same transaction already produced a more specific status, payment or fee event.
create or replace function barangayan_private.notify_request_details() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or (select auth.uid()) is not distinct from new.resident_id then return null; end if;
  if exists(select 1 from barangayan_private.notification_events e
             where e.recipient_id=new.resident_id and e.created_at=now() and e.dedupe_key ~ ('^request:'||new.id||':(status|payment|fee):')) then
    return null;
  end if;
  perform barangayan_private.account_notify('A45',new.resident_id,'request:'||new.id||':details:'||txid_current(),'request',new.id,
    jsonb_build_object('v',1,'kind','request','id',new.id),false);
  return null;
exception when others then
  raise warning 'notify_request_details failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_request_details on public.service_requests;
create constraint trigger z_notify_request_details after update of reference_number,requester_notes,payment_method on public.service_requests
  deferrable initially deferred
  for each row when (old.reference_number is distinct from new.reference_number or old.requester_notes is distinct from new.requester_notes
                     or old.payment_method is distinct from new.payment_method)
  execute function barangayan_private.notify_request_details();

-- ===== Resident-wait pauses (A32, A37) =====
create or replace function barangayan_private.notify_request_pause() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_resident uuid;
begin
  select r.resident_id into v_resident from public.service_requests r where r.id=new.request_id and r.deleted_at is null;
  if v_resident is null then return null; end if;
  perform barangayan_private.account_notify(case when tg_op='INSERT' then 'A32' else 'A37' end,v_resident,
    'request_pause:'||new.id||case when tg_op='INSERT' then ':started' else ':resumed' end,'request',new.request_id,
    jsonb_build_object('v',1,'kind','request','id',new.request_id),false);
  return null;
exception when others then
  raise warning 'notify_request_pause failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_request_pause_ins on public.service_request_pauses;
create trigger z_notify_request_pause_ins after insert on public.service_request_pauses
  for each row when (new.resumed_at is null) execute function barangayan_private.notify_request_pause();
drop trigger if exists z_notify_request_pause_upd on public.service_request_pauses;
create trigger z_notify_request_pause_upd after update of resumed_at on public.service_request_pauses
  for each row when (old.resumed_at is null and new.resumed_at is not null) execute function barangayan_private.notify_request_pause();

-- ===== Payment attempts and refund stages (A43, A44) =====
create or replace function barangayan_private.notify_payment_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_resident uuid; v_dest jsonb; v_stage text; v_old_stage text;
begin
  if new.deleted_at is not null then return null; end if;
  select r.resident_id into v_resident from public.service_requests r where r.id=new.service_request_id and r.deleted_at is null;
  if v_resident is null then return null; end if;
  v_dest:=jsonb_build_object('v',1,'kind','request','id',new.service_request_id);
  if new.status is distinct from old.status and new.status in ('failed','expired') then
    perform barangayan_private.account_notify('A43',v_resident,'payment:'||new.id||':'||new.status,'request',new.service_request_id,v_dest,false);
  end if;
  -- Stages, not raw states: initiated, in progress (processing/refunding), confirmed, failed. Moving
  -- between two states of one stage tells the resident nothing new.
  if new.refund_status is distinct from old.refund_status and new.refund_status<>'none' then
    v_stage:=case new.refund_status when 'pending' then 'pending' when 'processing' then 'processing' when 'refunding' then 'processing'
                                    when 'refunded' then 'refunded' else 'failed' end;
    v_old_stage:=case old.refund_status when 'pending' then 'pending' when 'processing' then 'processing' when 'refunding' then 'processing'
                                        when 'refunded' then 'refunded' when 'failed' then 'failed' end;
  end if;
  if v_stage is not null and v_stage is distinct from v_old_stage then
    perform barangayan_private.account_notify(
      case v_stage when 'pending' then 'A44P' when 'processing' then 'A44S' when 'refunded' then 'A44D' else 'A44F' end,
      v_resident,barangayan_private.occurrence_key(v_resident,'refund:'||new.id||':'||v_stage),'request',new.service_request_id,v_dest,false);
  end if;
  return null;
exception when others then
  raise warning 'notify_payment_change failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_payment_change on public.payments;
create trigger z_notify_payment_change after update of status,refund_status on public.payments
  for each row when (old.status is distinct from new.status or old.refund_status is distinct from new.refund_status)
  execute function barangayan_private.notify_payment_change();

-- ===== Incident reports: submission (A46), existing events with occurrence keys, withdrawal (A50) =====
create or replace function barangayan_private.notify_incident_submitted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform barangayan_private.account_notify('A46',new.reporter_id,'incident:'||new.id||':submitted','incident',new.id,
    jsonb_build_object('v',1,'kind','incident','id',new.id),true);
  return null;
exception when others then
  raise warning 'notify_incident_submitted failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_incident_submitted on public.incidents;
create trigger z_notify_incident_submitted after insert on public.incidents
  for each row when (new.deleted_at is null and new.reporter_id is not null) execute function barangayan_private.notify_incident_submitted();

create or replace function barangayan_private.notify_incident_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or new.reporter_id is null then return null; end if;
  if new.status='withdrawn' then
    perform barangayan_private.account_notify('A50',new.reporter_id,
      barangayan_private.occurrence_key(new.reporter_id,'incident:'||new.id||':withdrawn'),'incident',new.id,
      jsonb_build_object('v',1,'kind','incident','id',new.id),false);
    return null;
  end if;
  if new.reporter_id is not distinct from (select auth.uid()) or new.status not in ('in_progress','resolved','unresolved') then return null; end if;
  perform barangayan_private.emit_notification(array[new.reporter_id],new.barangay_id,'incident_status','incident',new.id,
    barangayan_private.occurrence_key(new.reporter_id,'incident:'||new.id||':status:'||new.status),'Report update','Your report has a new status.');
  return null;
exception when others then
  raise warning 'notify_incident_change failed: %',sqlstate;
  return null;
end $$;

revoke all on function barangayan_private.notify_profile_account(),barangayan_private.notify_household_change(),
  barangayan_private.notify_id_submission(),barangayan_private.notify_password_change(),barangayan_private.notify_request_submitted(),
  barangayan_private.notify_request_change(),barangayan_private.notify_request_details(),barangayan_private.notify_request_pause(),
  barangayan_private.notify_payment_change(),barangayan_private.notify_incident_submitted(),barangayan_private.notify_incident_change()
  from public,anon,authenticated,service_role;

-- ===== Bounded reconciliation of events keyed by their source row =====
-- Repairs an event a producer failed to write. Only sources whose key is the source row itself are
-- covered (ID versions and decisions, ID repair, request/incident submission, incident withdrawal,
-- pauses). History only: a late phone alert would be stale. At most p_limit (≤100) per call; each
-- repaired event removes its own candidate, so repeated calls end when nothing is missing.
create or replace function public.notification_reconcile_account_events(p_since timestamptz default null, p_limit integer default 100)
returns integer
language plpgsql security definer set search_path='' as $$
declare v_since timestamptz:=coalesce(p_since,now()-interval '7 days'); v_limit integer:=greatest(1,least(coalesce(p_limit,100),100));
  r record; v_done integer:=0;
begin
  if not coalesce((select s.emission_enabled from barangayan_private.notification_hub_settings s where s.id),false) then return 0; end if;
  for r in
    select c.* from (
      select s.resident_id as recipient,
             case when barangayan_private.id_submission_is_replacement(s.resident_id,s.version) then 'A11' else 'A07' end as code,
             'id:'||s.id||':submitted' as key,'account'::text as stype,s.resident_id as sid,null::jsonb as dest,s.submitted_at as occurred
        from public.id_submissions s where s.evidence_origin='resident_upload' and s.submitted_at>=v_since
      union all
      select s.resident_id,case s.decision when 'verified' then 'A08' when 'verification_failed' then 'A09' else 'A10' end,
             'id:'||s.id||':'||s.decision,'account',s.resident_id,null,s.reviewed_at
        from public.id_submissions s where s.evidence_origin='resident_upload' and s.decision<>'pending' and s.reviewed_at>=v_since
      union all
      select p.id,'A12','id_repair:'||p.id||':'||coalesce(p.current_id_submission_id::text,'none'),'account',p.id,null,p.updated_at
        from public.profiles p where p.id_repair_required
      union all
      select q.resident_id,'A31','request:'||q.id||':submitted','request',q.id,jsonb_build_object('v',1,'kind','request','id',q.id),q.created_at
        from public.service_requests q where q.deleted_at is null and q.created_at>=v_since
      union all
      select q.resident_id,'A32','request_pause:'||g.id||':started','request',q.id,jsonb_build_object('v',1,'kind','request','id',q.id),g.started_at
        from public.service_request_pauses g join public.service_requests q on q.id=g.request_id where q.deleted_at is null and g.started_at>=v_since
      union all
      select q.resident_id,'A37','request_pause:'||g.id||':resumed','request',q.id,jsonb_build_object('v',1,'kind','request','id',q.id),g.resumed_at
        from public.service_request_pauses g join public.service_requests q on q.id=g.request_id where q.deleted_at is null and g.resumed_at>=v_since
      union all
      select i.reporter_id,'A46','incident:'||i.id||':submitted','incident',i.id,jsonb_build_object('v',1,'kind','incident','id',i.id),i.created_at
        from public.incidents i where i.deleted_at is null and i.reporter_id is not null and i.created_at>=v_since
      union all
      select i.reporter_id,'A50','incident:'||i.id||':withdrawn','incident',i.id,jsonb_build_object('v',1,'kind','incident','id',i.id),i.updated_at
        from public.incidents i where i.deleted_at is null and i.reporter_id is not null and i.status='withdrawn' and i.updated_at>=v_since
    ) c
    where barangayan_private.account_recipient_barangay(c.recipient) is not null
      and not exists(select 1 from barangayan_private.notification_events e where e.recipient_id=c.recipient and e.dedupe_key=c.key)
    order by c.occurred,c.key
    limit v_limit
  loop
    v_done:=v_done+barangayan_private.account_notify(r.code,r.recipient,r.key,r.stype,r.sid,r.dest,true);
  end loop;
  return v_done;
end $$;

revoke all on function public.notification_reconcile_account_events(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.notification_reconcile_account_events(timestamptz,integer) to service_role;

-- ===== Due notices: publication, fan-out and catch-up for residents who became eligible later =====
-- Replaces the 0145 function (same signature, same behaviour) and adds the catch-up pass: a resident
-- who registered, moved into the audience or was restored after a notice's fan-out receives its
-- current revision as history only (no replayed phone alert). Shares the ≤100 budget per call.
create or replace function public.notification_publish_due_notices(p_limit integer default 100)
returns table(published integer, delivered integer, pending_notices integer)
language plpgsql security definer set search_path='' as $$
declare v_budget integer:=greatest(1,least(coalesce(p_limit,100),100)); v_published integer:=0; v_delivered integer:=0;
  v_notice public.system_notices; v_batch uuid[]; v_last uuid; v_group record; v_kind text; v_key text;
begin
  if not coalesce((select s.emission_enabled from barangayan_private.notification_hub_settings s where s.id),false) then
    return query select 0,0,(select count(*)::integer from public.system_notices n
      where n.state='scheduled' or (n.published_at is not null and n.fanout_revision<n.revision));
    return;
  end if;
  update public.system_notices set state='published',published_at=now(),updated_at=now()
   where id in (select n.id from public.system_notices n where n.state='scheduled' and n.publish_at<=now()
                 order by n.publish_at limit 100 for update skip locked);
  get diagnostics v_published = row_count;

  for v_notice in
    select * from public.system_notices n where n.published_at is not null and n.fanout_revision<n.revision
     order by n.updated_at for update skip locked
  loop
    exit when v_budget<=0;
    if v_notice.expires_at is not null and v_notice.expires_at<=now() then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
      continue;
    end if;
    select array_agg(x.id order by x.id) into v_batch from (
      select p.id from public.profiles p
       where p.role='resident' and p.deleted_at is null and p.barangay_id is not null
         and (v_notice.barangay_id is null or p.barangay_id=v_notice.barangay_id)
         and (v_notice.fanout_cursor is null or p.id>v_notice.fanout_cursor)
       order by p.id limit v_budget) x;
    if v_batch is null then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
      continue;
    end if;
    v_kind:=case v_notice.subtype when 'service_status' then 'system_service' when 'app_update' then 'system_update' else 'system_policy' end;
    v_key:='notice:'||v_notice.id||':r'||v_notice.revision;
    for v_group in select p.barangay_id,array_agg(p.id) as ids from public.profiles p where p.id=any(v_batch) group by p.barangay_id loop
      v_delivered:=v_delivered+barangayan_private.emit_notification_v2(v_group.ids,v_group.barangay_id,v_kind,'notice',v_notice.id,v_key,
        v_notice.title,v_notice.body,jsonb_build_object('v',2,'kind','notice','id',v_notice.id),v_notice.alert);
    end loop;
    v_last:=v_batch[array_length(v_batch,1)];
    v_budget:=v_budget-array_length(v_batch,1);
    if v_budget>0 then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
    else
      update public.system_notices set fanout_cursor=v_last where id=v_notice.id;
    end if;
  end loop;

  -- Catch-up. Only published, unexpired notices whose fan-out is complete and that are younger than
  -- the 180 day event retention (so "no event yet" really means "never received"). Each resident
  -- handled drops out of the next call's candidates, so the pass ends by itself.
  for v_notice in
    select * from public.system_notices n
     where n.state='published' and n.fanout_revision=n.revision and n.published_at>now()-interval '90 days'
       and (n.expires_at is null or n.expires_at>now())
     order by n.updated_at for update skip locked
  loop
    exit when v_budget<=0;
    select array_agg(x.id order by x.id) into v_batch from (
      select p.id from public.profiles p
       where p.role='resident' and p.deleted_at is null and p.barangay_id is not null
         and (v_notice.barangay_id is null or p.barangay_id=v_notice.barangay_id)
         and p.updated_at>=v_notice.published_at
         and not exists(select 1 from barangayan_private.notification_events e
                         where e.recipient_id=p.id and e.subject_type='notice' and e.subject_id=v_notice.id)
       order by p.id limit v_budget) x;
    if v_batch is null then continue; end if;
    v_kind:=case v_notice.subtype when 'service_status' then 'system_service' when 'app_update' then 'system_update' else 'system_policy' end;
    v_key:='notice:'||v_notice.id||':r'||v_notice.revision;
    for v_group in select p.barangay_id,array_agg(p.id) as ids from public.profiles p where p.id=any(v_batch) group by p.barangay_id loop
      v_delivered:=v_delivered+barangayan_private.emit_notification_v2(v_group.ids,v_group.barangay_id,v_kind,'notice',v_notice.id,v_key,
        v_notice.title,v_notice.body,jsonb_build_object('v',2,'kind','notice','id',v_notice.id),false);
    end loop;
    v_budget:=v_budget-array_length(v_batch,1);
  end loop;
  return query select v_published,v_delivered,(select count(*)::integer from public.system_notices n
    where n.state='scheduled' or (n.published_at is not null and n.fanout_revision<n.revision));
end $$;

revoke all on function public.notification_publish_due_notices(integer) from public,anon,authenticated;
grant execute on function public.notification_publish_due_notices(integer) to service_role;

notify pgrst,'reload schema';
