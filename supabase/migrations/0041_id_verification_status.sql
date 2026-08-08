-- ID verification workflow for resident profiles.
--
-- Adds id_verification_status (text) with three meaningful states:
--   NULL      — no ID uploaded yet (initial state)
--   'pending' — resident has uploaded an ID + selected a type, awaiting admin review
--   'verified'— admin has manually confirmed the ID is valid
--
-- Transition rules (enforced at the application layer):
--   resident save → NULL or 'pending'   (never 'verified'; see RLS note below)
--   admin action  → 'pending' → 'verified' (or back to 'pending' on revoke)
--   re-upload ID  → always resets to 'pending' even if previously 'verified'

alter table public.profiles
  add column if not exists id_verification_status text
    check (id_verification_status in ('pending', 'verified'));

comment on column public.profiles.id_verification_status is
  'ID verification workflow status.
   NULL    = no ID document uploaded yet.
   pending = resident uploaded an ID photo and selected an ID type; awaiting admin review.
   verified= admin has confirmed the uploaded ID is genuine.
   Residents may only set this to pending (via handleSave in the mobile app).
   Admins transition it to verified via the Resident Directory admin panel.
   Re-uploading a new ID photo always resets the status to pending.';

-- ── RLS: residents may not self-verify ────────────────────────────────────────
-- The existing admin UPDATE policy (migration 0009) lets admins update any
-- resident profile column including id_verification_status.
-- The resident UPDATE policy must not allow setting 'verified' themselves.
-- We rely on application-level enforcement (mobile app only ever writes 'pending')
-- plus this trigger that rejects any attempt to set 'verified' via a resident session.

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

  -- Resident: block escalation to 'verified'
  if new.id_verification_status = 'verified'
     and (old.id_verification_status is distinct from 'verified') then
    raise exception
      'Residents cannot self-verify their ID. '
      'Status must be set to "verified" by an administrator.';
  end if;

  return new;
end;
$$;

comment on function public.guard_id_verification_status() is
  'Trigger: prevents residents from self-escalating id_verification_status to '
  '"verified". Only admins (current_role() = ''admin'') may set that value.';

drop trigger if exists trg_guard_id_verification_status on public.profiles;

create trigger trg_guard_id_verification_status
  before update of id_verification_status on public.profiles
  for each row
  execute function public.guard_id_verification_status();
