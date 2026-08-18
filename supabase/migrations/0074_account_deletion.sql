-- Ticket 14: wire up the Data Privacy Act "Delete My Account" row in
-- resident settings, currently dead UI with no backend at all.
--
-- This is deliberately an anonymize-and-disable, not a hard DELETE of the
-- auth.users/profiles row: profiles is referenced by service_requests.resident_id
-- (not null, no ON DELETE clause -> RESTRICT), payments.collected_by,
-- announcements.created_by, and several other FKs with no cascade/set-null
-- behavior defined. A literal hard delete would either fail outright on the
-- first existing service request, or require a much larger migration to add
-- ON DELETE SET NULL everywhere it's safe to do so — out of scope here, and
-- financial/audit records (payments, admin_audit_log) generally shouldn't be
-- hard-deleted anyway. Anonymization + login disablement satisfies the
-- Data Privacy Act's right-to-erasure for the resident's personal data while
-- preserving the barangay's legitimate transaction/audit history, and matches
-- the soft-delete pattern already used elsewhere (announcements, incidents).

alter table public.profiles
  add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Set by request_own_account_deletion() when a resident deletes their own '
  'account. The row is kept (FK-referenced by service_requests/payments/etc.) '
  'but PII columns are cleared and the auth user is banned from logging in '
  '(see supabase/functions/delete-my-account). NULL = active account.';

-- Deleted accounts must not appear in the admin resident directory or the
-- guest-visible profile lookups.
create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at) where deleted_at is null;

create or replace function public.request_own_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    full_name              = 'Deleted Resident',
    mobile_number           = null,
    home_address             = null,
    email                    = null,
    avatar_url               = null,
    id_photo_urls            = '{}',
    id_type                  = null,
    id_verification_status   = null,
    household_members        = '[]'::jsonb,
    deleted_at                = now()
  where id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'Profile not found or already deleted' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.request_own_account_deletion() is
  'Self-service account deletion (Data Privacy Act). Anonymizes the caller''s '
  'own profile row and marks it deleted_at; does not touch auth.users or any '
  'FK-referencing tables. Called by the delete-my-account edge function, which '
  'also removes the resident''s Storage objects and bans the auth user from '
  'signing in again.';

-- Admins should not see deleted residents in the directory.
drop policy if exists "admins can read residents in their barangay" on public.profiles;

create policy "admins can read residents in their barangay"
  on public.profiles for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'resident'
    and deleted_at is null
  );
