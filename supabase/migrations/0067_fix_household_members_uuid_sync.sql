-- 0067_fix_household_members_uuid_sync.sql
--
-- Bug: adding a household member from the resident mobile Profile screen
-- failed with "invalid input syntax for type uuid".
--
-- Root cause: profile.tsx / use-profile-household-members.ts generate
-- client-side member ids with `Math.random().toString(36) + Date.now()`,
-- which are not valid UUIDs. The 0052 sync trigger
-- (sync_household_members_from_jsonb) mirrors profiles.household_members
-- (jsonb) into the canonical household_members table and does
-- `(v_member->>'id')::uuid` with no error handling, so any non-UUID id
-- throws and the whole profiles UPDATE — including the add-member save —
-- fails.
--
-- The mobile app is fixed separately to generate real UUIDs going forward,
-- but the trigger must not hard-fail on a malformed id (old cached ids,
-- other future clients, etc.) — mirror the defensive coalesce/exception
-- pattern already used by the 0052 backfill block.

create or replace function public.sync_household_members_from_jsonb()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member jsonb;
  v_id     uuid;
begin
  delete from household_members where profile_id = old.id;

  if new.household_members is not null then
    for v_member in select * from jsonb_array_elements(new.household_members)
    loop
      begin
        v_id := coalesce((v_member->>'id')::uuid, gen_random_uuid());
      exception when invalid_text_representation then
        v_id := gen_random_uuid();
      end;

      insert into household_members (id, profile_id, name, relation, role)
      values (
        v_id,
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

comment on function public.sync_household_members_from_jsonb() is
  'Mirrors profiles.household_members (jsonb, resident-editable) into the '
  'canonical household_members table. Falls back to a fresh uuid for any '
  'member id that is not a valid uuid instead of failing the triggering '
  'UPDATE (see migration 0067).';
