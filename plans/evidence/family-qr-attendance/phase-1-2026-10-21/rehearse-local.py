import hashlib
import json
import pathlib
import subprocess

work = pathlib.Path(__file__).parent
database = 'family_attendance_rehearsal_20261021_v5'
prefix = ['docker', 'exec', '-i', 'supabase_db_barangayan']
def sql(db, source, name):
    result = subprocess.run(prefix + ['psql','-U','supabase_admin','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],
                            input=source,encoding='utf-8',capture_output=True,timeout=90)
    (work / 'logs' / name).write_text(result.stdout + '\n' + result.stderr,encoding='utf-8')
    if result.returncode:
        raise RuntimeError(name + ': ' + result.stderr[-2000:])
    return result.stdout

assert sql('postgres',f"select count(*) from pg_database where datname='{database}'",'rehearsal-name.log').strip() == '0'
sql('postgres',f'create database {database} template template0','rehearsal-create.log')
dump = subprocess.run(prefix + ['pg_dump','-U','postgres','-d','postgres','--schema-only',
    '--exclude-extension=pg_cron','--exclude-schema=cron','--exclude-schema=supabase_migrations'],
    encoding='utf-8',capture_output=True,timeout=60)
assert dump.returncode == 0, dump.stderr
schema = dump.stdout.replace('CREATE SCHEMA public;', 'CREATE SCHEMA IF NOT EXISTS public;')
(work / 'local-0117-schema-only.sql').write_text(schema,encoding='utf-8')
sql(database,schema,'rehearsal-schema-restore.log')
assert sql(database,'select count(*) from public.profiles','rehearsal-empty.log').strip() == '0'
files = [p for p in sorted(pathlib.Path('supabase/migrations').glob('*.sql'))
         if p.name[:4].isdigit() and 118<=int(p.name[:4])<=136]
files.append(pathlib.Path('supabase/migrations/20261021111056_household_attendance.sql'))
results=[]
for path in files:
    sql(database,path.read_text(encoding='utf-8-sig'),'rehearsal-'+path.name+'.log')
    results.append({'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest().upper(),'exit':0})
    print('PASS '+path.name,flush=True)
sql(database,"select 'stays='||count(*) from public.household_attendance; select 'receipts='||count(*) from barangayan_private.household_attendance_receipts;",'rehearsal-no-backfill.log')
(work / 'rehearsal.json').write_text(json.dumps({'database':database,'baseline':'schema-only local 0117; no resident data copied',
    'excluded':'pg_cron extension/schema: scheduling is tied to the server database',
    'schema_sha256':hashlib.sha256(schema.encode()).hexdigest().upper(),'migrations':results},indent=2))
print('Rehearsal complete, with zero attendance backfill.')

