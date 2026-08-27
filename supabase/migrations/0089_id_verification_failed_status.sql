-- Adds a fourth id_verification_status state: 'verification_failed'.
--
-- Full workflow (mobile Profile screen, apps/resident-android-mobile):
--   NULL                  — no ID uploaded yet
--   'pending'             — resident uploaded an ID (type + front + back photo), awaiting review
--   'verified'            — admin confirmed the ID is genuine (admin-only transition)
--   'verification_failed' — admin rejected the ID (admin-only transition); the resident sees
--                           "Verification Failed, Try Again" and can simply re-upload, which
--                           (per the existing handleSave logic) resets the status to 'pending'.
--
-- Residents may still only ever write NULL or 'pending' to this column — both 'verified'
-- and 'verification_failed' remain admin-only, enforced by guard_id_verification_status().

alter table public.profiles
  drop constraint if exists profiles_id_verification_status_check;

alter table public.profiles
  add constraint profiles_id_verification_status_check
    check (id_verification_status in ('pending', 'verified', 'verification_failed'));

comment on column public.profiles.id_verification_status is
  'ID verification workflow status.
   NULL                  = no ID document uploaded yet.
   pending                = resident uploaded ID type + front/back photos; awaiting admin review.
   verified               = admin has confirmed the uploaded ID is genuine.
   verification_failed    = admin rejected the uploaded ID; resident should re-upload to retry.
   Residents may only set this to pending (via handleSave in the mobile/web apps).
   Admins transition it to verified or verification_failed via the Resident Directory admin panel.
   Re-uploading a new ID photo always resets the status to pending, regardless of prior state.';

create or replace function public.guard_id_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow if the caller is an admin or service_role
  if public.current_role() = 'admin' then
    return new;
  end if;

  -- Resident: block escalation to 'verified' or 'verification_failed' — both are
  -- admin-only outcomes of a review the resident cannot perform on themselves.
  if new.id_verification_status in ('verified', 'verification_failed')
     and (old.id_verification_status is distinct from new.id_verification_status) then
    raise exception
      'Residents cannot set their own ID verification result. '
      'Status must be set to "verified" or "verification_failed" by an administrator.';
  end if;

  return new;
end;
$$;

comment on function public.guard_id_verification_status() is
  'Trigger: prevents residents from self-escalating id_verification_status to '
  '"verified" or "verification_failed". Only admins (current_role() = ''admin'') may set those values.';
