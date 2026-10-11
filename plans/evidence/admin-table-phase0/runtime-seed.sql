-- Only runtime-stack.mjs's disposable container. No source/hosted execution.
BEGIN;
SET LOCAL statement_timeout='30000ms';
INSERT INTO public.barangays(id,name) VALUES
('10000000-0000-4000-8000-000000000001','Phase Zero Tenant A'),
('10000000-0000-4000-8000-000000000002','Phase Zero Tenant B');

-- Non-login synthetic identities supply valid real FK relationships at scale.
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 'phase0-resident-'||g||'@example.invalid','{}' FROM generate_series(1,1505)g;
INSERT INTO public.profiles(id,barangay_id,role,full_name,first_name,last_name,email,home_address,occupation)
SELECT ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','resident',
 CASE WHEN g=1505 THEN 'Beyond Cap Needle Ω' WHEN g%3=0 THEN 'Álpha Duplicate' WHEN g%3=1 THEN 'alpha duplicate' ELSE 'Beta Resident '||g END,
 CASE WHEN g=1505 THEN 'Beyond Cap' WHEN g%3=0 THEN 'Álpha' WHEN g%3=1 THEN 'alpha' ELSE 'Beta' END,
 CASE WHEN g=1505 THEN 'Needle Ω' WHEN g%3 IN (0,1) THEN 'Duplicate' ELSE 'Resident '||g END,
 'phase0-resident-'||g||'@example.invalid','Fixture Address '||g,'Fixture Occupation'
FROM generate_series(1,1505)g;

INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT ('21000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 'phase0-staff-'||g||'@example.invalid','{}' FROM generate_series(1,1505)g;
INSERT INTO public.profiles(id,barangay_id,role,full_name,email)
SELECT ('21000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','admin','Fixture Staff '||lpad(g::text,4,'0'),'phase0-staff-'||g||'@example.invalid'
FROM generate_series(1,1505)g;
-- The real profile trigger creates officials; no parallel roster abstraction.

INSERT INTO public.document_types(id,barangay_id,name,fee_centavos,contract_version) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fixture Document Alpha',100,1),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Foreign Document',100,1);
INSERT INTO public.service_requests(id,barangay_id,resident_id,document_type_id,reference_number,requester_notes,created_at)
SELECT ('40000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001',('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000001','REQ-PHASE0-'||lpad(g::text,5,'0'),
 CASE WHEN g=1505 THEN 'Beyond cap sentinel' ELSE 'Fixture notes' END,
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
INSERT INTO public.payments(id,barangay_id,service_request_id,method,amount_centavos,document_fee_centavos,status,created_at)
SELECT ('50000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001',('40000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 CASE WHEN g%2=0 THEN 'qrph' ELSE 'pickup' END,100,100,'pending',
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
INSERT INTO public.incident_categories(id,barangay_id,name) VALUES
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fixture Category');
INSERT INTO public.incidents(id,barangay_id,reporter_id,category_id,title,description,location,created_at)
SELECT ('61000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001',
 CASE WHEN g=1504 THEN NULL ELSE ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid END,
 CASE WHEN g=1504 THEN NULL ELSE '60000000-0000-4000-8000-000000000001'::uuid END,
 'Fixture Incident '||lpad(g::text,4,'0'),CASE WHEN g=1505 THEN 'Beyond Cap Needle Ω' ELSE 'Fixture description' END,'{}',
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
INSERT INTO public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining,created_at)
SELECT ('70000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','Fixture Drive '||lpad(g::text,4,'0'),'consultation','2026-10-11','08:00','12:00','Fixture residents',2000,2000,
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
INSERT INTO public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining,is_active) VALUES
('70000000-0000-4000-8000-000000009998','10000000-0000-4000-8000-000000000002','Foreign Active Drive','consultation','2026-10-11','08:00','12:00','Foreign fixture',10,10,true),
('70000000-0000-4000-8000-000000009999','10000000-0000-4000-8000-000000000002','Foreign Inactive Drive','consultation','2026-10-11','08:00','12:00','Foreign fixture',10,10,false);
INSERT INTO public.drive_registrations(id,drive_id,user_id,applicant_number,age,is_pwd,comorbidities,created_at)
SELECT ('71000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 '70000000-0000-4000-8000-000000000001',('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 'CON-PHASE0-'||lpad(g::text,5,'0'),20+g%60,g%2=0,
 CASE WHEN g=1505 THEN ARRAY['hypertension','diabetes'] ELSE ARRAY['Fixture condition'] END,
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
-- Preserve the registration trigger; assign deterministic comparison scores to
-- its already-created rows instead of inserting duplicate score records.
UPDATE public.drive_registration_scores s SET priority_score=(g%10)*10
FROM generate_series(1,1505)g
WHERE s.registration_id=('71000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid;
-- A real nullable-profile case: registrations reference Auth rather than profiles.
INSERT INTO auth.users(id,email) VALUES('20000000-0000-4000-8000-000000009998','phase0-no-profile@example.invalid');
-- Current insert guard requires an active resident. Create a valid profile at
-- registration time, then remove only this synthetic profile to model history.
INSERT INTO public.profiles(id,barangay_id,role,full_name,email) VALUES
('20000000-0000-4000-8000-000000009998','10000000-0000-4000-8000-000000000001','resident','Historical Missing Profile','phase0-no-profile@example.invalid');
INSERT INTO public.drive_registrations(id,drive_id,user_id,applicant_number,age) VALUES
('71000000-0000-4000-8000-000000009998','70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000009998','CON-MISSING-PROFILE',31),
('71000000-0000-4000-8000-000000009999','70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000009998','CON-MISSING-SCORE',31);
UPDATE public.drive_registration_scores SET priority_score=55 WHERE registration_id='71000000-0000-4000-8000-000000009998';
DELETE FROM public.drive_registration_scores WHERE registration_id='71000000-0000-4000-8000-000000009999';
DELETE FROM public.profiles WHERE id='20000000-0000-4000-8000-000000009998';
INSERT INTO public.household_members(id,profile_id,name,relation,created_at)
SELECT ('80000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Fixture Member '||lpad(g::text,4,'0'),'Child',
 '2026-01-01T00:00:00Z'::timestamptz + g*interval '1 minute'
FROM generate_series(1,1505)g;
COMMIT;
