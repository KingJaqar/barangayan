-- Phase 1: staff-confirmed household attendance. No legacy attendance is backfilled.
begin;

alter table public.household_members add constraint household_members_id_profile_key unique(id,profile_id);
create table public.household_attendance (
 id uuid primary key default gen_random_uuid(),
 household_profile_id uuid not null references public.profiles(id),
 household_member_id uuid,
 barangay_id uuid not null references public.barangays(id),
 evacuation_center_id uuid not null references public.evacuation_centers(id),
 checked_in_at timestamptz not null default clock_timestamp(),
 checked_in_by uuid not null references public.profiles(id),
 checked_out_at timestamptz,
 checked_out_by uuid references public.profiles(id),
 foreign key(household_member_id,household_profile_id) references public.household_members(id,profile_id),
 check ((checked_out_at is null) = (checked_out_by is null)),
 check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create unique index household_attendance_active_holder on public.household_attendance(household_profile_id)
 where household_member_id is null and checked_out_at is null;
create unique index household_attendance_active_member on public.household_attendance(household_member_id)
 where household_member_id is not null and checked_out_at is null;
create index household_attendance_history on public.household_attendance
 (household_profile_id,household_member_id,checked_in_at desc,id desc);
create index household_attendance_departures on public.household_attendance
 (household_profile_id,household_member_id,checked_out_at desc,id desc) where checked_out_at is not null;
create index household_attendance_center_active on public.household_attendance(barangay_id,evacuation_center_id)
 where checked_out_at is null;
create index household_attendance_center_history on public.household_attendance(evacuation_center_id);
create index household_attendance_arrival_actor on public.household_attendance(checked_in_by);
create index household_attendance_departure_actor on public.household_attendance(checked_out_by);

create table barangayan_private.household_attendance_receipts (
 id uuid not null unique default gen_random_uuid(),
 actor_profile_id uuid not null references public.profiles(id),
 request_id uuid not null,
 household_profile_id uuid not null references public.profiles(id),
 operation text not null check(operation in ('check_in','check_out')),
 input_fingerprint jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_profile_id,request_id)
);
create index household_attendance_receipts_household on barangayan_private.household_attendance_receipts
 (household_profile_id,created_at,request_id);
alter table public.household_attendance enable row level security;
alter table barangayan_private.household_attendance_receipts enable row level security;
revoke all on public.household_attendance from public,anon,authenticated,service_role;
grant select on public.household_attendance to authenticated,service_role;
revoke all on barangayan_private.household_attendance_receipts from public,anon,authenticated,service_role;

-- Identity changes serialize against in-flight confirmations. This is a separate
-- actor advisory lock, never an actor row lock acquired after a household lock.
create function barangayan_private.serialize_attendance_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('attendance-identity:'||old.id::text,4));
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger attendance_profile_identity before update of role,barangay_id,deleted_at or delete on public.profiles
 for each row execute function barangayan_private.serialize_attendance_identity();
create trigger attendance_auth_identity before update of banned_until,deleted_at,is_anonymous or delete on auth.users
 for each row execute function barangayan_private.serialize_attendance_identity();

create function barangayan_private.attendance_actor(p_role text) returns public.profiles
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor public.profiles; uid uuid := (select auth.uid());
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 -- Parent key-share locks precede the advisory lock, so a concurrent hard
 -- deletion cannot hold a parent row while waiting for our identity lock.
 perform 1 from auth.users where id=uid for key share;
 perform 1 from public.profiles where id=uid for key share;
 perform pg_advisory_xact_lock_shared(hashtextextended('attendance-identity:'||uid::text,4));
 select p.* into actor from public.profiles p join auth.users u on u.id=p.id
 where p.id=uid and p.role=p_role and p.deleted_at is null and p.barangay_id is not null
 and u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and (u.banned_until is null or u.banned_until<=clock_timestamp());
 if not found then raise exception 'attendance_forbidden' using errcode='42501'; end if;
 return actor;
end $$;

create function barangayan_private.attendance_can_read(p_household uuid,p_barangay uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles a join auth.users u on u.id=a.id
 join public.profiles h on h.id=p_household
 where a.id=(select auth.uid()) and a.deleted_at is null and u.deleted_at is null
 and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
 and ((a.role='resident' and a.id=p_household) or
 (a.role='admin' and a.barangay_id=p_barangay and h.barangay_id=a.barangay_id and h.deleted_at is null)))
$$;
create policy household_attendance_read on public.household_attendance for select to authenticated
 using (barangayan_private.attendance_can_read(household_profile_id,barangay_id));

