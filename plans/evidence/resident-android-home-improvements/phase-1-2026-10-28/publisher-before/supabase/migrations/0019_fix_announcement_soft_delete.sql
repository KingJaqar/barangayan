-- S0-5 / P1-C: migrations 0003 and 0005 created SELECT policies on announcements
-- ("residents can read their own barangay's announcements", "anyone can read
-- announcements") without a deleted_at IS NULL check. Migration 0011 tried to drop
-- policies by different names ("residents can read announcements from their barangay",
-- "guests can read all announcements") — a no-op against the originals — and created its
-- own corrected policies (which DO filter deleted_at IS NULL) alongside them. Result: 4
-- active SELECT policies, 2 without the soft-delete filter, so deleted announcements
-- remained visible. This drops the two original, unfiltered policies by their actual
-- names; the corrected 0011 policies remain active.
drop policy if exists "residents can read their own barangay's announcements" on public.announcements;
drop policy if exists "anyone can read announcements" on public.announcements;
