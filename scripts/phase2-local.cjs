/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const name = process.argv[2];
const commands = {
  reset:['db','reset','--local','--yes'], test:['test','db','--local'],
  advisors:['db','advisors','--local','--fail-on','error','--output-format','json'],
  stop:['stop'],
};
if (!Object.hasOwn(commands,name)) throw new Error('Only the isolated local stack checks are permitted');
const output = path.join(root,'plans/evidence/phase2/local');
fs.mkdirSync(output,{recursive:true});
const startedAt=new Date().toISOString();
const response=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase',...commands[name]],
 {cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,timeout:1800000});
const log=(response.stdout+response.stderr).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[LOCAL TOKEN REDACTED]')
 .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[LOCAL KEY REDACTED]').replace(/^.*(?:Access Key|Secret Key|JWT Secret|PASSWORD).*$/gmi,'[LOCAL CREDENTIAL LINE REDACTED]')
 .replace(/postgresql:\/\/[^\s]+/g,'[LOCAL DATABASE URL REDACTED]');
const stamp=Date.now();
fs.writeFileSync(path.join(output,`${name}-${stamp}.log`),log);
const result={startedAt,finishedAt:new Date().toISOString(),exitCode:response.status,passed:response.status===0&&!/not ok|Looks like you failed/.test(log),log:`${name}-${stamp}.log`};
fs.writeFileSync(path.join(output,`${name}-${stamp}.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(!result.passed) process.exitCode=1;
