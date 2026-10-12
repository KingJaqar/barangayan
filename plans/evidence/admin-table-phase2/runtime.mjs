import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { build } from 'esbuild';
export const root=path.resolve(import.meta.dirname,'../../..');
const privateDir=path.join(root,'dist/admin-table-phase2');
export const owner='admin-table-phase2-01a12ad6';
const names=['barangayan-admin-phase2-db','barangayan-admin-phase2-rest'];
const network='barangayan-admin-phase2';
export function docker(args,input,timeout=30000){
 const r=spawnSync('docker',args,{input,encoding:'utf8',timeout,windowsHide:true,maxBuffer:32*1024*1024});
 assert.equal(r.status,0,`${args[0]}: ${r.error?.code??r.stderr.slice(-2000)}`);return r.stdout.trim();
}
export const sql=source=>docker(['exec','-i',names[0],'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],`set statement_timeout='30s';\n${source}`,40000);
const inspect=(name,key)=>JSON.parse(docker(['inspect','--format',`{{json .${key}}}`,name]));
export const state=()=>JSON.parse(fs.readFileSync(path.join(privateDir,'state.json'),'utf8'));
export function token(role,sub){
 const secret=state().secret;
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({role,sub,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');
 return `${header}.${payload}.${createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url')}`;
}
async function start(){
 assert.ok(!fs.existsSync(privateDir),'Existing task directory must be inspected first');
 for(const n of names) assert.equal(docker(['ps','-aq','--filter',`name=^/${n}$`]),'');
 const db=inspect('supabase_db_barangayan','Config'),rest=inspect('supabase_rest_barangayan','Config');
 const roles=docker(['exec','supabase_db_barangayan','pg_dumpall','-U','postgres','--roles-only','--no-role-passwords']);
 const schema=docker(['exec','supabase_db_barangayan','pg_dump','-U','postgres','-d','postgres','--schema-only','--no-comments','--exclude-schema=realtime']);
 const migrations=docker(['exec','supabase_db_barangayan','pg_dump','-U','postgres','-d','postgres','--data-only','--table=supabase_migrations.schema_migrations']);
 fs.mkdirSync(privateDir,{recursive:true});
 const secret=randomBytes(40).toString('hex'),password=randomBytes(24).toString('hex');
 fs.writeFileSync(path.join(privateDir,'state.json'),JSON.stringify({owner,secret,rest:'http://127.0.0.1:55443'}));
 docker(['network','create','--label',`barangayan.task=${owner}`,network]);
 docker(['create','--name',names[0],'--label',`barangayan.task=${owner}`,'--network',network,'--memory','1g','--cpus','2','--user','postgres','--entrypoint','sh',db.Image,'-c',"initdb -D /tmp/admin-phase2-pg -A trust -U supabase_admin > /tmp/init.log && exec postgres -D /tmp/admin-phase2-pg -h 0.0.0.0 -c shared_preload_libraries=pg_cron,pg_net -c cron.database_name=postgres"]);
 docker(['start',names[0]]);
 let ready=false;
 for(let i=0;i<15;i++){
  const r=spawnSync('docker',['exec',names[0],'pg_isready','-U','supabase_admin'],{encoding:'utf8',timeout:2000,windowsHide:true});
  if(r.status===0){ready=true;break;} await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,'Startup exceeded finite bound');
 docker(['exec',names[0],'sh','-c',"printf 'host all all 0.0.0.0/0 scram-sha-256\\n' >> /tmp/admin-phase2-pg/pg_hba.conf"]);
 sql('select pg_reload_conf();');
 sql(roles.replace(/^CREATE ROLE supabase_admin;\r?\n/m,''));sql(schema);sql(migrations);
 assert.equal(sql('select max(version) from supabase_migrations.schema_migrations;'),'0109');
 assert.equal(sql('select count(*) from auth.users;'),'0');
 sql(`alter role authenticator password '${password}';`);
 sql(fs.readFileSync(path.join(root,'supabase/migrations/0110_admin_table_browse_projections.sql'),'utf8'));
 if(fs.existsSync(path.join(root,'supabase/migrations/0111_admin_table_browse_read_performance.sql')))sql(fs.readFileSync(path.join(root,'supabase/migrations/0111_admin_table_browse_read_performance.sql'),'utf8'));
 const env=Object.fromEntries(rest.Env.map(e=>{const i=e.indexOf('=');return [e.slice(0,i),e.slice(i+1)];}));
 Object.assign(env,{PGRST_DB_URI:`postgres://authenticator:${password}@${names[0]}:5432/postgres`,PGRST_JWT_SECRET:secret,PGRST_DB_MAX_ROWS:'1000'});
 fs.writeFileSync(path.join(privateDir,'rest.env'),Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n'));
 docker(['create','--name',names[1],'--label',`barangayan.task=${owner}`,'--network',network,'--memory','512m','--cpus','2','--env-file',path.join(privateDir,'rest.env'),'-p','127.0.0.1:55443:3000',rest.Image]);docker(['start',names[1]]);
 sql(fs.readFileSync(path.join(root,'plans/evidence/admin-table-phase0/runtime-seed.sql'),'utf8'));
 sql(`insert into auth.users(id,email) values ('23000000-0000-4000-8000-000000000001','foreign@example.invalid'),('23000000-0000-4000-8000-000000000002','removed@example.invalid');
 insert into public.profiles(id,barangay_id,role,full_name,email) values
 ('23000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin','Foreign Admin','foreign@example.invalid'),
 ('23000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','admin','Removed Admin','removed@example.invalid');
 update public.profiles set deleted_at=now() where id='23000000-0000-4000-8000-000000000002';`);
 sql('analyze;');
 await bundle();
 fs.writeFileSync(new URL('./stack.json',import.meta.url),JSON.stringify({owner,names,network,images:{db:db.Image,rest:rest.Image},sourceHighest:'0109',migrations:['0110','0111'],copiedAccountRows:0,restCap:1000,postgres:sql('select version();'),collation:sql(`select datcollate from pg_database where datname=current_database();`),views:JSON.parse(sql(`select json_agg(json_build_object('name',relname,'options',reloptions)) from pg_class where relname like 'admin_%' and relkind='v';`))},null,2)+'\n');
 console.log('Isolated schema and deterministic fixtures ready');
}
export async function bundle(){
 await build({entryPoints:[path.join(root,'apps/admin-web/src/lib/admin-tables/queries/browse.ts')],outfile:path.join(privateDir,'adapter.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'server-boundary',setup(b){
  b.onResolve({filter:/^server-only$/},()=>({path:'boundary',namespace:'stub'}));
  b.onResolve({filter:/supabase\/server$/},()=>({path:'session',namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='session'?"export function createSupabaseServerClient(){throw new Error('Tests must pass a session client')}" : '',loader:'js'}));
 }}]});
}
function cleanup(){
 assert.equal(state().owner,owner);
 for(const n of [...names].reverse()){
  if(!docker(['ps','-aq','--filter',`name=^/${n}$`]))continue;
  assert.equal(inspect(n,'Config').Labels['barangayan.task'],owner);docker(['rm','--force','--volumes',n]);
 }
 assert.equal(JSON.parse(docker(['network','inspect','--format','{{json .Labels}}',network]))['barangayan.task'],owner);docker(['network','rm',network]);
 assert.ok(path.resolve(privateDir).startsWith(path.join(root,'dist')+path.sep));
 const files=fs.readdirSync(privateDir);assert.ok(files.every(x=>['adapter.mjs','state.json','rest.env'].includes(x)));
 for(const f of files)fs.unlinkSync(path.join(privateDir,f));fs.rmdirSync(privateDir);
 fs.writeFileSync(new URL('./cleanup.json',import.meta.url),JSON.stringify({owner,removed:names,networkRemoved:true,privateStateRemoved:true,remaining:docker(['ps','-aq','--filter',`label=barangayan.task=${owner}`])},null,2));
 console.log('Isolated task resources removed');
}
if(process.argv[1]===import.meta.filename){if(process.argv[2]==='start')await start();else if(process.argv[2]==='cleanup')cleanup();else if(process.argv[2]==='bundle')await bundle();else if(process.argv[2]==='apply'){
 assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
 sql(fs.readFileSync(path.join(root,'supabase/migrations/0110_admin_table_browse_projections.sql'),'utf8').replace('create schema admin_table_keys;','create schema if not exists admin_table_keys;').replaceAll('create function ','create or replace function ').replaceAll('create view ','create or replace view '));
 await bundle();console.log('Updated only the owned fixture projections');
}else if(process.argv[2]==='repair-network'){
 assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
 docker(['exec',names[0],'sh','-c',"printf 'host all all 0.0.0.0/0 scram-sha-256\\n' >> /tmp/admin-phase2-pg/pg_hba.conf"]);
 sql('select pg_reload_conf();');docker(['restart',names[1]]);
}else if(process.argv[2]==='performance-migration'){
 assert.equal(inspect(names[0],'Config').Labels['barangayan.task'],owner);
 sql(fs.readFileSync(path.join(root,'supabase/migrations/0111_admin_table_browse_read_performance.sql'),'utf8'));
 sql('analyze;');sql("notify pgrst,'reload schema';");console.log('Applied measured read performance changes only to owned fixture');
}}
