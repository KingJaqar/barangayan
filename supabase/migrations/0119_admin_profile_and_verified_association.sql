begin;

-- Self-profile updates need atomic conflict detection. Associations need proof
-- from two independent Auth sessions; there is deliberately no backfill.
create table public.admin_resident_associations (
 admin_id uuid primary key references public.profiles(id) on delete cascade,
 resident_id uuid not null unique references public.profiles(id) on delete cascade,
 linked_at timestamptz not null default clock_timestamp(),
 check(admin_id<>resident_id)
);
alter table public.admin_resident_associations enable row level security;
revoke all on public.admin_resident_associations from public,anon,authenticated,service_role;
grant select on public.admin_resident_associations to authenticated;
create policy "active owner reads association" on public.admin_resident_associations
 for select to authenticated using(admin_id=(select auth.uid())
 and (select barangayan_private.active_admin_barangay_id()) is not null);

-- Only functions can inspect or consume challenges. One bounded row per admin.
create table barangayan_private.admin_association_challenges (
 admin_id uuid primary key references public.profiles(id) on delete cascade,
 challenge uuid not null unique default gen_random_uuid(),
 admin_session uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 resident_id uuid references public.profiles(id) on delete cascade,
 resident_session uuid,
 consumed_at timestamptz
);
alter table barangayan_private.admin_association_challenges enable row level security;
revoke all on barangayan_private.admin_association_challenges from public,anon,authenticated,service_role;

create function barangayan_private.profile_live_identity()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); begin
 if v_uid is null or not exists(select 1 from auth.users u where u.id=v_uid
  and not coalesce(u.is_anonymous,false) and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=now()))
  or not exists(select 1 from auth.sessions s where s.id=nullif(auth.jwt()->>'session_id','')::uuid
   and s.user_id=v_uid and (s.not_after is null or s.not_after>now()))
  or (exists(select 1 from auth.mfa_factors where user_id=v_uid and status='verified')
   and (coalesce(auth.jwt()->>'aal','aal1')<>'aal2' or not exists(select 1 from auth.sessions
    where id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=v_uid and aal='aal2'))) then
  raise exception 'active_identity_required' using errcode='42501';
 end if;
 return v_uid;
end $$;

create function barangayan_private.admin_profile_actor()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=barangayan_private.profile_live_identity(); v_tenant uuid; begin
 select barangay_id into v_tenant from public.profiles where id=v_uid and role='admin' and deleted_at is null;
 if v_tenant is null or exists(select 1 from public.barangay_officials where profile_id=v_uid
  and (not is_active or deleted_at is not null or barangay_id<>v_tenant)) then
  raise exception 'active_admin_required' using errcode='42501';
 end if;
 return v_tenant;
end $$;

