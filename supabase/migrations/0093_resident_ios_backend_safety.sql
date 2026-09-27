-- Safety prerequisites found while preparing the resident iOS implementation.
-- Keep household identity edits tenant-scoped and preserve attendance, retain the
-- administrator RPC contract, isolate private ID images by barangay, and reserve
-- one QR PH creation per service request before contacting PayMongo.

-- Reconcile canonical household rows before saving the profile JSON. This preserves
-- attendance for retained IDs, rejects IDs owned by another household, and writes
-- normalized UUIDs back so legacy malformed IDs do not change on every edit.
create or replace function public.sync_household_members_from_jsonb()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member jsonb;
  v_normalized_members jsonb := '[]'::jsonb;
  v_member_id uuid;
  v_existing_profile_id uuid;
  v_seen_ids uuid[] := '{}'::uuid[];
begin
  if new.household_members is not null
     and jsonb_typeof(new.household_members) <> 'array' then
    raise exception 'household_members must be a JSON array';
  end if;

  for v_member in
    select value
    from jsonb_array_elements(coalesce(new.household_members, '[]'::jsonb)) as item(value)
  loop
    if jsonb_typeof(v_member) <> 'object' then
      raise exception 'Each household member must be a JSON object';
    end if;

    begin
      v_member_id := nullif(v_member->>'id', '')::uuid;
    exception when invalid_text_representation then
      v_member_id := null;
    end;
    v_member_id := coalesce(v_member_id, gen_random_uuid());

    if v_member_id = any(v_seen_ids) then
      raise exception 'Duplicate household member ID %', v_member_id;
    end if;

    select hm.profile_id
      into v_existing_profile_id
      from public.household_members hm
      where hm.id = v_member_id
      for update;

    if found then
      if v_existing_profile_id is distinct from new.id then
        raise exception 'Household member ID % belongs to another profile', v_member_id;
      end if;

      update public.household_members
        set name = v_member->>'name',
            relation = v_member->>'relation',
            role = v_member->>'role'
        where id = v_member_id and profile_id = new.id;
    else
      insert into public.household_members (id, profile_id, name, relation, role)
      values (
        v_member_id,
        new.id,
        v_member->>'name',
        v_member->>'relation',
        v_member->>'role'
      );
    end if;

    v_seen_ids := array_append(v_seen_ids, v_member_id);
    v_normalized_members := v_normalized_members || jsonb_set(
      v_member,
      '{id}',
      to_jsonb(v_member_id::text),
      true
    );
  end loop;

  if new.household_members is not null then
    new.household_members := v_normalized_members;
  end if;

  delete from public.household_members hm
    where hm.profile_id = new.id
      and not (hm.id = any(v_seen_ids));

  return new;
end;
$$;

drop trigger if exists sync_household_members_from_jsonb on public.profiles;
create trigger sync_household_members_from_jsonb
  before update of household_members on public.profiles
  for each row
  when (old.household_members is distinct from new.household_members)
  execute function public.sync_household_members_from_jsonb();

-- These SECURITY DEFINER RPCs bypass row policies, so authorization and tenant
-- ownership must be checked inside every function. The trigger above now owns the
-- canonical table write; do not insert/update/delete the same member a second time.
create or replace function public.admin_add_household_member(
  p_profile_id uuid,
  p_name text,
  p_relation text,
  p_role text default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := gen_random_uuid();
  v_profile public.profiles%rowtype;
  v_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select * into v_profile
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  v_members := coalesce(v_profile.household_members, '[]'::jsonb);
  v_members := v_members || jsonb_build_object(
    'id', v_member_id::text,
    'name', p_name,
    'relation', p_relation,
    'role', p_role
  );

  update public.profiles set household_members = v_members where id = p_profile_id;
  return v_member_id;
end;
$$;

create or replace function public.admin_update_household_member(
  p_profile_id uuid,
  p_member_id uuid,
  p_name text,
  p_relation text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members jsonb;
  v_updated_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select household_members into v_members
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  select jsonb_agg(
    case when elem->>'id' = p_member_id::text then jsonb_build_object(
      'id', p_member_id::text,
      'name', p_name,
      'relation', p_relation,
      'role', p_role
    ) else elem end
    order by item.ordinality
  ) into v_updated_members
  from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) with ordinality as item(elem, ordinality);

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as item(elem)
    where elem->>'id' = p_member_id::text
  ) then
    raise exception 'Member % not found in profile %', p_member_id, p_profile_id;
  end if;

  update public.profiles set household_members = v_updated_members where id = p_profile_id;
end;
$$;

create or replace function public.admin_remove_household_member(
  p_profile_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members jsonb;
  v_updated_members jsonb;
begin
  if auth.uid() is null or public.current_role() is distinct from 'admin' then
    raise exception 'only authenticated administrators can manage household members';
  end if;

  select household_members into v_members
    from public.profiles
    where id = p_profile_id
      and barangay_id = public.current_barangay_id()
      and role = 'resident'
    for update;
  if not found then
    raise exception 'Profile % not found in your barangay', p_profile_id;
  end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as item(elem)
    where elem->>'id' = p_member_id::text
  ) then
    raise exception 'Member % not found in profile %', p_member_id, p_profile_id;
  end if;

  select coalesce(jsonb_agg(elem order by item.ordinality), '[]'::jsonb) into v_updated_members
  from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) with ordinality as item(elem, ordinality)
  where coalesce(elem->>'id', '') <> p_member_id::text;

  update public.profiles set household_members = v_updated_members where id = p_profile_id;
end;
$$;

revoke all on function public.admin_add_household_member(uuid, text, text, text) from public, anon;
revoke all on function public.admin_update_household_member(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.admin_remove_household_member(uuid, uuid) from public, anon;
grant execute on function public.admin_add_household_member(uuid, text, text, text) to authenticated;
grant execute on function public.admin_update_household_member(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.admin_remove_household_member(uuid, uuid) to authenticated;

-- Public-read history in migration 0042 made private IDs retrievable without
-- tenant scoping. Remove it and explicitly cover both profile IDs and request IDs.
drop policy if exists "admins read all id docs" on storage.objects;

create policy "admins read barangay profile id docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'id-documents'
  and public.current_role() = 'admin'
  and exists (
    select 1 from public.profiles p
    where p.role = 'resident'
      and p.barangay_id = public.current_barangay_id()
      and name = any(p.id_photo_urls)
  )
);

-- The existing per-service-request ID policy remains in place and is already
-- barangay-scoped. Private buckets keep anonymous object reads disabled.

-- A reservation row is created before the external PayMongo calls. Its unique
-- request key serializes concurrent function invocations; it is cleared only after
-- a complete QR has been stored or the incomplete attempt has been safely abandoned.
alter table public.payments add column qrph_creation_key uuid;
create unique index payments_qrph_creation_key_uidx
  on public.payments (qrph_creation_key)
  where method = 'qrph' and qrph_creation_key is not null;

comment on column public.payments.qrph_creation_key is
  'Temporary per-request creation reservation for QR PH. Set before contacting PayMongo and cleared after the QR is persisted or the attempt is abandoned.';
