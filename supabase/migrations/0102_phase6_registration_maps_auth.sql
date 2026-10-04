begin;

-- Preserve the original registration observation; selected home is a separate value.
alter table public.profiles add column registration_home_location jsonb;

create function barangayan_private.valid_location(p jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when p is null or p='null'::jsonb then true
 when jsonb_typeof(p) <> 'object' then false
 when (select count(*) from jsonb_object_keys(p)) <> 2 then false
 when jsonb_typeof(p->'lat') is distinct from 'number' or jsonb_typeof(p->'lng') is distinct from 'number' then false
 else (p->>'lat')::numeric between -90 and 90 and (p->>'lng')::numeric between -180 and 180 end
$$;

-- Ray casting with inclusive edges and holes, matching the shared calculation.
create function barangayan_private.point_in_ring(p jsonb, ring jsonb) returns integer
language plpgsql immutable set search_path='' as $$
declare x numeric:=(p->>'lng')::numeric; y numeric:=(p->>'lat')::numeric;
 a jsonb; b jsonb; ax numeric; ay numeric; bx numeric; byy numeric; inside boolean:=false; i integer;
begin
 if jsonb_typeof(ring)<>'array' or jsonb_array_length(ring)<4 then return 0; end if;
 for i in 0..jsonb_array_length(ring)-2 loop
  a:=ring->i; b:=ring->(i+1); ax:=(a->>0)::numeric; ay:=(a->>1)::numeric; bx:=(b->>0)::numeric; byy:=(b->>1)::numeric;
  if (x-ax)*(byy-ay)=(y-ay)*(bx-ax) and x between least(ax,bx) and greatest(ax,bx) and y between least(ay,byy) and greatest(ay,byy) then return 2; end if;
  if (ay>y)<>(byy>y) then
   if x < (bx-ax)*(y-ay)/(byy-ay)+ax then inside:=not inside; end if;
  end if;
 end loop;
 return case when inside then 1 else 0 end;
end $$;

create function barangayan_private.location_inside(p jsonb, geometry jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare polygons jsonb; poly jsonb; ring jsonb; result integer; accepted boolean;
begin
 if p is null or p='null'::jsonb or geometry is null or geometry='null'::jsonb then return null; end if;
 if not barangayan_private.valid_location(p) then raise exception 'invalid_coordinates' using errcode='22023'; end if;
 if geometry->>'type'='Polygon' then polygons:=jsonb_build_array(geometry->'coordinates');
 elsif geometry->>'type'='MultiPolygon' then polygons:=geometry->'coordinates'; else return null; end if;
 if jsonb_typeof(polygons) is distinct from 'array' or jsonb_array_length(polygons)=0 then return null; end if;
 for poly in select value from jsonb_array_elements(polygons) loop
  result:=barangayan_private.point_in_ring(p,poly->0);
  if result=2 then return true; end if;
  accepted:=result=1;
  for ring in select value from jsonb_array_elements(poly) with ordinality as r(value,n) where n>1 loop
   result:=barangayan_private.point_in_ring(p,ring);
   if result=2 then return true; end if;
   if result=1 then accepted:=false; end if;
  end loop;
  if accepted then return true; end if;
 end loop;
 return false;
end $$;

create function barangayan_private.guard_profile_locations() returns trigger
language plpgsql security definer set search_path='' as $$
declare geometry jsonb; metadata jsonb; configured uuid;
begin
 select boundary into geometry from public.barangays where id=new.barangay_id;
 if tg_op='INSERT' and new.role='resident' then
  select raw_user_meta_data into metadata from auth.users where id=new.id;
  if metadata ? 'barangay_id' then
   select barangay_id into configured from public.barangay_localities where resident_registration_enabled;
   if (select count(*) from public.barangay_localities where resident_registration_enabled)<>1 or new.barangay_id is distinct from configured then
    raise exception 'registration_locality_not_configured' using errcode='22023';
   end if;
  end if;
  if metadata ? 'registration_gps' then new.registration_location:=nullif(metadata->'registration_gps','null'::jsonb); end if;
  if metadata ? 'registration_home' then new.registration_home_location:=nullif(metadata->'registration_home','null'::jsonb); end if;
 elsif tg_op='UPDATE' and current_setting('role',true) in ('authenticated','anon')
   and current_setting('barangayan.profile_location_operation',true) is distinct from new.id::text
   and (new.registration_location is distinct from old.registration_location or new.registration_home_location is distinct from old.registration_home_location
     or new.location_verified is distinct from old.location_verified) then
  raise exception 'registration_location_operation_required' using errcode='42501';
 end if;
 if not barangayan_private.valid_location(new.registration_location) or not barangayan_private.valid_location(new.registration_home_location)
   or not barangayan_private.valid_location(new.verified_location) then raise exception 'invalid_coordinates' using errcode='22023'; end if;
 if tg_op='INSERT' then
  new.location_verified:=barangayan_private.location_inside(coalesce(new.registration_home_location,new.registration_location),geometry);
 end if;
 if new.verified_location is not null and (tg_op='INSERT' or new.verified_location is distinct from old.verified_location) then
  if barangayan_private.location_inside(new.verified_location,geometry) is distinct from true then raise exception 'location_outside_or_unavailable' using errcode='22023'; end if;
  new.location_verified_at:=clock_timestamp();
 elsif tg_op='UPDATE' and new.location_verified_at is distinct from old.location_verified_at and new.verified_location is not distinct from old.verified_location then
  new.location_verified_at:=old.location_verified_at;
 end if;
 return new;
end $$;
create trigger z_guard_profile_locations before insert or update on public.profiles
for each row execute function barangayan_private.guard_profile_locations();

-- Keep the proven identity/tenant/locking operation and extend it transactionally.
alter function barangayan_private.complete_resident_profile(jsonb) rename to complete_resident_profile_fields;
create function barangayan_private.complete_resident_profile(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid; location jsonb; geometry jsonb;
begin
 location:=p_input->'location';
 if location is not null then
  perform barangayan_private.check_keys(location,array['gps','home']);
  if not barangayan_private.valid_location(location->'gps') or not barangayan_private.valid_location(location->'home') then raise exception 'invalid_coordinates' using errcode='22023'; end if;
 end if;
 uid:=barangayan_private.complete_resident_profile_fields(p_input-'location');
 if location is not null then
  select b.boundary into geometry from public.barangays b join public.profiles p on p.barangay_id=b.id where p.id=uid;
  perform set_config('barangayan.profile_location_operation',uid::text,true);
  update public.profiles set registration_location=nullif(location->'gps','null'::jsonb),registration_home_location=nullif(location->'home','null'::jsonb),
   location_verified=barangayan_private.location_inside(coalesce(nullif(location->'home','null'::jsonb),nullif(location->'gps','null'::jsonb)),geometry) where id=uid;
  perform set_config('barangayan.profile_location_operation','',true);
 end if;
 return uid;
end $$;
-- Rebind the public wrapper to the new private implementation.
create or replace function public.complete_resident_profile(p_input jsonb) returns uuid language sql security invoker set search_path='' as $$ select barangayan_private.complete_resident_profile(p_input) $$;
revoke all on function barangayan_private.complete_resident_profile_fields(jsonb) from public,anon,authenticated;
revoke all on function barangayan_private.complete_resident_profile(jsonb) from public,anon;
grant execute on function barangayan_private.complete_resident_profile(jsonb) to authenticated;
revoke all on function barangayan_private.valid_location(jsonb),barangayan_private.point_in_ring(jsonb,jsonb),barangayan_private.location_inside(jsonb,jsonb),barangayan_private.guard_profile_locations() from public,anon,authenticated;
commit;