create function public.admin_update_own_profile(p_patch jsonb,p_expected timestamptz)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare p public.profiles; v_count integer; v_updated timestamptz; v_path text; begin
 perform barangayan_private.admin_profile_actor();
 if p_expected is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
  or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('full_name','mobile_number','email','avatar_url'))
  or exists(select 1 from jsonb_each(p_patch) e where jsonb_typeof(e.value) not in ('string','null')) then
  raise exception 'invalid_profile_patch' using errcode='22023';
 end if;
 select * into p from public.profiles where id=(select auth.uid()) for update;
 perform 1 from public.barangay_officials where profile_id=(select auth.uid()) for share;
 perform barangayan_private.admin_profile_actor();
 if p.id is null then raise exception 'active_admin_required' using errcode='42501'; end if;
 if p.updated_at is distinct from p_expected then raise exception 'profile_changed' using errcode='PT409'; end if;
 if p_patch ? 'full_name' and (nullif(btrim(p_patch->>'full_name'),'') is null or char_length(btrim(p_patch->>'full_name'))>150
  or coalesce(nullif(btrim(p.first_name),''),nullif(btrim(p.last_name),''),nullif(btrim(p.middle_name),''),nullif(btrim(p.suffix),'')) is not null) then
  raise exception 'legacy_name_only' using errcode='22023';
 end if;
 if p_patch->>'mobile_number' is not null and p_patch->>'mobile_number' !~ '^09[0-9]{9}$' then
  raise exception 'invalid_mobile' using errcode='22023';
 end if;
 if p_patch->>'email' is not null and (char_length(p_patch->>'email')>254
  or p_patch->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
  raise exception 'invalid_email' using errcode='22023';
 end if;
 if p_patch->>'avatar_url' is not null then
  if char_length(p_patch->>'avatar_url')>1024 or p_patch->>'avatar_url' !~
   ('^https?://[^/]+/storage/v1/object/public/profile-photos/'||p.id||'/[0-9a-f-]{36}\.(jpg|png|webp)$') then
   raise exception 'owned_avatar_required' using errcode='22023';
  end if;
  v_path:=split_part(p_patch->>'avatar_url','/profile-photos/',2);
  if not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=v_path
   and (storage.foldername(name))[1]=p.id::text) then
   raise exception 'owned_avatar_required' using errcode='22023';
  end if;
 end if;
 -- Do not include structured identity/address columns in this statement: their
 -- compose trigger must not run on unrelated legacy contact edits.
 update public.profiles set
  full_name=case when p_patch ? 'full_name' then btrim(p_patch->>'full_name') else full_name end,
  mobile_number=case when p_patch ? 'mobile_number' then p_patch->>'mobile_number' else mobile_number end,
  email=case when p_patch ? 'email' then p_patch->>'email' else email end,
  avatar_url=case when p_patch ? 'avatar_url' then p_patch->>'avatar_url' else avatar_url end
 where id=p.id and role='admin' and deleted_at is null and updated_at=p_expected returning updated_at into v_updated;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'profile_changed' using errcode='PT409'; end if;
 return v_updated;
end $$;

create function barangayan_private.admin_begin_resident_association()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_id uuid; begin
 perform barangayan_private.admin_profile_actor();
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,119));
 perform 1 from public.profiles where id=v_uid for update;
 if exists(select 1 from public.admin_resident_associations where admin_id=v_uid) then
  raise exception 'association_conflict' using errcode='PT409';
 end if;
 if exists(select 1 from barangayan_private.admin_association_challenges where admin_id=v_uid
  and created_at>clock_timestamp()-interval '30 seconds') then
  raise exception 'challenge_rate_limit' using errcode='PT429';
 end if;
 insert into barangayan_private.admin_association_challenges(admin_id,admin_session)
 values(v_uid,(auth.jwt()->>'session_id')::uuid)
 on conflict(admin_id) do update set challenge=gen_random_uuid(),admin_session=excluded.admin_session,
  created_at=clock_timestamp(),expires_at=clock_timestamp()+interval '5 minutes',resident_id=null,resident_session=null,consumed_at=null
 returning challenge into v_id;
 return v_id;
end $$;

create function barangayan_private.resident_prove_admin_association(p_challenge uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare c barangayan_private.admin_association_challenges; r public.profiles; a public.profiles;
 v_uid uuid:=barangayan_private.profile_live_identity(); begin
 select * into c from barangayan_private.admin_association_challenges where challenge=p_challenge for update;
 if c.admin_id is null or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.resident_id is not null then
  raise exception 'invalid_proof' using errcode='22023';
 end if;
 select * into r from public.profiles where id=v_uid;
 select * into a from public.profiles where id=c.admin_id;
 if r.id is null or a.id is null or r.role<>'resident' or a.role<>'admin'
  or r.deleted_at is not null or a.deleted_at is not null or r.barangay_id<>a.barangay_id or r.id=a.id
  or exists(select 1 from public.barangay_officials where profile_id=a.id and (not is_active or deleted_at is not null))
  or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=r.id and created_at>=c.created_at) then
  raise exception 'invalid_proof' using errcode='22023';
 end if;
 update barangayan_private.admin_association_challenges set resident_id=r.id,resident_session=(auth.jwt()->>'session_id')::uuid where admin_id=c.admin_id;
 return true;
end $$;

