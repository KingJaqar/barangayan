// Compare bytes against the original baseline; never resets or restores files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const plan='plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md';
const allowed=(file)=>file===plan || file.startsWith('plans/evidence/admin-table-phase0/');
const baseline=JSON.parse(fs.readFileSync(new URL('./baseline-hashes.json',import.meta.url),'utf8'));
const changed=[];
for(const item of baseline) {
  if(allowed(item.path)) continue;
  const target=path.join(root,item.path);
  if(!fs.existsSync(target)) changed.push({path:item.path,status:'missing'});
  else if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex').toUpperCase()!==item.sha256) changed.push({path:item.path,status:'changed since baseline'});
}
const result=spawnSync('git',['status','--porcelain=v1'],{cwd:root,encoding:'utf8',timeout:15000,windowsHide:true});
if(result.status!==0) throw new Error(result.stderr || result.error?.message);
const report={baselineFilesChecked:baseline.filter((x)=>!allowed(x.path)).length,outsideScopeByteChanges:changed,gitStatus:result.stdout.split('\n').filter(Boolean),note:'Byte comparison verifies preservation of existing files, including pre-existing Android edits. It does not attribute concurrent external changes. No files are reset.'};
fs.writeFileSync(new URL('./scope-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baselineFilesChecked:report.baselineFilesChecked,outsideScopeByteChanges:changed},null,2));
if(changed.length) process.exitCode=1;
