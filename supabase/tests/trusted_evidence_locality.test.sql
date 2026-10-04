begin;
select no_plan();
insert into public.barangays(id,name) values ('a2100000-0000-0000-0000-000000000001','Phase 2 locality');
insert into public.barangay_localities values ('a2100000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
insert into auth.users(id,email,raw_user_meta_data) values ('b2100000-0000-0000-0000-000000000001','phase2@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name,home_address,city,province,id_type,id_photo_urls,id_verification_status)
values ('b2100000-0000-0000-0000-000000000001','a2100000-0000-0000-0000-000000000001','resident','Phase Two','Legacy address preserved','Forged','Forged','Passport',array['b2100000-0000-0000-0000-000000000001/id-front.jpg','b2100000-0000-0000-0000-000000000001/id-back.jpg'],'verified');
select is((select city from public.profiles where id='b2100000-0000-0000-0000-000000000001'),'San Mateo','New profile locality is server derived');
select is((select province from public.profiles where id='b2100000-0000-0000-0000-000000000001'),'Rizal','Province is server derived');
select is((select home_address from public.profiles where id='b2100000-0000-0000-0000-000000000001'),'Legacy address preserved','Unsplittable free text survives');
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b2100000-0000-0000-0000-000000000001/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b2100000-0000-0000-0000-000000000001/id-back.jpg','{"size":1000,"mimetype":"image/jpeg"}');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
values ('c2100000-0000-0000-0000-000000000001','b2100000-0000-0000-0000-000000000001','a2100000-0000-0000-0000-000000000001',1,'Passport',
'b2100000-0000-0000-0000-000000000001/id-front.jpg','b2100000-0000-0000-0000-000000000001/id-back.jpg','verified','legacy_approval');
update public.profiles set current_id_submission_id='c2100000-0000-0000-0000-000000000001',approved_id_submission_id='c2100000-0000-0000-0000-000000000001' where id='b2100000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','b2100000-0000-0000-0000-000000000001',true);
set local role authenticated;
select throws_ok($$update public.profiles set city='Tampered' where id=auth.uid()$$,'42501','fixed_locality','City tampering denied');
select throws_ok($$update public.profiles set province='Tampered' where id=auth.uid()$$,'42501','fixed_locality','Province tampering denied');
select throws_ok($$update public.profiles set home_address='Forged locality' where id=auth.uid()$$,'42501','derived_address','Free-text locality bypass denied');
select throws_ok($$update public.profiles set id_type='Different' where id=auth.uid()$$,'42501','use_ID_version_operations','Type-only changes cannot retain approval');
select throws_ok($$update public.profiles set id_verification_status='pending' where id=auth.uid()$$,'42501','use_ID_version_operations','Raw status mutation denied');
select lives_ok($$update public.profiles set mobile_number='09171234567' where id=auth.uid()$$,'Ordinary edits work');
select is((select approved_id_submission_id::text from public.profiles where id=auth.uid()),'c2100000-0000-0000-0000-000000000001','Ordinary edits retain exact approval');
with changed as (update storage.objects set metadata='{"size":1}' where bucket_id='id-documents' returning id)
select is((select count(*)::int from changed),0,'Imported evidence cannot be overwritten');
select * from finish();
rollback;
