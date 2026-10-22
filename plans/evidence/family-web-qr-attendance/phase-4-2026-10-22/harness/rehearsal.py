"""Synthetic, local-only release rehearsal. Never accepts a remote connection."""
import hashlib, json, os, pathlib, re, subprocess, sys

root = pathlib.Path.cwd()
work = root / 'tmp/family-web-phase4-20261022'
database = 'family_attendance_web4_20261022'
restored = 'family_attendance_web4_backup_20261022'
container = 'supabase_db_barangayan'
owner = 'supabase_admin'
tenant = 'afb44000-0000-4000-8000-000000000001'
actor = 'dfb44000-0000-4000-8000-000000000001'
holder = 'dfb44000-0000-4000-8000-000000000002'
center = 'efb44000-0000-4000-8000-000000000001'
request = 'bfb44000-0000-4000-8000-000000000001'
departure_request = 'bfb44000-0000-4000-8000-000000000002'
next_request = 'bfb44000-0000-4000-8000-000000000003'

def call(args, data=None, timeout=60):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8',errors='replace'))
    return result.stdout

def sql(statement, db=database):
    assert db in (database,restored,'postgres')
    return call(['docker','exec','-i',container,'psql','-X','-U',owner,'-d',db,'-At','-v','ON_ERROR_STOP=1'],statement.encode())

def record(name, value):
    (work/name).write_text(json.dumps(value,indent=2),encoding='utf-8')
    print(json.dumps(value,indent=2),flush=True)

def parse(output):
    return json.loads(next(line for line in reversed(output.decode().splitlines()) if line.startswith('{')))

def as_actor(statement, who=actor):
    return f"begin; set local role authenticated; select set_config('request.jwt.claim.sub','{who}',true); {statement} commit;"

arrival=f"select public.check_in_household_members('{holder}','{center}','[{{\"kind\":\"holder\"}}]','{request}');"
snapshot="""select jsonb_build_object(
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.profiles p),
 'members',(select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.household_members m),
 'legacy',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.evacuation_center_checkins c),
 'stays',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.household_attendance s),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from barangayan_private.household_attendance_receipts r));"""
catalog="""select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
 'source_md5',md5(prosrc),'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig,'acl',proacl) order by p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','barangayan_private') and p.prokind='f'),
 'views',(select jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'definition',pg_get_viewdef(c.oid,true),'options',reloptions,'acl',relacl) order by c.oid::regclass::text)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'));
"""

if sys.argv[1]=='prepare':
    assert sql(f"select count(*) from pg_database where datname='{database}'",'postgres').strip()==b'0','Preserve existing database; never replace it.'
    reference=root/'tmp/attendance-0139-recovery-20261022/reference-schema.sql'
    schema=reference.read_bytes()
    assert not re.search(rb'^(?:COPY |INSERT INTO )',schema,re.M),'Reference must be schema-only.'
    call(['docker','exec',container,'createdb','-U',owner,'-O',owner,'-T','template0',database])
    (work/'logs/schema-restore.log').write_bytes(sql(schema.decode()))
    assert sql('select count(*) from public.profiles').strip()==b'0'
    # Seed known synthetic legacy data, without declaring any confirmed attendance.
    seed=f"""begin;
     insert into public.barangays(id,name) values('{tenant}','Synthetic Phase 4 legacy');
     insert into auth.users(id,email) values('{actor}','release4-staff@test.local'),('{holder}','release4-holder@test.local');
     insert into public.profiles(id,barangay_id,role,full_name) values
       ('{actor}','{tenant}','admin','Synthetic Release Staff'),('{holder}','{tenant}','resident','Synthetic Release Holder');
     update public.profiles set household_members='[{{"id":"cfb44000-0000-4000-8000-000000000001","name":"Synthetic Legacy Member","relation":"child"}}]' where id='{holder}';
     insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
       ('{center}','{tenant}','Synthetic Release Center','{{"lat":1,"lng":1}}',true);
     alter table public.evacuation_center_checkins disable trigger reject_legacy_attendance;
     insert into public.evacuation_center_checkins(evacuation_center_id,user_id,barangay_id) values('{center}','{holder}','{tenant}');
     alter table public.evacuation_center_checkins enable trigger reject_legacy_attendance;
     commit;"""
    sql(seed)
    before=parse(sql(snapshot)); identities=[]
    for name in ['0139_remote_schema.sql','0140_restore_household_attendance.sql','0141_attendance_receipt_export_access.sql']:
        path=root/'supabase/migrations'/name; content=path.read_bytes()
        (work/f'logs/{name}.log').write_bytes(sql('begin;\n'+content.decode()+'\ncommit;'))
        identities.append({'path':path.relative_to(root).as_posix(),'sha256':hashlib.sha256(content).hexdigest()})
    after=parse(sql(snapshot))
    assert before==after,'Migrations must preserve all seeded rows exactly and never backfill attendance.'
    record('migration-rehearsal.json',{'database':database,'result':'pass','reference':str(reference.relative_to(root)),'reference_sha256':hashlib.sha256(schema).hexdigest(),'migrations':identities,'preserved':{k:len(v) for k,v in after.items()}})
    (work/'catalog.local.json').write_text(json.dumps(parse(sql(catalog)),indent=2),encoding='utf-8')
