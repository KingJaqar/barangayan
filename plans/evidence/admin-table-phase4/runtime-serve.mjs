// Loopback-only Auth/REST/Realtime proxy and source-snapshot Next preview.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {root,statePath,privateDir,sql} from './runtime-stack.mjs';

const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
assert.equal(state.owner,'admin-table-phase4-01a12d0a');
const destination=path.join(root,'dist/admin-table-phase4-preview');
if(process.argv.includes('--resume')) {
 assert.equal(JSON.parse(fs.readFileSync(path.join(destination,'package.json'),'utf8')).name,'@barangayan/web');
 assert.ok(fs.readFileSync(path.join(destination,'src/app/login/page.tsx')).equals(fs.readFileSync(path.join(root,'apps/admin-web/src/app/login/page.tsx'))),'Snapshot source must remain the inspected baseline');
} else {
 assert.ok(!fs.existsSync(destination),'Preserve existing snapshot: inspect before explicitly resuming');
 fs.cpSync(path.join(root,'apps/admin-web'),destination,{recursive:true,filter:source=>!path.relative(path.join(root,'apps/admin-web'),source).split(path.sep).some(part=>part==='.next'||part==='node_modules'||part.startsWith('.env'))});
}
// Generated Next files are confined to this copied source tree.
const streams = {rest:55433,auth:55432,realtime:55434};
const requestLog=[];
const sockets=new Set();
const server=http.createServer({maxHeaderSize:131072},(req,res)=>{
  const faultsFile=path.join(privateDir,'faults.json');
  const faults=fs.existsSync(faultsFile)?JSON.parse(fs.readFileSync(faultsFile,'utf8')):{};
  const pathname=req.url.split('?')[0];
  const optionRead=pathname==='/rest/v1/profiles' && new URL(req.url,state.api).searchParams.get('select')==='id,full_name';
  if(faults.fail?.includes(pathname.split('/').pop()) || (faults.options && optionRead)) {
    res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'XX000',message:'Synthetic query failure'}));return;
  }
  if(pathname==='/functions/v1/refund-payment') {
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      const id=JSON.parse(body).paymentId;assert.match(id,/^[0-9a-f-]{36}$/);
      sql("update public.payments set refund_status='pending',refund_amount_centavos=amount_centavos,refund_reason='requested_by_customer' where id='"+id+"';");
      res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'http://127.0.0.1:3140'});res.end(JSON.stringify({paymentId:id,status:'pending'}));
    });return;
  }
  const parts=req.url.split('/');const type=parts[1];
  if(!streams[type]||parts[2]!=='v1') {res.writeHead(404);res.end();return;}
  const targetPath=req.url.replace(`/${type}/v1`,type==='realtime'?'/socket':'')||'/';
  const headers={...req.headers,host:type==='realtime'?'realtime-dev.localhost':'localhost'};
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3140');
  res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,range,x-supabase-api-version,accept-profile,content-profile');
  res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const upstream=http.request({host:'127.0.0.1',port:streams[type],path:targetPath,method:req.method,headers,timeout:15000},response=>{
    // Evidence records route/method/status only, never authorization or payloads.
    requestLog.push({type,method:req.method,path:targetPath.split('?')[0],status:response.statusCode});
    const responseHeaders={...response.headers};delete responseHeaders['access-control-allow-origin'];
    res.writeHead(response.statusCode,responseHeaders);if(faults.delay && targetPath.startsWith('/admin_') && targetPath.includes('_browse')) setTimeout(()=>response.pipe(res),faults.delay);else response.pipe(res);
  });
  upstream.on('timeout',()=>upstream.destroy(new Error('upstream timeout')));
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Isolated upstream unavailable');});req.pipe(upstream);
});
server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
server.on('upgrade',(req,socket,head)=>{
  if(!req.url.startsWith('/realtime/v1/')){socket.destroy();return;}
  const upstream=net.connect(55434,'127.0.0.1',()=>{
    const headers={...req.headers,host:'realtime-dev.localhost'};
    upstream.write(`${req.method} ${req.url.replace('/realtime/v1','/socket')} HTTP/${req.httpVersion}\r\n`+Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');
    if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
  });
  upstream.setTimeout(120000,()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
});
await new Promise(resolve=>server.listen(55431,'127.0.0.1',resolve));
const log=fs.openSync(path.join(import.meta.dirname,'runtime-preview.log'),'w');
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',destination,'--webpack','--hostname','127.0.0.1','--port','3140'],{cwd:root,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:state.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:state.anonKey,NEXT_TELEMETRY_DISABLED:'1',BARANGAYAN_PREVIEW_DIST_DIR:'.next'},stdio:['ignore',log,log],windowsHide:true});
fs.writeFileSync(path.join(import.meta.dirname,'runtime-preview-process.json'),JSON.stringify({owner:state.owner,proxyPid:process.pid,nextPid:child.pid,destination,maximumLifetimeMinutes:45,startedAt:new Date().toISOString()},null,2)+'\n');
let stopped=false;
function stop(){
 if(stopped)return;stopped=true;
 if(process.platform==='win32') spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{timeout:10000,windowsHide:true,stdio:'ignore'});
 else child.kill();
 for(const socket of sockets)socket.destroy();server.close();
 fs.writeFileSync(path.join(import.meta.dirname,'runtime-request-log.json'),JSON.stringify(requestLog,null,2)+'\n');
 console.log('Preview/proxy stopped; source snapshot retained for bounded cleanup');
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('exit',stop);
const timer=setTimeout(stop,45*60*1000);timer.unref();
console.log('Task-owned preview: http://127.0.0.1:3140; lifetime limited to 45 minutes');