create function barangayan_private.admin_finish_resident_association(p_challenge uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c barangayan_private.admin_association_challenges; a public.profiles; r public.profiles;
 v_uid uuid:=(select auth.uid()); begin
 perform barangayan_private.admin_profile_actor();
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,119));
 select * into c from barangayan_private.admin_association_challenges where challenge=p_challenge and admin_id=v_uid for update;
 if c.admin_id is null or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.resident_id is null
  or c.admin_session is distinct from (auth.jwt()->>'session_id')::uuid then
  raise exception 'invalid_proof' using errcode='22023';
 end if;
 -- Deterministic locking serializes links against profile retirement/tenant edits.
 perform 1 from public.profiles where id in (v_uid,c.resident_id) order by id for update;
 perform 1 from public.barangay_officials where profile_id=v_uid for share;
 perform barangayan_private.admin_profile_actor();
 select * into a from public.profiles where id=v_uid;
 select * into r from public.profiles where id=c.resident_id;
 if r.id is null or r.role<>'resident' or r.deleted_at is not null or r.barangay_id<>a.barangay_id or r.id=a.id
  or not exists(select 1 from auth.users where id=r.id and deleted_at is null and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<=now()))
  or not exists(select 1 from auth.sessions where id=c.resident_session and user_id=r.id and (not_after is null or not_after>now()))
  or (exists(select 1 from auth.mfa_factors where user_id=r.id and status='verified')
   and not exists(select 1 from auth.sessions where id=c.resident_session and user_id=r.id and aal='aal2')) then
  raise exception 'invalid_proof' using errcode='22023';
 end if;
 insert into public.admin_resident_associations(admin_id,resident_id) values(v_uid,r.id);
 update barangayan_private.admin_association_challenges set consumed_at=clock_timestamp() where admin_id=v_uid;
 insert into public.admin_audit_log(admin_id,barangay_id,action,entity_type,entity_id,entity_label,metadata)
 values(v_uid,a.barangay_id,'update','system',v_uid,'Admin account association','{"operation":"link_resident"}'::jsonb);
 return r.id;
end $$;

create function barangayan_private.admin_unlink_resident_association(p_resident uuid,p_expected timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_tenant uuid; v_count integer; begin
 v_tenant:=barangayan_private.admin_profile_actor();
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,119));
 perform 1 from public.profiles where id=v_uid for update;
 perform 1 from public.barangay_officials where profile_id=v_uid for share;
 perform barangayan_private.admin_profile_actor();
 delete from public.admin_resident_associations where admin_id=v_uid and resident_id=p_resident and linked_at=p_expected;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'association_changed' using errcode='PT409'; end if;
 update barangayan_private.admin_association_challenges set consumed_at=clock_timestamp() where admin_id=v_uid;
 insert into public.admin_audit_log(admin_id,barangay_id,action,entity_type,entity_id,entity_label,metadata)
 values(v_uid,v_tenant,'update','system',v_uid,'Admin account association','{"operation":"unlink_resident"}'::jsonb);
 return true;
end $$;

create function barangayan_private.admin_cancel_resident_association(p_challenge uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform barangayan_private.admin_profile_actor();
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text,119));
 update barangayan_private.admin_association_challenges set consumed_at=clock_timestamp()
 where admin_id=(select auth.uid()) and challenge=p_challenge and consumed_at is null;
 return found;
end $$;

create function public.admin_begin_resident_association() returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.admin_begin_resident_association() $$;
create function public.resident_prove_admin_association(p_challenge uuid) returns boolean language sql security invoker set search_path='' as $$ select barangayan_private.resident_prove_admin_association(p_challenge) $$;
create function public.admin_finish_resident_association(p_challenge uuid) returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.admin_finish_resident_association(p_challenge) $$;
create function public.admin_unlink_resident_association(p_resident uuid,p_expected timestamptz) returns boolean language sql security invoker set search_path='' as $$ select barangayan_private.admin_unlink_resident_association(p_resident,p_expected) $$;
create function public.admin_cancel_resident_association(p_challenge uuid) returns boolean language sql security invoker set search_path='' as $$ select barangayan_private.admin_cancel_resident_association(p_challenge) $$;

