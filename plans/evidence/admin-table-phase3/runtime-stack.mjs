// Disposable schema-only copy. Never writes to the source local/hosted database.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';

export const root = path.resolve(import.meta.dirname, '../../..');
export const privateDir = path.join(root, 'dist/admin-table-phase3-runtime');
export const statePath = path.join(privateDir, 'state.json');
const evidence = import.meta.dirname;
const owner = 'admin-table-phase3-01a12b8f';
const network = 'barangayan-admin-phase3';
const names = ['db', 'rest', 'auth', 'realtime'].map(s => `barangayan-admin-phase3-${s}`);
export function docker(args, input, timeout = 30000) {
  const result = spawnSync('docker', args, { input, encoding:'utf8', timeout, maxBuffer:32*1024*1024, windowsHide:true });
  assert.equal(result.status, 0, `Docker ${args[0]} failed: ${result.error?.code ?? result.stderr?.slice(-2500)}`);
  return result.stdout.trim();
}
export function sql(source) {
  return docker(['exec', '-i', names[0], 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], source);
}
const inspect = (name, field) => JSON.parse(docker(['inspect','--format',`{{json .${field}}}`,name]));
const jwt = (secret, role) => {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url')}`;
};
function create(service, image, env, extra = [], command = []) {
  const envFile = path.join(privateDir, `${service}.env`);
  fs.writeFileSync(envFile, Object.entries(env).map(([key,value]) => `${key}=${value}`).join('\n')+'\n');
  const id = docker(['create','--name',`barangayan-admin-phase3-${service}`,'--label',`barangayan.task=${owner}`,'--network',network,'--memory','768m','--cpus','2','--env-file',envFile,...extra,image,...command]);
  docker(['start',id]);
  return id;
}
async function start() {
  assert.ok(!fs.existsSync(statePath), 'Existing task state: inspect/clean up before creating another stack');
  for (const name of names) assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]), '', `Existing container ${name}`);
  const db = inspect('supabase_db_barangayan','Config');
  const rest = inspect('supabase_rest_barangayan','Config');
  const auth = inspect('supabase_auth_barangayan','Config');
  const roles = docker(['exec','supabase_db_barangayan','pg_dumpall','-U','postgres','--roles-only','--no-role-passwords']);
  // The pinned Realtime service owns its infrastructure schema. A copied older
  // composite type/function pair caused an actual WAL incompatibility; its own
  // migrations now create that schema. Affected public application schema stays exact.
  const schema = docker(['exec','supabase_db_barangayan','pg_dump','-U','postgres','-d','postgres','--schema-only','--no-comments','--exclude-schema=realtime']);
  const metadata = docker(['exec','supabase_db_barangayan','pg_dump','-U','postgres','-d','postgres','--data-only','--table=auth.schema_migrations','--table=_realtime.schema_migrations','--table=supabase_migrations.schema_migrations']);
  fs.mkdirSync(privateDir,{recursive:true});
  const secret = randomBytes(40).toString('hex');
  const password = randomBytes(24).toString('hex');
  const state = {owner,network,names,api:'http://127.0.0.1:55431',rest:'http://127.0.0.1:55433',auth:'http://127.0.0.1:55432',realtime:'http://127.0.0.1:55434',anonKey:jwt(secret,'anon'),serviceKey:jwt(secret,'service_role'),createdAt:new Date().toISOString()};
  fs.writeFileSync(statePath,JSON.stringify(state,null,2)); // Ignored private state: never put credentials in evidence.
  docker(['network','create','--label',`barangayan.task=${owner}`,network]);
  create('db',db.Image,{},['--user','postgres','--entrypoint','sh'],['-c',"initdb -D /tmp/admin-phase3-pg -A trust -U supabase_admin > /tmp/admin-phase3-init.log && printf 'host all all 0.0.0.0/0 scram-sha-256\\n' >> /tmp/admin-phase3-pg/pg_hba.conf && exec postgres -D /tmp/admin-phase3-pg -h 0.0.0.0 -c wal_level=logical -c max_replication_slots=10 -c shared_preload_libraries=pg_cron,pg_net -c cron.database_name=postgres"]);
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = spawnSync('docker',['exec',names[0],'pg_isready','-U','supabase_admin'],{encoding:'utf8',timeout:3000,windowsHide:true});
    if (result.status === 0) {ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Fresh PostgreSQL did not become ready within the finite startup bound');
  sql(roles.replace(/^CREATE ROLE supabase_admin;\r?\n/m,''));
  sql(schema);
  sql(metadata);
  sql(`alter role authenticator password '${password}'; alter role supabase_auth_admin password '${password}'; alter role supabase_admin password '${password}';`);
  const highest = sql('select max(version) from supabase_migrations.schema_migrations;');
  assert.equal(highest,'0109','Source schema changed: review alignment before testing');
  assert.equal(sql('select count(*) from auth.users;'),'0','No source account records may be copied');
  sql(fs.readFileSync(path.join(root,'supabase/migrations/0110_admin_table_browse_projections.sql'),'utf8'));
  sql(fs.readFileSync(path.join(root,'supabase/migrations/0111_admin_table_browse_read_performance.sql'),'utf8'));
  const envOf = c => Object.fromEntries(c.Env.map(e=>{const index=e.indexOf('=');return [e.slice(0,index),e.slice(index+1)];}));
  create('rest',rest.Image,{...envOf(rest),PGRST_DB_URI:`postgres://authenticator:${password}@${names[0]}:5432/postgres`,PGRST_JWT_SECRET:secret,PGRST_DB_MAX_ROWS:'1000'},['-p','127.0.0.1:55433:3000']);
  const authEnv = {...envOf(auth),GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@${names[0]}:5432/postgres`,GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_KEYS:'[]',GOTRUE_JWT_VALIDMETHODS:'HS256',GOTRUE_JWT_VALID_METHODS:'HS256',GOTRUE_JWT_ISSUER:state.api+'/auth/v1',API_EXTERNAL_URL:state.api+'/auth/v1',GOTRUE_SITE_URL:'http://127.0.0.1:3140',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_EXTERNAL_APPLE_ENABLED:'false',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:'1'};
  // This test requires password Auth only; no provider secret or outbound mail transport.
  for(const key of Object.keys(authEnv)) if(/SECRET|CLIENT_ID/.test(key)&&key!=='GOTRUE_JWT_SECRET') delete authEnv[key];
  create('auth',auth.Image,authEnv,['-p','127.0.0.1:55432:9999']);
  const realtimeImage = 'public.ecr.aws/supabase/realtime:v2.135.3';
  docker(['image','inspect','--format','{{.Id}}',realtimeImage]); // Reuse cached pinned image; no implicit download.
  create('realtime',realtimeImage,{PORT:'4000',DB_HOST:names[0],DB_PORT:'5432',DB_USER:'supabase_admin',DB_PASSWORD:password,DB_NAME:'postgres',DB_AFTER_CONNECT_QUERY:'SET search_path TO _realtime',DB_ENC_KEY:'supabaserealtime',API_JWT_SECRET:secret,SECRET_KEY_BASE:randomBytes(64).toString('hex'),METRICS_JWT_SECRET:secret,ERL_AFLAGS:'-proto_dist inet_tcp',DNS_NODES:"''",RLIMIT_NOFILE:'10000',APP_NAME:'realtime',SEED_SELF_HOST:'true',RUN_JANITOR:'false',DISABLE_HEALTHCHECK_LOGGING:'true'},['-p','127.0.0.1:55434:4000']);
  const catalog = JSON.parse(sql('set search_path=public;\n'+fs.readFileSync(path.join(root,'plans/evidence/admin-table-phase0/hosted-schema-query.sql'),'utf8')));
  fs.writeFileSync(path.join(evidence,'runtime-schema.json'),JSON.stringify(catalog,null,2)+'\n');
  const hosted = JSON.parse(fs.readFileSync(path.join(root,'plans/evidence/admin-table-phase0/hosted-schema.json'),'utf8'));
  const normalize = data=>JSON.stringify(data.map(item=>JSON.stringify(item)).sort());
  const alignment = Object.fromEntries(['columns','constraints','indexes','policies','rls','collations','migrations'].map(key=>[key,normalize(catalog[key])===normalize(hosted[key])]));
  fs.writeFileSync(path.join(evidence,'runtime-stack.json'),JSON.stringify({createdAt:state.createdAt,owner,names,network,images:{db:db.Image,rest:rest.Image,auth:auth.Image,realtime:realtimeImage},highestMigration:highest,copiedAccountRows:0,alignment,note:'Schema-only source copy plus infrastructure migration metadata; no application/source user data. Fresh signing keys; loopback ports only.'},null,2)+'\n');
  console.log(JSON.stringify({created:names,highestMigration:highest,alignment}));
}
function cleanup() {
  const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
  assert.equal(state.owner,owner); assert.deepEqual(state.names,names); assert.equal(state.network,network);
  const removed=[];
  for(const name of [...names].reverse()) {
    if(!docker(['ps','-aq','--filter',`name=^/${name}$`])) continue;
    assert.equal(inspect(name,'Config').Labels['barangayan.task'],owner);
    docker(['rm','--force','--volumes',name]);removed.push(name);
  }
  const labels=JSON.parse(docker(['network','inspect','--format','{{json .Labels}}',network]));
  assert.equal(labels['barangayan.task'],owner);docker(['network','rm',network]);
  assert.ok(path.resolve(privateDir).startsWith(path.join(root,'dist')+path.sep));
  const files=fs.readdirSync(privateDir);assert.ok(files.every(file=>/^(state\.json|(?:db|rest|auth|realtime)\.env|users\.json|faults\.json)$/.test(file)),'Inspect unexpected files before cleanup');
  for(const file of files) fs.unlinkSync(path.join(privateDir,file));
  fs.rmdirSync(privateDir);
  fs.writeFileSync(path.join(evidence,'runtime-cleanup.json'),JSON.stringify({timestamp:new Date().toISOString(),removed,networkRemoved:true,privateCredentialsRemoved:true,remainingOwnedContainers:docker(['ps','-aq','--filter',`label=barangayan.task=${owner}`])},null,2)+'\n');
  console.log('Task-owned containers, network and private fixture credentials removed');
}
if(process.argv[1]===path.resolve(import.meta.filename)) {
  if(process.argv[2]==='start') await start();
  else if(process.argv[2]==='cleanup') cleanup();
  else if(process.argv[2]==='repair-network') {
    assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
    docker(['exec',names[0],'sh','-c',"printf 'host all all 0.0.0.0/0 scram-sha-256\\n' >> /tmp/admin-phase3-pg/pg_hba.conf"]);
    sql('select pg_reload_conf();');
    docker(['restart',...names.slice(1)]);
    const catalog=JSON.parse(sql('set search_path=public;\n'+fs.readFileSync(path.join(root,'plans/evidence/admin-table-phase0/hosted-schema-query.sql'),'utf8')));
    fs.writeFileSync(path.join(evidence,'runtime-schema.json'),JSON.stringify(catalog,null,2)+'\n');
    console.log('Corrected task-owned network HBA and restarted three isolated services once');
  }
  else if(process.argv[2]==='repair-realtime-metadata') {
    assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
    const metadata=docker(['exec','supabase_db_barangayan','pg_dump','-U','postgres','-d','postgres','--data-only','--table=realtime.schema_migrations']);
    assert.ok(metadata.includes('COPY realtime.schema_migrations'),'Expected infrastructure migration metadata');
    sql('truncate realtime.schema_migrations;\n'+metadata);
    docker(['restart',names[3]]);
    console.log('Restored task-owned Realtime infrastructure migration metadata; no public object changed');
  }
  else if(process.argv[2]==='rebuild-realtime-infrastructure') {
    assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
    assert.equal(inspect(names[3],'Config').Labels['barangayan.task'],owner);
    const dependencies=sql("select count(*) from pg_depend d join pg_proc p on d.refclassid='pg_proc'::regclass and d.refobjid=p.oid join pg_namespace n on n.oid=p.pronamespace where n.nspname='realtime' and d.classid='pg_proc'::regclass and d.objid not in(select oid from pg_proc where pronamespace=n.oid);");
    assert.equal(dependencies,'0','External application function dependency: do not rebuild');
    docker(['stop','--time','5',names[3]]);
    sql('drop schema realtime cascade; create schema realtime authorization supabase_admin;');
    docker(['start',names[3]]);
    console.log('Rebuilt only task-owned Realtime schema from pinned service migrations; no external function dependencies');
  }
  else throw new Error('Use start or cleanup');
}
