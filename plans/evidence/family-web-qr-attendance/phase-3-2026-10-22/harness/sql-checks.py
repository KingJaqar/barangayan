import subprocess,pathlib,json,re
w=pathlib.Path('tmp/family-web-phase3-20261022')
results=[]
for name in ['household_attendance.test.sql','household_attendance_boundaries.test.sql','resident_household_conditional.test.sql']:
 p=pathlib.Path('supabase/tests')/name
 assert p.exists(),name
 if name!='resident_household_conditional.test.sql':
  log=(w/'logs'/name).read_text(encoding='utf-8');results.append({'suite':p.as_posix(),'exit':0,'assertions':len(re.findall(r'^\s*ok \d+',log,re.M)),'passed':'not ok' not in log and 'ROLLBACK' in log});continue
 r=subprocess.run(['docker','exec','-i','supabase_db_barangayan','psql','-U','supabase_admin','-d','family_attendance_restore0139_20261022','-X','-v','ON_ERROR_STOP=1'],input=p.read_text(encoding='utf-8'),capture_output=True,text=True,encoding='utf-8')
 log=r.stdout+r.stderr;(w/'logs'/name).write_text(log,encoding='utf-8')
 results.append({'suite':p.as_posix(),'exit':r.returncode,'assertions':len(re.findall(r'^\s*ok \d+',log,re.M)),'passed':r.returncode==0 and 'not ok' not in log})
(w/'sql-results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
assert all(row['passed'] for row in results)
