import hashlib
import json
import pathlib
import subprocess

work=pathlib.Path(__file__).parent
database='family_attendance_rehearsal_20261021_v5'
prefix=['docker','exec','-i','supabase_db_barangayan']
args=prefix+['psql','-U','supabase_admin','-d',database,'-X','-At','-v','ON_ERROR_STOP=1']
def run(sql,name):
    r=subprocess.run(args,input=sql,encoding='utf-8',capture_output=True,timeout=30)
    (work/'logs'/name).write_text(r.stdout+'\n'+r.stderr,encoding='utf-8')
    assert r.returncode==0,r.stderr
    return r.stdout

tenant='afa40000-0000-4000-8000-000000000001'
actor='dfa40000-0000-4000-8000-000000000001'
resident='dfa40000-0000-4000-8000-000000000002'
center='efa40000-0000-4000-8000-000000000001'
request='bfa40000-0000-4000-8000-000000000001'
assert run('select count(*) from public.household_attendance','recovery-precondition.log').strip()=='0'
run(f"""begin;
insert into public.barangays(id,name) values('{tenant}','Synthetic recovery');
insert into auth.users(id,email) values('{actor}','recovery-actor@test.local'),('{resident}','recovery-resident@test.local');
insert into public.profiles(id,barangay_id,role,full_name) values
('{actor}','{tenant}','admin','Synthetic staff'),('{resident}','{tenant}','resident','Synthetic household');
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
('{center}','{tenant}','Synthetic recovery center','{{"lat":1,"lng":1}}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','{actor}',true);
select public.check_in_household_members('{resident}','{center}','[{{"kind":"holder"}}]','{request}');
commit;""",'recovery-synthetic-arrival.log')
dump=subprocess.run(prefix+['pg_dump','-U','supabase_admin','-d',database,'--data-only','--column-inserts',
 '--table=public.household_attendance','--table=barangayan_private.household_attendance_receipts'],
 encoding='utf-8',capture_output=True,timeout=30)
assert dump.returncode==0,dump.stderr
(work/'synthetic-attendance-backup.sql').write_text(dump.stdout,encoding='utf-8')
fingerprint_query="""select jsonb_build_object('stays',(select jsonb_agg(to_jsonb(s) order by id) from public.household_attendance s),
 'receipts',(select jsonb_agg(to_jsonb(r) order by actor_profile_id,request_id) from barangayan_private.household_attendance_receipts r));"""
original=json.loads(run(fingerprint_query,'recovery-before.json.log'))
restored=run('begin; delete from barangayan_private.household_attendance_receipts; delete from public.household_attendance;\n'+
 dump.stdout+'\n'+fingerprint_query+'\nrollback;','recovery-restore.log')
recovered=json.loads(next(line for line in restored.splitlines() if line.startswith('{"stays"')))
assert recovered==original,'Backup restore changed a receipt or stay.'
assert json.loads(run(fingerprint_query,'recovery-after.json.log'))==original
run(f"""begin; set local role authenticated; select set_config('request.jwt.claim.sub','{actor}',true);
select public.check_in_household_members('{resident}','{center}','[{{"kind":"holder"}}]','{request}'); rollback;""",'recovery-replay.log')
run(f"""delete from barangayan_private.household_attendance_receipts where household_profile_id='{resident}';
delete from public.household_attendance where household_profile_id='{resident}';
delete from public.evacuation_centers where id='{center}';
delete from public.profiles where id in ('{actor}','{resident}');
delete from auth.users where id in ('{actor}','{resident}');
delete from public.barangays where id='{tenant}';""",'recovery-fixture-cleanup.log')
result={'database':database,'backup_sha256':hashlib.sha256(dump.stdout.encode()).hexdigest().upper(),
 'result':'pass','checks':['all stay/receipt fields restored exactly','restore transaction rolled back without losing recorded data',
 'original request still replays after recovery','synthetic fixtures removed'],'production_recovery':'not exercised or authorized'}
(work/'recovery.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))