-- Bounded per-person reads, including holder-only households. Stored tenant
-- ownership filters historical records even after both household and actor move.
create function barangayan_private.read_household_attendance(p_household uuid,p_barangay uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('household_profile_id',p_household,'people',coalesce(jsonb_agg(
 jsonb_build_object('kind',person.kind,'member_id',person.member_id,'name',person.name,
 'relation',person.relation,'role',person.role,'current_stay',active.stay,'latest_departure',departed.stay)
 order by person.kind desc,person.sort_order,person.member_id),'[]'::jsonb))
 from (
 select 'holder'::text kind,null::uuid member_id,p.full_name name,null::text relation,null::text role,-1 sort_order
 from public.profiles p where p.id=p_household
 union all select 'member',m.id,m.name,m.relation,m.role,m.sort_order from public.household_members m
 where m.profile_id=p_household and m.deleted_at is null
 ) person
 left join lateral (
 select jsonb_build_object('attendance_id',s.id,'center_id',s.evacuation_center_id,'center_name',c.name,
 'checked_in_at',s.checked_in_at,'checked_out_at',s.checked_out_at) stay
 from public.household_attendance s join public.evacuation_centers c on c.id=s.evacuation_center_id
 where s.household_profile_id=p_household and s.household_member_id is not distinct from person.member_id
 and s.checked_out_at is null and (p_barangay is null or s.barangay_id=p_barangay)
 order by s.checked_in_at desc,s.id desc limit 1
 ) active on true
 left join lateral (
 select jsonb_build_object('attendance_id',s.id,'center_id',s.evacuation_center_id,'center_name',c.name,
 'checked_in_at',s.checked_in_at,'checked_out_at',s.checked_out_at) stay
 from public.household_attendance s join public.evacuation_centers c on c.id=s.evacuation_center_id
 where s.household_profile_id=p_household and s.household_member_id is not distinct from person.member_id
 and s.checked_out_at is not null and (p_barangay is null or s.barangay_id=p_barangay)
 order by s.checked_out_at desc,s.id desc limit 1
 ) departed on true
$$;

create function barangayan_private.get_my_household_attendance() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor public.profiles;
begin
 actor:=barangayan_private.attendance_actor('resident');
 if (select count(*) from public.household_members where profile_id=actor.id and deleted_at is null)>30 then
  raise exception 'household_roster_changed' using errcode='PT409'; end if;
 return barangayan_private.read_household_attendance(actor.id,null);
end $$;

create function barangayan_private.lookup_household_for_attendance(p_qr_payload text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; payload jsonb; household uuid;
begin
 actor:=barangayan_private.attendance_actor('admin');
 if p_qr_payload is null or octet_length(p_qr_payload)>2048 then
  raise exception 'invalid_household_qr' using errcode='22023'; end if;
 begin
  payload:=p_qr_payload::jsonb;
  if jsonb_typeof(payload) is distinct from 'object' or payload->>'type' is distinct from 'household'
   or (payload ? 'version' and (jsonb_typeof(payload->'version') is distinct from 'string' or payload->>'version' is distinct from '1.0'))
   or jsonb_typeof(payload->'profileId') is distinct from 'string'
   or (payload->>'profileId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or payload-array['type','version','profileId']<>'{}'::jsonb then
   raise exception 'invalid_household_qr' using errcode='22023'; end if;
  household:=(payload->>'profileId')::uuid;
 exception when invalid_text_representation then
  raise exception 'invalid_household_qr' using errcode='22023';
 end;
 if not exists(select 1 from public.profiles h join auth.users u on u.id=h.id
  where h.id=household and h.role='resident' and h.barangay_id=actor.barangay_id and h.deleted_at is null
  and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())) then
  raise exception 'household_unavailable' using errcode='42501'; end if;
 if (select count(*) from public.household_members where profile_id=household and deleted_at is null)>30 then
  raise exception 'household_roster_changed' using errcode='PT409'; end if;
 return barangayan_private.read_household_attendance(household,actor.barangay_id);
end $$;

create function barangayan_private.check_in_household_members(p_profile_id uuid,p_center_id uuid,p_participants jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor public.profiles; household public.profiles; center public.evacuation_centers;
 item jsonb; normalized jsonb; member uuid; stay public.household_attendance;
 fingerprint jsonb; receipt barangayan_private.household_attendance_receipts;
 results jsonb:='[]'; result jsonb; outcome text;
begin
 if p_request_id is null or p_profile_id is null or p_center_id is null then
  raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text||':'||p_request_id::text,5));
 actor:=barangayan_private.attendance_actor('admin');
 if jsonb_typeof(p_participants) is distinct from 'array' then
  raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 if jsonb_array_length(p_participants) not between 1 and 31 then
  raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_participants) loop
  if jsonb_typeof(item) is distinct from 'object' then
   raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
  if item->>'kind'='holder' and item-'kind'='{}'::jsonb then continue; end if;
  if item->>'kind' is distinct from 'member' or item-array['kind','member_id']<>'{}'::jsonb
   or jsonb_typeof(item->'member_id') is distinct from 'string'
   or (item->>'member_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 end loop;
 select jsonb_agg(v order by v::text) into normalized from (
  select distinct case when e->>'kind'='holder' then jsonb_build_object('kind','holder') else
   jsonb_build_object('kind','member','member_id',(e->>'member_id')::uuid) end v
  from jsonb_array_elements(p_participants) e) s;
 perform 1 from auth.users where id=p_profile_id for key share;
 select * into household from public.profiles where id=p_profile_id for update;
 perform pg_advisory_xact_lock_shared(hashtextextended('attendance-identity:'||p_profile_id::text,4));
 if household.id is null or household.role<>'resident' or household.deleted_at is not null or household.barangay_id is distinct from actor.barangay_id
  or not exists(select 1 from auth.users u where u.id=p_profile_id and u.deleted_at is null
   and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())) then
  raise exception 'household_unavailable' using errcode='42501'; end if;
 perform 1 from public.evacuation_centers c where c.id=p_center_id or c.id in (
  select s.evacuation_center_id from public.household_attendance s where s.household_profile_id=p_profile_id and s.checked_out_at is null
  ) order by c.id for update;
 select * into center from public.evacuation_centers where id=p_center_id;
 if not found or center.barangay_id is distinct from actor.barangay_id then
  raise exception 'attendance_center_unavailable' using errcode='PT409'; end if;
 fingerprint:=jsonb_build_object('operation','check_in','household',p_profile_id,'center',p_center_id,
  'participants',normalized,'barangay',actor.barangay_id);
 select * into receipt from barangayan_private.household_attendance_receipts
 where actor_profile_id=actor.id and request_id=p_request_id;
 if found then
  if receipt.input_fingerprint->>'barangay' is distinct from actor.barangay_id::text then
   raise exception 'attendance_forbidden' using errcode='42501'; end if;
  if receipt.input_fingerprint is distinct from fingerprint then
   raise exception 'attendance_request_conflict' using errcode='PT409'; end if;
  return receipt.result;
 end if;
 if center.deleted_at is not null or not center.is_active then
  raise exception 'attendance_center_unavailable' using errcode='PT409'; end if;
 if (select count(*) from public.household_members where profile_id=p_profile_id and deleted_at is null)>30 then
  raise exception 'household_roster_changed' using errcode='PT409'; end if;
 perform 1 from public.household_attendance where household_profile_id=p_profile_id and checked_out_at is null order by id for update;
 for item in select value from jsonb_array_elements(normalized) loop
  member:=(item->>'member_id')::uuid;
  if member is not null and not exists(select 1 from public.household_members
   where id=member and profile_id=p_profile_id and deleted_at is null) then
   raise exception 'household_roster_changed' using errcode='PT409'; end if;
  select * into stay from public.household_attendance where household_profile_id=p_profile_id
   and household_member_id is not distinct from member and checked_out_at is null;
  if found then
   if stay.evacuation_center_id<>p_center_id or stay.barangay_id<>actor.barangay_id then
    raise exception 'attendance_active_elsewhere' using errcode='PT409'; end if;
   outcome:='already_active';
  else
   insert into public.household_attendance(household_profile_id,household_member_id,barangay_id,evacuation_center_id,checked_in_by)
   values(p_profile_id,member,actor.barangay_id,p_center_id,actor.id) returning * into stay;
   outcome:='created';
  end if;
  if member is not null then
   update public.household_members set is_checked_in=true,checked_in_at=stay.checked_in_at,
    checked_in_center_id=p_center_id,checked_in_center_name=center.name where id=member;
  end if;
  results:=results||jsonb_build_array(jsonb_build_object('attendance_id',stay.id,'kind',item->>'kind','member_id',member,
   'center_id',stay.evacuation_center_id,'checked_in_at',stay.checked_in_at,'checked_out_at',stay.checked_out_at,'outcome',outcome));
 end loop;
 result:=jsonb_build_object('request_id',p_request_id,'operation','check_in','household_profile_id',p_profile_id,'stays',results);
 insert into barangayan_private.household_attendance_receipts
 (actor_profile_id,request_id,household_profile_id,operation,input_fingerprint,result,created_at)
 values(actor.id,p_request_id,p_profile_id,'check_in',fingerprint,result,clock_timestamp());
 return result;
