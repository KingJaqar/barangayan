begin;

-- Reuse existing charter/purpose/rule/pricing/target columns; no historical rewrite.
alter table public.document_types drop constraint document_types_service_kind_check;
alter table public.document_types add constraint document_types_service_kind_check
  check (service_kind in ('business','indigency','first_time_job_seeker','certified_true_copy','general'));
drop index public.document_types_active_service_kind;
create unique index document_types_active_service_kind on public.document_types(barangay_id,service_kind)
where contract_version=2 and is_active and deleted_at is null and service_kind <> 'general';

create or replace function barangayan_private.guard_request_foundations() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_doc public.document_types; v_res public.profiles; v_operation text := current_setting('barangayan.foundation_operation',true);
begin
  if tg_op='INSERT' and current_user in ('authenticated','anon') and new.legacy_fee_centavos is not null then raise exception 'server_fee_snapshot_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and new.legacy_fee_centavos is distinct from old.legacy_fee_centavos then
    if old.contract_version=1 and old.legacy_fee_centavos is null and current_user not in ('authenticated','anon')
      and v_operation='catalog_snapshot' and new.legacy_fee_centavos=(
        select fee_centavos from public.document_types where id=old.document_type_id)
      and (to_jsonb(new)-array['legacy_fee_centavos','updated_at'])=(to_jsonb(old)-array['legacy_fee_centavos','updated_at']) then
      new.updated_at := old.updated_at;
    else
      raise exception 'immutable_legacy_fee_snapshot' using errcode='42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.contract_version <> old.contract_version then
    raise exception 'immutable_request_contract' using errcode='42501';
  end if;
  if tg_op = 'INSERT' or new.resident_id is distinct from old.resident_id or new.document_type_id is distinct from old.document_type_id or new.barangay_id is distinct from old.barangay_id then
    select * into v_res from public.profiles where id = new.resident_id and role = 'resident' and deleted_at is null;
    select * into v_doc from public.document_types where id = new.document_type_id and is_active and deleted_at is null;
    if v_res.id is null or v_doc.id is null or new.barangay_id is distinct from v_res.barangay_id or new.barangay_id is distinct from v_doc.barangay_id then
      raise exception 'invalid_request_ownership_or_service' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and (new.status <> 'submitted' or new.payment_status <> 'pending' or new.deleted_at is not null) then
      raise exception 'invalid_initial_request_state' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' and (new.contract_version <> v_doc.contract_version or (v_doc.contract_version = 2 and
      (v_operation is distinct from 'submit' or current_user in ('authenticated','anon')))) then
      raise exception 'use_submit_service_request' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.contract_version = 2 then
    if current_user in ('authenticated','anon') and new.payment_status is distinct from old.payment_status then raise exception 'use_payment_ledger_operations' using errcode='42501'; end if;
    if new.payment_method is distinct from old.payment_method and exists(select 1 from public.payments where service_request_id=old.id and status in ('pending','paid')) then raise exception 'payment_method_locked' using errcode='22023'; end if;
    if (to_jsonb(new) - array['updated_at','payment_method','payment_status','deleted_at']) is distinct from
       (to_jsonb(old) - array['updated_at','payment_method','payment_status','deleted_at'])
       and (coalesce(v_operation,'') not in ('assessment','sla','review') or current_user in ('authenticated','anon')) then
      raise exception 'use_controlled_request_operations' using errcode = '42501';
    end if;
    if new.resident_id is distinct from old.resident_id or new.barangay_id is distinct from old.barangay_id
      or new.document_type_id is distinct from old.document_type_id or new.contract_version <> old.contract_version
      or new.submission_payload is distinct from old.submission_payload or new.approved_id_submission_id is distinct from old.approved_id_submission_id
      or new.target_minutes_snapshot is distinct from old.target_minutes_snapshot or new.timing_model <> old.timing_model
      or new.pricing_mode_snapshot is distinct from old.pricing_mode_snapshot then
      raise exception 'immutable_request_snapshot' using errcode = '42501';
    end if;
    if new.payment_status = 'paid' and old.payment_status <> 'paid' and not exists (
      select 1 from public.payments p where p.service_request_id = new.id and p.status = 'paid'
    ) then raise exception 'payment_ledger_required' using errcode = '42501'; end if;
    if new.payment_status = 'waived' and new.fee_assessment_state <> 'waived' then raise exception 'fee_waiver_required' using errcode = '42501'; end if;
  end if;
  return new;
end $$;

