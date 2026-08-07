-- Migration: prevent authenticated residents from directly writing to the
-- email-verification state columns on their own profiles row.
--
-- Why this is necessary:
--   The existing resident UPDATE policy (from 0001/0002) lets a resident update
--   their own profiles row to change name, address, etc. Without this guard, a
--   resident could call the PostgREST API directly and set
--   email_verification_status = 'verified' on their own row, bypassing any future
--   SMTP-backed verification flow entirely.
--
-- Approach: a BEFORE UPDATE trigger that runs for every authenticated session and
-- raises an exception when any of the three verification columns are changed.
-- Service-role callers (Edge Functions) bypass row-level security entirely, so
-- server-side verification updates are unaffected.
--
-- This does NOT block the handle_new_user() trigger — that function runs as
-- SECURITY DEFINER at INSERT time, not UPDATE time, so it is unaffected.

create or replace function public.prevent_verification_field_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.email_verification_status      is distinct from old.email_verification_status      or
    new.email_verification_requested_at is distinct from old.email_verification_requested_at or
    new.email_verified_at              is distinct from old.email_verified_at
  ) then
    raise exception
      'Direct updates to email verification fields are not allowed. '
      'Use the server-side verification endpoint instead.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_verification_field_update() is
  'Trigger: rejects any UPDATE on profiles that changes email_verification_status,
   email_verification_requested_at, or email_verified_at. Verification state must
   only be changed by a service-role Edge Function, never by a resident client.';

drop trigger if exists guard_verification_fields on public.profiles;

create trigger guard_verification_fields
  before update on public.profiles
  for each row
  -- Only fire for regular authenticated sessions; skip service-role calls which
  -- bypass RLS entirely (auth.role() returns 'service_role' for those, but the
  -- trigger still fires — we restrict to 'authenticated' to allow server-side
  -- Edge Function updates while blocking client-side abuse).
  when (current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated')
  execute function public.prevent_verification_field_update();
