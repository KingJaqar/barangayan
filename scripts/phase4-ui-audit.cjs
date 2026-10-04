/* global __dirname */
// Read-only audit of the eight synthetic browser/emulator acceptance journeys.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..');
const result = spawnSync('wsl.exe', ['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'], {encoding:'utf8'});
assert.equal(result.status, 0);
const config = JSON.parse(result.stdout);
assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const fixtures = JSON.parse(fs.readFileSync(path.join(root,'dist/phase4-tools/ui-users.json')));
const client = createClient(config.API_URL, config.ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const journeys = [
 ['web','business','4c92aa99-0337-4b49-8347-e65571ee3fe9',12500],
 ['web','indigency','ebb5efea-d86d-4a15-bb00-4d6bbd2f54e9',10000],
 ['web','first_time_job_seeker','f8882737-6b2b-4cc9-846d-987554ccd2a8',0],
 ['web','certified_true_copy','1e3d98a8-ffee-4846-9320-281cc64ff01b',4000],
 ['android','business','131b0e41-8e14-4139-9f84-60de8f83df37',12500],
 ['android','indigency','5f34a903-f827-41fe-bb5b-1897f8919c1a',10000],
 ['android','first_time_job_seeker','43c66c35-745d-46be-9c3a-64259e3d2771',0],
 ['android','certified_true_copy','1dd1ebc5-aed8-4398-aa24-634d4363efaa',4000],
];
async function ok(operation){const r=await operation; assert.ifError(r.error); return r.data;}
async function main(){
 await ok(client.auth.signInWithPassword(fixtures.resident));
 const profile=await ok(client.from('profiles').select('*').eq('id',fixtures.resident.id).single());
 const output={passed:false,checkedAt:new Date().toISOString(),journeys:[],assertions:[]};
 for(const [platform,kind,id,amount] of journeys){
  const row=await ok(client.from('service_requests').select('*,document_types(service_kind),payments(*)').eq('id',id).single());
  assert.equal(row.resident_id,fixtures.resident.id); assert.equal(row.document_types.service_kind,kind);
  assert.equal(row.status,'completed'); assert.equal(row.assessed_amount_centavos,amount);
  assert.equal(row.approved_id_submission_id,'fd806049-9834-4c1f-94c6-a6856068baa5');
  assert.notEqual(row.approved_id_submission_id,profile.current_id_submission_id);
  assert.equal(row.id_document_path,null);
  if(amount){const paid=row.payments.filter(p=>p.status==='paid');assert.equal(paid.length,1);assert.equal(paid[0].amount_centavos,amount);assert.equal(paid[0].document_fee_centavos,amount);assert.equal(row.payment_status,'paid');}
  else{assert.equal(row.fee_assessment_state,'waived');assert.equal(row.payments.length,0);}
  if(kind==='certified_true_copy'){assert.equal(row.supporting_details.copies,3);assert.equal(row.billable_pages,4);}
  if(row.purpose_code==='others'){assert.ok(row.purpose_explanation);assert.equal(row.purpose_explanation,row.purpose_explanation.trim());}
  const attachments=await ok(client.from('request_attachments').select('*').eq('request_id',id));
  for(const file of attachments){const blob=await ok(client.storage.from('request-attachments').download(file.object_path));assert.ok(blob.size>0&&blob.size<=5*1024*1024);}
  output.journeys.push({platform,kind,requestId:id,status:row.status,amountCentavos:amount,feeState:row.fee_assessment_state,paymentStatus:row.payment_status,approvedIdVersion:row.approved_id_submission_id,purpose:row.purpose_code,purposeExplanation:row.purpose_explanation,notes:row.requester_notes,details:row.supporting_details,attachments:attachments.map(a=>({requirement:a.requirement_code,mime:a.mime_type,size:a.size_bytes}))});
 }
 const old=await ok(client.from('id_submissions').select('*').eq('id','fd806049-9834-4c1f-94c6-a6856068baa5').single());
 assert.equal(old.decision,'verified');
 output.assertions.push('All eight actual UI journeys completed with exactly one paid ledger or a recorded waiver','CTC copies=3 and confirmed total pages=4 produce ₱40 on both platforms','Historical requests retain approved version 1 after version 3 publication/approval','Request submission reuses approved evidence without another ID upload','Every attached private object remains readable by its owner and below 5 MB');
 output.passed=true;
 const target=path.join(root,'plans/evidence/phase4',`ui-audit-${Date.now()}.json`);fs.writeFileSync(target,JSON.stringify(output,null,2));console.log(JSON.stringify({passed:true,journeys:journeys.length,evidence:path.relative(root,target)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
