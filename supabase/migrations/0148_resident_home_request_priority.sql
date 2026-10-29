-- Additive, read-only Home contract. Deploy before the Phase 3 Home consumer.
-- The caller supplies only a presentation capability, never a resident or a limit.
-- Existing RLS and owner visibility (including retired catalog/legacy rows) apply.
create function public.resident_home_requests(p_qrph_settlement_ready boolean default false)
returns table (
  id uuid, reference_number text, status text, payment_status text, payment_method text,
  created_at timestamptz, updated_at timestamptz, status_history jsonb, cancelled_at timestamptz,
  contract_version integer, fee_assessment_state text, assessed_amount_centavos integer,
  legacy_fee_centavos integer, sla_state text, document_name text, service_kind text,
  resolved_fee_centavos integer, next_action text
)
language sql stable security invoker
set search_path = ''
as $$
  with eligible as (
    select r.id, r.reference_number, r.status, r.payment_status, r.payment_method,
      r.created_at, r.updated_at, r.status_history, r.cancelled_at, r.contract_version,
      r.fee_assessment_state, r.assessed_amount_centavos, r.legacy_fee_centavos, r.sla_state,
      d.name as document_name, d.service_kind,
      -- requestFee parity: ledger, then v2 assessment, otherwise legacy snapshot/catalog.
      -- Missing catalog metadata is unknown, never an invented zero fee.
      coalesce(p.document_fee_centavos, p.amount_centavos,
        case when r.contract_version = 2 then r.assessed_amount_centavos
          else coalesce(r.legacy_fee_centavos, d.fee_centavos) end) as resolved_fee_centavos
    from public.service_requests r
    left join public.document_types d on d.id = r.document_type_id
    left join lateral (
      select payment.document_fee_centavos, payment.amount_centavos
      from public.payments payment
      where payment.service_request_id = r.id
      order by (payment.status = 'paid') desc, payment.created_at desc nulls last, payment.id desc
      limit 1
    ) p on true
    where r.resident_id = (select auth.uid())
  ), actionable as (
    select eligible.*,
      -- Keep in parity with homeRequestAttention. No mutation/payment permission is granted.
      case
        when status not in ('submitted', 'in_progress', 'ready_for_pickup') then null
        when status = 'ready_for_pickup' then 'collect'
        when fee_assessment_state = 'page_count_required' and payment_status = 'pending' then 'enter_pages'
        when sla_state = 'paused' then 'review_requirements'
        when payment_status in ('paid', 'waived', 'refunded') or resolved_fee_centavos is null or resolved_fee_centavos <= 0 then null
        when payment_method is null then 'choose_payment'
        when payment_method = 'qrph' and p_qrph_settlement_ready is true and resolved_fee_centavos >= 100 then 'pay'
        else null
      end as next_action
    from eligible
  )
  select * from actionable
  order by case
    when next_action is not null then 0
    when status in ('submitted', 'in_progress', 'ready_for_pickup') then 1
    when status = 'completed' then 2
    when status = 'cancelled' then 3
    else 4 end,
    updated_at desc nulls last, id desc
  limit 3;
$$;

revoke all on function public.resident_home_requests(boolean) from public, anon, authenticated;
grant execute on function public.resident_home_requests(boolean) to authenticated;
comment on function public.resident_home_requests(boolean) is
  'At most three owner-visible Home requests: attention, active, completed, cancelled, unknown; updated_at/id descending. Paid ledger first, then newest created_at/id. QR capability affects rank only.';