end $$;

create function barangayan_private.check_out_household_attendance(p_attendance_ids uuid[],p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor public.profiles; household public.profiles; ids uuid[]; household_id uuid;
 receipt barangayan_private.household_attendance_receipts; fingerprint jsonb; stay public.household_attendance;
 active public.household_attendance; results jsonb:='[]'; result jsonb; outcome text; center_name text;
begin
 if array_ndims(p_attendance_ids) is distinct from 1 then
  raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 if p_request_id is null or coalesce(cardinality(p_attendance_ids),0) not between 1 and 31
  or array_position(p_attendance_ids,null) is not null then
  raise exception 'invalid_attendance_selection' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text||':'||p_request_id::text,5));
 actor:=barangayan_private.attendance_actor('admin');
 select array_agg(distinct id order by id) into ids from unnest(p_attendance_ids) id;
 select household_profile_id into household_id from public.household_attendance where id=ids[1];
 perform 1 from auth.users where id=household_id for key share;
 select * into household from public.profiles where id=household_id for update;
 perform pg_advisory_xact_lock_shared(hashtextextended('attendance-identity:'||household_id::text,4));
 if household.id is null or household.role<>'resident' or household.deleted_at is not null or household.barangay_id is distinct from actor.barangay_id then
  raise exception 'attendance_forbidden' using errcode='42501'; end if;
 perform 1 from public.evacuation_centers where id in (
  select evacuation_center_id from public.household_attendance where id=any(ids)) order by id for update;
 perform 1 from public.household_attendance where id=any(ids) order by id for update;
 if (select count(*) from public.household_attendance s join public.evacuation_centers c on c.id=s.evacuation_center_id
  where s.id=any(ids) and s.household_profile_id=household_id and s.barangay_id=actor.barangay_id
  and c.barangay_id=actor.barangay_id)<>cardinality(ids) then
  raise exception 'attendance_forbidden' using errcode='42501'; end if;
 fingerprint:=jsonb_build_object('operation','check_out','household',household_id,'attendance_ids',to_jsonb(ids),'barangay',actor.barangay_id);
 select * into receipt from barangayan_private.household_attendance_receipts where actor_profile_id=actor.id and request_id=p_request_id;
 if found then
  if receipt.input_fingerprint->>'barangay' is distinct from actor.barangay_id::text then
   raise exception 'attendance_forbidden' using errcode='42501'; end if;
  if receipt.input_fingerprint is distinct from fingerprint then
   raise exception 'attendance_request_conflict' using errcode='PT409'; end if;
  return receipt.result;
 end if;
 for stay in select * from public.household_attendance where id=any(ids) order by id loop
  outcome:='already_closed';
  if stay.checked_out_at is null then
   update public.household_attendance set checked_out_at=greatest(clock_timestamp(),checked_in_at),checked_out_by=actor.id
    where id=stay.id returning * into stay;
   outcome:='closed';
  end if;
  if stay.household_member_id is not null then
   select * into active from public.household_attendance where household_member_id=stay.household_member_id and checked_out_at is null;
   select name into center_name from public.evacuation_centers where id=active.evacuation_center_id;
   update public.household_members set is_checked_in=active.id is not null,checked_in_at=active.checked_in_at,
    checked_in_center_id=active.evacuation_center_id,checked_in_center_name=center_name where id=stay.household_member_id;
  end if;
  results:=results||jsonb_build_array(jsonb_build_object('attendance_id',stay.id,
   'kind',case when stay.household_member_id is null then 'holder' else 'member' end,'member_id',stay.household_member_id,
   'center_id',stay.evacuation_center_id,'checked_in_at',stay.checked_in_at,'checked_out_at',stay.checked_out_at,'outcome',outcome));
 end loop;
 result:=jsonb_build_object('request_id',p_request_id,'operation','check_out','household_profile_id',household_id,'stays',results);
 insert into barangayan_private.household_attendance_receipts
 (actor_profile_id,request_id,household_profile_id,operation,input_fingerprint,result,created_at)
 values(actor.id,p_request_id,household_id,'check_out',fingerprint,result,clock_timestamp());
 return result;
