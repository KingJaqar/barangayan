-- 0052_household_admin_management.sql
-- Admin Household & Residents screen integration.
--
-- Database status: existing tables are sufficient.
--   profiles.household_members (jsonb) — denormalised member list
--   household_members (table)       — canonical member rows with check-in state
--
-- What this migration adds:
--   1. Admin RLS policies for INSERT / UPDATE / DELETE on household_members
--   2. Atomic RPCs that keep both the jsonb cache and the table in sync
--   3. A trigger that keeps the jsonb cache in sync when residents edit via mobile

-- ── 1. Admin write policies ───────────────────────────────────────────────────
drop policy if exists "admins manage barangay household members" on public.household_members;

create policy "admins manage barangay household members"
  on public.household_members for all
  to authenticated
  using (
    public.current_role() = 'admin'
    and profile_id in (
      select id from public.profiles
      where barangay_id = public.current_barangay_id()
    )
  )
  with check (
    public.current_role() = 'admin'
    and profile_id in (
      select id from public.profiles
      where barangay_id = public.current_barangay_id()
    )
  );

-- ── 2. Atomic RPCs ────────────────────────────────────────────────────────────

-- Add a household member and sync the jsonb cache on profiles
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
  v_profile  profiles%rowtype;
  v_members  jsonb;
begin
  select * into v_profile from profiles where id = p_profile_id;
  if not found then
    raise exception 'Profile % not found', p_profile_id;
  end if;

  v_members := coalesce(v_profile.household_members, '[]'::jsonb);
  v_members := v_members || jsonb_build_object(
    'id',       v_member_id::text,
    'name',     p_name,
    'relation', p_relation,
    'role',     p_role
  );

  update profiles set household_members = v_members where id = p_profile_id;
  insert into household_members (id, profile_id, name, relation, role)
  values (v_member_id, p_profile_id, p_name, p_relation, p_role);

  return v_member_id;
end;
$$;

-- Update a household member and sync the jsonb cache on profiles
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
begin
  select household_members into v_members from profiles where id = p_profile_id;
  if v_members is null then
    raise exception 'Profile % not found', p_profile_id;
  end if;

  v_members := (
    select jsonb_agg(
      case when (elem->>'id')::uuid = p_member_id
        then jsonb_build_object(
          'id',       p_member_id::text,
          'name',     p_name,
          'relation', p_relation,
          'role',     p_role
        )
        else elem
      end
    )
    from jsonb_array_elements(v_members) as elem
  );

  if v_members is null then
    raise exception 'Member % not found in profile %', p_member_id, p_profile_id;
  end if;

  update profiles set household_members = v_members where id = p_profile_id;
  update household_members
     set name = p_name,
         relation = p_relation,
         role = p_role
   where id = p_member_id
     and profile_id = p_profile_id;
end;
$$;

-- Remove a household member and sync the jsonb cache on profiles
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
begin
  select household_members into v_members from profiles where id = p_profile_id;
  if v_members is null then
    raise exception 'Profile % not found', p_profile_id;
  end if;

  v_members := (
    select jsonb_agg(elem)
    from jsonb_array_elements(v_members) as elem
    where (elem->>'id')::uuid != p_member_id
  );

  update profiles set household_members = v_members where id = p_profile_id;
  delete from household_members where id = p_member_id and profile_id = p_profile_id;
end;
$$;

-- ── 3. Sync trigger (resident-side edits via mobile) ─────────────────────────
-- When a resident adds/updates/removes a member via the mobile app the jsonb
-- column is the source of truth there.  This trigger reconciles the dedicated
-- table so the admin panel sees a single source of truth.

create or replace function public.sync_household_members_from_jsonb()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member jsonb;
begin
  delete from household_members where profile_id = old.id;

  if new.household_members is not null then
    for v_member in select * from jsonb_array_elements(new.household_members)
    loop
      insert into household_members (id, profile_id, name, relation, role)
      values (
        coalesce((v_member->>'id')::uuid, gen_random_uuid()),
        new.id,
        v_member->>'name',
        v_member->>'relation',
        v_member->>'role'
      )
      on conflict (id) do update set
        name     = excluded.name,
        relation = excluded.relation,
        role     = excluded.role;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_household_members_from_jsonb on public.profiles;

create trigger sync_household_members_from_jsonb
  after update of household_members on public.profiles
  for each row
  when (old.household_members is distinct from new.household_members)
  execute function public.sync_household_members_from_jsonb();

-- Backfill existing data
do $$
declare
  r record;
  v_member jsonb;
begin
  for r in select id, household_members from public.profiles where household_members is not null
  loop
    delete from public.household_members where profile_id = r.id;
    for v_member in select * from jsonb_array_elements(r.household_members)
    loop
      insert into public.household_members (id, profile_id, name, relation, role)
      values (
        coalesce((v_member->>'id')::uuid, gen_random_uuid()),
        r.id,
        v_member->>'name',
        v_member->>'relation',
        v_member->>'role'
      )
      on conflict (id) do nothing;
    end loop;
  end loop;
end;
$$;
