BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';
SELECT jsonb_build_object(
'exact_counts',jsonb_build_object('profiles',(SELECT count(*) FROM public.profiles),'requests',(SELECT count(*) FROM public.service_requests),'payments',(SELECT count(*) FROM public.payments),'incidents',(SELECT count(*) FROM public.incidents),'drives',(SELECT count(*) FROM public.medical_drives),'registrations',(SELECT count(*) FROM public.drive_registrations),'members',(SELECT count(*) FROM public.household_members),'officials',(SELECT count(*) FROM public.barangay_officials)),
'tenant_scale',jsonb_build_object('profiles_max',(SELECT max(n) FROM (SELECT count(*) n FROM public.profiles GROUP BY barangay_id)t),'requests_max',(SELECT max(n) FROM (SELECT count(*) n FROM public.service_requests GROUP BY barangay_id)t),'drives_max',(SELECT max(n) FROM (SELECT count(*) n FROM public.medical_drives GROUP BY barangay_id)t)),
'reference_shapes',(SELECT jsonb_build_object('canonical',count(*) FILTER(WHERE reference_number ~ '^REQ-[0-9]{4}-[0-9]{5}$'),'noncanonical',count(*) FILTER(WHERE reference_number !~ '^REQ-[0-9]{4}-[0-9]{5}$')) FROM public.service_requests),
'cancelled_registrations',(SELECT count(*) FROM public.drive_registrations WHERE status='cancelled'),
'drives_without_registrations',(SELECT count(*) FROM public.medical_drives d WHERE NOT EXISTS(SELECT 1 FROM public.drive_registrations r WHERE r.drive_id=d.id))
) AS evidence; COMMIT;
