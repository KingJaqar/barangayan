import json, pathlib, subprocess
work=pathlib.Path('tmp/family-web-phase4-20261022')
path=pathlib.Path('supabase/runbooks/family-attendance/preflight.sql')
source=path.read_text(encoding='utf-8')
args=['docker','exec','-i','supabase_db_barangayan','psql','-X','-U','supabase_admin','-d','family_attendance_web4_20261022','-At','-v','ON_ERROR_STOP=1']
def run(name,sql):
    r=subprocess.run(args,input=sql,capture_output=True,text=True,encoding='utf-8',timeout=30)
    (work/f'logs/preflight-{name}.log').write_text(r.stdout+r.stderr,encoding='utf-8')
    return r
good=run('enabled',source)
assert good.returncode==0,good.stderr
body=source.replace('begin read only;','',1)
assert body.rstrip().endswith('commit;')
body=body.rstrip()[:-len('commit;')]
cases=[
 ('paused',"revoke execute on function public.check_in_household_members(uuid,uuid,jsonb,uuid) from authenticated;",'paused or authenticated execute is missing'),
 ('rls',"alter table public.household_attendance disable row level security;",'RLS must both be enabled'),
 ('direct-write',"grant insert on public.household_attendance to authenticated;",'Unexpected direct attendance/receipt privilege'),
 ('column-write',"grant update(checked_in_at) on public.household_attendance to authenticated;",'Unexpected direct attendance/receipt privilege'),
 ('receipt-column-read',"grant select(request_id) on barangayan_private.household_attendance_receipts to authenticated;",'Unexpected direct attendance/receipt privilege'),
 ('guard',"alter table public.evacuation_center_checkins disable trigger reject_legacy_attendance;",'Missing or disabled trigger'),
 ('export-view',"alter view public.household_attendance_receipt_exports set (security_invoker=false);",'Receipt export view must enforce'),
]
results=[{'case':'enabled','result':'pass'}]
for name,mutation,message in cases:
    result=run(name,'begin;\n'+mutation+'\n'+body+'\nrollback;')
    assert result.returncode==3 and message in result.stderr,(name,result.stderr)
    # Every negative scenario is rolled back by psql's aborted transaction exit.
    results.append({'case':name,'result':'pass','expected_failure':message,'rolled_back':True})
final=run('unchanged',source)
assert final.returncode==0,final.stderr
assert final.stdout==good.stdout,'Read-only inventory must be unchanged by negative cases.'
(work/'preflight-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
