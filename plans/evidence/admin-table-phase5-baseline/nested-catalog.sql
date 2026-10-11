-- Metadata only: supporting lookups, review/history, audit drawer and storage.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '8000ms';
SELECT jsonb_build_object(
  'columns', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('document_types','id_submissions','request_attachments','admin_audit_log')
    ORDER BY table_name,ordinal_position) c),
  'constraints', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE connamespace='public'::regnamespace
    AND conrelid::regclass::text IN ('document_types','id_submissions','request_attachments','admin_audit_log')) c),
  'policies', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
    WHERE (schemaname='public' AND tablename IN ('document_types','id_submissions','request_attachments','admin_audit_log'))
    OR (schemaname='storage' AND tablename='objects')) c),
  'functions', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
      p.prosecdef AS security_definer,p.proconfig,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND p.proname IN ('current_role','current_barangay_id','admin_register_for_drive',
      'admin_add_household_member','update_incident_status','service_request_sla_tracking',
      'begin_processing_request','complete_service_request','mark_request_ready_for_pickup',
      'cancel_service_request','service_sla_report_rows')) c),
  'publications', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT pubname,schemaname,tablename FROM pg_publication_tables
    WHERE schemaname='public' ORDER BY pubname,tablename) c)
) AS evidence;
COMMIT;
