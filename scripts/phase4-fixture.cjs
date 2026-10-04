/* global __dirname, Buffer */
// Staff/test-account actions for the isolated local UI acceptance journeys only.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'),
  { randomUUID } = require('node:crypto'),
  { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..'),
  mode = process.argv[2];
const status = spawnSync(
  'wsl.exe',
  [
    '--distribution',
    'barangayan-phase1',
    '--user',
    'root',
    '--cd',
    '/mnt/c/Users/User/barangayan',
    '--exec',
    '/opt/barangayan-tools/supabase',
    'status',
    '--output',
    'json',
  ],
  { encoding: 'utf8' },
);
assert.equal(status.status, 0);
const config = JSON.parse(status.stdout);
assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'dist/phase4-tools/ui-users.json')));
const make = (key) =>
  createClient(config.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const resident = make(config.ANON_KEY),
  admin = make(config.ANON_KEY);
async function ok(operation) {
  const result = await operation;
  assert.ifError(result.error);
  return result.data;
}
async function main() {
  await ok(resident.auth.signInWithPassword(fixtures.resident));
  await ok(admin.auth.signInWithPassword(fixtures.admin));
  if (mode === 'missing') {
    const trusted = make(config.SERVICE_ROLE_KEY);
    const email = `phase4-missing-${randomUUID()}@test.local`,
      password = 'PhaseLocalOnly!2026';
    const auth = await ok(trusted.auth.admin.createUser({ email, password, email_confirm: true }));
    const id = auth.user.id;
    await ok(
      trusted
        .from('profiles')
        .insert({
          id,
          barangay_id: '00000000-0000-0000-0000-000000000001',
          role: 'resident',
          full_name: 'Different Resident',
          first_name: 'Different',
          last_name: 'Resident',
          email,
          mobile_number: '09179876543',
          house_no: '99',
          street: 'Other Street',
          sex: 'male',
          employment_status: 'student',
          birth_date: '2000-01-01',
        }),
    );
    fixtures.missing = { id, email, password };
    fs.writeFileSync(path.join(root, 'dist/phase4-tools/ui-users.json'), JSON.stringify(fixtures, null, 2));
    console.log('Created isolated second resident without ID evidence.');
    return;
  }
  if (mode === 'profile') {
    await ok(
      resident.rpc('complete_resident_profile', {
        p_input: {
          firstName: 'Phase',
          lastName: 'Four',
          houseNo: '12',
          street: 'Main Street',
          sex: 'female',
          employmentStatus: 'student',
          mobileNumber: '09171234567',
          birthDate: '2000-01-01',
        },
      }),
    );
    console.log('Synthetic resident completed the actual profile operation.');
    return;
  }
  if (mode === 'latest') {
    const rows = await ok(
      resident
        .from('service_requests')
        .select('*, document_types(service_kind)')
        .eq('resident_id', fixtures.resident.id)
        .order('created_at', { ascending: false })
        .limit(20),
    );
    console.log(
      JSON.stringify(rows.filter((row) => row.document_types.service_kind === process.argv[3]).slice(0, 1)),
    );
    return;
  }
  if (['assess', 'collect'].includes(mode)) {
    const id = process.argv[3];
    assert.match(id ?? '', /^[a-f0-9-]{36}$/);
    const row = await ok(
      admin
        .from('service_requests')
        .select('*, document_types(service_kind)')
        .eq('id', id)
        .eq('resident_id', fixtures.resident.id)
        .single(),
    );
    if (mode === 'assess') {
      const kind = row.document_types.service_kind;
      await ok(
        admin.rpc('review_service_request', {
          p_input: {
            requestId: id,
            requirementsComplete: true,
            eligibility: 'eligible',
            note: 'Synthetic local acceptance review: requirements and eligibility confirmed',
            personalAppearancePresent: true,
          },
        }),
      );
      await ok(
        admin.rpc('assess_service_request_fee', {
          p_input: {
            requestId: id,
            state: kind === 'first_time_job_seeker' ? 'waived' : 'assessed',
            amountCentavos:
              kind === 'first_time_job_seeker'
                ? 0
                : kind === 'certified_true_copy'
                  ? 4000
                  : kind === 'business'
                    ? 12500
                    : 10000,
            basis:
              kind === 'first_time_job_seeker'
                ? 'Confirmed eligible first-time job-seeker exemption'
                : 'Confirmed applicable fee in local test',
            ...(kind === 'certified_true_copy' ? { billablePages: 4 } : {}),
          },
        }),
      );
      await ok(
        admin.rpc('transition_service_request_sla', {
          p_input: {
            requestId: id,
            action: 'accept',
            requirementsComplete: true,
            personalAppearanceReady: true,
          },
        }),
      );
      await ok(admin.rpc('transition_service_request_sla', { p_input: { requestId: id, action: 'ready' } }));
    } else {
      if (row.fee_assessment_state !== 'waived' && row.assessed_amount_centavos > 0)
        await ok(admin.rpc('collect_pickup_payment', { p_request_id: id }));
      await ok(
        admin.rpc('transition_service_request_sla', { p_input: { requestId: id, action: 'release' } }),
      );
    }
    console.log(JSON.stringify({ mode, requestId: id, passed: true }));
    return;
  }
  if (['replace', 'approve', 'reject', 'revoke'].includes(mode)) {
    const profile = await ok(resident.from('profiles').select('*').eq('id', fixtures.resident.id).single());
    if (mode === 'replace') {
      const version = randomUUID(),
        png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=',
          'base64',
        );
      const frontPath = `${profile.id}/versions/${version}/id-front.png`,
        backPath = `${profile.id}/versions/${version}/id-back.png`;
      for (const target of [frontPath, backPath])
        await ok(
          resident.storage
            .from('id-documents')
            .upload(target, png, { contentType: 'image/png', upsert: false }),
        );
      await ok(
        resident.rpc('publish_id_submission', {
          p_input: { submissionId: version, idType: 'Passport', frontPath, backPath },
        }),
      );
    } else
      await ok(
        admin.rpc('review_id_submission', {
          p_input: {
            submissionId: profile.current_id_submission_id,
            decision: mode === 'approve' ? 'verified' : mode === 'revoke' ? 'revoked' : 'verification_failed',
            ...(mode !== 'approve' ? { reason: 'Synthetic acceptance test: clearer evidence required' } : {}),
          },
        }),
      );
    console.log('Synthetic ID review state changed through the real operation.');
    return;
  }
  if (mode === 'catalog') {
    const rows = await ok(resident.from('document_types').select('*').eq('is_active', true));
    fs.writeFileSync(path.join(root, 'dist/phase4-tools/catalog.json'), JSON.stringify(rows, null, 2));
    console.log(rows.map((row) => ({ id: row.id, kind: row.service_kind, name: row.name })));
    return;
  }
  throw new Error('Unsupported isolated fixture operation');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
