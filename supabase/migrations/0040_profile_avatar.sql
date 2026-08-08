-- Module: Resident Profile — avatar photo support.
--
-- Adds avatar_url (text) to profiles and creates the public `profile-photos`
-- storage bucket with per-resident RLS policies.
--
-- Design decisions:
--   • Public bucket — avatars are shown in the mobile app and admin directory, so
--     they must be readable without authentication. getPublicUrl() works immediately.
--   • 2 MB file limit — enough for a high-quality phone selfie; prevents abuse.
--   • Single path per resident: {uid}/avatar.{ext}  (upsert with overwrite).
--     Keeping one canonical path means the stored avatar_url never goes stale when
--     the resident re-uploads.  Old files are overwritten at the Storage level.
--   • avatar_url stores the full public URL returned by getPublicUrl() so the
--     mobile app and admin web can render it with a plain <img> / expo-image
--     without making a second API call.

-- ── 1. Column ─────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Full public URL of the resident''s profile photo stored in the '
  'profile-photos Supabase Storage bucket. NULL until the resident uploads '
  'their first photo. Updated in-place whenever they re-upload.';

-- ── 2. Storage bucket ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,                    -- public: avatars must be readable without auth
  2097152,                 -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- Residents upload their own avatar (path must start with their uid/)
create policy "residents upload own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Residents replace (overwrite) their own avatar
create policy "residents update own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Residents delete their own avatar (for future "remove photo" feature)
create policy "residents delete own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read — the bucket is already public, but an explicit policy is best
-- practice so the intent is visible in the project's RLS list.
create policy "avatars are publicly readable"
on storage.objects for select to public
using (bucket_id = 'profile-photos');
