-- Extends profiles with four new columns needed by the mobile Profile screen
-- (Module: Resident Profile) and the admin Resident Directory refactor.
--
-- email            — denormalised from auth.users so admins can query it via
--                    the regular RLS-gated profiles table without service_role.
-- household_members — JSONB array of { name, relation, role } descriptors for
--                    each person living with the resident.
-- id_photo_urls    — array of Storage object paths (bucket: id-documents) for
--                    the government-issued ID photos the resident uploads.
-- id_type          — human-readable name of the submitted ID document.

alter table public.profiles
  add column if not exists email               text,
  add column if not exists household_members   jsonb  not null default '[]'::jsonb,
  add column if not exists id_photo_urls       text[] not null default '{}',
  add column if not exists id_type             text;

-- ── Back-fill email from auth.users for all existing rows ─────────────────────
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null;

-- ── Comments ──────────────────────────────────────────────────────────────────

comment on column public.profiles.email is
  'Denormalised copy of auth.users.email. Kept in sync by the handle_new_user '
  'trigger (0012) and the admin invite API route. Readable by admins via the '
  'profiles RLS policy; auth.users itself requires service_role.';

comment on column public.profiles.household_members is
  'JSON array of household-member objects: '
  '[{"id":"…","name":"…","relation":"…","role":"…"}, …]. '
  'Managed entirely by the resident via the mobile Profile screen.';

comment on column public.profiles.id_photo_urls is
  'Array of Supabase Storage object paths inside the id-documents bucket. '
  'Populated when the resident uploads their government-issued ID on the '
  'mobile Profile screen. Use storage.from("id-documents").getPublicUrl(path) '
  'to turn each path into a viewable URL.';

comment on column public.profiles.id_type is
  'Type of government-issued ID submitted by the resident, e.g. '
  '"PhilSys", "Driver''s License", "Passport", "SSS", "Voter''s ID".';

-- ── Update handle_new_user() to also capture email on signup ──────────────────
-- The trigger is recreated; the migration-0012 version stays as a fallback
-- through the "on conflict (id) do nothing" clause.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barangay_id uuid;
  v_full_name   text;
begin
  v_full_name := (new.raw_user_meta_data->>'full_name');
  if v_full_name is null or trim(v_full_name) = '' then
    return new;
  end if;

  v_barangay_id := (new.raw_user_meta_data->>'barangay_id')::uuid;

  if not exists (select 1 from public.barangays where id = v_barangay_id) then
    raise exception 'Invalid barangay_id in signup metadata: %', v_barangay_id;
  end if;

  insert into public.profiles (
    id,
    barangay_id,
    role,
    full_name,
    mobile_number,
    home_address,
    email,
    email_verification_status
  ) values (
    new.id,
    v_barangay_id,
    'resident',
    trim(v_full_name),
    nullif(trim(coalesce(new.raw_user_meta_data->>'mobile_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), ''),
    new.email,
    'unavailable'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: creates a profiles row atomically with the auth.users row when '
  'registration metadata (full_name, barangay_id) is present. Now also '
  'stores the email column introduced in migration 0039. Admin-invited users '
  '(no metadata) are skipped so the admin API route handles their profile.';
