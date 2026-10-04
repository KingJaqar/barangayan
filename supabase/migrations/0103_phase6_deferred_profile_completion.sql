begin;

-- An authenticated account without a profile may read public information from
-- the sole enabled registration tenant. This does not assign a profile or role.
create function public.incomplete_profile_browsing_barangay() returns uuid
language sql stable security definer set search_path='' as $$
 select l.barangay_id from public.barangay_localities l
 where l.resident_registration_enabled
 and (select count(*) from public.barangay_localities where resident_registration_enabled)=1
 and exists(select 1 from auth.users u where u.id=(select auth.uid()) and not coalesce(u.is_anonymous,false))
 and not exists(select 1 from public.profiles p where p.id=(select auth.uid()))
$$;
revoke all on function public.incomplete_profile_browsing_barangay() from public,anon;
grant execute on function public.incomplete_profile_browsing_barangay() to authenticated;

create policy "incomplete accounts browse announcements" on public.announcements for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null);
create policy "incomplete accounts browse active documents" on public.document_types for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and is_active and deleted_at is null);
create policy "incomplete accounts browse public incidents" on public.incidents for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null);
create policy "incomplete accounts browse emergency information" on public.emergency_information for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null and is_active);
create policy "incomplete accounts browse help" on public.faq_articles for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null and is_active);
create policy "incomplete accounts browse site content" on public.site_content for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null and is_active);
create policy "incomplete accounts browse about" on public.about_us for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null and is_active);
create policy "incomplete accounts browse developer profiles" on public.developer_profiles for select to authenticated
using (barangay_id=(select public.incomplete_profile_browsing_barangay()) and deleted_at is null);

-- Enforce completion at the write boundary, including direct REST and RPC calls.
-- Import/seed operations without an end-user identity and staff operations retain
-- their existing authorization. Existing historical rows are not rewritten.
create function barangayan_private.require_complete_profile_for_submission() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 if (select auth.uid()) is null then return new; end if;
 select * into p from public.profiles where id=(select auth.uid()) and deleted_at is null;
 if found and p.role<>'resident' then return new; end if;
 if p.id is null or not coalesce(
  length(regexp_replace(p.first_name,'^[[:space:]]+|[[:space:]]+$','','g')) between 1 and 200 and p.first_name ~ '^[A-Za-z[:space:]]+$'
  and length(regexp_replace(p.last_name,'^[[:space:]]+|[[:space:]]+$','','g')) between 1 and 200 and p.last_name ~ '^[A-Za-z[:space:]]+$'
  and length(regexp_replace(p.house_no,'^[[:space:]]+|[[:space:]]+$','','g')) between 1 and 200
  and length(regexp_replace(p.street,'^[[:space:]]+|[[:space:]]+$','','g')) between 1 and 500
  and p.sex in ('male','female')
  and p.employment_status in ('employed','unemployed','student','self_employed','retired')
  and p.mobile_number ~ '^09[0-9]{9}$' and p.birth_date is not null and p.birth_date<=current_date, false)
 then raise exception 'resident_profile_completion_required' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function barangayan_private.require_complete_profile_for_submission() from public,anon,authenticated;
create trigger a0_require_complete_profile before insert on public.service_requests
for each row execute function barangayan_private.require_complete_profile_for_submission();
create trigger a0_require_complete_profile before insert on public.drive_registrations
for each row execute function barangayan_private.require_complete_profile_for_submission();
create trigger a0_require_complete_profile before insert on public.incidents
for each row execute function barangayan_private.require_complete_profile_for_submission();
commit;