create function barangayan_private.admin_profile_verify_fresh_session()
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform barangayan_private.admin_profile_actor();
 return exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid
  and user_id=(select auth.uid()) and created_at>clock_timestamp()-interval '5 minutes');
end $$;
create function public.admin_profile_verify_fresh_session() returns boolean language sql security invoker set search_path='' as $$ select barangayan_private.admin_profile_verify_fresh_session() $$;
create function public.admin_profile_access() returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.admin_profile_actor() $$;
create function barangayan_private.admin_profile_resident_available()
returns boolean language plpgsql security definer set search_path='' as $$
declare v_tenant uuid:=barangayan_private.admin_profile_actor(); begin
 return exists(select 1 from public.admin_resident_associations a
  join public.profiles r on r.id=a.resident_id join auth.users u on u.id=r.id
  where a.admin_id=(select auth.uid()) and r.role='resident' and r.deleted_at is null
   and r.barangay_id=v_tenant and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and (u.banned_until is null or u.banned_until<=now()));
end $$;
create function public.admin_profile_resident_available() returns boolean language sql security invoker set search_path='' as $$ select barangayan_private.admin_profile_resident_available() $$;
revoke all on function barangayan_private.admin_profile_resident_available(),public.admin_profile_resident_available() from public,anon,authenticated,service_role;
grant execute on function barangayan_private.admin_profile_resident_available(),public.admin_profile_resident_available() to authenticated;
revoke all on function public.admin_profile_access() from public,anon,authenticated,service_role;
grant execute on function public.admin_profile_access() to authenticated;
revoke all on function barangayan_private.admin_profile_verify_fresh_session(),public.admin_profile_verify_fresh_session() from public,anon,authenticated,service_role;
grant execute on function barangayan_private.admin_profile_verify_fresh_session(),public.admin_profile_verify_fresh_session() to authenticated;

-- Storage cleanup must never remove an object still referenced by a profile.
-- Privileged lookup is needed to protect references hidden by profile RLS.
create function barangayan_private.admin_profile_photo_unreferenced(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (storage.foldername(p_name))[1]=(select auth.uid())::text
  and (not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
    or not exists(select 1 from public.profiles where avatar_url like '%/storage/v1/object/public/profile-photos/'||p_name))
$$;
revoke all on function barangayan_private.admin_profile_photo_unreferenced(text) from public,anon,authenticated,service_role;
grant execute on function barangayan_private.admin_profile_photo_unreferenced(text) to authenticated;
create policy "preserve referenced profile photos" on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'profile-photos' or barangayan_private.admin_profile_photo_unreferenced(name));

revoke all on function barangayan_private.profile_live_identity(),barangayan_private.admin_profile_actor(),
 public.admin_update_own_profile(jsonb,timestamptz),barangayan_private.admin_begin_resident_association(),
 barangayan_private.resident_prove_admin_association(uuid),barangayan_private.admin_finish_resident_association(uuid),
 barangayan_private.admin_unlink_resident_association(uuid,timestamptz),barangayan_private.admin_cancel_resident_association(uuid),
 public.admin_begin_resident_association(),public.resident_prove_admin_association(uuid),public.admin_finish_resident_association(uuid),
 public.admin_unlink_resident_association(uuid,timestamptz),public.admin_cancel_resident_association(uuid)
 from public,anon,authenticated,service_role;
grant execute on function barangayan_private.profile_live_identity(),barangayan_private.admin_profile_actor(),
 public.admin_update_own_profile(jsonb,timestamptz),barangayan_private.admin_begin_resident_association(),
 barangayan_private.resident_prove_admin_association(uuid),barangayan_private.admin_finish_resident_association(uuid),
 barangayan_private.admin_unlink_resident_association(uuid,timestamptz),barangayan_private.admin_cancel_resident_association(uuid),
 public.admin_begin_resident_association(),public.resident_prove_admin_association(uuid),public.admin_finish_resident_association(uuid),
 public.admin_unlink_resident_association(uuid,timestamptz),public.admin_cancel_resident_association(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
