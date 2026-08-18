-- Fix BUG-07: admin "register resident for drive" silently registers the
-- signed-in admin's own account instead of the selected resident.
--
-- apps/admin-web/.../applicants-table.tsx's resident picker was decorative —
-- register_for_drive() uses auth.uid() internally, so p_target had no effect.
-- This adds a separate, admin-only RPC that accepts an explicit target
-- resident and re-derives the same atomic slot-reservation + weighted
-- priority-scoring logic as register_for_drive (kept as its own function,
-- not a branch inside register_for_drive, so the resident self-registration
-- path used by the mobile app is untouched).
--
-- Safety, per the audit report's sequencing rule for privileged RPCs: this
-- is a new SECURITY DEFINER path where one user (admin) acts on another's
-- behalf, so it must re-verify (a) caller is admin and (b) the target
-- resident belongs to the caller's own barangay_id — mirroring every other
-- admin RPC's tenancy check — before it's allowed to touch drive stock or
-- insert a registration row.

create or replace function public.admin_register_for_drive(
  p_target_user_id uuid,
  p_drive_id        uuid,
  p_age             integer,
  p_is_pwd          boolean,
  p_comorbidities   text[],
  p_prior_dose_date date default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id         uuid    := auth.uid();
  v_admin_barangay_id uuid;
  v_target_barangay_id uuid;
  v_drive            public.medical_drives;
  v_prefix           text;
  v_applicant_number text;
  v_score            numeric := 0;
  v_reg              public.drive_registrations;
begin
  -- Auth + role guard
  if v_admin_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if public.current_role() != 'admin' then
    raise exception 'Only admins can register a resident on their behalf' using errcode = 'P0005';
  end if;

  v_admin_barangay_id := public.current_barangay_id();

  -- Target must be a resident of the admin's own barangay — an admin from
  -- one barangay must not be able to register a resident of another.
  select barangay_id into v_target_barangay_id
  from public.profiles
  where id = p_target_user_id and role = 'resident';

  if v_target_barangay_id is null then
    raise exception 'Target resident not found' using errcode = 'P0006';
  end if;

  if v_target_barangay_id != v_admin_barangay_id then
    raise exception 'Target resident is not in your barangay' using errcode = 'P0007';
  end if;

  -- Lock drive row so concurrent registrations can't oversell
  select * into v_drive
  from public.medical_drives
  where id = p_drive_id
    and is_active   = true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Drive not found or inactive' using errcode = 'P0002';
  end if;

  if v_drive.barangay_id != v_admin_barangay_id then
    raise exception 'Drive is not in your barangay' using errcode = 'P0008';
  end if;

  if v_drive.stock_remaining <= 0 then
    raise exception 'No remaining slots for this drive' using errcode = 'P0003';
  end if;

  -- Duplicate-registration guard
  if exists(
    select 1 from public.drive_registrations
    where drive_id = p_drive_id and user_id = p_target_user_id
  ) then
    raise exception 'Already registered for this drive' using errcode = 'P0004';
  end if;

  -- Applicant-number prefix by drive type (mirrors register_for_drive)
  v_prefix := case v_drive.type
    when 'vaccination'    then 'VAC'
    when 'maternal_care'  then 'MAT'
    when 'blood_drive'    then 'BLD'
    when 'dental'         then 'DEN'
    when 'optical'        then 'OPT'
    when 'medicine'       then 'MED'
    when 'emergency_kit'  then 'EMK'
    when 'screening'      then 'SCR'
    when 'consultation'   then 'CON'
    when 'minor_surgical' then 'SRG'
    else                       'DRV'
  end;

  v_applicant_number :=
    v_prefix || '-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((v_drive.stock_total - v_drive.stock_remaining + 1)::text, 4, '0');

  -- Weighted priority score (mirrors register_for_drive)
  if p_is_pwd                    then v_score := v_score + 30; end if;
  if p_age >= 60                 then v_score := v_score + 20; end if;
  if p_age < 5                   then v_score := v_score + 15; end if;
  v_score := v_score + least(
    coalesce(array_length(p_comorbidities, 1), 0) * 5, 20
  );
  if p_prior_dose_date is not null then v_score := v_score + 10; end if;

  -- Insert registration under the target resident, not the admin
  insert into public.drive_registrations (
    drive_id, user_id, applicant_number,
    age, is_pwd, comorbidities, prior_dose_date,
    priority_score, status
  ) values (
    p_drive_id, p_target_user_id, v_applicant_number,
    p_age, p_is_pwd,
    coalesce(p_comorbidities, '{}'), p_prior_dose_date,
    v_score, 'pending'
  )
  returning * into v_reg;

  -- Decrement available stock
  update public.medical_drives
  set stock_remaining = stock_remaining - 1
  where id = p_drive_id;

  return json_build_object(
    'registration_id',  v_reg.id,
    'applicant_number', v_applicant_number,
    'priority_score',   v_score,
    'status',           v_reg.status
  );
end;
$$;

-- ============================================================================
-- pgTAP regression test: a resident must not be able to call the admin path.
-- Extends the project's existing rls_isolation.test.sql pattern rather than
-- deferring to the general "expand test coverage" backlog item.
-- ============================================================================
-- (See supabase/tests/rls_isolation.test.sql for the companion assertions
-- added alongside this migration.)
