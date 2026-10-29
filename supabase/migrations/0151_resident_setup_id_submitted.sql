-- Resident registration proof of residency, Phase 1: report whether the caller has an ID
-- submission on file so the shared setup route can place the ID step between details and
-- password for email-registered residents. Additive: one new field on the v1 status shape
-- used by Android; the v2 (iOS) status, grants and the public wrapper are unchanged.
-- Apply only after the Android build that understands `idSubmitted` ships: the client's
-- status schema is strict, so an older build would reject the extra field.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function barangayan_private.get_resident_account_setup_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); p public.profiles; lifecycle barangayan_private.resident_account_lifecycle;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u where u.id=v_uid and not coalesce(u.is_anonymous,false)
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
  raise exception 'resident_identity_required' using errcode='42501'; end if;
 select * into p from public.profiles where id=v_uid;
 if found and (p.role<>'resident' or p.deleted_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into lifecycle from barangayan_private.resident_account_lifecycle where user_id=v_uid;
 if not found then raise exception 'resident_setup_state_unavailable' using errcode='55000'; end if;
 return jsonb_build_object('registrationOrigin',case when lifecycle.registration_origin='apple' then 'legacy' else lifecycle.registration_origin end,
  'profileComplete',barangayan_private.resident_profile_complete(p),'passwordSet',lifecycle.password_set,
  'hasGoogleIdentity',exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='google'),
  'idSubmitted',(p.current_id_submission_id is not null or p.id_verification_status is not null));
end $$;

comment on function public.get_resident_account_setup_status() is
 'Caller-only resident setup status. Null passwordSet means unresolved legacy provenance; never replace its credential via first-time setup. idSubmitted is true once any ID submission or ID verification status is on file. Metadata flow hints confer no authorization.';

notify pgrst,'reload schema';
commit;
