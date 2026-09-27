-- Resident iOS launch safety: enforce tenant and resident identity at the write
-- boundary used by medical registration and evacuation check-in. Client filtering
-- is not authorization, and both original paths accepted identifiers independently.

create or replace function public.guard_drive_registration_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_drive public.medical_drives;
begin
  select * into v_profile from public.profiles where id = new.user_id and deleted_at is null;
  if not found or v_profile.role <> 'resident' then
    raise exception 'Only an active resident can be registered for a medical drive' using errcode = 'P0010';
  end if;

  select * into v_drive from public.medical_drives where id = new.drive_id and deleted_at is null;
  if not found or not v_drive.is_active then
    raise exception 'Drive not found or inactive' using errcode = 'P0002';
  end if;

  if v_profile.barangay_id <> v_drive.barangay_id then
    raise exception 'Resident and medical drive must belong to the same barangay' using errcode = 'P0011';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_drive_registration_tenant on public.drive_registrations;
create trigger guard_drive_registration_tenant
  before insert or update of drive_id, user_id on public.drive_registrations
  for each row execute function public.guard_drive_registration_tenant();

create or replace function public.guard_evacuation_checkin_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_center public.evacuation_centers;
begin
  select * into v_profile from public.profiles where id = new.user_id and deleted_at is null;
  if not found or v_profile.role <> 'resident' then
    raise exception 'Only an active resident can check in' using errcode = 'P0010';
  end if;

  select * into v_center from public.evacuation_centers where id = new.evacuation_center_id and deleted_at is null;
  if not found or not v_center.is_active then
    raise exception 'Evacuation center not found or inactive' using errcode = 'P0012';
  end if;

  if new.user_id <> auth.uid()
     or new.barangay_id <> v_profile.barangay_id
     or new.barangay_id <> v_center.barangay_id then
    raise exception 'Resident, check-in, and evacuation center must belong to the same barangay' using errcode = 'P0011';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_evacuation_checkin_tenant on public.evacuation_center_checkins;
create trigger guard_evacuation_checkin_tenant
  before insert or update of evacuation_center_id, user_id, barangay_id
  on public.evacuation_center_checkins
  for each row execute function public.guard_evacuation_checkin_tenant();

comment on function public.guard_drive_registration_tenant() is
  'Rejects non-resident, deleted, inactive-drive, and cross-barangay medical registrations at the table boundary.';
comment on function public.guard_evacuation_checkin_tenant() is
  'Rejects non-resident, forged-user, inactive-center, and cross-barangay evacuation check-ins at the table boundary.';
