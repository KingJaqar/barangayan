-- Household Members table for family emergency management
-- Tracks each member of a resident's household with check-in status

create table public.household_members (
  id              uuid        primary key default gen_random_uuid(),
  profile_id      uuid        not null references public.profiles(id) on delete cascade,
  name            text        not null,
  relation        text        not null,
  role            text        not null default 'member',
  avatar_url      text        null,
  is_checked_in   boolean     not null default false,
  checked_in_at   timestamptz null,
  checked_in_center_id   uuid   null references public.evacuation_centers(id) on delete set null,
  checked_in_center_name text   null,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index household_members_profile_idx on public.household_members (profile_id);
create index household_members_center_idx on public.household_members (checked_in_center_id);

alter table public.household_members enable row level security;

-- Residents manage their own household members
create policy "residents manage own household"
  on public.household_members for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Admins may read household members in their barangay
create policy "admins read barangay household"
  on public.household_members for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and profile_id in (
      select id from public.profiles where barangay_id = public.current_barangay_id()
    )
  );

-- Auto-update updated_at
create or replace function public.handle_household_member_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger household_members_updated_at
  before update on public.household_members
  for each row execute function public.handle_household_member_updated_at();
