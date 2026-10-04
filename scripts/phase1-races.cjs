/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const binary = path.join(root,'dist/phase1-tools/postgres/pgsql/bin/psql.exe');
const args = ['-X','-At','-h','127.0.0.1','-p','55431','-U','postgres','-d','phase1_existing','-v','ON_ERROR_STOP=1'];
const evidenceRun = process.argv[2] || 'database-final';
if (!/^[a-z0-9-]+$/.test(evidenceRun)) throw new Error('Invalid evidence directory');
const output = path.join(root,'plans/evidence/phase1',evidenceRun);
fs.mkdirSync(output,{recursive:true});
if (fs.existsSync(path.join(output,'race-fixture.log'))) throw new Error('Use a new evidence directory to preserve the previous race results');
const results = [];
const resident = 'b4000000-0000-0000-0000-000000000001';
const admin = 'b4000000-0000-0000-0000-000000000003';
const actor = id => `set local role authenticated; set local request.jwt.claim.sub='${id}';`;
const quote = text => "'" + text.replaceAll("'","''") + "'";
function run(sql) {
  const result = spawnSync(binary,args,{ input: sql,encoding:'utf8' });
  if (result.status !== 0 || /not ok/.test(result.stdout)) throw new Error(result.stderr + result.stdout.slice(-1500));
  return result.stdout;
}
function start(sql, marker) {
  const child = spawn(binary,args,{ stdio:['pipe','pipe','pipe'] });
  let stdout='',stderr='',resolveReady,rejectReady;
  const ready = new Promise((resolve,reject) => { resolveReady=resolve; rejectReady=reject; });
  const timer = setTimeout(() => child.kill(),30000);
  const finished = new Promise((resolve,reject) => {
    child.on('error',error => { clearTimeout(timer); if (marker) rejectReady(error); reject(error); });
    child.stdout.on('data',chunk => { stdout += chunk; if (marker && stdout.includes(marker)) resolveReady(); });
    child.stderr.on('data',chunk => { stderr += chunk; });
    child.on('exit',code => { clearTimeout(timer); if (marker && !stdout.includes(marker)) rejectReady(new Error(stderr || 'Process ended before lock marker')); resolve({ code,stdout,stderr }); });
  });
  child.stdin.end(sql);
  return { ready,finished };
}
const payload = key => ({ documentTypeId:'d4000000-0000-0000-0000-000000000001',idempotencyKey:key,purposeCode:'medical',details:{personalAppearanceAcknowledged:true},attachments:[] });
const submit = key => `select public.submit_service_request(${quote(JSON.stringify(payload(key)))}::jsonb);`;
const transition = (id,action,rest={}) => `select public.transition_service_request_sla(${quote(JSON.stringify({requestId:id,action,...rest}))}::jsonb);`;
(async () => {
  // The unchanged assertion suite provides synthetic fixtures; only its final rollback
  // is replaced with commit in this isolated database. Every assertion still runs.
  const fixture = fs.readFileSync(path.join(root,'supabase/tests/service_foundations.test.sql'),'utf8').replace(/rollback;\s*$/,'commit;');
  fs.writeFileSync(path.join(output,'race-fixture.log'),run('set search_path=public,extensions;\n'+fixture));
  run(`begin; update public.id_submissions set decision='pending',reviewed_by=null,reviewed_at=null,rejection_reason=null where id='c4000000-0000-0000-0000-000000000002'; ${actor(admin)} select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000002","decision":"verified"}'); commit;`);

  const key = 'e7000000-0000-0000-0000-000000000001';
  const first = start(`begin; ${actor(resident)} ${submit(key)} select 'submission_locked'; select pg_sleep(0.7); commit;`,'submission_locked');
  await first.ready;
  const second = start(`begin; ${actor(resident)} ${submit(key)} commit;`);
  const pair = await Promise.all([first.finished,second.finished]);
  assert.ok(pair.every(r=>r.code===0));
  const id = pair[0].stdout.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)[0];
  assert.ok(pair[1].stdout.includes(id));
  assert.equal(run(`select count(*) from public.service_requests where idempotency_key='${key}';`).trim(),'1');
  results.push({scenario:'Concurrent same-owner same-key submissions',passed:true,requestId:id,persistedRows:1});

  run(`begin; ${actor(admin)} ${transition(id,'accept',{requirementsComplete:true,personalAppearanceReady:true})} commit;`);
  const pause1 = start(`begin; ${actor(admin)} ${transition(id,'pause',{reason:'Resident clarification'})} select 'pause_locked'; select pg_sleep(0.7); commit;`,'pause_locked');
  await pause1.ready;
  const pause2 = start(`begin; ${actor(admin)} ${transition(id,'pause',{reason:'Second wait'})} commit;`);
  const pauses = await Promise.all([pause1.finished,pause2.finished]);
  assert.equal(pauses[0].code,0);
  assert.notEqual(pauses[1].code,0);
  assert.match(pauses[1].stderr,/invalid_SLA_transition/);
  assert.equal(run(`select count(*) from public.service_request_pauses where request_id='${id}' and resumed_at is null;`).trim(),'1');
  results.push({scenario:'Concurrent pauses',passed:true,persistedOpenPauses:1,rejectedError:'invalid_SLA_transition'});

  run(`begin; ${actor(admin)} select public.assess_service_request_fee('${JSON.stringify({requestId:id,state:'assessed',amountCentavos:5000,basis:'Confirmed fee'})}'); commit;`);
  const payment1 = start(`begin; ${actor(admin)} insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos) values('${id}','a4000000-0000-0000-0000-000000000001','pickup',5000,5000); select 'payment_locked'; select pg_sleep(0.7); commit;`,'payment_locked');
  await payment1.ready;
  const reassess = start(`begin; ${actor(admin)} select public.assess_service_request_fee('${JSON.stringify({requestId:id,state:'assessed',amountCentavos:6000,basis:'Attempted changed fee'})}'); commit;`);
  const financial = await Promise.all([payment1.finished,reassess.finished]);
  assert.equal(financial[0].code,0); assert.notEqual(financial[1].code,0);
  assert.match(financial[1].stderr,/assessment_locked_after_payment_begins/);
  assert.equal(run(`select assessed_amount_centavos from public.service_requests where id='${id}';`).trim(),'5000');
  results.push({scenario:'Payment reservation versus fee reassessment',passed:true,stableAmountCentavos:5000});

  const revoke = start(`begin; ${actor(admin)} select id from public.profiles where id='${resident}' for update; select 'review_locked'; select pg_sleep(0.7); select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000002","decision":"revoked","reason":"Approval withdrawn"}'); commit;`,'review_locked');
  await revoke.ready;
  const blockedKey='e7000000-0000-0000-0000-000000000002';
  const request = start(`begin; ${actor(resident)} ${submit(blockedKey)} commit;`);
  const review = await Promise.all([revoke.finished,request.finished]);
  assert.equal(review[0].code,0); assert.notEqual(review[1].code,0);
  assert.match(review[1].stderr,/current_approved_ID_required/);
  assert.equal(run(`select count(*) from public.service_requests where idempotency_key='${blockedKey}';`).trim(),'0');
  results.push({scenario:'Approval revocation versus concurrent submission',passed:true,rejectedError:'current_approved_ID_required',persistedRows:0});
  fs.writeFileSync(path.join(output,'races.json'),JSON.stringify({database:'127.0.0.1:55431/phase1_existing',finishedAt:new Date().toISOString(),results},null,2));
  console.log('PASS: four real multi-session concurrency cases');
})().catch(error=>{ console.error(error); process.exitCode=1; });
