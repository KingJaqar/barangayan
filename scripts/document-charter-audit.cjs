/* global __dirname */
// Synthetic local browser fixture and isolated database only; no hosted access.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'), {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'), output=path.join(root,'plans/evidence/document-charter');
const report={checkedAt:new Date().toISOString(),assertions:[]};
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);report.assertions.push(label);}
function sql(source){
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
const browser=JSON.parse(fs.readFileSync(path.join(output,'browser-values.json'),'utf8'));
const fields={Name:'Charter form verification',Description:'Synthetic complete charter service','Office/Division':'Records Office',Classification:'Complex','Type of Transaction':'G2B','Who May Avail':'Local applicants','Checklist of Requirements':'Valid ID\nApplication form','Where to Secure the Requirements':'Barangay front desk','Client Steps':'1. Submit application\n2. Collect document','Agency Actions':'Review application and issue document','Fees to Be Paid':'Published fee: ₱25.50','Processing Time':'Review: 10 minutes; release: 5 minutes','Person Responsible':'Records officer','Processing Target (minutes)':'25',Purpose:'Application'};
for(const [label,value] of Object.entries(fields)){
 equal(browser.created.find(f=>f.label===label)?.value,value,`Create/reload: ${label}`);
 equal(browser.updated.find(f=>f.label===label)?.value,label==='Name'?'Updated charter verification':label==='Processing Target (minutes)'?'35':'Updated '+value,`Edit/reload: ${label}`);
}
equal(browser.created.filter(f=>f.checked!==undefined).map(f=>f.checked),[true,false,false,false,true],'Created purpose explanation and appearance rules');
equal(browser.updated.filter(f=>f.checked!==undefined).map(f=>f.checked),[false,false,false,false,false],'Edited purpose explanation and appearance rules');
equal(browser.created.find(f=>f.label==='Pricing')?.value,'fixed','Created fixed pricing');
equal(browser.created.find(f=>f.label==='Confirmed fee (₱)')?.value,'25.5','Created confirmed charge');
equal(browser.updated.find(f=>f.label==='Pricing')?.value,'assessment','Edited assessment pricing');
equal(browser.validation,'Classification: Enter a value.','Validation identifies the field');
equal(browser.browserErrors,[],'No browser errors after CSS repair');
const row=JSON.parse(sql("select to_jsonb(d) from public.document_types d where name='Updated charter verification' and barangay_id='00000000-0000-0000-0000-000000000001'"));
equal(row.contract_version,2,'New document uses complete charter contract');
equal(row.fee_centavos,0,'Assessment stores no invented confirmed charge');
equal(row.processing_target_minutes,35,'Database stores the edited minute target');
equal(row.requirements,['Updated Valid ID','Application form'],'Legacy checklist mirror derives from charter input');
equal(row.pricing_mode,'assessment','Database stores edited pricing');
const resident=sql("select id from public.profiles where email like 'phase5-resident-%@test.local' and approved_id_submission_id=current_id_submission_id and id_verification_status='verified' and barangay_id='00000000-0000-0000-0000-000000000001' order by id limit 1");
assert.match(resident,/^[0-9a-f-]{36}$/);
const retryKey=randomUUID(),payload=JSON.stringify({documentTypeId:row.id,idempotencyKey:retryKey,purposeCode:row.purposes[0].code,details:{},attachments:[]});
const lines=sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${resident}'; select public.submit_service_request('${payload}'); select public.submit_service_request('${payload}'); select to_jsonb(r) from public.service_requests r where idempotency_key='${retryKey}'; rollback;`).split('\n');
const ids=lines.filter(line=>/^[0-9a-f-]{36}$/.test(line));
const request=JSON.parse(lines.find(line=>line.startsWith('{')));
equal(ids.length,2,'General service submits through the existing resident operation');
equal(ids[0],ids[1],'Resident retries remain idempotent');
equal(request.target_minutes_snapshot,35,'Resident request snapshots configured SLA target');
equal(request.pricing_mode_snapshot,'assessment','Resident request snapshots configured pricing');
equal(request.contract_version,2,'Resident consumer retains validated V2 journey');
report.passed=true;report.documentType=row;report.request=request;
fs.writeFileSync(path.join(output,'persistence-audit.json'),JSON.stringify(report,null,2));
console.log(`PASS: ${report.assertions.length} browser/database/resident compatibility assertions`);
