const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const WebSocket=require('../../node_modules/ws');
const run=promisify(execFile);
const [port,label,xmlPath]=process.argv.slice(2);
if(!['8096','8098'].includes(port)||!/^performance-(baseline|candidate)(-verified|-repeat)?$/.test(label)||!xmlPath) throw new Error('Explicit baseline/candidate arguments required');
const base=path.join(__dirname,'native-resume',label);
if(fs.existsSync(base)) throw new Error('Do not overwrite earlier profile');
fs.mkdirSync(base);
const adb=async(...args)=>(await run('C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','127.0.0.1:16384',...args],{maxBuffer:16_000_000})).stdout;
const pause=()=>new Promise(resolve=>setTimeout(resolve,350));
async function main(){
  const xml=fs.readFileSync(xmlPath,'utf8');
  const node=xml.match(/<node\b[^>]*content-desc="Choose a purpose"[^>]*>/g);
  if(node?.length!==1) throw new Error('Expected observed purpose control');
  const bounds=node[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if(!bounds) throw new Error('Missing control bounds');
  const x=Math.round((Number(bounds[1])+Number(bounds[3]))/2);
  const y=Math.round((Number(bounds[2])+Number(bounds[4]))/2);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target=targets.find(item=>item.title?.includes('com.barangayan.resident.dev'));
  if(!target) throw new Error('Native target unavailable');
  const socket=new WebSocket(target.webSocketDebuggerUrl,{origin:`http://127.0.0.1:${port}`});
  const contexts=[];const events=[];const pending=new Map();const network={requests:0,finished:0,failed:0};let id=0;let tracing=false;let complete;
  const traceComplete=new Promise(resolve=>{complete=resolve;});
  socket.on('message',raw=>{
    const message=JSON.parse(raw);
    if(message.method==='Runtime.executionContextCreated') contexts.push(message.params.context);
    if(message.method==='Network.requestWillBeSent') network.requests++;
    if(message.method==='Network.loadingFinished') network.finished++;
    if(message.method==='Network.loadingFailed') network.failed++;
    if(message.method==='Tracing.dataCollected') for(const event of message.params.value) {
      const keepArgs=['Profile','ProfileChunk','BeginFrame','DrawFrame','thread_name','process_name'].includes(event.name);
      events.push({...event,args:keepArgs?event.args:{}});
    }
    if(message.method==='Tracing.tracingComplete') complete();
    if(message.id){const callback=pending.get(message.id);if(callback){pending.delete(message.id);clearTimeout(callback.timer);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result);}}
  });
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const request=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;const timer=setTimeout(()=>{pending.delete(current);reject(new Error('Timed out: '+method));},15000);pending.set(current,{resolve,reject,timer});socket.send(JSON.stringify({id:current,method,params}));});
  const inspect=async(name,opened)=>{
    await adb('shell','uiautomator','dump','/sdcard/phase1-profile-ui.xml');
    const state=await adb('exec-out','cat','/sdcard/phase1-profile-ui.xml');
    fs.writeFileSync(path.join(base,name+'.xml'),state);
    const valid=opened?state.includes('content-desc="Cancel purpose selection"'):state.includes('content-desc="Choose a purpose"')&&!state.includes('content-desc="Cancel purpose selection"');
    if(!valid) throw new Error('Unexpected native state: '+name);
  };
  try{
    await request('Runtime.enable');
    const context=contexts.find(item=>item.name==='main');
    if(!context) throw new Error('Main native runtime unavailable');
    const snapshot=async()=>{
      const result=await request('Runtime.evaluate',{contextId:context.id,returnByValue:true,expression:`JSON.stringify((()=>{const module=Array.from(globalThis.__r.getModules().values()).find(item=>item.isInitialized && item.verboseName==='src/lib/supabase.ts');return {reduceMotionListeners:globalThis.__rctDeviceEventEmitter.listenerCount('reduceMotionDidChange'),realtimeChannels:module?.publicModule.exports.supabase.getChannels().length};})())`});
      if(result.exceptionDetails) throw new Error('Read-only snapshot failed');
      return JSON.parse(result.result.value);
    };
    // One untimed warm-up cycle uses the same inspected control and cancel-only Back.
    await inspect('before-warmup',false);
    await adb('shell','input','tap',String(x),String(y));await pause();await inspect('warm-open',true);
    await adb('shell','input','keyevent','4');await pause();await inspect('warm-closed',false);
    const before=await snapshot();
    await request('Network.enable');
    await adb('shell','dumpsys','gfxinfo','com.barangayan.resident.dev','reset');
    await request('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler,v8.execute'});tracing=true;
    const cycles=[];
    for(let cycle=1;cycle<=10;cycle++){
      const started=new Date().toISOString();
      await adb('shell','input','tap',String(x),String(y));await pause();
      await inspect(`cycle-${cycle}-open`,true);
      await adb('shell','input','keyevent','4');await pause();
      await inspect(`cycle-${cycle}-closed`,false);
      cycles.push({cycle,started,completed:new Date().toISOString()});
    }
    await request('Tracing.end');tracing=false;
    const completed=await Promise.race([traceComplete.then(()=>true),new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),10000);timer.unref();})]);
    if(!completed) throw new Error('Native tracing completion unavailable');
    const after=await snapshot();
    await request('Network.disable');
    fs.writeFileSync(path.join(base,'gfxinfo.txt'),await adb('shell','dumpsys','gfxinfo','com.barangayan.resident.dev'));
    fs.writeFileSync(path.join(base,'framestats.txt'),await adb('shell','dumpsys','gfxinfo','com.barangayan.resident.dev','framestats'));
    await adb('shell','uiautomator','dump','/sdcard/phase1-profile-ui.xml');
    const finalXml=await adb('exec-out','cat','/sdcard/phase1-profile-ui.xml');
    fs.writeFileSync(path.join(base,'final-ui.xml'),finalXml);
    const returnedToForm=finalXml.includes('content-desc="Choose a purpose"')&&!finalXml.includes('content-desc="Cancel purpose selection"');
    fs.writeFileSync(path.join(base,'trace.json'),JSON.stringify({traceEvents:events}));
    const names={};for(const event of events) names[event.name]=(names[event.name]||0)+1;
    const begins=new Map();const frameMs=[];
    for(const event of events){const key=`${event.pid}:${event.tid}:${event.args?.frameSeqId}`;if(event.name==='BeginFrame')begins.set(key,event.ts);if(event.name==='DrawFrame'&&begins.has(key))frameMs.push((event.ts-begins.get(key))/1000);}
    frameMs.sort((a,b)=>a-b);
    const result={recordedAt:new Date().toISOString(),label,port,control:{x,y},warmupCycles:1,cycles,before,after,network,returnedToForm,traceEvents:events.length,names,frames:{count:frameMs.length,p95Ms:frameMs[Math.ceil(frameMs.length*0.95)-1]??null,maxMs:frameMs.at(-1)??null,within15HzBudget:frameMs.length?frameMs.filter(value=>value<=1000/15).length/frameMs.length:null},limitations:['Native development build and inspector overhead; no physical-device claim.','Network stores aggregate counts only; no headers, credentials or payloads.','Trace retains CPU/frame arguments and removes other event argument payloads.']};
    fs.writeFileSync(path.join(base,'summary.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    if(!returnedToForm||before.reduceMotionListeners!==after.reduceMotionListeners||before.realtimeChannels!==after.realtimeChannels) process.exitCode=1;
  }finally{if(tracing)await request('Tracing.end').catch(()=>{});socket.close();}
}
main().catch(error=>{fs.writeFileSync(path.join(base,'error.txt'),error.message);console.error(error.message);process.exitCode=1;});
