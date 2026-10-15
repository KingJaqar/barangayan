-- Operational rollback, not a forward migration. Disable frontend feature flags
-- first. Execution against any hosted database needs separate owner approval.
-- Preserve all accounts, profiles, associations, challenges and audit history.
begin;
revoke select on public.admin_resident_associations from authenticated;
revoke execute on function
 public.admin_profile_access(),public.admin_profile_verify_fresh_session(),public.admin_profile_resident_available(),
 public.admin_update_own_profile(jsonb,timestamptz),public.admin_begin_resident_association(),
 public.resident_prove_admin_association(uuid),public.admin_finish_resident_association(uuid),
 public.admin_unlink_resident_association(uuid,timestamptz),public.admin_cancel_resident_association(uuid),
 barangayan_private.profile_live_identity(),barangayan_private.admin_profile_actor(),
 barangayan_private.admin_profile_verify_fresh_session(),barangayan_private.admin_profile_resident_available(),
 barangayan_private.admin_begin_resident_association(),barangayan_private.resident_prove_admin_association(uuid),
 barangayan_private.admin_finish_resident_association(uuid),barangayan_private.admin_unlink_resident_association(uuid,timestamptz),
 barangayan_private.admin_cancel_resident_association(uuid)
from authenticated;
-- Retain the photo-reference safety policy/function: removing it would reopen
-- deletion of referenced admin photos and disrupt ordinary resident cleanup.
notify pgrst,'reload schema';
commit;
