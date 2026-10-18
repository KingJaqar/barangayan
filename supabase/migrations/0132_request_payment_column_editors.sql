-- Separate editable payment method/status fields without relaxing request
-- submission snapshots, tenant boundaries, or immutable ledger amounts.
begin;

alter table public.service_requests drop constraint service_requests_payment_status_check;
alter table public.service_requests add constraint service_requests_payment_status_check
 check (payment_status in ('pending','paid','failed','refunded','waived'));

-- Only the checked, privileged correction function below may change a method
-- that already has a payment. Setting this GUC as authenticated cannot bypass it.
do $$
declare definition text; anchor text := 'if new.payment_method is distinct from old.payment_method and exists(';
begin
 definition := pg_get_functiondef('barangayan_private.guard_request_foundations()'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Request payment method guard missing'; end if;
 execute replace(definition,anchor,
  'if new.payment_method is distinct from old.payment_method
   and not (current_user not in (''authenticated'',''anon'') and coalesce(v_operation,'''')=''admin_payment_correction'') and exists(');
end $$;

-- Reflect failed/pending attempts as well as settlements. A late event for an
-- older attempt must not overwrite a newer payment or an existing paid attempt.
create or replace function public.sync_service_request_payment_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare active_payment uuid; next_status text;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status
  and new.deleted_at is not distinct from old.deleted_at
  and new.service_request_id is not distinct from old.service_request_id then return new; end if;
 select id into active_payment from public.payments
 where service_request_id=new.service_request_id and barangay_id=new.barangay_id and deleted_at is null
 order by case status when 'paid' then 0 when 'pending' then 1 else 2 end,created_at desc,id desc limit 1;
 if active_payment is distinct from new.id then return new; end if;
 next_status := case new.status when 'paid' then 'paid' when 'refunded' then 'refunded' when 'failed' then 'failed' else 'pending' end;
 update public.service_requests set payment_status=next_status
 where id=new.service_request_id and barangay_id=new.barangay_id and payment_status is distinct from next_status;
 return new;
end $$;
revoke all on function public.sync_service_request_payment_status() from public,anon,authenticated;

-- Bring existing failed attempts into the request summary too. Preserve fee
-- waivers and use the same attempt precedence as subsequent ledger events.
with latest as (
 select distinct on (service_request_id) service_request_id,barangay_id,
  case status when 'paid' then 'paid' when 'refunded' then 'refunded' when 'failed' then 'failed' else 'pending' end as summary
 from public.payments where deleted_at is null
 order by service_request_id,case status when 'paid' then 0 when 'pending' then 1 else 2 end,created_at desc,id desc
)
update public.service_requests r set payment_status=p.summary from latest p
where r.id=p.service_request_id and r.barangay_id=p.barangay_id and r.payment_status<>'waived' and r.payment_status is distinct from p.summary;

create function barangayan_private.admin_edit_request_payment(p_id uuid,p_patch jsonb,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles; request public.service_requests; payment public.payments;
 next_method text; next_status text; amount integer; before_payment jsonb;
 previous_operation text := current_setting('barangayan.foundation_operation',true);
begin
 actor := barangayan_private.assert_actor(true);
 perform barangayan_private.check_keys(p_patch,array['payment_method','payment_status']);
 if p_patch='{}'::jsonb then raise exception 'Enter payment changes.' using errcode='22023'; end if;
 if p_patch?'payment_method' and (p_patch->>'payment_method' is null or p_patch->>'payment_method' not in ('pickup','qrph')) then
  raise exception 'Select Pay at Pickup or QR PH.' using errcode='22023'; end if;
 if p_patch?'payment_status' and (p_patch->>'payment_status' is null or p_patch->>'payment_status' not in ('pending','paid','failed','refunded')) then
  raise exception 'Select Paid, Pending, Failed or Refunded.' using errcode='22023'; end if;
 select * into request from public.service_requests where id=p_id and barangay_id=actor.barangay_id for update;
 if not found then raise exception 'Request unavailable.' using errcode='42501'; end if;
 if p_expected is null or request.updated_at is distinct from p_expected then
  raise exception 'Record changed. Reload details.' using errcode='40001'; end if;
 before_payment := jsonb_build_object('payment_method',request.payment_method,'payment_status',request.payment_status);
 perform 1 from public.payments where service_request_id=request.id order by id for update;
 if (select count(*) from public.payments where service_request_id=request.id and deleted_at is null and status in ('pending','paid'))>1 then
  raise exception 'Resolve multiple active payments in Transactions before editing this request.' using errcode='22023'; end if;
 select * into payment from public.payments
 where service_request_id=request.id and barangay_id=actor.barangay_id and deleted_at is null
 order by case status when 'paid' then 0 when 'pending' then 1 else 2 end,created_at desc,id desc limit 1;
 next_method := case when p_patch?'payment_method' then p_patch->>'payment_method' else coalesce(request.payment_method,payment.method) end;
 next_status := coalesce(p_patch->>'payment_status',request.payment_status);
 if next_method='qrph' and exists(select 1 from public.document_types where id=request.document_type_id and service_kind='business') then
  raise exception 'This document requires Pay at Pickup.' using errcode='22023'; end if;
 perform set_config('barangayan.foundation_operation','admin_payment_correction',true);

 if payment.id is null and p_patch?'payment_status' and next_status='paid' then
  if next_method is null then raise exception 'Select a payment method before recording payment.' using errcode='22023'; end if;
  if request.contract_version=2 then
   if request.fee_assessment_state<>'assessed' or coalesce(request.assessed_amount_centavos,0)<=0 then
    raise exception 'Confirm the payable amount using the request review controls first.' using errcode='22023'; end if;
   amount := request.assessed_amount_centavos;
  else
   select coalesce(request.legacy_fee_centavos,d.fee_centavos) into amount from public.document_types d where id=request.document_type_id;
   if amount is null or amount<=0 then raise exception 'A confirmed payable amount is required.' using errcode='22023'; end if;
  end if;
  insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status)
  values(request.id,actor.barangay_id,next_method,amount,amount,'pending') returning * into payment;
 elsif payment.id is null and p_patch?'payment_status' and next_status='refunded' then
  raise exception 'A recorded payment is required before marking it refunded.' using errcode='22023';
 end if;

 if payment.id is not null then
  update public.payments set
   method=coalesce(next_method,method),
   status=case when p_patch?'payment_status' then next_status else status end,
   paid_at=case when p_patch?'payment_status' and next_status='paid' then coalesce(paid_at,clock_timestamp())
    when p_patch?'payment_status' and next_status in ('pending','failed') then null else paid_at end,
   collected_by=case when next_method='qrph' then null when p_patch?'payment_status' and next_status='paid' then coalesce(collected_by,actor.id) else collected_by end,
   refund_status=case when p_patch?'payment_status' then case when next_status='refunded' then 'refunded' else 'none' end else refund_status end,
   refund_amount_centavos=case when p_patch?'payment_status' then case when next_status='refunded' then amount_centavos else null end else refund_amount_centavos end,
   refunded_at=case when p_patch?'payment_status' then case when next_status='refunded' then coalesce(refunded_at,clock_timestamp()) else null end else refunded_at end,
   refunded_by=case when p_patch?'payment_status' then case when next_status='refunded' then coalesce(refunded_by,actor.id) else null end else refunded_by end
  where id=payment.id;
 end if;
 update public.service_requests set payment_method=next_method,payment_status=next_status where id=request.id returning * into request;
 insert into public.admin_audit_log(barangay_id,admin_id,action,entity_type,entity_id,entity_label,changes,metadata)
 values(actor.barangay_id,actor.id,'update','service_request',request.id,request.reference_number,
  jsonb_build_object('before',before_payment,'after',jsonb_build_object('payment_method',request.payment_method,'payment_status',request.payment_status)),
  jsonb_build_object('operation','payment_record_correction','payment_id',payment.id,'admin_name',actor.full_name));
 perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
 return jsonb_build_object('id',request.id,'row',to_jsonb(request),'payment_audited',true);
end $$;
revoke all on function barangayan_private.admin_edit_request_payment(uuid,jsonb,timestamptz) from public,anon;
grant execute on function barangayan_private.admin_edit_request_payment(uuid,jsonb,timestamptz) to authenticated;

-- Both the sheet and table call the existing mutation boundary. Mixed legacy
-- edits remain one transaction; errors in any other field roll everything back.
do $$
declare definition text; anchor text;
begin
 definition := pg_get_functiondef('public.admin_mutate_record(text,uuid,text,jsonb,timestamptz)'::regprocedure);
 anchor := 'if p_screen=''requests'' and current_record->>''contract_version''=''2'' and p_patch-''payment_method''<>''{}''::jsonb then raise exception ''Use request review'' using errcode=''42501''; end if;';
 if strpos(definition,anchor)=0 then raise exception 'Request record edit guard missing'; end if;
 definition := replace(definition,'linked_request uuid;','linked_request uuid; payment_result jsonb;');
 definition := replace(definition,anchor,
  'if p_screen=''requests'' and current_record->>''contract_version''=''2'' and p_patch-array[''payment_method'',''payment_status'']<>''{}''::jsonb then raise exception ''Use request review'' using errcode=''42501''; end if;
   if p_screen=''requests'' and p_patch ?| array[''payment_method'',''payment_status''] then
    payment_result := barangayan_private.admin_edit_request_payment(p_id,
     (select jsonb_object_agg(key,value) from jsonb_each(p_patch) where key in (''payment_method'',''payment_status'')),p_expected);
    p_patch := p_patch-array[''payment_method'',''payment_status''];
    if p_patch=''{}''::jsonb then return payment_result; end if;
   end if;');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
