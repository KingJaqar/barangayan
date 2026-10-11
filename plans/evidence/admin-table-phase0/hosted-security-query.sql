BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';
SELECT jsonb_build_object(
'functions',(SELECT jsonb_agg(to_jsonb(f)) FROM (SELECT n.nspname,p.proname,p.prosecdef,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname IN ('current_role','current_barangay_id','admin_register_for_drive','admin_add_household_member')) OR (n.nspname='barangayan_private' AND p.proname='guard_drive_registration_edit'))f),
'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM (SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('drive_registration_scores','drive_registrations','profiles') AND grantee IN ('anon','authenticated'))g),
'publication',(SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT pubname,tablename FROM pg_publication_tables WHERE schemaname='public' AND tablename IN ('profiles','service_requests','payments','incidents','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))t)
) AS evidence; COMMIT;
