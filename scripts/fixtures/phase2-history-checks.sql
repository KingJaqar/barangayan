do $$ begin
  if not exists(select 1 from public.profiles p join public.id_submissions s on s.id=p.approved_id_submission_id
    where p.id='b2000000-0000-0000-0000-000000000001' and s.decision='verified' and s.evidence_origin='legacy_approval'
    and s.reviewed_by is null and s.reviewed_at is null and not p.id_repair_required
    and p.home_address='Legacy free text retained exactly' and p.house_no is null and p.street is null
    and p.city='San Mateo' and p.province='Rizal') then raise exception 'Legacy approval/address reconciliation failed'; end if;
  if not exists(select 1 from public.profiles where id='b2000000-0000-0000-0000-000000000002'
    and id_repair_required and approved_id_submission_id is null and id_verification_status='verified'
    and home_address='Another unsplittable address') then raise exception 'Inconsistent legacy approval not flagged'; end if;
  if not exists(select 1 from public.profiles p join public.id_submissions s on s.id=p.current_id_submission_id
    where p.id='b2000000-0000-0000-0000-000000000003' and s.decision='pending'
    and s.evidence_origin='legacy_pending' and p.approved_id_submission_id is null) then raise exception 'Legacy pending evidence not imported'; end if;
end $$;