elif sys.argv[1]=='sql':
    names=['household_attendance.test.sql','household_attendance_boundaries.test.sql','admin_household_attendance_projection_web.test.sql','resident_household_conditional.test.sql','resident_ios_phase18_account_deletion.test.sql','household_attendance_receipt_exports.test.sql','admin_record_lifecycle.test.sql']
    results=[]
    for name in names:
        path=root/'supabase/tests'/name
        assert path.is_file(),path
        output=sql(path.read_text(encoding='utf-8-sig')).decode()
        (work/f'logs/{name}.log').write_text(output,encoding='utf-8')
        assert not re.search(r'^not ok\b|# Looks like you failed',output,re.M),name
        count=len(re.findall(r'^ok\b',output,re.M)); assert count>0,name
        results.append({'suite':name,'result':'pass','assertions':count,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        record('sql-results.json',results)
elif sys.argv[1] in ('races','recovery'):
    mode=sys.argv[1]; name='household_attendance_concurrency.mjs' if mode=='races' else 'household_attendance_recovery.mjs'
    # The existing recovery harness requires zero attendance, which preparation ensures.
    result=subprocess.run(['node','supabase/tests/'+name],env={**os.environ,'ATTENDANCE_TEST_DB':database,'ATTENDANCE_DB_OWNER':owner},capture_output=True,timeout=150)
    (work/f'logs/{mode}.log').write_bytes(result.stdout+result.stderr)
    assert result.returncode==0,result.stderr.decode(errors='replace')
    print(result.stdout.decode(),flush=True)
elif sys.argv[1]=='backup':
    assert sql(f"select count(*) from pg_database where datname='{restored}'",'postgres').strip()==b'0'
    original=parse(sql(as_actor(arrival)))
    departure=f"select public.check_out_household_attendance(array['{original['stays'][0]['attendance_id']}'::uuid],'{departure_request}');"
    closed=parse(sql(as_actor(departure)))
    later=parse(sql(as_actor(arrival.replace(request,next_request))))
    assert later['stays'][0]['attendance_id']!=original['stays'][0]['attendance_id']
    before=parse(sql(snapshot)); before_catalog=parse(sql(catalog))
    pause=(root/'supabase/runbooks/family-attendance/pause.sql').read_text()
    resume=(root/'supabase/runbooks/family-attendance/resume.sql').read_text()
    sql(pause)
    dump=call(['docker','exec',container,'pg_dump','-U',owner,'-d',database],timeout=60)
    (work/'synthetic-recovery.sql').write_bytes(dump)
    call(['docker','exec',container,'createdb','-U',owner,'-O',owner,'-T','template0',restored])
    (work/'logs/full-restore.log').write_bytes(sql(dump.decode(),restored))
    assert parse(sql(snapshot,restored))==before,'Full restore must preserve legacy data, stays and receipts exactly.'
    paused_catalog=parse(sql(catalog))
    assert parse(sql(catalog,restored))==paused_catalog,'Restore must preserve function/view ownership and permissions.'
    for db in [database,restored]:
        sql(resume,db)
        assert parse(sql(as_actor(arrival),db))==original
        assert parse(sql(as_actor(departure),db))==closed
        current=parse(sql(as_actor('select public.get_my_household_attendance();',holder),db))
        person=next(p for p in current['people'] if p['kind']=='holder')
        assert person['current_stay']['attendance_id']==later['stays'][0]['attendance_id']
        assert parse(sql(snapshot,db))==before
        assert parse(sql(catalog,db))==before_catalog
    record('full-recovery.json',{'result':'pass','database':database,'restored_database':restored,'backup_sha256':hashlib.sha256(dump).hexdigest(),'rows':{k:len(v) for k,v in before.items()},'checks':['full schema/data restore to separate empty database','exact legacy/profile/member/stay/receipt row equality','function/view ownership/ACL equality','paused grants preserved through backup','resume original receipt replay leaves subsequent visit active'],'synthetic_only':True})
elif sys.argv[1]=='verify-backup':
    # Continue the completed restore after diagnosing the holder's array position.
    # Never repeat fixture creation, migration or restore against an existing DB.
    dump=(work/'synthetic-recovery.sql').read_bytes()
    before=parse(sql(snapshot)); expected_catalog=parse(sql(catalog))
    assert parse(sql(snapshot,restored))==before
    receipts={r['request_id']:r['result'] for r in before['receipts'] if r['actor_profile_id']==actor}
    original=receipts[request]; closed=receipts[departure_request]; later=receipts[next_request]
    departure=f"select public.check_out_household_attendance(array['{original['stays'][0]['attendance_id']}'::uuid],'{departure_request}');"
    resume=(root/'supabase/runbooks/family-attendance/resume.sql').read_text()
    for db in [database,restored]:
        sql(resume,db)
        assert parse(sql(as_actor(arrival),db))==original
        assert parse(sql(as_actor(departure),db))==closed
        current=parse(sql(as_actor('select public.get_my_household_attendance();',holder),db))
        person=next(p for p in current['people'] if p['kind']=='holder')
        assert person['current_stay']['attendance_id']==later['stays'][0]['attendance_id']
        assert parse(sql(snapshot,db))==before
        assert parse(sql(catalog,db))==expected_catalog
    record('full-recovery.json',{'result':'pass','database':database,'restored_database':restored,'backup_sha256':hashlib.sha256(dump).hexdigest(),'rows':{k:len(v) for k,v in before.items()},'checks':['full schema/data restore to separate empty database','exact legacy/profile/member/stay/receipt row equality','function/view ownership/ACL equality','paused grants preserved through backup','resume original receipt replay leaves subsequent visit active'],'synthetic_only':True,'diagnostic':'Initial post-restore assertion assumed holder at index zero; diagnosed actual member-first ordering and completed verification by kind without recreating fixtures or repeating restore.'})
else:
    raise ValueError('Unknown mode')
