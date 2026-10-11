import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const commands=[
  ['fixtures', ['--test','--test-timeout=30000',path.join(import.meta.dirname,'verify.mjs')], root,30000],
  ['admin-typecheck', [path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--incremental','false'],path.join(root,'apps/admin-web'),60000],
  ['admin-lint', [path.join(root,'node_modules/eslint/bin/eslint.js'),'.'],path.join(root,'apps/admin-web'),60000],
];
const results=[];
for (const [name,args,cwd,timeout] of commands) {
  const start=Date.now(); const result=spawnSync(process.execPath,args,{cwd,timeout,encoding:'utf8',windowsHide:true});
  fs.writeFileSync(path.join(import.meta.dirname,name+'.log'),(result.stdout??'')+(result.stderr??''));
  results.push({name,status:result.status,error:result.error?.code,elapsedMs:Date.now()-start,timeoutMs:timeout});
  console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(path.join(import.meta.dirname,'check-results.json'),JSON.stringify(results,null,2)+'\n');
if (results.some((r)=>r.status!==0)) process.exitCode=1;
