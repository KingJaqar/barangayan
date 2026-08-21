-- ============================================================================
-- Grant Guest (Anon) Read Access to FAQ Articles
-- ============================================================================
-- 0053_faq.sql only granted `to authenticated`, so resident-web's Settings > Help
-- Center screen couldn't be made guest-accessible (RLS silently returned zero rows
-- for anon callers even with the page-level auth gate removed). Same pattern as
-- 0055_grant_guest_read_access.sql / 0005_guest_readable_public_content.sql: FAQ
-- content is a public civic-bulletin-board resource, not personal data.

create policy "anyone can read active faq articles"
  on public.faq_articles for select
  to anon
  using (deleted_at is null and is_active = true);
