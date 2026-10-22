delete from barangayan_private.household_attendance_receipts
where household_profile_id in ('dfb21000-0000-4000-8000-000000000002','dfb21000-0000-4000-8000-000000000003');
delete from public.household_attendance
where household_profile_id in ('dfb21000-0000-4000-8000-000000000002','dfb21000-0000-4000-8000-000000000003');
delete from public.household_members where profile_id='dfb21000-0000-4000-8000-000000000002' and deleted_at is not null;
update public.profiles set household_members='[{"id":"cfb21000-0000-4000-8000-000000000001","name":"Selected Child","relation":"child","role":"member"},{"id":"cfb21000-0000-4000-8000-000000000002","name":"Unselected Child","relation":"child","role":"member"}]'
where id='dfb21000-0000-4000-8000-000000000002';
update public.profiles set household_members='[]' where id='dfb21000-0000-4000-8000-000000000003';
