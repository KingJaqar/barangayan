-- Synthetic pre-Phase-1 history: legacy names/addresses/IDs, requests/payments,
-- and medical applicant/priority data. No real personal data is used.
insert into public.barangays(id,name,config) values ('a3000000-0000-0000-0000-000000000001','Historical Other Tenant','{"keep":"unchanged"}');
insert into auth.users(id,email,raw_user_meta_data) values
('b3000000-0000-0000-0000-000000000001','historical-resident@test.local','{}'),
('b3000000-0000-0000-0000-000000000002','historical-admin@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name,home_address,id_type,id_photo_urls,id_verification_status) values
('b3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','resident','Unsplit Historical Name','Unstructured address, preserved verbatim','Passport',array['b3000000-0000-0000-0000-000000000001/old-front.jpg','b3000000-0000-0000-0000-000000000001/old-back.jpg'],'verified'),
('b3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001','admin','Historical Administrator',null,null,'{}',null);
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b3000000-0000-0000-0000-000000000001/old-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b3000000-0000-0000-0000-000000000001/old-back.jpg','{"size":1000,"mimetype":"image/jpeg"}');
insert into public.document_types(id,barangay_id,name,fee_centavos,processing_target_hours) values
('d3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Historical inactive service',12500,48);
insert into public.service_requests(id,barangay_id,resident_id,document_type_id,created_at) values
('c3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','2024-01-01T00:00:00Z'),
('c3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','2024-02-01T00:00:00Z');
select set_config('barangayan.allow_request_completion','true',false);
update public.service_requests set status='completed' where id='c3000000-0000-0000-0000-000000000001';
update public.service_requests set status='cancelled' where id='c3000000-0000-0000-0000-000000000002';
insert into public.payments(id,barangay_id,service_request_id,method,amount_centavos,document_fee_centavos,status) values
('e3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','c3000000-0000-0000-0000-000000000001','pickup',12500,12500,'paid'),
('e3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001','c3000000-0000-0000-0000-000000000002','qrph',12500,12500,'refunded');
update public.document_types set is_active=false where id='d3000000-0000-0000-0000-000000000001';
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining) values
('f3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Historical drive','vaccination','2024-01-01','08:00','12:00','Residents',10,9);
insert into public.drive_registrations(id,drive_id,user_id,age,is_pwd,comorbidities,priority_score,applicant_number) values
('f3000000-0000-0000-0000-000000000002','f3000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',70,true,array['hypertension'],90,'HIST-00001');