create or replace function barangayan_private.guard_catalog_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb; k text; previous_operation text;
begin
  if tg_op='UPDATE' and old.contract_version=2 and new.contract_version<>2 then raise exception 'immutable_catalog_contract' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.contract_version=2 and new.service_kind is distinct from old.service_kind then
    raise exception 'immutable_service_workflow' using errcode='42501';
  end if;
  if new.contract_version = 1 then return new; end if;
  if length(btrim(new.name)) not between 1 and 200 or length(coalesce(new.description,'')) > 2000 then
    raise exception 'invalid_document_identity' using errcode='22023';
  end if;
  if tg_op='UPDATE' then
    previous_operation := current_setting('barangayan.foundation_operation',true);
    perform set_config('barangayan.foundation_operation','catalog_snapshot',true);
    update public.service_requests set legacy_fee_centavos=old.fee_centavos
    where document_type_id=old.id and contract_version=1 and legacy_fee_centavos is null;
    perform set_config('barangayan.foundation_operation',coalesce(previous_operation,''),true);
  end if;
  perform barangayan_private.check_keys(new.charter,array['officeDivision','classification','transactionType','whoMayAvail','checklistOfRequirements',
    'whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime','personResponsible']);
  foreach k in array array['officeDivision','whoMayAvail','checklistOfRequirements','whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime'] loop
    perform barangayan_private.required_text(new.charter,k,10000);
  end loop;
  perform barangayan_private.required_text(new.charter,'classification',200);
  perform barangayan_private.required_text(new.charter,'transactionType',200);
  if not new.charter ? 'personResponsible' then raise exception 'invalid_charter' using errcode='22023'; end if;
  if new.charter->'personResponsible' <> 'null'::jsonb then perform barangayan_private.required_text(new.charter,'personResponsible',10000); end if;
  perform barangayan_private.check_keys(new.requirement_rules,array['dtiRequired','hoaRequired','lessorForRenter','personalAppearance']);
  foreach k in array array['dtiRequired','hoaRequired','lessorForRenter','personalAppearance'] loop
    if jsonb_typeof(new.requirement_rules->k) is distinct from 'boolean' then raise exception 'invalid_requirement_rules' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(new.purposes) is distinct from 'array' or jsonb_array_length(new.purposes) not between 1 and 30 then raise exception 'invalid_purposes' using errcode='22023'; end if;
  for p in select value from jsonb_array_elements(new.purposes) loop
    perform barangayan_private.check_keys(p,array['code','label','requiresExplanation']);
    if barangayan_private.required_text(p,'code',100) !~ '^[a-z0-9_]+$' or jsonb_typeof(p->'requiresExplanation') is distinct from 'boolean' then raise exception 'invalid_purpose_option' using errcode='22023'; end if;
    perform barangayan_private.required_text(p,'label',200);
  end loop;
  if (select count(*) from jsonb_array_elements(new.purposes)) <> (select count(distinct value->>'code') from jsonb_array_elements(new.purposes)) then raise exception 'duplicate_purpose_codes' using errcode='22023'; end if;
  if (new.pricing_mode='per_page' and (new.service_kind<>'certified_true_copy' or new.fee_centavos<>1000)) or
    ((new.requirement_rules->>'dtiRequired')::boolean and new.service_kind<>'business') or
    (((new.requirement_rules->>'hoaRequired')::boolean or (new.requirement_rules->>'lessorForRenter')::boolean) and new.service_kind not in ('indigency','first_time_job_seeker')) then
    raise exception 'incompatible_catalog_rules_or_page_rate' using errcode='22023';
  end if;
  return new;
end $$;

-- Runs after the ordinary updated_at trigger; a fee snapshot is bookkeeping,
-- not a historical request/status change. Other updates retain normal behavior.
create function barangayan_private.preserve_catalog_snapshot_timestamp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('authenticated','anon') and current_setting('barangayan.foundation_operation',true)='catalog_snapshot'
    and old.contract_version=1 and old.legacy_fee_centavos is null
    and (to_jsonb(new)-array['legacy_fee_centavos','updated_at'])=(to_jsonb(old)-array['legacy_fee_centavos','updated_at']) then
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
revoke all on function barangayan_private.preserve_catalog_snapshot_timestamp() from public,anon,authenticated;
create trigger zz_preserve_catalog_snapshot_timestamp before update on public.service_requests
for each row execute function barangayan_private.preserve_catalog_snapshot_timestamp();

comment on column public.document_types.charter is 'Citizen''s Charter guidance with editable classification and transaction type; procedure durations remain separate from SLA target.';
comment on column public.document_types.processing_target_minutes is 'Agency processing SLA target for future request snapshots; catalog edits never rewrite existing request targets.';
commit;