end $$;

create function public.get_my_household_attendance() returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.get_my_household_attendance()
$$;
create function public.lookup_household_for_attendance(p_qr_payload text) returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.lookup_household_for_attendance(p_qr_payload)
$$;
create function public.check_in_household_members(p_profile_id uuid,p_center_id uuid,p_participants jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.check_in_household_members(p_profile_id,p_center_id,p_participants,p_request_id)
$$;
create function public.check_out_household_attendance(p_attendance_ids uuid[],p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select barangayan_private.check_out_household_attendance(p_attendance_ids,p_request_id)
$$;

-- The profile row is the common household mutex. Conditional saves keep their
-- seed-1 advisory lock BEFORE that row; other writers never acquire seed 1 after
-- taking a row lock. Direct member DML is removed, avoiding member->profile locks.
create or replace function public.sync_household_members_from_jsonb() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; member uuid; retained uuid[]:='{}'; normalized jsonb:='[]'; affected integer;
 member_name text; member_relation text; member_role text;
begin
 if jsonb_typeof(coalesce(new.household_members,'[]')) is distinct from 'array' then
  raise exception 'invalid_household_members' using errcode='22023'; end if;
 if jsonb_array_length(coalesce(new.household_members,'[]'))>30 then
  raise exception 'invalid_household_members' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(coalesce(new.household_members,'[]')) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'name') is distinct from 'string'
   or jsonb_typeof(item->'relation') is distinct from 'string'
   or (item ? 'role' and jsonb_typeof(item->'role') not in ('string','null')) then
   raise exception 'invalid_household_member' using errcode='22023'; end if;
  if item ? 'id' and (jsonb_typeof(item->'id') is distinct from 'string'
   or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
   raise exception 'invalid_household_member_id' using errcode='22023'; end if;
  begin member:=coalesce((item->>'id')::uuid,gen_random_uuid());
  exception when invalid_text_representation then
   raise exception 'invalid_household_member_id' using errcode='22023'; end;
  if member=any(retained) then raise exception 'duplicate_household_member_id' using errcode='22023'; end if;
  member_name:=btrim(item->>'name'); member_relation:=btrim(item->>'relation');
  member_role:=coalesce(nullif(btrim(item->>'role'),''),'member');
  if char_length(member_name) not between 1 and 200 or char_length(member_relation) not between 1 and 100
   or char_length(member_role)>50 then raise exception 'invalid_household_member' using errcode='22023'; end if;
  if exists(select 1 from public.household_members where id=member and profile_id<>new.id) then
   raise exception 'household_roster_changed' using errcode='PT409'; end if;
  if exists(select 1 from public.household_members where id=member and deleted_at is not null) then
   raise exception 'household_roster_changed' using errcode='PT409'; end if;
  retained:=array_append(retained,member);
  normalized:=normalized||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
   'id',member,'name',member_name,'relation',member_relation,'role',nullif(btrim(item->>'role'),''))));
 end loop;
 -- A concurrent household can introduce a previously unseen UUID after the
 -- ownership read above. Revalidate ownership inside ON CONFLICT itself, and
 -- acquire member rows in UUID order while retaining the original JSON order.
 insert into public.household_members as canonical(id,profile_id,name,relation,role)
 select (e->>'id')::uuid,new.id,e->>'name',e->>'relation',coalesce(e->>'role','member')
 from jsonb_array_elements(normalized) e order by (e->>'id')::uuid
 on conflict(id) do update set name=excluded.name,relation=excluded.relation,role=excluded.role
 where canonical.profile_id=excluded.profile_id and canonical.deleted_at is null;
 get diagnostics affected=row_count;
 if affected<>cardinality(retained) then raise exception 'household_roster_changed' using errcode='PT409'; end if;
 if exists(select 1 from public.household_attendance where household_profile_id=new.id
  and household_member_id is not null and not(household_member_id=any(retained)) and checked_out_at is null) then
  raise exception 'attendance_lifecycle_conflict' using errcode='PT409'; end if;
 update public.household_members m set deleted_at=clock_timestamp()
 where m.profile_id=new.id and m.deleted_at is null and not(m.id=any(retained))
 and exists(select 1 from public.household_attendance s where s.household_member_id=m.id);
 delete from public.household_members m where m.profile_id=new.id and m.deleted_at is null and not(m.id=any(retained));
 new.household_members:=normalized;
 return new;
end $$;

-- Covers INSERT as well as legacy direct JSON updates; new IDs are persisted in
-- the JSON, not regenerated on every edit. Existing update trigger is replaced.
drop trigger if exists sync_household_members_from_jsonb on public.profiles;
create trigger sync_household_members_from_jsonb before update of household_members on public.profiles
 for each row execute function public.sync_household_members_from_jsonb();
