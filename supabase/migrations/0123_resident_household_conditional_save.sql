-- Resident iOS Phase 3 (P03-T04): atomic, conditional whole-list household save.
--
-- Additive. Android/web keep writing `profiles.household_members` directly; the existing
-- mirror trigger (0093, rewritten in 0115) still owns the canonical rows. This endpoint adds what a direct
-- update cannot: a transaction-bound stale-editor check, server validation of every
-- member and a normalized result. A stale editor receives `PT409` and no write occurs.
begin;

-- Latent defect carried by the mirror trigger (0093, kept by the 0115 archive-preserving
-- rewrite): a member without `role` inserts NULL into the NOT NULL column (the column
-- default is bypassed by an explicit NULL), failing the whole profile save. Apply the
-- column default instead. Everything else is the 0115 function unchanged: archive and
-- check-in state of retained members are preserved and foreign member ids are rejected.
create or replace function public.sync_household_members_from_jsonb() returns trigger
language plpgsql security definer set search_path='' as $$
declare member jsonb; member_id uuid; retained uuid[] := '{}';
begin
 for member in select * from jsonb_array_elements(coalesce(new.household_members,'[]'::jsonb)) loop
  begin member_id := coalesce((member->>'id')::uuid,gen_random_uuid());
  exception when invalid_text_representation then member_id := gen_random_uuid(); end;
  retained := array_append(retained,member_id);
  if exists(select 1 from public.household_members h where h.id=member_id and h.profile_id<>new.id) then
   raise exception 'Household member belongs to another profile' using errcode='42501';
  end if;
  insert into public.household_members(id,profile_id,name,relation,role)
  values(member_id,new.id,member->>'name',member->>'relation',coalesce(nullif(member->>'role',''),'member'))
  on conflict(id) do update set name=excluded.name,relation=excluded.relation,role=excluded.role;
 end loop;
 delete from public.household_members where profile_id=new.id and deleted_at is null and not(id=any(retained));
 return new;
end $$;
revoke all on function public.sync_household_members_from_jsonb() from public,anon,authenticated;

create function barangayan_private.save_resident_household_if_unchanged(p_members jsonb, p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=(select auth.uid());
 p public.profiles;
 v_item jsonb;
 v_id text;
 v_name text;
 v_relation text;
 v_role text;
 v_normalized jsonb:='[]'::jsonb;
 v_current jsonb;
 -- ECMAScript trim/\s characters, matching the profile completion validator.
 ws text:=E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)
  ||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)
  ||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 if v_uid is null or not exists(select 1 from auth.users u where u.id=v_uid
  and not coalesce(u.is_anonymous,false) and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=now())) then
  raise exception 'resident_identity_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members)>30 then
  raise exception 'invalid_household_members' using errcode='22023';
 end if;
 if p_expected is not null and jsonb_typeof(p_expected) not in ('array','null') then
  raise exception 'invalid_household_snapshot' using errcode='22023';
 end if;

 for v_item in select value from jsonb_array_elements(p_members) loop
  if jsonb_typeof(v_item) is distinct from 'object'
     or jsonb_typeof(v_item->'id') is distinct from 'string'
     or jsonb_typeof(v_item->'name') is distinct from 'string'
     or jsonb_typeof(v_item->'relation') is distinct from 'string'
     or (v_item ? 'role' and jsonb_typeof(v_item->'role') not in ('string','null')) then
   raise exception 'invalid_household_member' using errcode='22023';
  end if;
  v_id:=v_item->>'id';
  if v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'invalid_household_member_id' using errcode='22023';
  end if;
  v_name:=btrim(v_item->>'name',ws);
  v_relation:=btrim(v_item->>'relation',ws);
  v_role:=nullif(btrim(coalesce(v_item->>'role',''),ws),'');
  if char_length(v_name) not between 1 and 200 or char_length(v_relation) not between 1 and 100
     or (v_role is not null and char_length(v_role)>50) then
   raise exception 'invalid_household_member' using errcode='22023';
  end if;
  v_normalized:=v_normalized||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
   'id',lower(v_id),'name',v_name,'relation',v_relation,'role',v_role)));
 end loop;
 if (select count(distinct m->>'id') from jsonb_array_elements(v_normalized) m)<>jsonb_array_length(v_normalized) then
  raise exception 'duplicate_household_member_id' using errcode='22023';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
 select * into p from public.profiles where id=v_uid for update;
 if not found or p.role<>'resident' or p.deleted_at is not null then
  raise exception 'forbidden' using errcode='42501';
 end if;
 v_current:=coalesce(p.household_members,'[]'::jsonb);
 if v_current is distinct from coalesce(nullif(p_expected,'null'::jsonb),'[]'::jsonb) then
  raise exception 'resident_household_changed' using errcode='PT409';
 end if;

 -- The mirror trigger reconciles canonical rows, preserves attendance for retained
 -- IDs and rejects an ID owned by another household (all within this transaction).
 update public.profiles set household_members=v_normalized where id=v_uid;
 select household_members into v_current from public.profiles where id=v_uid;
 return v_current;
end $$;

create function public.save_resident_household_if_unchanged(p_members jsonb, p_expected jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.save_resident_household_if_unchanged(p_members,p_expected)
$$;
revoke all on function barangayan_private.save_resident_household_if_unchanged(jsonb,jsonb),
 public.save_resident_household_if_unchanged(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function barangayan_private.save_resident_household_if_unchanged(jsonb,jsonb),
 public.save_resident_household_if_unchanged(jsonb,jsonb) to authenticated;
comment on function public.save_resident_household_if_unchanged(jsonb,jsonb) is
 'Caller-only whole-list household save with an atomic snapshot check (PT409 on a stale list; null/[] expects an empty list). Validates members (max 30), preserves attendance for retained IDs via the mirror trigger, never accepts a profile id.';

notify pgrst,'reload schema';
commit;
