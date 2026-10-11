begin;

-- A previously confirmed address cannot lend its badge to an edited address.
-- Run after guard_verification_fields: resident-written status changes still
-- fail, while this server-owned trigger resets status on a permitted email edit.
create function barangayan_private.reset_changed_profile_email_verification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if lower(btrim(coalesce(new.email,''))) is distinct from lower(btrim(coalesce(old.email,''))) then
  new.email_verification_status := 'unverified';
  new.email_verification_requested_at := null;
  new.email_verified_at := null;
 end if;
 return new;
end $$;
revoke all on function barangayan_private.reset_changed_profile_email_verification() from public,anon,authenticated,service_role;
create trigger reset_changed_profile_email_verification before update of email on public.profiles
for each row execute function barangayan_private.reset_changed_profile_email_verification();

commit;