create function barangayan_private.initialize_attendance_household() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.household_members is distinct from '[]'::jsonb then
  update public.profiles set household_members=new.household_members where id=new.id;
 end if;
 return new;
end $$;
create trigger initialize_attendance_household after insert on public.profiles
 for each row execute function barangayan_private.initialize_attendance_household();
revoke insert,update,delete on public.household_members from anon,authenticated,service_role;

create or replace function barangayan_private.guard_household_archive() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated','service_role') then
  raise exception 'attendance_forbidden' using errcode='42501'; end if;
 if tg_op='DELETE' or new.deleted_at is distinct from old.deleted_at or new.profile_id is distinct from old.profile_id then
  if exists(select 1 from public.household_attendance where household_member_id=old.id and checked_out_at is null) then
   raise exception 'attendance_lifecycle_conflict' using errcode='PT409'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists guard_household_archive on public.household_members;
create trigger guard_household_archive before update or delete on public.household_members
 for each row execute function barangayan_private.guard_household_archive();

create function barangayan_private.guard_attendance_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or new.barangay_id is distinct from old.barangay_id
  or new.deleted_at is distinct from old.deleted_at
  or (tg_table_name='profiles' and to_jsonb(new)->>'role' is distinct from to_jsonb(old)->>'role') then
  if exists(select 1 from public.household_attendance where checked_out_at is null and
   ((tg_table_name='profiles' and household_profile_id=old.id) or
    (tg_table_name='evacuation_centers' and evacuation_center_id=old.id))) then
   raise exception 'attendance_lifecycle_conflict' using errcode='PT409'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_attendance_household before update of role,barangay_id,deleted_at or delete on public.profiles
 for each row execute function barangayan_private.guard_attendance_lifecycle();
create trigger guard_attendance_center before update of barangay_id,deleted_at or delete on public.evacuation_centers
 for each row execute function barangayan_private.guard_attendance_lifecycle();

-- Generic household mutations use this narrow privileged operation. The public
-- generic editor retains its invoker mode for every other screen.
create function barangayan_private.mutate_attendance_household_member(p_id uuid,p_operation text,p_patch jsonb,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles; household public.profiles; member public.household_members; household_id uuid;
 members jsonb; replacement jsonb;
begin
 actor:=barangayan_private.attendance_actor('admin');
 select profile_id into household_id from public.household_members where id=p_id;
 select * into household from public.profiles where id=household_id for update;
 if not found or household.role<>'resident' or household.barangay_id is distinct from actor.barangay_id then
  raise exception 'attendance_forbidden' using errcode='42501'; end if;
 select * into member from public.household_members where id=p_id and profile_id=household_id for update;
 if not found then raise exception 'household_roster_changed' using errcode='PT409'; end if;
 if p_expected is null or member.updated_at is distinct from p_expected then
  raise exception 'Record changed. Reload details.' using errcode='40001'; end if;
 if p_operation not in ('save','archive','restore','delete') or p_operation is null then
  raise exception 'Invalid action' using errcode='22023'; end if;
 if (p_operation='archive' and member.deleted_at is not null) or (p_operation='restore' and member.deleted_at is null) then
  raise exception 'Archive state changed. Reload details.' using errcode='40001'; end if;
 members:=coalesce(household.household_members,'[]');
 if p_operation='save' then
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}' or p_patch-array['name','relation','role']<>'{}'
   or exists(select 1 from jsonb_each(p_patch) where jsonb_typeof(value)<>'string') then
   raise exception 'Invalid editable fields' using errcode='22023'; end if;
  replacement:=jsonb_build_object('id',member.id,'name',coalesce(p_patch->>'name',member.name),
   'relation',coalesce(p_patch->>'relation',member.relation),'role',coalesce(p_patch->>'role',member.role));
  if char_length(btrim(replacement->>'name')) not between 1 and 200
   or char_length(btrim(replacement->>'relation')) not between 1 and 100
   or char_length(btrim(replacement->>'role')) not between 1 and 50 then
   raise exception 'invalid_household_member' using errcode='22023'; end if;
  if member.deleted_at is null then
   select jsonb_agg(case when e->>'id'=p_id::text then replacement else e end order by n)
   into members from jsonb_array_elements(members) with ordinality a(e,n);
   update public.profiles set household_members=members where id=household_id;
  else
   update public.household_members set name=replacement->>'name',relation=replacement->>'relation',role=replacement->>'role' where id=p_id;
  end if;
 elsif p_operation='restore' then
  if jsonb_array_length(members)>=30 then raise exception 'invalid_household_members' using errcode='22023'; end if;
  update public.household_members set deleted_at=null where id=p_id;
  update public.profiles set household_members=members||jsonb_build_array(jsonb_build_object('id',member.id,'name',member.name,
   'relation',member.relation,'role',member.role)) where id=household_id;
 else
  if exists(select 1 from public.household_attendance where household_member_id=p_id and checked_out_at is null) then
   raise exception 'attendance_lifecycle_conflict' using errcode='PT409'; end if;
  if p_operation='archive' then update public.household_members set deleted_at=clock_timestamp() where id=p_id; end if;
  if member.deleted_at is null then
   update public.profiles set household_members=(select coalesce(jsonb_agg(e order by n),'[]')
    from jsonb_array_elements(members) with ordinality a(e,n) where e->>'id'<>p_id::text) where id=household_id;
  end if;
  if p_operation='delete' then
   if exists(select 1 from public.household_attendance where household_member_id=p_id) then
    update public.household_members set deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id;
   else delete from public.household_members where id=p_id; end if;
  end if;
 end if;
 return jsonb_build_object('id',p_id);
