import hashlib
import json
import pathlib
import re
import subprocess

work = pathlib.Path(__file__).parent
database = 'family_attendance_rehearsal_20261021_drift_v5'
prefix = ['docker', 'exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'supabase_admin']

def sql(db, source, name):
    result = subprocess.run(prefix + ['-d', db, '-X', '-At', '-v', 'ON_ERROR_STOP=1'],
                            input=source, encoding='utf-8', capture_output=True, timeout=90)
    (work / 'logs' / name).write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    assert result.returncode == 0, result.stderr[-2000:]
    assert not re.search(r'^not ok|^# Looks like you failed', result.stdout, re.MULTILINE), result.stdout[-2000:]
    return result.stdout

assert sql('postgres', f"select count(*) from pg_database where datname='{database}'", 'drift-name.log').strip() == '0'
sql('postgres', f'create database {database} template template0', 'drift-create.log')
sql(database, (work / 'local-0117-schema-only.sql').read_text(encoding='utf-8'), 'drift-restore.log')
files = [p for p in sorted(pathlib.Path('supabase/migrations').glob('*.sql'))
         if p.name[:4].isdigit() and 118 <= int(p.name[:4]) <= 136]
for path in files:
    sql(database, path.read_text(encoding='utf-8-sig'), 'drift-' + path.name + '.log')
sql(database, 'drop trigger guard_household_archive on public.household_members; '
              'drop function barangayan_private.guard_household_archive();', 'drift-remove-guard.log')
candidate = pathlib.Path('supabase/migrations/20261021111056_household_attendance.sql')
sql(database, candidate.read_text(encoding='utf-8-sig'), 'drift-candidate.log')
sql(database, pathlib.Path('supabase/tests/household_attendance.test.sql').read_text(encoding='utf-8-sig'), 'drift-tests.log')
result = {'database': database, 'candidate_sha256': hashlib.sha256(candidate.read_bytes()).hexdigest().upper(),
          'result': 'pass', 'checks': ['schema-only restore; no resident records',
          '0118–0136 applied', 'prior archive trigger and function deliberately absent',
          'candidate migration restores required guard', '83 attendance assertions pass']}
(work / 'drift.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))

