-- Resident iOS Phase 3 (P03-T02/T08): storage ownership, tenant isolation and
-- immutability of identity evidence, through the same policies the clients use.
begin;
select no_plan();

insert into public.barangays(id,name) values
 ('a3500000-0000-0000-0000-000000000001','Storage A'),
 ('a3500000-0000-0000-0000-000000000002','Storage B');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at) values
 ('b3500000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-a@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3500000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-b@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3500000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-admin-a@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3500000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-admin-b@test.local','',now(),'','','','','{}','{}',false,now(),now());
insert into public.profiles(id,barangay_id,role,full_name,id_photo_urls) values
 ('b3500000-0000-0000-0000-00000000000a','a3500000-0000-0000-0000-000000000001','resident','St A',array['b3500000-0000-0000-0000-00000000000a/front.jpg']),
 ('b3500000-0000-0000-0000-00000000000b','a3500000-0000-0000-0000-000000000002','resident','St B','{}'),
 ('b3500000-0000-0000-0000-00000000000c','a3500000-0000-0000-0000-000000000001','admin','St Admin A','{}'),
 ('b3500000-0000-0000-0000-00000000000d','a3500000-0000-0000-0000-000000000002','admin','St Admin B','{}');
insert into storage.objects(bucket_id,name,owner) values
 ('id-documents','b3500000-0000-0000-0000-00000000000a/front.jpg','b3500000-0000-0000-0000-00000000000a'),
 ('id-documents','b3500000-0000-0000-0000-00000000000a/unreferenced.jpg','b3500000-0000-0000-0000-00000000000a'),
 ('incident-photos','b3500000-0000-0000-0000-00000000000b/p/photo.jpg','b3500000-0000-0000-0000-00000000000b'),
 ('profile-photos','b3500000-0000-0000-0000-00000000000b/avatar.jpg','b3500000-0000-0000-0000-00000000000b');

-- Bucket configuration is part of the contract.
select is((select public from storage.buckets where id='id-documents'),false,'Identity bucket is private');
select is((select public from storage.buckets where id='request-attachments'),false,'Supporting-file bucket is private');
select is((select file_size_limit from storage.buckets where id='id-documents'),5242880::bigint,'Identity images are limited to 5 MiB');
select is((select file_size_limit from storage.buckets where id='incident-photos'),10485760::bigint,'Incident photos are limited to 10 MiB');
select is((select allowed_mime_types from storage.buckets where id='id-documents'),array['image/jpeg','image/jpg','image/png','image/webp'],'Identity bucket is image-only');
select is((select count(*)::int from storage.buckets where id='request-attachments' and 'application/pdf'=any(allowed_mime_types)),1,'Supporting files allow PDF');

-- Resident A.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3500000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3500000-0000-0000-0000-00000000000a',true);
select lives_ok($$insert into storage.objects(bucket_id,name,owner) values ('id-documents','b3500000-0000-0000-0000-00000000000a/versions/new-front.jpg','b3500000-0000-0000-0000-00000000000a')$$,
 'A resident can upload identity evidence under their own folder');
select throws_ok($$insert into storage.objects(bucket_id,name,owner) values ('id-documents','b3500000-0000-0000-0000-00000000000b/forged.jpg','b3500000-0000-0000-0000-00000000000a')$$,
 '42501',null,'A resident cannot write into another resident folder');
select throws_ok($$insert into storage.objects(bucket_id,name,owner) values ('incident-photos','b3500000-0000-0000-0000-00000000000b/p/forged.jpg','b3500000-0000-0000-0000-00000000000a')$$,
 '42501',null,'A resident cannot upload incident photos into another folder');
select throws_ok($$insert into storage.objects(bucket_id,name,owner) values ('request-attachments','b3500000-0000-0000-0000-00000000000a/loose.pdf','b3500000-0000-0000-0000-00000000000a')$$,
 '42501',null,'Supporting files must use the request-scoped path');
select lives_ok($$insert into storage.objects(bucket_id,name,owner) values ('request-attachments','b3500000-0000-0000-0000-00000000000a/00000000-0000-4000-8000-000000000001/x.pdf','b3500000-0000-0000-0000-00000000000a')$$,
 'A supporting file can be staged under the own folder before submission (linkage happens at submit)');
select throws_ok($$insert into storage.objects(bucket_id,name,owner) values ('request-attachments','b3500000-0000-0000-0000-00000000000b/00000000-0000-4000-8000-000000000001/x.pdf','b3500000-0000-0000-0000-00000000000a')$$,
 '42501',null,'A supporting file cannot be staged into another resident folder');
select throws_ok($$insert into storage.objects(bucket_id,name,owner) values ('site-content','b3500000-0000-0000-0000-00000000000a/x.png','b3500000-0000-0000-0000-00000000000a')$$,
 '42501',null,'A resident cannot publish site content');
select is((select count(*)::int from storage.objects where bucket_id='id-documents'),3,'A resident sees only their own identity objects');
select throws_ok($$delete from storage.objects where bucket_id='id-documents' and name='b3500000-0000-0000-0000-00000000000a/front.jpg'$$,
 '42501',null,'Direct SQL deletion from Storage tables is refused');
select lives_ok($$update storage.objects set name='b3500000-0000-0000-0000-00000000000a/renamed.jpg' where bucket_id='id-documents' and name='b3500000-0000-0000-0000-00000000000a/front.jpg'$$,
 'A client overwrite of identity evidence is filtered, not an error');
reset role;
select is((select count(*)::int from storage.objects where bucket_id='id-documents' and name='b3500000-0000-0000-0000-00000000000a/front.jpg'),1,
 'Identity evidence survived the delete and rename attempts');
select is((select count(*)::int from pg_policies where schemaname='storage' and tablename='objects' and permissive='RESTRICTIVE'
  and policyname in ('ID evidence cannot be deleted by clients','ID evidence cannot be overwritten')),2,
 'Storage API delete and overwrite of identity evidence are blocked by restrictive policies');

-- Resident B and administrators.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3500000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3500000-0000-0000-0000-00000000000b',true);
select is((select count(*)::int from storage.objects where bucket_id='id-documents'),0,'Another resident sees no identity objects of Resident A');
reset role;
select is((select count(*)::int from pg_policies where schemaname='storage' and tablename='objects' and policyname='residents delete own incident photos'
  and cmd='DELETE' and qual like '%incident-photos%'),1,'Residents can remove their own incident photos through the Storage API');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3500000-0000-0000-0000-00000000000c","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3500000-0000-0000-0000-00000000000c',true);
select is((select array_agg(name order by name) from storage.objects where bucket_id='id-documents'),array['b3500000-0000-0000-0000-00000000000a/front.jpg'],
 'A same-barangay administrator reads only referenced identity evidence');
select set_config('request.jwt.claims','{"sub":"b3500000-0000-0000-0000-00000000000d","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3500000-0000-0000-0000-00000000000d',true);
select is((select count(*)::int from storage.objects where bucket_id='id-documents'),0,'An administrator of another barangay reads no identity evidence');

-- Anonymous.
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)::int from storage.objects where bucket_id in ('id-documents','request-attachments')),0,'Anonymous sees no private objects');
select is((select count(*)::int from storage.objects where bucket_id='profile-photos'),1,'Avatars remain publicly readable by design (privacy review PR-13)');
reset role;
select * from finish();
rollback;