end $$;

-- Keep the three verified roster APIs and strengthen their identity checks.
do $$
declare signature text; definition text; anchor text;
begin
 foreach signature in array array['public.admin_add_household_member(uuid,text,text,text)',
 'public.admin_update_household_member(uuid,uuid,text,text,text)','public.admin_remove_household_member(uuid,uuid)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  anchor:='if auth.uid() is null or public.current_role() is distinct from ''admin'' then';
  if strpos(definition,anchor)=0 then raise exception 'Roster authorization boundary missing: %',signature; end if;
  definition:=replace(definition,anchor,'perform barangayan_private.attendance_actor(''admin''); '||anchor);
  definition:=replace(definition,'and role = ''resident''','and role = ''resident'' and deleted_at is null');
  execute definition;
 end loop;
end $$;

-- Erasure runs only inside the existing fresh-authenticated deletion operations.
create function barangayan_private.erase_household_attendance(p_household uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_household is distinct from (select auth.uid()) then raise exception 'attendance_forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=p_household for update;
 perform pg_advisory_xact_lock(hashtextextended('attendance-identity:'||p_household::text,4));
 delete from barangayan_private.household_attendance_receipts where household_profile_id=p_household or actor_profile_id=p_household;
 delete from public.household_attendance where household_profile_id=p_household;
end $$;
do $$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.request_own_account_deletion()'::regprocedure);
 anchor:='update public.profiles set';
 if strpos(definition,anchor)=0 then raise exception 'Deletion v1 boundary missing'; end if;
 execute replace(definition,anchor,'perform barangayan_private.erase_household_attendance(v_user_id); '||anchor);
 definition:=pg_get_functiondef('public.erase_own_account_records()'::regprocedure);
 anchor:='-- References first:';
 if strpos(definition,anchor)=0 then raise exception 'Deletion v2 boundary missing'; end if;
 execute replace(definition,anchor,'perform barangayan_private.erase_household_attendance(v_user); '||anchor);
end $$;

-- A security-barrier export projection exposes only caller-owned metadata,
-- never staff identity, the fingerprint, or the private receipt result.
create view public.household_attendance_receipt_exports with (security_barrier=true) as
 select r.id,r.household_profile_id,r.request_id,r.operation,r.created_at
 from barangayan_private.household_attendance_receipts r
 where r.household_profile_id=(select auth.uid()) and exists(
  select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=(select auth.uid())
  and p.role='resident' and p.deleted_at is null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and (u.banned_until is null or u.banned_until<=now()));
revoke all on public.household_attendance_receipt_exports from public,anon,authenticated,service_role;
grant select on public.household_attendance_receipt_exports to authenticated;

-- This migration is the coordinated server cutover boundary. Preserve legacy
-- history and endpoint signatures, but reject direct, queued and RPC arrivals.
create function barangayan_private.reject_legacy_attendance() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated','service_role') then
  raise exception 'Ask barangay staff to scan your Family QR and confirm who is present. Update the app if needed.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger reject_legacy_attendance before insert or update on public.evacuation_center_checkins
 for each row execute function barangayan_private.reject_legacy_attendance();
create or replace function public.check_in_to_evacuation_center(p_center_id uuid)
returns table(check_in_id uuid,evacuation_center_id uuid,evacuation_center_name text,barangay_id uuid,
 checked_in_at timestamptz,already_checked_in boolean)
language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Ask barangay staff to scan your Family QR and confirm who is present. Update the app if needed.' using errcode='42501';
end $$;

-- Explicit grants, including private wrappers. Internal helpers are never RPCs.
do $$
declare signature text;
begin
 foreach signature in array array[
 'barangayan_private.serialize_attendance_identity()',
 'barangayan_private.initialize_attendance_household()',
 'barangayan_private.attendance_actor(text)',
 'barangayan_private.read_household_attendance(uuid,uuid)',
 'barangayan_private.guard_attendance_lifecycle()',
 'barangayan_private.erase_household_attendance(uuid)',
 'barangayan_private.reject_legacy_attendance()',
 'barangayan_private.guard_household_archive()',
 'public.sync_household_members_from_jsonb()'] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role';
 end loop;
 foreach signature in array array[
 'barangayan_private.attendance_can_read(uuid,uuid)',
 'barangayan_private.mutate_attendance_household_member(uuid,text,jsonb,timestamptz)',
 'barangayan_private.get_my_household_attendance()',
 'barangayan_private.lookup_household_for_attendance(text)',
 'barangayan_private.check_in_household_members(uuid,uuid,jsonb,uuid)',
 'barangayan_private.check_out_household_attendance(uuid[],uuid)',
 'public.get_my_household_attendance()',
 'public.lookup_household_for_attendance(text)',
 'public.check_in_household_members(uuid,uuid,jsonb,uuid)',
 'public.check_out_household_attendance(uuid[],uuid)'] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end $$;

-- Preserve the current request/payment corrections; replace only household routing.
CREATE OR REPLACE FUNCTION public.admin_mutate_record(p_screen text, p_id uuid, p_operation text, p_patch jsonb, p_expected timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare table_name text; allowed text[]; assignment text; current_record jsonb; actor public.profiles;
 affected integer; profile_patch jsonb; official_patch jsonb; linked_request uuid; payment_result jsonb;
begin
 if p_screen='households' then
  return barangayan_private.mutate_attendance_household_member(p_id,p_operation,p_patch,p_expected);
 end if;
 select * into actor from public.profiles where id=(select auth.uid()) and role='admin' and deleted_at is null;
 if actor.id is null then raise exception 'Active administrator required' using errcode='42501'; end if;
 case p_screen
 when 'requests' then table_name:='service_requests'; allowed:=array['reference_number','resident_id','document_type_id','created_at','status','requester_notes','payment_status','payment_method'];
 when 'transactions' then table_name:='payments'; allowed:=array['amount_centavos','method','status','paymongo_source_id','created_at','collected_by','request_reference','linked_resident_id','linked_document_type_id'];
 when 'residents' then table_name:='profiles'; allowed:=array['first_name','last_name','middle_name','suffix','sex','email','mobile_number','birth_date','house_no','street','city','employment_status','occupation'];
 when 'incidents' then table_name:='incidents'; allowed:=array['title','description','address','specific_area_details','status','category_id','reporter_id','location','confirmation_count','created_at'];
 when 'health' then table_name:='medical_drives'; allowed:=array['title','type','drive_date','location','time_start','time_end','eligible_criteria','stock_label','stock_unit','stock_total','stock_remaining','is_active'];
 when 'applicants' then table_name:='drive_registrations'; allowed:=array['age','is_pwd','comorbidities','prior_dose_date','status'];

 when 'staff' then table_name:='barangay_officials'; allowed:=array['full_name','mobile_number','home_address','official_role','date_hired','is_active'];
 else raise exception 'Invalid screen' using errcode='22023'; end case;
 if p_operation not in ('save','archive','restore','delete') then raise exception 'Invalid action' using errcode='22023'; end if;
 execute format('select to_jsonb(b) from public.%I b where id=$1 for update',table_name) into current_record using p_id;
 if current_record is null or not exists(
  select 1 from public.profiles where id=actor.id and deleted_at is null) then
  raise exception 'Record unavailable' using errcode='42501';
 end if;
 -- The record projections check the same active administrator and tenant,
 -- including parent-based tenant membership for household/applicant rows.
 execute format('select count(*) from public.admin_%I_records where id=$1 and tenant_id=$2',p_screen) into affected using p_id,actor.barangay_id;
 if affected<>1 then raise exception 'Record unavailable' using errcode='42501'; end if;
 if p_screen='residents' and current_record->>'role'='admin' and p_operation<>'save' then
   raise exception 'Manage admin account removal through Staff' using errcode='42501';
  end if;
  if p_screen='staff' and (current_record->>'profile_id')::uuid=actor.id then raise exception 'You cannot change your own staff record' using errcode='42501'; end if;
 if p_expected is null or (current_record->>'updated_at')::timestamptz is distinct from p_expected then
  raise exception 'Record changed. Reload details.' using errcode='40001'; end if;
 if p_operation='archive' and current_record->>'deleted_at' is not null or p_operation='restore' and current_record->>'deleted_at' is null then
  raise exception 'Archive state changed. Reload details.' using errcode='40001'; end if;

 if p_operation='save' then
  if p_screen='requests' and current_record->>'contract_version'='2' then
   return barangayan_private.admin_edit_request_details(p_id,p_patch,p_expected);
  end if;
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then
   raise exception 'Invalid editable fields' using errcode='22023'; end if;
  if p_screen='requests' and current_record->>'contract_version'='2' and p_patch-array['payment_method','payment_status']<>'{}'::jsonb then raise exception 'Use request review' using errcode='42501'; end if;
   if p_screen='requests' and p_patch ?| array['payment_method','payment_status'] then
    payment_result := barangayan_private.admin_edit_request_payment(p_id,
     (select jsonb_object_agg(key,value) from jsonb_each(p_patch) where key in ('payment_method','payment_status')),p_expected);
    p_patch := p_patch-array['payment_method','payment_status'];
    if p_patch='{}'::jsonb then return payment_result; end if;
   end if;
  if p_screen='transactions' and current_record->>'status'<>'pending' and p_patch?'amount_centavos' then raise exception 'Paid amounts are immutable' using errcode='42501'; end if;
  if exists(select 1 from jsonb_each(p_patch) e where e.key in ('name','title','first_name','last_name','full_name','location','eligible_criteria','stock_label','stock_unit') and coalesce(trim(e.value#>>'{}'),'')='') then
   raise exception 'Required fields cannot be empty' using errcode='22023'; end if;
  -- Validate references in the caller's tenant before any write. Domain triggers
  -- continue to protect versioned request snapshots and settled payment amounts.
  if p_screen='incidents' then
   if p_patch->>'category_id' is not null and not exists(select 1 from public.incident_categories where id=(p_patch->>'category_id')::uuid and barangay_id=actor.barangay_id) then
    raise exception 'Category unavailable' using errcode='42501'; end if;
   if p_patch->>'reporter_id' is not null and not exists(select 1 from public.profiles where id=(p_patch->>'reporter_id')::uuid and barangay_id=actor.barangay_id and role='resident' and deleted_at is null) then
    raise exception 'Reporter unavailable' using errcode='42501'; end if;
   if p_patch?'confirmation_count' and (jsonb_typeof(p_patch->'confirmation_count')<>'number' or (p_patch->>'confirmation_count')::numeric<0 or (p_patch->>'confirmation_count')::numeric<>trunc((p_patch->>'confirmation_count')::numeric)) then
    raise exception 'Invalid confirmation count' using errcode='22023'; end if;
   if p_patch?'location' and p_patch->'location'<>'null'::jsonb and
    (jsonb_typeof(p_patch->'location')<>'object' or jsonb_typeof(p_patch->'location'->'lat') is distinct from 'number' or jsonb_typeof(p_patch->'location'->'lng') is distinct from 'number'
     or abs((p_patch->'location'->>'lat')::numeric)>90 or abs((p_patch->'location'->>'lng')::numeric)>180) then
    raise exception 'Invalid coordinates' using errcode='22023'; end if;
  end if;
  if p_screen='requests' then
   if p_patch?'resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'resident_id')::uuid and barangay_id=actor.barangay_id and role in ('resident','admin') and deleted_at is null) then
    raise exception 'Resident unavailable' using errcode='42501'; end if;
   if p_patch?'document_type_id' and not exists(select 1 from public.document_types where id=(p_patch->>'document_type_id')::uuid and barangay_id=actor.barangay_id and deleted_at is null) then
    raise exception 'Document unavailable' using errcode='42501'; end if;
  end if;
  if p_screen='transactions' then
   linked_request:=(current_record->>'service_request_id')::uuid;
   if p_patch?'request_reference' then
    select id into linked_request from public.service_requests
    where reference_number=ltrim(btrim(p_patch->>'request_reference'),'#') and barangay_id=actor.barangay_id and deleted_at is null for update;
    if linked_request is null then raise exception 'Request reference not found' using errcode='22023'; end if;
    p_patch:=p_patch-'request_reference'||jsonb_build_object('service_request_id',linked_request);
   end if;
   if p_patch->>'collected_by' is not null and not exists(select 1 from public.profiles where id=(p_patch->>'collected_by')::uuid and barangay_id=actor.barangay_id and role='admin' and deleted_at is null) then
    raise exception 'Collector unavailable' using errcode='42501'; end if;
   if p_patch ?| array['linked_resident_id','linked_document_type_id'] then
    if p_patch?'linked_resident_id' and not exists(select 1 from public.profiles where id=(p_patch->>'linked_resident_id')::uuid and barangay_id=actor.barangay_id and role in ('resident','admin') and deleted_at is null) then
     raise exception 'Resident unavailable' using errcode='42501'; end if;
    if p_patch?'linked_document_type_id' and not exists(select 1 from public.document_types where id=(p_patch->>'linked_document_type_id')::uuid and barangay_id=actor.barangay_id and deleted_at is null) then
     raise exception 'Document unavailable' using errcode='42501'; end if;
    update public.service_requests set
     resident_id=case when p_patch?'linked_resident_id' then (p_patch->>'linked_resident_id')::uuid else resident_id end,
     document_type_id=case when p_patch?'linked_document_type_id' then (p_patch->>'linked_document_type_id')::uuid else document_type_id end
     where id=linked_request and barangay_id=actor.barangay_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Linked request unavailable' using errcode='42501'; end if;
    p_patch:=p_patch-array['linked_resident_id','linked_document_type_id'];
   end if;
   if p_patch->>'status'='paid' and current_record->>'status'<>'paid' then
    p_patch:=p_patch||jsonb_build_object('paid_at',now());
   end if;
  end if;

   official_patch:=p_patch;
   if p_screen='staff' then
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into profile_patch from jsonb_each(p_patch) where key in ('full_name','mobile_number','home_address');
    official_patch:=p_patch-array['full_name','mobile_number','home_address'];
    if profile_patch<>'{}'::jsonb then
     select string_agg(format('%I = v.%I',key,key),',') into assignment from jsonb_object_keys(profile_patch) key;
     execute format('update public.profiles b set %s from jsonb_populate_record(null::public.profiles,$1) v where b.id=$2',assignment)
      using profile_patch,(current_record->>'profile_id')::uuid;
     get diagnostics affected=row_count;
     if affected<>1 then raise exception 'Staff profile update denied' using errcode='42501'; end if;
    end if;
   end if;
   if official_patch<>'{}'::jsonb then
    select string_agg(format('%I = v.%I',key,key),',') into assignment from jsonb_object_keys(official_patch) key;
    execute format('update public.%I b set %s from jsonb_populate_record(null::public.%I,$1) v where b.id=$2',table_name,assignment,table_name) using official_patch,p_id;
   else
    -- Profile-only staff edits still advance the roster version for concurrency.
    execute format('update public.%I set updated_at=now() where id=$1',table_name) using p_id;
   end if;
   get diagnostics affected=row_count;
 elsif p_operation='delete' then

  execute format('delete from public.%I where id=$1',table_name) using p_id;
  get diagnostics affected=row_count;

 else
  execute format('update public.%I set deleted_at=$1 where id=$2',table_name)
   using case when p_operation='archive' then now() else null::timestamptz end,p_id;
  get diagnostics affected=row_count;

 end if;
 if affected<>1 then raise exception 'No record changed. Check your access.' using errcode='42501'; end if;
 return jsonb_build_object('id',p_id);
end $function$;

-- CREATE OR REPLACE retains prior owners. A schema restored by supabase_admin
-- can contain postgres-owned entrypoints: grant only those verified trusted
-- owners the internal helpers, without granting client roles another write path.
do $$
declare target record; owner_name text;
begin
 for target in select p.proowner,'barangayan_private.attendance_actor(text)' helper
  from pg_proc p where p.oid in (
   'public.admin_add_household_member(uuid,text,text,text)'::regprocedure,
   'public.admin_update_household_member(uuid,uuid,text,text,text)'::regprocedure,
   'public.admin_remove_household_member(uuid,uuid)'::regprocedure)
  union select p.proowner,'barangayan_private.erase_household_attendance(uuid)'
  from pg_proc p where p.oid in ('public.request_own_account_deletion()'::regprocedure,
   'public.erase_own_account_records()'::regprocedure)
 loop
  owner_name:=pg_get_userbyid(target.proowner);
  if owner_name in ('anon','authenticated','service_role') then
   raise exception 'Untrusted lifecycle function owner: %',owner_name;
  end if;
  execute format('grant execute on function %s to %I',target.helper,owner_name);
 end loop;
end $$;

notify pgrst,'reload schema';
commit;
