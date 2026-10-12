import {sql} from './runtime.mjs';
import fs from 'node:fs';
const claims=JSON.stringify({sub:'21000000-0000-4000-8000-000000001505',role:'authenticated'});
const plans={};
for(const name of ['requests','transactions','applicants']) {
 const sort=name==='requests'?'reference':name==='transactions'?'created':'registered';
 plans[name]=JSON.parse(sql(`set role authenticated;set request.jwt.claims='${claims}';explain(analyze,buffers,format json) select row from public.admin_${name}_browse order by s_${sort} asc nulls last,id asc limit 100;`));
 console.log(name,plans[name][0]['Execution Time']);
}
fs.writeFileSync(new URL(`./plans-${process.argv[2]??'before'}.json`,import.meta.url),JSON.stringify(plans,null,2));
