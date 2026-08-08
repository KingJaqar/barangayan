-- Make the id-documents bucket publicly readable so that getPublicUrl() works
-- for displaying uploaded ID photos in both the mobile resident profile screen
-- and the web admin resident directory screen.
--
-- Background: migration 0020 created this bucket as private (public = false),
-- which meant the public URL endpoint returned 403 and expo-image / <img> tags
-- showed a grey/broken frame even though the file was successfully uploaded.
-- Profile photos (profile-photos bucket, migration 0040) are already public and
-- display correctly — this migration brings id-documents to parity.
--
-- Security note: objects live at `{auth.uid()}/id_{timestamp}.{ext}`.
-- The path contains a UUID so the URL is not guessable without knowing the
-- resident's auth UID. RLS INSERT/DELETE policies still limit who can write.

update storage.buckets
set public = true
where id = 'id-documents';

-- Also allow WebP uploads (the image picker may produce webp on some devices).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
where id = 'id-documents';

-- ── Write policies ─────────────────────────────────────────────────────────────
-- The INSERT policy from migration 0020 already covers new uploads.
-- Add UPDATE so that a re-upload to the same path (upsert:true) is also allowed.
-- Add DELETE so residents can remove their own files.

create policy "residents update own id docs"
on storage.objects for update to authenticated
using  (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "residents delete own id docs"
on storage.objects for delete to authenticated
using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Admin read policy (belt-and-suspenders) ────────────────────────────────────
-- The bucket is now public so the public URL endpoint bypasses RLS entirely.
-- This policy covers the authenticated Storage API path (supabase.storage.download)
-- which still respects RLS — admins can read any object in the bucket.
create policy "admins read all id docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'id-documents'
  and public.current_role() = 'admin'
);
