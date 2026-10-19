const fs=require('node:fs');
const path=require('node:path');
const WebSocket=require('../../node_modules/ws');
const slug=process.argv[2]||'inspector-probe';
if(!/^[a-z0-9-]+$/.test(slug))throw new Error('Invalid observation name');
const stateOnly=process.argv[3]==='state-only';
const output=path.join(__dirname,'native-resume',slug+'.json');
async function main() {
  const targets=await (await fetch('http://127.0.0.1:8098/json/list')).json();
  const target=targets.find(item=>item.title?.includes('com.barangayan.resident.dev'));
  if (!target) throw new Error('No matching existing native app');
  const socket=new WebSocket(target.webSocketDebuggerUrl,{origin:'http://127.0.0.1:8098'});
  const pending=new Map(); let id=0;
  const contexts=[];
  socket.on('message',raw=>{const message=JSON.parse(raw);if(message.method==='Runtime.executionContextCreated') contexts.push(message.params.context);if(message.id){const callback=pending.get(message.id);if(callback){pending.delete(message.id);clearTimeout(callback.timer);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result);}}});
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const request=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;const timer=setTimeout(()=>{pending.delete(current);reject(new Error('Timed out: '+method));},10000);pending.set(current,{resolve,reject,timer});socket.send(JSON.stringify({id:current,method,params}));});
  try {
    await request('Runtime.enable');
    const evaluations=[];
    for(const context of contexts) evaluations.push({context,result:await request('Runtime.evaluate',{expression:`JSON.stringify({globals:Object.getOwnPropertyNames(globalThis).filter(name=>/^(global|__r|__rctDeviceEventEmitter|HermesInternal)$/.test(name)),reduceMotionListeners:globalThis.__rctDeviceEventEmitter?.listenerCount('reduceMotionDidChange'),modules:typeof globalThis.__r?.getModules==='function'?Array.from(globalThis.__r.getModules().values()).filter(item=>item.isInitialized && /(^|\\/)src\\/lib\\/supabase\\.ts$/.test(item.verboseName || '')).map(item=>({name:item.verboseName,exports:Object.keys(item.publicModule.exports),realtimeChannels:item.publicModule.exports.supabase.getChannels().length})):[]})`,contextId:context.id,returnByValue:true})});
    if(stateOnly){const record={recordedAt:new Date().toISOString(),target:target.title,evaluations};fs.writeFileSync(output,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));return;}
    let profiler;
    try {await request('Profiler.enable');profiler={supported:true};await request('Profiler.disable');}
    catch(error){profiler={supported:false,error:error.message};}
    let network;
    try {await request('Network.enable');network={supported:true};await request('Network.disable');}
    catch(error){network={supported:false,error:error.message};}
    let tracing;
    try {await request('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler'});await request('Tracing.end');tracing={supported:true};}
    catch(error){tracing={supported:false,error:error.message};}
    const record={recordedAt:new Date().toISOString(),target:target.title,evaluations,profiler,network,tracing};
    fs.writeFileSync(output,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
  } finally {socket.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
