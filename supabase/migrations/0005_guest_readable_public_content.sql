-- Guest ("I'll Sign In Later") real read-only browsing — matches the Auth Choice
-- screen's own "Browse public community updates" copy. document_types and
-- announcements are public civic-bulletin-board content, not personal data — unlike
-- service_requests/profiles, which stay strictly `authenticated` + auth.uid()-scoped and
-- are untouched by this migration. Anonymous callers still cannot read either of those.
--
-- No barangay_id filter in either policy below: an anonymous caller has no profile to
-- derive current_barangay_id() from. Harmless today (exactly one barangay exists) — once
-- multi-barangay support lands, the CLIENT should filter by a guest-selected barangay_id
-- in the query itself; these policies intentionally don't enforce tenant isolation
-- because this data isn't sensitive.

create policy "anyone can read active document types"
  on public.document_types for select
  to anon
  using (is_active = true);

create policy "anyone can read announcements"
  on public.announcements for select
  to anon
  using (true);
