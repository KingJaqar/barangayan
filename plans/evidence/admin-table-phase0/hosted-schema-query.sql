BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';
SELECT jsonb_build_object(
'version',version(),
'api_max_rows_setting', current_setting('pgrst.db_max_rows',true),
'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('profiles','service_requests','payments','incidents','incident_categories','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials') ORDER BY table_name,ordinal_position)c),
'constraints',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text IN ('profiles','service_requests','payments','incidents','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))c),
'indexes',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('profiles','service_requests','payments','incidents','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))c),
'policies',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','service_requests','payments','incidents','incident_categories','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))c),
'rls',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('profiles','service_requests','payments','incidents','incident_categories','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))c),
'scale_estimates',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT relname,n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' AND relname IN ('profiles','service_requests','payments','incidents','medical_drives','drive_registrations','drive_registration_scores','household_members','barangay_officials'))c),
'collations',(SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT collname,collprovider,collisdeterministic FROM pg_collation WHERE collname IN ('C','C.utf8','und-x-icu'))c),
'migrations',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations)
) AS evidence; COMMIT;
