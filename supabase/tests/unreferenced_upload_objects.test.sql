-- Resident iOS Phase 3 (P03-T07): orphan discovery for private upload buckets.
begin;
select no_plan();
insert into public.barangays(id,name) values ('a3400000-0000-0000-0000-000000000001','Upload Local');
insert into auth.users(id,email) values ('b3400000-0000-0000-0000-000000000001','upload@test.local');
insert into public.profiles(id,barangay_id,role,full_name,id_photo_urls) values
 ('b3400000-0000-0000-0000-000000000001','a3400000-0000-0000-0000-000000000001','resident','Upload R',
  array['b3400000-0000-0000-0000-000000000001/legacy-front.jpg']);

insert into storage.objects(bucket_id,name,owner,created_at,updated_at) values
 ('id-documents','b3400000-0000-0000-0000-000000000001/legacy-front.jpg','b3400000-0000-0000-0000-000000000001',now()-interval '30 days',now()),
 ('id-documents','b3400000-0000-0000-0000-000000000001/orphan-old.jpg','b3400000-0000-0000-0000-000000000001',now()-interval '30 days',now()),
 ('id-documents','b3400000-0000-0000-0000-000000000001/orphan-young.jpg','b3400000-0000-0000-0000-000000000001',now()-interval '2 minutes',now()),
 ('request-attachments','b3400000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001/orphan.pdf','b3400000-0000-0000-0000-000000000001',now()-interval '30 days',now()),
 ('profile-photos','b3400000-0000-0000-0000-000000000001/avatar.jpg','b3400000-0000-0000-0000-000000000001',now()-interval '30 days',now());

select is((select array_agg(object_name) from barangayan_private.unreferenced_upload_objects('id-documents')),
 array['b3400000-0000-0000-0000-000000000001/orphan-old.jpg'],'Only the old unreferenced identity object is listed');
select is((select count(*)::int from barangayan_private.unreferenced_upload_objects('id-documents',interval '0')),1,
 'A zero minimum age is floored to one hour');
select is((select count(*)::int from barangayan_private.unreferenced_upload_objects('request-attachments')),1,
 'An unreferenced supporting file is listed');
select is((select count(*)::int from barangayan_private.unreferenced_upload_objects('profile-photos')),0,
 'Other buckets are never listed');
select is(has_function_privilege('authenticated','barangayan_private.unreferenced_upload_objects(text,interval)','execute'),false,
 'Residents cannot call the discovery routine');
select is(has_function_privilege('anon','barangayan_private.unreferenced_upload_objects(text,interval)','execute'),false,
 'Anonymous cannot call the discovery routine');
select is(has_function_privilege('service_role','barangayan_private.unreferenced_upload_objects(text,interval)','execute'),true,
 'The service role can call the discovery routine');
select * from finish();
rollback;
