-- S0-11: enables pgTAP so supabase/tests/rls_isolation.test.sql can run via
-- `supabase test db` (local or --linked).
create extension if not exists pgtap with schema extensions;
