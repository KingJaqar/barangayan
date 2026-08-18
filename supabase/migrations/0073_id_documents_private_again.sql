-- Fix BUG-02, step 2 of 2: revert id-documents to a private bucket now that
-- every consumer (apps/resident-android-mobile settings/profile.tsx,
-- apps/admin-web residents/resident-directory.tsx) has been switched from
-- getPublicUrl() to short-lived createSignedUrls() in this same change.
--
-- 0042_id_documents_public_bucket.sql flipped this bucket public to work
-- around getPublicUrl() returning 403 on a private bucket — but government-ID
-- photos should never rely on UUID-path obscurity as their only protection.
-- The SELECT policies added by 0020/0042 (residents read their own folder,
-- admins read any object in their barangay) were never removed, so signed
-- URLs work immediately for both call sites without any RLS changes here.
--
-- Per the audit report's sequencing rule: this migration must not ship ahead
-- of the consumer-side code change in the same deploy — doing so first would
-- turn a security fix into a self-inflicted outage (broken image loading).

update storage.buckets
set public = false
where id = 'id-documents';
