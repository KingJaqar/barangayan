\ir phase1-historical.sql
insert into public.barangays(id,name) values ('a2000000-0000-0000-0000-000000000001','Barangay Ampid I');
insert into public.barangay_localities values ('a2000000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
insert into auth.users(id,email,raw_user_meta_data) values
('b2000000-0000-0000-0000-000000000001','legacy-complete@test.local','{}'),
('b2000000-0000-0000-0000-000000000002','legacy-missing@test.local','{}'),
('b2000000-0000-0000-0000-000000000003','legacy-pending@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name,home_address,id_type,id_photo_urls,id_verification_status) values
('b2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','resident','Complete Legacy','Legacy free text retained exactly','Passport',array['b2000000-0000-0000-0000-000000000001/id-front.jpg','b2000000-0000-0000-0000-000000000001/id-back.jpg'],'verified'),
('b2000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','resident','Missing Legacy','Another unsplittable address','Passport',array['b2000000-0000-0000-0000-000000000002/missing-front.jpg','b2000000-0000-0000-0000-000000000002/missing-back.jpg'],'verified'),
('b2000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001','resident','Pending Legacy','Pending free text','Passport',array['b2000000-0000-0000-0000-000000000003/id-front.jpg','b2000000-0000-0000-0000-000000000003/id-back.jpg'],'pending');
insert into storage.objects(bucket_id,name,metadata)
select 'id-documents',id::text || '/id-' || side || '.jpg','{"size":1000,"mimetype":"image/jpeg"}'::jsonb
from public.profiles cross join (values('front'),('back')) sides(side)
where id in ('b2000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000003');
