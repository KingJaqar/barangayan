-- ============================================================================
-- Account deletion contract v2 (resident iOS plan Phase 18, P18-T05) — migration 0136
-- ============================================================================
-- Backs the `delete-my-account` function's v2 path (the v1 RPC `request_own_account_deletion` is untouched, so Android and web
-- keep working). It adds:
--   * `account_deletion_requests`: the truthful, resumable state of one deletion. The function reports `completed` only after
--     the records, the Storage objects and the sign-in have all been dealt with; anything else is `needs_attention`.
--   * `erase_own_account_records()`: the retain / de-identify / erase matrix for the database, in one idempotent step.
--   * `set_account_deletion_state(...)`: service-role only, moves the state forward (never back from `completed`).
--
-- The matrix below is the default proposed in P03-T07 section 3. The owner approved it as written on 2026-10-21 (PR-14, decision
-- OD-16). Deployment is a separate owner approval; the app keeps `accountDeletion` closed until then.
--
--   ERASED     household members, request attachments (rows), medical drive registrations, evacuation check-ins, push
--              tokens, notification inbox/events/preferences, announcement read marks, and every ID submission that no
--              document request depends on. The files themselves are removed by the function.
--   DE-IDENTIFIED (kept)
--              the profile row (name, contact, birth date, address, locations, avatar and ID fields cleared), document
--              requests (free text and ID file reference cleared, supporting details emptied) and their payments, incident reports (reporter link and photo references cleared), report corroborations
--              (their author is now an anonymous profile), and the ID submissions that a version 2 document request must
--              keep pointing at (type, file paths and confirmed details replaced by tombstones; only the decision and its
--              audit remain).
--   AUTH       handled by the function: sessions revoked and the sign-in soft-deleted, which removes its email, password and
--              linked identities while keeping the id the retained rows point at.

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references public.profiles(id),
  state text not null check (state in ('requested','profile_erased','storage_cleaned','auth_revoked','completed','needs_attention')),
  last_error text check (last_error is null or char_length(last_error) <= 200),
  attempts integer not null default 1 check (attempts >= 1),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant all on public.account_deletion_requests to service_role;

create or replace function barangayan_private.deletion_state_rank(p_state text) returns integer
language sql immutable set search_path = '' as $$
  select case p_state when 'requested' then 1 when 'profile_erased' then 2 when 'storage_cleaned' then 3 when 'auth_revoked' then 4 when 'completed' then 5 else 0 end
$$;

create or replace function public.erase_own_account_records() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_state text;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode = 'P0001'; end if;
  select state into v_state from public.account_deletion_requests where user_id = v_user;
  if v_state = 'completed' then return v_state; end if;
  if exists (select 1 from public.profiles where id = v_user and deleted_at is null) then
    -- A first request is destructive and irreversible: it needs a recent authentication proven by the token itself.
    if not barangayan_private.has_recent_authentication() then
      raise exception 'fresh_authentication_required' using errcode = '42501';
    end if;
  elsif v_state is null then
    -- Anonymized earlier by the v1 flow (or never a profile): there is nothing to resume.
    raise exception 'Profile not found or already deleted' using errcode = 'P0002';
  end if;

  insert into public.account_deletion_requests (user_id, state) values (v_user, 'requested')
  on conflict (user_id) do update set attempts = public.account_deletion_requests.attempts + 1, updated_at = now();

  -- References first: the profile and the retained requests point at ID submissions that are about to be erased.
  perform set_config('barangayan.profile_location_operation', v_user::text, true);
  update public.profiles set
    full_name = 'Deleted Resident', first_name = null, middle_name = null, last_name = null, suffix = null,
    mobile_number = null, home_address = null, house_no = null, street = null, email = null, avatar_url = null,
    birth_date = null, sex = null, employment_status = null, occupation = null,
    id_photo_urls = '{}', id_type = null, id_verification_status = null,
    current_id_submission_id = null, approved_id_submission_id = null,
    household_members = '[]'::jsonb,
    registration_location = null, registration_home_location = null, verified_location = null, verified_location_address = null,
    location_verified = null, location_verified_at = null,
    push_notifications_enabled = false, custom_accent_colors = '{}',
    deleted_at = coalesce(deleted_at, now())
  where id = v_user;
  perform set_config('barangayan.profile_location_operation', '', true);

  -- Version 2 requests must keep supporting details and a verified ID reference (service_requests_v2_shape), so they keep an empty
  -- object and the reference to a de-identified submission. Their submission payload is an immutable snapshot that holds no
  -- identity (column comment, migration 0095) and is left alone. The guard accepts a definer-side change of a version 2 request
  -- only under a named operation; the existing record-correction operation is the one that allows this kind of edit.
  perform set_config('barangayan.foundation_operation', 'admin_record_correction', true);
  update public.service_requests set
    requester_notes = null, purpose_explanation = null, id_document_path = null,
    supporting_details = case when contract_version = 2 then '{}'::jsonb else null end
  where resident_id = v_user;
  perform set_config('barangayan.foundation_operation', '', true);
  update public.incidents set reporter_id = null, photo_urls = '{}' where reporter_id = v_user;

  delete from public.household_members where profile_id = v_user;
  delete from public.request_attachments where resident_id = v_user;
  update public.id_submissions set id_type = 'erased', front_path = 'erased/' || id::text || '/front', back_path = 'erased/' || id::text || '/back', confirmed_details = null
  where resident_id = v_user;
  delete from public.id_submissions s where s.resident_id = v_user
    and not exists (select 1 from public.service_requests r where r.approved_id_submission_id = s.id);
  delete from public.drive_registrations where user_id = v_user;
  delete from public.evacuation_center_checkins where user_id = v_user;
  delete from public.push_tokens where user_id = v_user;
  delete from public.announcement_reads where resident_id = v_user;
  delete from public.notification_preferences where user_id = v_user;
  -- Events cascade to the inbox, outbox and delivery tickets of this resident.
  delete from barangayan_private.notification_events where recipient_id = v_user;

  update public.account_deletion_requests
  set state = case when barangayan_private.deletion_state_rank(state) < 2 then 'profile_erased' else state end, last_error = null, updated_at = now()
  where user_id = v_user
  returning state into v_state;
  return v_state;
end $$;

create or replace function public.set_account_deletion_state(p_user uuid, p_state text, p_error text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  if p_state not in ('profile_erased','storage_cleaned','auth_revoked','completed','needs_attention') then
    raise exception 'invalid_deletion_state' using errcode = '22023';
  end if;
  update public.account_deletion_requests set
    -- Progress only moves forward; a failure keeps the furthest step reached and says so in `needs_attention`.
    state = case
      when state = 'completed' then state
      when p_state = 'needs_attention' then 'needs_attention'
      when barangayan_private.deletion_state_rank(p_state) > barangayan_private.deletion_state_rank(state) or state = 'needs_attention' then p_state
      else state end,
    last_error = case when p_state = 'needs_attention' then left(coalesce(p_error, 'unspecified'), 200) else null end,
    completed_at = case when p_state = 'completed' then coalesce(completed_at, now()) else completed_at end,
    updated_at = now()
  where user_id = p_user
  returning state into v_state;
  if v_state is null then raise exception 'deletion_not_requested' using errcode = 'P0002'; end if;
  return v_state;
end $$;

revoke all on function public.erase_own_account_records() from public, anon;
grant execute on function public.erase_own_account_records() to authenticated, service_role;
revoke all on function public.set_account_deletion_state(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_account_deletion_state(uuid, text, text) to service_role;
revoke all on function barangayan_private.deletion_state_rank(text) from public, anon, authenticated;
