begin;

-- Additive endpoint: existing clients keep complete_resident_profile(jsonb).
-- Lock and compare the caller's freshly loaded row in the same transaction as
-- completion. A client-side read/compare alone cannot prevent lost updates.
create function barangayan_private.complete_resident_profile_if_unchanged(p_input jsonb, p_expected jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); p public.profiles; v_current jsonb;
begin
 if v_uid is null or not exists(select 1 from auth.users u where u.id=v_uid
  and not coalesce(u.is_anonymous,false) and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=now())) then
  raise exception 'resident_identity_required' using errcode='42501';
 end if;
 if p_expected is not null and jsonb_typeof(p_expected) not in ('object','null') then
  raise exception 'invalid_profile_snapshot' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
 select * into p from public.profiles where id=v_uid for update;
 if found then
  if p.role<>'resident' or p.deleted_at is not null then raise exception 'forbidden' using errcode='42501'; end if;
  v_current:=to_jsonb(p);
 end if;
 if v_current is distinct from nullif(p_expected,'null'::jsonb) then
  raise exception 'resident_profile_changed' using errcode='PT409';
 end if;
 return barangayan_private.complete_resident_profile(p_input);
end $$;
create function public.complete_resident_profile_if_unchanged(p_input jsonb, p_expected jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select barangayan_private.complete_resident_profile_if_unchanged(p_input,p_expected)
$$;
revoke all on function barangayan_private.complete_resident_profile_if_unchanged(jsonb,jsonb),
 public.complete_resident_profile_if_unchanged(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function barangayan_private.complete_resident_profile_if_unchanged(jsonb,jsonb),
 public.complete_resident_profile_if_unchanged(jsonb,jsonb) to authenticated;
comment on function public.complete_resident_profile_if_unchanged(jsonb,jsonb) is
 'Caller-only completion with an atomic full-row snapshot check. SQL/JSON null expects no existing profile. Stale snapshots fail without writes; no caller-supplied identity or tenant.';
notify pgrst,'reload schema';
commit;
