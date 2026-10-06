/* global Buffer */
// Read credentials only from the verified local test container, in memory.
const {spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
function docker(...args){const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker',...args],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.equal(r.status,0,'Local Docker command failed');return r.stdout;}
module.exports=function(){
 const info=JSON.parse(docker('inspect','supabase_kong_barangayan'))[0];
 assert.ok(info.NetworkSettings.Ports['8000/tcp'].every(p=>p.HostPort==='54321'),'Only isolated loopback API port is accepted');
 const configPath=info.Config.Env.find(e=>e.startsWith('KONG_DECLARATIVE_CONFIG=')).slice('KONG_DECLARATIVE_CONFIG='.length);
 assert.ok(configPath.startsWith('/'));
 const config=docker('exec','supabase_kong_barangayan','cat',configPath);
 const tokens=[...new Set(config.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g))];
 const tokenFor=role=>tokens.find(token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url')).role===role);
 // Windows loopback forwarding is unavailable on this test host; derive only
 // the address of the named WSL test distribution, never accept a remote URL.
 const host=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','hostname','-I'],{encoding:'utf8',timeout:10000});
 assert.equal(host.status,0);const address=host.stdout.trim().split(/\s+/)[0];
 assert.match(address,/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/);
 const result={API_URL:`http://${address}:54321`,ANON_KEY:tokenFor('anon'),SERVICE_ROLE_KEY:tokenFor('service_role')};
 assert.ok(result.ANON_KEY&&result.SERVICE_ROLE_KEY,'Local fixture credentials are required');return result;
};
