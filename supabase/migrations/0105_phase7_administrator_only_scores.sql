begin;
-- Serialize reconciliation with registrations; preserve exact historical numeric values.
lock table public.drive_registrations in access exclusive mode;
create table public.drive_registration_scores (
 registration_id uuid primary key references public.drive_registrations(id) on delete cascade,
 priority_score numeric not null
);
alter table public.drive_registration_scores enable row level security;
revoke all on public.drive_registration_scores from public, anon, authenticated;
grant select on public.drive_registration_scores to authenticated;
grant all on public.drive_registration_scores to service_role;
create policy "administrators read same tenant scores" on public.drive_registration_scores
for select to authenticated using (
 exists(select 1 from public.profiles p
  join public.medical_drives d on d.barangay_id=p.barangay_id
  join public.drive_registrations r on r.drive_id=d.id
  where p.id=(select auth.uid()) and p.role='admin' and p.deleted_at is null
    and r.id=registration_id)
);
insert into public.drive_registration_scores select id,priority_score from public.drive_registrations;
do $$ begin
 if exists(select 1 from public.drive_registrations r left join public.drive_registration_scores s
 on s.registration_id=r.id where s.priority_score is distinct from r.priority_score)
 then raise exception 'Score reconciliation failed'; end if;
end $$;
-- Preserve a null compatibility column until compatible consumers are shipped.
-- Never leave actual scores resident-readable during that transition. Preserve
-- historical timestamps while clearing only the obsolete mirror.
alter table public.drive_registrations alter column priority_score drop not null;
alter table public.drive_registrations alter column priority_score drop default;
alter table public.drive_registrations disable trigger set_drive_registrations_updated_at;
update public.drive_registrations set priority_score=null;
alter table public.drive_registrations add constraint drive_registration_score_mirror_empty
 check (priority_score is null);
alter table public.drive_registrations enable trigger set_drive_registrations_updated_at;
-- The protected table is intentionally absent from all Realtime publications.
comment on table public.drive_registrations is 'One row per resident and drive; scores live in administrator-protected storage.';

-- Existing staff audit metadata may contain historical scores. Its read policy
-- must also reject removed administrators, including Realtime authorization.
alter policy "admins can read own barangay audit log" on public.admin_audit_log
using (public.current_role()='admin' and barangay_id=public.current_barangay_id()
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
  and p.role='admin' and p.deleted_at is null));

create function barangayan_private.record_drive_priority_score() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.drive_registration_scores(registration_id,priority_score) values(new.id,
  (case when new.is_pwd then 30 else 0 end)
  +(case when new.age>=60 then 20 else 0 end)
  +(case when new.age<5 then 15 else 0 end)
  +least(coalesce(array_length(new.comorbidities,1),0)*5,20)
  +(case when new.prior_dose_date is not null then 10 else 0 end));
 return new;
end $$;
revoke all on function barangayan_private.record_drive_priority_score() from public,anon,authenticated;
create trigger record_drive_priority_score after insert on public.drive_registrations
for each row execute function barangayan_private.record_drive_priority_score();

-- Score snapshots and applicant identity must survive edits and cancellation.
create function barangayan_private.guard_drive_registration_edit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.id<>old.id or new.drive_id<>old.drive_id or new.user_id<>old.user_id
 or new.applicant_number<>old.applicant_number or new.created_at<>old.created_at then
  raise exception 'Registration identity is immutable' using errcode='42501';
 end if;
 if (select auth.uid()) is not null and not exists(select 1 from public.profiles p
  join public.medical_drives d on d.barangay_id=p.barangay_id
  where p.id=(select auth.uid()) and p.role='admin' and p.deleted_at is null and d.id=old.drive_id)
 and (new.age<>old.age or new.is_pwd<>old.is_pwd or new.comorbidities<>old.comorbidities
 or new.prior_dose_date is distinct from old.prior_dose_date) then
  raise exception 'Residents may only cancel their pending registration' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function barangayan_private.guard_drive_registration_edit() from public,anon,authenticated;
create trigger guard_drive_registration_edit before update on public.drive_registrations
for each row execute function barangayan_private.guard_drive_registration_edit();
create or replace function public.register_for_drive(
  p_drive_id       uuid,
  p_age            integer,
  p_is_pwd         boolean,
  p_comorbidities  text[],
  p_prior_dose_date date default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id          uuid    := auth.uid();
  v_drive            public.medical_drives;
  v_prefix           text;
  v_applicant_number text;
  v_reg              public.drive_registrations;
begin
  -- Auth guard
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- Lock drive row so concurrent registrations can''t oversell
  select * into v_drive
  from public.medical_drives
  where id = p_drive_id
    and is_active   = true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Drive not found or inactive' using errcode = 'P0002';
  end if;

  if v_drive.stock_remaining <= 0 then
    raise exception 'No remaining slots for this drive' using errcode = 'P0003';
  end if;

  -- Duplicate-registration guard
  if exists(
    select 1 from public.drive_registrations
    where drive_id = p_drive_id and user_id = v_user_id
  ) then
    raise exception 'Already registered for this drive' using errcode = 'P0004';
  end if;

  -- Applicant-number prefix by drive type
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

  -- Insert registration
  insert into public.drive_registrations (
    drive_id, user_id, applicant_number,
    age, is_pwd, comorbidities, prior_dose_date,
    status
  ) values (
    p_drive_id, v_user_id, v_applicant_number,
    p_age, p_is_pwd,
    coalesce(p_comorbidities, '{}'), p_prior_dose_date,
    'pending'
  )
  returning * into v_reg;

  -- Decrement available stock
  update public.medical_drives
  set stock_remaining = stock_remaining - 1
  where id = p_drive_id;

  return json_build_object(
    'registration_id',  v_reg.id,
    'applicant_number', v_applicant_number,
    'status',           v_reg.status
  );
end;
$$;
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
set search_path = ''
as $$
declare
  v_admin_id         uuid    := auth.uid();
  v_admin_barangay_id uuid;
  v_target_barangay_id uuid;
  v_drive            public.medical_drives;
  v_prefix           text;
  v_applicant_number text;
  v_reg              public.drive_registrations;
begin
  -- Auth + role guard
  if v_admin_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not exists(select 1 from public.profiles p where p.id=v_admin_id
    and p.role='admin' and p.deleted_at is null) then
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

  -- Insert registration under the target resident, not the admin
  insert into public.drive_registrations (
    drive_id, user_id, applicant_number,
    age, is_pwd, comorbidities, prior_dose_date,
    status
  ) values (
    p_drive_id, p_target_user_id, v_applicant_number,
    p_age, p_is_pwd,
    coalesce(p_comorbidities, '{}'), p_prior_dose_date,
    'pending'
  )
  returning * into v_reg;

  -- Decrement available stock
  update public.medical_drives
  set stock_remaining = stock_remaining - 1
  where id = p_drive_id;

  return json_build_object(
    'registration_id',  v_reg.id,
    'applicant_number', v_applicant_number,
    'priority_score', (select priority_score from public.drive_registration_scores where registration_id=v_reg.id),
    'status',           v_reg.status
  );
end;
$$;
revoke all on function public.register_for_drive(uuid,integer,boolean,text[],date) from public,anon;
grant execute on function public.register_for_drive(uuid,integer,boolean,text[],date) to authenticated;
revoke all on function public.admin_register_for_drive(uuid,uuid,integer,boolean,text[],date) from public,anon;
grant execute on function public.admin_register_for_drive(uuid,uuid,integer,boolean,text[],date) to authenticated;
notify pgrst,'reload schema';
commit;
