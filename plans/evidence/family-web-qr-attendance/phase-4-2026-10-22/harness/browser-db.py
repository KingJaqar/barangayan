import subprocess,json,pathlib,sys,os,hmac,hashlib,base64,time
w=pathlib.Path('tmp/family-web-phase4-20261022')
def call(args,**kw): return subprocess.run(args,capture_output=True,text=True,encoding='utf-8',**kw)
def sql(text):
 r=call(['docker','exec','-i','supabase_db_barangayan','psql','-U','supabase_admin','-d','family_attendance_web4_20261022','-X','-At','-v','ON_ERROR_STOP=1'],input=text)
 (w/'logs/browser-fixtures.log').write_text(r.stdout+r.stderr); assert r.returncode==0,r.stderr
if sys.argv[1]=='setup':
 rest=json.loads(call(['docker','inspect','supabase_rest_barangayan']).stdout)[0]
 env=dict(item.split('=',1) for item in rest['Config']['Env'] if '=' in item)
 uri=env['PGRST_DB_URI']; uri=uri.rsplit('/',1)[0]+'/family_attendance_web4_20261022'
 network=next(iter(rest['NetworkSettings']['Networks']))
 key='family-web-phase2-disposable-synthetic-only-jwt-signing-key-20261021'
 args=['docker','run','-d','--name','family-web-phase4-rest','--network',network,'-p','127.0.0.1::3000',
  '-e','PGRST_DB_URI='+uri,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+key,rest['Config']['Image']]
 r=call(args); assert r.returncode==0,r.stderr
 port=json.loads(call(['docker','inspect','family-web-phase4-rest']).stdout)[0]['NetworkSettings']['Ports']['3000/tcp'][0]['HostPort']
 (w/'rest-port.txt').write_text(port)
 sql('''insert into public.barangays(id,name) values('afb21000-0000-4000-8000-000000000001','Web browser synthetic');
 insert into auth.users(id,email) select ('dfb21000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'web-browser-'||n||'@test.local' from generate_series(1,3)n;
 insert into public.profiles(id,barangay_id,role,full_name) select ('dfb21000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'afb21000-0000-4000-8000-000000000001',case when n=1 then 'admin' else 'resident' end,
 case when n=1 then 'Synthetic Staff' when n=2 then 'Synthetic Family' else 'Synthetic Holder Only' end from generate_series(1,3)n;
 update public.profiles set household_members='[{"id":"cfb21000-0000-4000-8000-000000000001","name":"Selected Child","relation":"child","role":"member"},{"id":"cfb21000-0000-4000-8000-000000000002","name":"Unselected Child","relation":"child","role":"member"}]' where id='dfb21000-0000-4000-8000-000000000002';
 insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
 ('efb21000-0000-4000-8000-000000000001','afb21000-0000-4000-8000-000000000001','Synthetic Center A','{"lat":1,"lng":1}',true),
 ('efb21000-0000-4000-8000-000000000002','afb21000-0000-4000-8000-000000000001','Synthetic Center B','{"lat":1,"lng":1}',true);''')
 print('Isolated synthetic PostgREST started on loopback port '+port)
elif sys.argv[1]=='reset':
 sql((w/'reset.sql').read_text())
 print('Reset only this task synthetic households in the disposable database.')
elif sys.argv[1]=='run':
 info=json.loads(call(['docker','inspect','family-web-phase4-rest']).stdout)[0]
 (w/'rest-port.txt').write_text(info['NetworkSettings']['Ports']['3000/tcp'][0]['HostPort'])
 key='family-web-phase2-disposable-synthetic-only-jwt-signing-key-20261021'
 enc=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
 header=enc({'alg':'HS256','typ':'JWT'}); payload=enc({'role':'authenticated','sub':'dfb21000-0000-4000-8000-000000000002','exp':int(time.time())+7200})
 signing=header+'.'+payload; token=signing+'.'+base64.urlsafe_b64encode(hmac.new(key.encode(),signing.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 otherPayload=enc({'role':'authenticated','sub':'dfb21000-0000-4000-8000-000000000003','exp':int(time.time())+7200})
 otherSigning=header+'.'+otherPayload; otherToken=otherSigning+'.'+base64.urlsafe_b64encode(hmac.new(key.encode(),otherSigning.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 adminPayload=enc({'role':'authenticated','sub':'dfb21000-0000-4000-8000-000000000001','exp':int(time.time())+7200})
 adminSigning=header+'.'+adminPayload; adminToken=adminSigning+'.'+base64.urlsafe_b64encode(hmac.new(key.encode(),adminSigning.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 env={**os.environ,'ATTENDANCE_TEST_TOKEN':token,'ATTENDANCE_OTHER_TEST_TOKEN':otherToken,'ATTENDANCE_ADMIN_TEST_TOKEN':adminToken}
 if len(sys.argv)>2 and sys.argv[2]=='admin': env['ATTENDANCE_TEST_TOKEN']=adminToken
 r=subprocess.run(['node',str(w/(sys.argv[2]+'.mjs' if len(sys.argv)>2 else 'browser.mjs'))],env=env); sys.exit(r.returncode)
