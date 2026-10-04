/* global __dirname, Buffer */
// Real HTTP integration checks against the isolated local WSL Supabase stack.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'plans/evidence/phase1/completion-http');
fs.mkdirSync(output, { recursive: true });
const run = { startedAt: new Date().toISOString(), passed: false, transport: 'real local HTTP', checks: [] };
const status = spawnSync('wsl.exe', ['--distribution', 'barangayan-phase1', '--user', 'root',
  '--cd', '/mnt/c/Users/User/barangayan', '--exec', '/opt/barangayan-tools/supabase', 'status', '--output', 'json'],
{ cwd: root, encoding: 'utf8', timeout: 30000 });
assert.equal(status.status, 0, 'Local stack status must succeed');
const config = JSON.parse(status.stdout);
assert.equal(config.API_URL, 'http://127.0.0.1:54321', 'Only this loopback test stack is allowed');
const client = key => createClient(config.API_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const admin = client(config.SERVICE_ROLE_KEY);
const anon = client(config.ANON_KEY);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
const users = {};
const pilot = '00000000-0000-0000-0000-000000000001';
const foreignTenant = randomUUID();
const doc = randomUUID();
const legacyDoc = randomUUID();
const idVersion = randomUUID();
let request;
let input;
let attachment;
let foreignFile;
let current;
function prove(condition, message) {
  assert.ok(condition, message);
  current.assertions.push(message);
}
function cleanError(error) {
  return String(error?.message || error).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[REDACTED]');
}
function save() {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(run, null, 2) + '\n');
}
async function ok(promise, label) {
  const result = await promise;
  assert.ifError(result.error && new Error(`${label}: ${cleanError(result.error)}`));
  prove(!result.error, label);
  return result.data;
}
async function denied(promise, label, codes) {
  const result = await promise;
  prove(Boolean(result.error), label);
  if (codes) prove(codes.includes(result.error.code), `${label}: expected authorization/validation error`);
  else {
    const errorStatus = Number(result.error.statusCode ?? result.error.status);
    prove(errorStatus >= 400 && errorStatus < 500, `${label}: client denial, not network/server failure`);
  }
}
async function group(name, action) {
  current = { name, passed: false, assertions: [] };
  run.checks.push(current);
  try { await action(); current.passed = true; }
  catch (error) { current.error = cleanError(error); throw error; }
  finally { save(); console.log(`${current.passed ? 'PASS' : 'FAIL'} ${name}: ${current.assertions.length} assertions`); }
}
const rpc = (user, name, payload) => user.client.rpc(name, { p_input: payload });
const front = user => `${user.id}/versions/${idVersion}/id-front.png`;
const back = user => `${user.id}/versions/${idVersion}/id-back.png`;
async function makeUser(label, tenant, role) {
  const email = `phase1-${label}-${randomUUID()}@test.local`;
  const password = `Phase1-${randomUUID()}!`;
  const data = await ok(admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { full_name: `HTTP ${label}`, role: 'admin' } }), `${label} Auth identity created without registration metadata`);
  const value = { id: data.user.id, email, password, client: client(config.ANON_KEY) };
  users[label] = value;
  if (tenant) await ok(admin.from('profiles').insert({ id: value.id, barangay_id: tenant, role, full_name: `HTTP ${label}` }), `${label} trusted test profile provisioned`);
  await ok(value.client.auth.signInWithPassword({ email, password }), `${label} real password session established`);
  return value;
}
const profileInput = { firstName: 'Ana', lastName: 'Reyes', houseNo: '12', street: 'Main Street',
  sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-02-29' };
async function signedDownload(actor, bucket, objectPath, bytes, label) {
  const data = await ok(actor.storage.from(bucket).createSignedUrl(objectPath, 60), `${label} signed URL authorized`);
  const response = await fetch(data.signedUrl);
  prove(response.ok, `${label} private object fetched through signed URL`);
  prove(Buffer.from(await response.arrayBuffer()).equals(bytes), `${label} downloaded bytes match upload`);
}
async function listOwned(bucket, owner) {
  const files = [];
  async function walk(prefix) {
    for (let offset = 0; ; offset += 100) {
      const data = await ok(admin.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }), `${bucket} owner tree listed`);
      for (const item of data) {
        const child = `${prefix}/${item.name}`;
        if (item.id === null) await walk(child); else files.push(child);
      }
      if (data.length < 100) break;
    }
  }
  await walk(owner);
  return files;
}
async function main() {
  await group('Auth session and profile completion', async () => {
    await ok(admin.from('barangays').insert({ id: foreignTenant, name: `HTTP foreign ${foreignTenant}` }), 'Second tenant exists only in local fixtures');
    await makeUser('resident', null, null);
    await makeUser('neighbor', pilot, 'resident');
    await makeUser('foreign', foreignTenant, 'resident');
    await makeUser('administrator', pilot, 'admin');
    await makeUser('foreignAdmin', foreignTenant, 'admin');
    const user = users.resident;
    await denied(rpc(user, 'complete_resident_profile', { ...profileInput, role: 'admin' }), 'Profile completion rejects caller authority', ['22023']);
    await denied(rpc(user, 'complete_resident_profile', { ...profileInput, city: 'Forged city' }), 'Profile completion rejects forged locality', ['22023']);
    prove(await ok(rpc(user, 'complete_resident_profile', profileInput), 'Authenticated metadata-free user completes profile') === user.id, 'Profile identity comes from session');
    prove(await ok(rpc(user, 'complete_resident_profile', profileInput), 'Profile completion retry succeeds') === user.id, 'Profile completion retry returns same identity');
    const profile = await ok(user.client.from('profiles').select('id,role,barangay_id,city,province').eq('id', user.id).single(), 'Resident can read completed profile');
    prove(profile.role === 'resident' && profile.barangay_id === pilot, 'Editable metadata cannot assign administrator or foreign tenant');
    prove(profile.city === 'San Mateo' && profile.province === 'Rizal', 'Configured locality is applied by server');
    await denied(user.client.from('profiles').update({ role: 'admin' }).eq('id', user.id), 'Raw privilege escalation fails', ['42501']);
  });
  await group('ID upload, publication and review', async () => {
    const user = users.resident;
    for (const objectPath of [front(user), back(user)]) await ok(user.client.storage.from('id-documents').upload(objectPath, png, { contentType: 'image/png' }), 'Resident uploads immutable ID evidence');
    const payload = { submissionId: idVersion, idType: 'Passport', frontPath: front(user), backPath: back(user) };
    prove(await ok(rpc(user, 'publish_id_submission', payload), 'Real uploaded ID version published') === idVersion, 'Publication returns supplied immutable version');
    prove(await ok(rpc(user, 'publish_id_submission', payload), 'Publication retry succeeds') === idVersion, 'Retry preserves one version');
    await denied(rpc(user, 'review_id_submission', { submissionId: idVersion, decision: 'verified' }), 'Resident approval denied', ['42501']);
    await denied(rpc(users.foreignAdmin, 'review_id_submission', { submissionId: idVersion, decision: 'verified' }), 'Foreign administrator approval denied', ['42501']);
    await ok(rpc(users.administrator, 'review_id_submission', { submissionId: idVersion, decision: 'verified' }), 'Same-tenant administrator approves reviewed evidence');
    await denied(rpc(users.administrator, 'review_id_submission', { submissionId: idVersion, decision: 'verified' }), 'Repeated review denied', ['22023']);
    await denied(user.client.storage.from('id-documents').update(front(user), png, { contentType: 'image/png' }), 'Owner cannot overwrite versioned ID object');
    const removed = await user.client.storage.from('id-documents').remove([front(user)]);
    prove(Boolean(removed.error) || removed.data?.length === 0, 'ID delete is denied or filtered without removing objects');
    await signedDownload(user.client, 'id-documents', front(user), png, 'Immutable ID remains present after delete attempt');
    await signedDownload(users.administrator.client, 'id-documents', back(user), png, 'Reviewing administrator');
    const legacyPath = `${user.id}/legacy-id.png`;
    await ok(user.client.storage.from('id-documents').upload(legacyPath, png, { contentType: 'image/png', upsert: true }), 'Legacy ID path upload remains supported');
    await ok(user.client.storage.from('id-documents').upload(legacyPath, png, { contentType: 'image/png', upsert: true }), 'Legacy ID path upsert remains supported');
  });
  await group('Attachment upload and signed URL', async () => {
    attachment = `${users.resident.id}/${randomUUID()}/lessor.pdf`;
    foreignFile = `${users.foreign.id}/${randomUUID()}/foreign.pdf`;
    await ok(users.resident.client.storage.from('request-attachments').upload(attachment, pdf, { contentType: 'application/pdf' }), 'Owner uploads private PDF');
    await ok(users.foreign.client.storage.from('request-attachments').upload(foreignFile, pdf, { contentType: 'application/pdf' }), 'Other tenant uploads own private PDF');
    await signedDownload(users.resident.client, 'request-attachments', attachment, pdf, 'Attachment owner');
    await denied(users.administrator.client.storage.from('request-attachments').createSignedUrl(attachment, 60), 'Administrator cannot access unassociated upload');
    await denied(users.foreign.client.storage.from('request-attachments').upload(`${users.resident.id}/${randomUUID()}/forged.pdf`, pdf, { contentType: 'application/pdf' }), 'Upload under another account denied');
    await denied(users.resident.client.storage.from('request-attachments').upload(`${users.resident.id}/${randomUUID()}/bad.txt`, Buffer.from('bad'), { contentType: 'text/plain' }), 'Unsupported attachment type denied');
    await denied(users.resident.client.storage.from('request-attachments').upload(`${users.resident.id}/${randomUUID()}/large.pdf`, Buffer.alloc(5242881), { contentType: 'application/pdf' }), 'Over-5-MB attachment denied');
  });
  await group('Submission retry and direct bypass', async () => {
    const charter = { officeDivision: 'Office', classification: 'Simple', transactionType: 'G2C', whoMayAvail: 'Residents',
      checklistOfRequirements: 'Requirements', whereToSecureRequirements: 'Office', clientSteps: 'Grouped steps',
      agencyActions: 'Grouped actions', feesToBePaid: 'Assessment', processingTime: '15 minutes', personResponsible: null };
    await ok(admin.from('document_types').insert({ id: doc, barangay_id: pilot, name: `HTTP service ${doc}`, contract_version: 2,
      service_kind: 'indigency', charter, purposes: [{ code: 'medical', label: 'Medical assistance', requiresExplanation: false },
        { code: 'others', label: 'Others', requiresExplanation: true }],
      requirement_rules: { dtiRequired: false, hoaRequired: false, lessorForRenter: true, personalAppearance: true }, pricing_mode: 'assessment', processing_target_minutes: 15 }), 'Opt-in catalog fixture configured');
    input = { documentTypeId: doc, idempotencyKey: randomUUID(), purposeCode: 'medical',
      details: { isRenter: true, personalAppearanceAcknowledged: true },
      attachments: [{ requirementCode: 'lessor', path: attachment, mimeType: 'application/pdf', sizeBytes: pdf.length }] };
    await denied(rpc(users.resident, 'submit_service_request', { ...input, residentId: users.foreign.id }), 'Forged submission identity denied', ['22023']);
    await denied(rpc(users.resident, 'submit_service_request', { ...input, attachments: [] }), 'Missing renter requirement denied', ['22023']);
    await denied(rpc(users.resident, 'submit_service_request', { ...input, purposeCode: 'others', purposeExplanation: '  ' }), 'Whitespace Others explanation denied', ['22023']);
    await denied(rpc(users.resident, 'submit_service_request', { ...input, attachments: [{ ...input.attachments[0], path: foreignFile }] }), 'Foreign object association denied', ['22023']);
    const submitted = await Promise.all([ok(rpc(users.resident, 'submit_service_request', input), 'Concurrent submission A'), ok(rpc(users.resident, 'submit_service_request', input), 'Concurrent submission B')]);
    request = submitted[0];
    prove(submitted[1] === request, 'Concurrent same-key retries return one request');
    await denied(rpc(users.resident, 'submit_service_request', { ...input, requesterNotes: 'changed' }), 'Changed payload with same key conflicts', ['22023']);
    await denied(users.resident.client.from('service_requests').insert({ barangay_id: pilot, resident_id: users.resident.id, document_type_id: doc }), 'Raw insert cannot downgrade opt-in contract', ['42501']);
    const rows = await ok(users.resident.client.from('service_requests').select('id,contract_version,fee_assessment_state,approved_id_submission_id,timing_model').eq('idempotency_key', input.idempotencyKey), 'Owner reads submitted request');
    prove(rows.length === 1 && rows[0].contract_version === 2 && rows[0].fee_assessment_state === 'pending', 'Exactly one pending-assessment request persisted');
    prove(rows[0].approved_id_submission_id === idVersion && rows[0].timing_model === 'agency_minutes_v1', 'Evidence and timing model frozen on request');
    await signedDownload(users.administrator.client, 'request-attachments', attachment, pdf, 'Associated same-tenant administrator');
  });
  await group('Cross-tenant and anonymous denial', async () => {
    for (const actor of [users.neighbor.client, users.foreign.client, users.foreignAdmin.client]) {
      prove((await ok(actor.from('service_requests').select('id').eq('id', request), 'Other-account request query permitted but filtered')).length === 0, 'Other-account request hidden');
      prove((await ok(actor.from('id_submissions').select('id').eq('id', idVersion), 'Other-account evidence query permitted but filtered')).length === 0, 'Other-account evidence hidden');
      await denied(actor.storage.from('request-attachments').createSignedUrl(attachment, 60), 'Other-account signed attachment URL denied');
      await denied(actor.storage.from('id-documents').createSignedUrl(front(users.resident), 60), 'Other-account signed ID URL denied');
    }
    await denied(anon.rpc('submit_service_request', { p_input: input }), 'Anonymous submission denied', ['42501']);
    await denied(anon.from('id_submissions').select('id'), 'Anonymous ID read denied', ['42501']);
    await denied(anon.storage.from('request-attachments').createSignedUrl(attachment, 60), 'Anonymous attachment access denied');
    await denied(rpc(users.foreignAdmin, 'assess_service_request_fee', { requestId: request, state: 'waived', amountCentavos: 0, basis: 'Forged waiver' }), 'Cross-tenant fee assessment denied', ['42501']);
    await ok(rpc(users.administrator, 'review_id_submission', { submissionId: idVersion, decision: 'revoked', reason: 'Evidence no longer valid' }), 'Administrator revokes current approval');
    prove(await ok(rpc(users.resident, 'submit_service_request', input), 'Original submission retry after revocation') === request, 'Revocation preserves prior idempotent outcome');
    await denied(rpc(users.resident, 'submit_service_request', { ...input, idempotencyKey: randomUUID() }), 'Revoked approval blocks a new request', ['42501']);
    const replacement = randomUUID();
    const prefix = `${users.resident.id}/versions/${replacement}`;
    for (const name of ['id-front.png', 'id-back.png']) await ok(users.resident.client.storage.from('id-documents').upload(`${prefix}/${name}`, png, { contentType: 'image/png' }), 'Replacement evidence uploaded under a new version');
    await ok(rpc(users.resident, 'publish_id_submission', { submissionId: replacement, idType: 'Passport', frontPath: `${prefix}/id-front.png`, backPath: `${prefix}/id-back.png` }), 'Replacement ID version published');
    const profile = await ok(users.resident.client.from('profiles').select('approved_id_submission_id,id_verification_status').eq('id', users.resident.id).single(), 'Replacement verification read');
    prove(profile.approved_id_submission_id === null && profile.id_verification_status === 'pending', 'Replacement cannot retain approval');
  });
  await group('Assessment and SLA operations', async () => {
    const assessor = users.administrator;
    await denied(rpc(users.resident, 'assess_service_request_fee', { requestId: request, state: 'waived', amountCentavos: 0, basis: 'Forged waiver' }), 'Resident fee assessment denied', ['42501']);
    await ok(rpc(assessor, 'assess_service_request_fee', { requestId: request, state: 'waived', amountCentavos: 0, basis: 'Confirmed exemption' }), 'Administrator confirms waiver');
    await denied(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'accept', requirementsComplete: true }), 'Acceptance requires appearance readiness', ['22023']);
    await ok(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'accept', requirementsComplete: true, personalAppearanceReady: true }), 'Formal acceptance starts server clock');
    await denied(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'pause' }), 'Undocumented pause denied', ['22023']);
    const pauses = await Promise.all([rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'pause', reason: 'Resident awaiting original' }), rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'pause', reason: 'Resident awaiting original' })]);
    prove(pauses.filter(value => !value.error).length === 1 && pauses.filter(value => value.error?.code === '22023').length === 1, 'Concurrent pause produces one success and one invalid transition');
    await ok(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'resume' }), 'Resident wait resumes');
    await denied(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'resume' }), 'Repeated resume denied', ['22023']);
    await ok(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'ready' }), 'Readiness stops processing clock');
    await ok(rpc(assessor, 'transition_service_request_sla', { requestId: request, action: 'release' }), 'Waiver permits release');
    const row = await ok(users.resident.client.from('service_requests').select('status,sla_state,accepted_at,ready_at,released_at').eq('id', request).single(), 'Resident reads released request');
    prove(row.status === 'completed' && row.sla_state === 'released', 'Existing completion status preserved');
    prove(row.accepted_at && Date.parse(row.ready_at) >= Date.parse(row.accepted_at) && Date.parse(row.released_at) >= Date.parse(row.ready_at), 'Server timestamps are ordered');
  });
  await group('Legacy administrator joins', async () => {
    await ok(admin.from('document_types').insert({ id: legacyDoc, barangay_id: pilot, name: `HTTP legacy ${legacyDoc}` }), 'Legacy catalog fixture created with original fields');
    const legacy = await ok(users.resident.client.from('service_requests').insert({ barangay_id: pilot, resident_id: users.resident.id, document_type_id: legacyDoc, requester_notes: 'Legacy notes' }).select('id').single(), 'Legacy resident direct submission remains supported');
    const row = await ok(users.administrator.client.from('service_requests').select('id,contract_version,timing_model,requester_notes,profiles!service_requests_resident_id_fkey(full_name)').eq('id', legacy.id).single(), 'Administrator resident relationship resolves through real PostgREST');
    prove(row.contract_version === 1 && row.timing_model === 'legacy_hours' && row.requester_notes === 'Legacy notes', 'Legacy values and original timing retained');
    prove(row.profiles.full_name === 'Ana Reyes', 'Explicit administrator join returns resident, not assessor');
  });
  await group('Account deletion nested media cleanup', async () => {
    const user = users.resident;
    const orphan = `${user.id}/${randomUUID()}/orphan.pdf`;
    await ok(user.client.storage.from('request-attachments').upload(orphan, pdf, { contentType: 'application/pdf' }), 'Unassociated supporting object uploaded');
    await ok(user.client.storage.from('profile-photos').upload(`${user.id}/avatar.png`, png, { contentType: 'image/png' }), 'Avatar uploaded');
    const before = await ok(admin.from('service_requests').select('id,approved_id_submission_id').eq('resident_id', user.id).order('id'), 'Request history recorded before deletion');
    const data = await ok(user.client.functions.invoke('delete-my-account'), 'Real account deletion Edge Function succeeds');
    prove(data.success === true, 'Function confirms deletion');
    for (const bucket of ['profile-photos', 'id-documents', 'request-attachments']) prove((await listOwned(bucket, user.id)).length === 0, `${bucket} owner objects, including nested versions and orphans, removed`);
    await signedDownload(users.foreign.client, 'request-attachments', foreignFile, pdf, 'Foreign object retained after another account deletion');
    const after = await ok(admin.from('service_requests').select('id,approved_id_submission_id').eq('resident_id', user.id).order('id'), 'Historical requests retained after anonymization');
    prove(JSON.stringify(before) === JSON.stringify(after), 'Deletion preserves request identities and approved evidence references');
    const profile = await ok(admin.from('profiles').select('deleted_at').eq('id', user.id).single(), 'Anonymized profile retained');
    prove(Boolean(profile.deleted_at), 'Profile is marked deleted');
    await denied(client(config.ANON_KEY).auth.signInWithPassword({ email: user.email, password: user.password }), 'Deleted account cannot sign in');
    await denied(rpc(user, 'complete_resident_profile', profileInput), 'Previously issued session cannot restore deleted profile', ['42501']);
  });
  run.passed = run.checks.length === 8 && run.checks.every(check => check.passed);
}
main().catch(error => { run.error = cleanError(error); process.exitCode = 1; })
  .finally(() => {
    run.finishedAt = new Date().toISOString();
    run.assertions = run.checks.reduce((total, check) => total + check.assertions.length, 0);
    // Fixtures remain only in the disposable local stack for inspection, never hosted data.
    run.fixtureTenant = foreignTenant;
    save();
    fs.writeFileSync(path.join(output, `results-${Date.now()}.json`), JSON.stringify(run, null, 2) + '\n');
    console.log(`HTTP integration: ${run.passed ? 'PASS' : 'FAIL'}; ${run.assertions} assertions`);
  });
