const fs=require('node:fs');const path=require('node:path');
const base=path.join(__dirname,'native-resume');
const percentile=(items,fraction)=>items.length?[...items].sort((a,b)=>a-b)[Math.ceil(items.length*fraction)-1]:null;
const records=[];
for(const [kind,folder] of [['baseline','baseline-verified'],['candidate','candidate-verified'],['candidate-repeat','candidate-repeat']]){
  const directory=path.join(base,`performance-${folder}`);
  const summary=JSON.parse(fs.readFileSync(path.join(directory,'summary.json'),'utf8'));
  const events=JSON.parse(fs.readFileSync(path.join(directory,'trace.json'),'utf8')).traceEvents;
  const commits=[];const commitStarts=new Map();
  for(const event of events.filter(item=>item.name==='commit')) {
    const key=`${event.pid}:${event.tid}:${event.id}`;
    if(event.ph==='b')commitStarts.set(key,event.ts);
    if(event.ph==='e'&&commitStarts.has(key)){commits.push((event.ts-commitStarts.get(key))/1000);commitStarts.delete(key);}
  }
  let columns=[];let active=false;let flagged=0;let invalid=0;const frames=[];
  for(const raw of fs.readFileSync(path.join(directory,'framestats.txt'),'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(line==='---PROFILEDATA---'){active=!active;columns=[];continue;}
    if(!active)continue;
    if(line.startsWith('Flags,')){columns=line.split(',').filter(Boolean);continue;}
    if(!columns.length||!/^\-?\d+(,\-?\d+)+,$/.test(line))continue;
    const values=line.split(',').filter(Boolean);const row=Object.fromEntries(columns.map((key,index)=>[key,BigInt(values[index])]));
    if(row.Flags!==0n){flagged++;continue;}
    const duration=row.FrameCompleted-row.IntendedVsync;
    if(duration<0n||duration>BigInt(Number.MAX_SAFE_INTEGER)){invalid++;continue;}
    const durationMs=Number(duration)/1e6;
    // MuMu's FrameInterval/FrameStartTime columns disagree with their header.
    // Compare renderer completion with the independently observed 15Hz display.
    frames.push({durationMs,withinBudget:durationMs<=1000/15});
  }
  records.push({kind,cycleCount:summary.cycles.length,returnedToForm:summary.returnedToForm,before:summary.before,after:summary.after,network:summary.network,reactCommits:{count:commits.length,p95Ms:percentile(commits,.95),maxMs:commits.length?Math.max(...commits):null},rendererFrames:{count:frames.length,flaggedExcluded:flagged,invalidExcluded:invalid,p95Ms:percentile(frames.map(frame=>frame.durationMs),.95),maxMs:frames.length?Math.max(...frames.map(frame=>frame.durationMs)):null,measuredDisplayBudgetMs:1000/15,withinBudgetFraction:frames.length?frames.filter(frame=>frame.withinBudget).length/frames.length:null,over50Ms:frames.filter(frame=>frame.durationMs>50).length},nativeTraceFrameEvents:summary.frames.count});
}
const result={recordedAt:new Date().toISOString(),records,limitations:['Frame-statistics ring buffers cover surviving windows; dismissed modal windows are not retained here.','RN trace provides CPU/React events but zero BeginFrame/DrawFrame events despite requesting the installed Frame category.','UIAutomator state assertions and inspector add overhead; this is not a physical-device or exact motion timing pass.','No all-M03/M04/M05/M12 frame-budget or stall-attribution claim follows from these scoped observations.']};
fs.writeFileSync(path.join(base,'performance-comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
