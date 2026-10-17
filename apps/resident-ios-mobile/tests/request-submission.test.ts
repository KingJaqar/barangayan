import { ResidentSubmissionAttempt, serviceCatalogContractSchema, type Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogueRow } from '../src/features/services/catalog';
import { blankDraft, clearRequestDraft, loadRequestDraft, saveRequestDraft } from '../src/features/services/request-draft';
import {
  buildLegacySubmission, buildSubmission, catalogOf, choosePurpose, emptyFields, evidenceSlots, feeNote, pruneEvidence, reviewLines, validateLegacyNotes,
  validateSubmission, type Evidence, type FormFields,
} from '../src/features/services/request-form';
import { sendRequest, uploadEvidence, uploadLegacyId, type UploadState } from '../src/features/services/request-submit';
import { createProtectedDrafts } from '../src/lib/protected-drafts';
import { createSecureStorage, type KeyValueStore } from '../src/lib/secure-storage-core';
import { createStagedUploads, type BucketApi } from '../src/lib/staged-uploads';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENANT = '22222222-2222-4222-8222-222222222222';
const DOC = '11111111-1111-4111-8111-111111111111';
const UPLOAD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const KEY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const scope = { environment: 'staging' as const, barangayId: TENANT, userId: USER };

const charter = {
  officeDivision: 'Barangay Hall', classification: 'Simple', transactionType: 'G2C', whoMayAvail: 'Residents', checklistOfRequirements: 'Valid ID',
  whereToSecureRequirements: 'Hall', clientSteps: 'Submit', agencyActions: 'Review', feesToBePaid: '₱100.00', processingTime: '30 minutes', personResponsible: null,
};
const purposes = [{ code: 'employment', label: 'Employment', requiresExplanation: false }, { code: 'other', label: 'Other', requiresExplanation: true }];
const noRules = { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: false };
function catalog(kind: 'business' | 'indigency' | 'first_time_job_seeker' | 'certified_true_copy' | 'general', rules: Partial<typeof noRules> = {}) {
  return serviceCatalogContractSchema.parse({
    serviceKind: kind, charter, purposes, requirementRules: { ...noRules, ...rules },
    pricingMode: kind === 'business' ? 'assessment' : kind === 'certified_true_copy' ? 'per_page' : 'fixed', processingTargetMinutes: 60,
  });
}
const fields = (patch: Partial<FormFields> = {}): FormFields => ({ ...emptyFields(), purposeCode: 'employment', ...patch });
const file = (patch: Partial<Evidence[keyof Evidence] & object> = {}) => ({ uploadId: UPLOAD, name: 'proof.pdf', mimeType: 'application/pdf' as const, bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), uploaded: false, ...patch });

describe('form model per service kind (P08-T02/T03, A11)', () => {
  it('shows the right evidence slots, and only a renter sees the lessor slot', () => {
    expect(evidenceSlots(catalog('business', { dtiRequired: true }), { isRenter: false })).toEqual([{ code: 'dti', label: 'DTI registration', required: true }]);
    const residency = catalog('indigency', { hoaRequired: true, lessorForRenter: true });
    expect(evidenceSlots(residency, { isRenter: false }).map((slot) => slot.code)).toEqual(['hoa']);
    expect(evidenceSlots(residency, { isRenter: true }).map((slot) => [slot.code, slot.required])).toEqual([['hoa', true], ['lessor', true]]);
    expect(evidenceSlots(catalog('general'), { isRenter: false })).toEqual([]);
    expect(evidenceSlots(catalog('certified_true_copy'), { isRenter: false })).toEqual([]);
  });
  it('clears the lessor file when renter is switched off and drops evidence the service no longer asks for', () => {
    const residency = catalog('indigency', { hoaRequired: true, lessorForRenter: true });
    const evidence: Evidence = { hoa: file(), lessor: file({ uploadId: KEY }) };
    expect(Object.keys(pruneEvidence(residency, { isRenter: false }, evidence))).toEqual(['hoa']);
    expect(Object.keys(pruneEvidence(catalog('general'), { isRenter: true }, evidence))).toEqual([]);
  });
  it('clears the explanation when the purpose changes, but not when the same purpose is chosen again', () => {
    const typed = fields({ purposeCode: 'other', explanation: 'My reason' });
    expect(choosePurpose(typed, 'employment').explanation).toBe('');
    expect(choosePurpose(typed, 'other')).toBe(typed);
  });
  it('builds exactly the kind-specific payload and accepts a complete business request', () => {
    const business = catalog('business', { dtiRequired: true });
    const draft = buildSubmission(business, DOC, USER, fields({ businessName: ' Sari-Sari ', address: ' 1 Rizal St ' }), { dti: file() });
    expect(draft.details).toEqual({ businessName: 'Sari-Sari', establishmentAddress: '1 Rizal St' });
    expect(draft.attachments).toEqual([{ requirementCode: 'dti', path: `${USER}/${UPLOAD}/dti.pdf`, mimeType: 'application/pdf', sizeBytes: 5 }]);
    expect(validateSubmission(business, draft)).toEqual({});
  });
  it('reports each missing required answer or file for the service rules', () => {
    const business = catalog('business', { dtiRequired: true });
    expect(Object.keys(validateSubmission(business, buildSubmission(business, DOC, USER, fields(), {})))).toEqual(expect.arrayContaining(['businessName', 'establishmentAddress', 'dti']));
    const residency = catalog('first_time_job_seeker', { hoaRequired: true, lessorForRenter: true, personalAppearance: true });
    const errors = validateSubmission(residency, buildSubmission(residency, DOC, USER, fields({ isRenter: true }), {}));
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['hoa', 'lessor', 'personalAppearanceAcknowledged']));
    const complete = buildSubmission(residency, DOC, USER, fields({ isRenter: true, appearance: true }), { hoa: file(), lessor: file({ uploadId: KEY }) });
    expect(validateSubmission(residency, complete)).toEqual({});
  });
  it('requires an explanation only for a purpose that asks for one', () => {
    const general = catalog('general');
    expect(validateSubmission(general, buildSubmission(general, DOC, USER, fields({ purposeCode: 'other' }), {}))).toHaveProperty('purposeExplanation');
    expect(validateSubmission(general, buildSubmission(general, DOC, USER, fields({ purposeCode: 'other', explanation: 'Because' }), {}))).toEqual({});
    expect(validateSubmission(general, buildSubmission(general, DOC, USER, fields({ purposeCode: '' }), {}))).toHaveProperty('purposeCode');
  });
  it('validates certified copy counts, including non-numbers and out-of-range values', () => {
    const copy = catalog('certified_true_copy');
    const check = (patch: Partial<FormFields>) => validateSubmission(copy, buildSubmission(copy, DOC, USER, fields({ recordReference: 'Birth record', ...patch }), {}));
    expect(check({})).toEqual({});
    expect(check({ copies: '0' })).toHaveProperty('copies');
    expect(check({ copies: '1.5' })).toHaveProperty('copies');
    expect(check({ copies: 'abc' })).toHaveProperty('copies');
    expect(check({ copies: '1001' })).toHaveProperty('copies');
    expect(check({ totalPages: '' })).toHaveProperty('totalPages');
    expect(check({ recordReference: '  ' })).toHaveProperty('recordReference');
  });
  it('sends no incompatible fields for another service kind', () => {
    const general = catalog('general');
    const draft = buildSubmission(general, DOC, USER, fields({ businessName: 'x', isRenter: true, recordReference: 'x' }), { dti: file() });
    expect(draft.details).toEqual({});
    expect(draft.attachments).toEqual([]);
  });
  it('builds a legacy request that the version-1 server contract accepts', () => {
    const legacy = buildLegacySubmission(DOC, '  Employment  ', `${USER}/${UPLOAD}/id.jpg`);
    expect(legacy).toMatchObject({ documentTypeId: DOC, purposeCode: 'legacy', requesterNotes: 'Employment', details: {}, attachments: [] });
    expect(buildLegacySubmission(DOC, '   ').requesterNotes).toBeUndefined();
    expect(validateLegacyNotes('x'.repeat(1001))).toBeTruthy();
    expect(validateLegacyNotes('x'.repeat(1000))).toBeUndefined();
  });
  it('reads a charter contract only from a complete version-2 row', () => {
    const row = { id: DOC, name: 'Indigency', description: null, fee_centavos: 10000, processing_target_hours: 0, requirements: [], contract_version: 2, service_kind: 'indigency', charter, purposes, requirement_rules: noRules, pricing_mode: 'fixed', processing_target_minutes: 60 } satisfies CatalogueRow;
    expect(catalogOf(row)?.serviceKind).toBe('indigency');
    expect(catalogOf({ ...row, contract_version: 1 })).toBeNull();
    expect(catalogOf({ ...row, charter: null })).toBeNull();
  });
});

describe('fee basis and review summary (A11-004/024, P08-T05)', () => {
  it('explains the per-page estimate as informational and the business fee as confirmed by the barangay', () => {
    expect(feeNote(catalog('certified_true_copy'), '₱10.00 per page', { totalPages: '3' })).toContain('Estimate: ₱30.00');
    expect(feeNote(catalog('certified_true_copy'), '₱10.00 per page', { totalPages: 'x' })).toBe('₱10.00 per page across all copies.');
    expect(feeNote(catalog('business'), 'ignored', { totalPages: '1' })).toContain('The barangay confirms the amount');
    expect(feeNote(catalog('indigency'), '₱100.00', { totalPages: '1' })).toBe('₱100.00');
    expect(feeNote(null, '₱50.00', { totalPages: '1' })).toBe('₱50.00');
  });
  it('lists the exact values and files that will be sent', () => {
    const business = catalog('business', { dtiRequired: true, personalAppearance: true });
    const draft = buildSubmission(business, DOC, USER, fields({ businessName: 'Sari-Sari', address: '1 Rizal', appearance: true, notes: 'Hello' }), { dti: file() });
    expect(reviewLines(business, draft, { dti: 'proof.pdf' })).toEqual([
      ['Purpose', 'Employment'], ['Business name', 'Sari-Sari'], ['Establishment address', '1 Rizal'],
      ['Personal appearance', 'Understood: you must appear in person'], ['DTI registration', 'proof.pdf'], ['Additional notes', 'Hello'],
    ]);
    expect(reviewLines(null, buildLegacySubmission(DOC, 'Work', 'selected-photo'))).toEqual([['Purpose of request', 'Work'], ['ID photo', 'Attached']]);
  });
});

function keychain() {
  const entries = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async (key) => { entries.delete(key); },
  };
  return { entries, drafts: createProtectedDrafts(createSecureStorage(store, 'drafts')) };
}

describe('protected request drafts and unconfirmed attempts (P08-T05, F07)', () => {
  it('restores typed answers and the exact unconfirmed payload with its key for the same account only', async () => {
    const { drafts } = keychain();
    const attempt = { ...buildLegacySubmission(DOC, 'Work'), idempotencyKey: KEY };
    await saveRequestDraft(drafts, scope, DOC, { fields: fields({ notes: 'Work' }), attempt });
    expect((await loadRequestDraft(drafts, scope, DOC)).attempt).toEqual(attempt);
    expect((await loadRequestDraft(drafts, scope, DOC)).fields.notes).toBe('Work');
    expect(await loadRequestDraft(drafts, { ...scope, userId: OTHER }, DOC)).toEqual(blankDraft());
  });
  it('is blank after it is cleared and for a malformed stored value, never throwing a partial form', async () => {
    const { drafts, entries } = keychain();
    await saveRequestDraft(drafts, scope, DOC, { fields: fields(), attempt: null });
    await clearRequestDraft(drafts, scope, DOC);
    expect(await loadRequestDraft(drafts, scope, DOC)).toEqual(blankDraft());
    await drafts.save(scope, `service-request-${DOC}`, 1, { fields: { purposeCode: 4 }, attempt: 'x' });
    expect(await loadRequestDraft(drafts, scope, DOC)).toEqual(blankDraft());
    expect(entries.size).toBeGreaterThan(0);
  });
});

/** An in-memory private bucket that records uploads and can fail or lose replies. */
function bucket(options: { failFor?: string; loseReplyFor?: string } = {}) {
  const objects = new Map<string, Uint8Array>();
  const upload = vi.fn(async (path: string, body: Uint8Array, opts: { contentType: string; upsert: false }) => {
    void opts;
    if (path.includes(options.failFor ?? '\u0000')) return { error: { status: 400, message: 'rejected' } };
    if (objects.has(path)) return { error: { status: 409, message: 'exists' } };
    objects.set(path, body);
    return path.includes(options.loseReplyFor ?? '\u0000') ? { error: { message: 'Network request failed', name: 'StorageUnknownError' } } : { error: null };
  });
  const api: BucketApi = {
    upload,
    download: async (path) => { const stored = objects.get(path); return { data: stored ? { arrayBuffer: async () => stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength) as ArrayBuffer } : null, error: stored ? null : { message: 'missing' } }; },
    remove: async () => ({ error: null }),
    createSignedUrl: async () => ({ data: null, error: { message: 'unused' } }),
  };
  return { api, objects, upload };
}

describe('supporting uploads (P08-T04, F05/F06)', () => {
  it('uploads each file once to its immutable owned path, stages it first and does not resend uploaded files', async () => {
    const { drafts } = keychain();
    const staged = createStagedUploads(drafts);
    const { api, upload } = bucket();
    const states: [string, UploadState][] = [];
    const evidence: Evidence = { hoa: file() };
    const result = await uploadEvidence({ bucket: api, staged, scope }, evidence, (code, state) => states.push([code, state]));
    expect(result).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(`${USER}/${UPLOAD}/hoa.pdf`, expect.any(Uint8Array), { contentType: 'application/pdf', upsert: false });
    expect(states).toEqual([['hoa', 'waiting'], ['hoa', 'uploading'], ['hoa', 'uploaded']]);
    expect((await staged.pending(scope)).map((ref) => ref.path)).toEqual([`${USER}/${UPLOAD}/hoa.pdf`]);
    expect(evidence.hoa?.uploaded).toBe(true);
    await uploadEvidence({ bucket: api, staged, scope }, evidence, () => undefined);
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it('treats a lost upload reply as success only when the stored bytes are identical', async () => {
    const { drafts } = keychain();
    const { api } = bucket({ loseReplyFor: 'hoa' });
    const result = await uploadEvidence({ bucket: api, staged: createStagedUploads(drafts), scope }, { hoa: file() }, () => undefined);
    expect(result).toEqual({ ok: true });
  });
  it('reports a failed file, keeps it selected and stops before the request is sent', async () => {
    const { drafts } = keychain();
    const { api } = bucket({ failFor: 'lessor' });
    const evidence: Evidence = { hoa: file(), lessor: file({ uploadId: KEY }) };
    const states: Record<string, UploadState> = {};
    const result = await uploadEvidence({ bucket: api, staged: createStagedUploads(drafts), scope }, evidence, (code, state) => { states[code] = state; });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('still selected');
    expect(states).toEqual({ hoa: 'uploaded', lessor: 'failed' });
    expect(evidence.hoa?.uploaded).toBe(true);
    expect(evidence.lessor?.uploaded).toBe(false);
  });
  it('uploads the optional legacy ID photo to an owned folder of the ID bucket', async () => {
    const { drafts } = keychain();
    const { api, upload } = bucket();
    const jpeg = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), mimeType: 'image/jpeg' as const, extension: 'jpg' };
    const result = await uploadLegacyId({ bucket: api, staged: createStagedUploads(drafts), scope }, UPLOAD, jpeg);
    expect(result).toEqual({ ok: true, path: `${USER}/${UPLOAD}/id.jpg` });
    expect(upload).toHaveBeenCalledOnce();
  });
});

function submitHarness() {
  const rpc = vi.fn().mockResolvedValue({ data: 'c6000000-0000-4000-8000-000000000001', error: null });
  const single = vi.fn().mockResolvedValue({ data: { id: 'c6000000-0000-4000-8000-000000000001', reference_number: 'REQ-2026-0001' }, error: null });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  } as unknown as SupabaseClient<Database>;
  const { drafts } = keychain();
  const staged = createStagedUploads(drafts);
  const persisted: (unknown | null)[] = [];
  const persistAttempt = vi.fn(async (value: unknown | null) => { persisted.push(value); return true; });
  return { rpc, single, deps: { client, staged, scope, persistAttempt }, persistAttempt, persisted, staged };
}
const legacyDraft = buildLegacySubmission(DOC, 'Work');

describe('authoritative submission (P08-T06/T07, F03, T11)', () => {
  it('submits through submit_service_request only, persists the payload first and unstages linked files', async () => {
    const { rpc, deps, persisted, staged } = submitHarness();
    const business = catalog('business', { dtiRequired: true });
    const payload = buildSubmission(business, DOC, USER, fields({ businessName: 'Sari-Sari', address: '1 Rizal' }), { dti: file() });
    await staged.stage(scope, 'request-attachments', payload.attachments[0].path);
    const outcome = await sendRequest(deps, new ResidentSubmissionAttempt(KEY), payload);
    expect(outcome).toEqual({ kind: 'committed', id: 'c6000000-0000-4000-8000-000000000001', reference: 'REQ-2026-0001' });
    expect(rpc).toHaveBeenCalledWith('submit_service_request', { p_input: expect.objectContaining({ documentTypeId: DOC, idempotencyKey: KEY, attachments: payload.attachments }) });
    expect(persisted[0]).toMatchObject({ idempotencyKey: KEY, documentTypeId: DOC });
    expect(await staged.pending(scope)).toEqual([]);
  });
  it('keeps the same key and payload after a lost reply, then recovers the reference by retrying unchanged', async () => {
    const { rpc, deps } = submitHarness();
    const attempt = new ResidentSubmissionAttempt();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } });
    const first = await sendRequest(deps, attempt, legacyDraft);
    expect(first.kind).toBe('unknown');
    expect((await sendRequest(deps, attempt, legacyDraft)).kind).toBe('committed');
    expect(rpc.mock.calls[0][1].p_input.idempotencyKey).toBe(rpc.mock.calls[1][1].p_input.idempotencyKey);
  });
  it('refuses an edited payload after an uncertain reply instead of creating another request', async () => {
    const { rpc, deps } = submitHarness();
    const attempt = new ResidentSubmissionAttempt();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } });
    await sendRequest(deps, attempt, legacyDraft);
    const edited = await sendRequest(deps, attempt, { ...legacyDraft, requesterNotes: 'Changed' });
    expect(edited.kind).toBe('unknown');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('resumes a persisted attempt after process termination with the original key', async () => {
    const { rpc, deps } = submitHarness();
    const resumed = new ResidentSubmissionAttempt(KEY);
    expect((await sendRequest(deps, resumed, legacyDraft)).kind).toBe('committed');
    expect(rpc.mock.calls[0][1].p_input.idempotencyKey).toBe(KEY);
  });
  it('treats a definite refusal as correctable: nothing is kept for retry and the message is specific', async () => {
    const { rpc, deps, persisted } = submitHarness();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'current_approved_ID_required' } });
    const outcome = await sendRequest(deps, new ResidentSubmissionAttempt(KEY), legacyDraft);
    expect(outcome).toMatchObject({ kind: 'rejected', freshKey: false });
    expect(outcome.kind === 'rejected' ? outcome.message : '').toContain('approved');
    expect(persisted.at(-1)).toBeNull();
  });
  it('asks for a new key after an idempotency conflict and reports local validation without sending', async () => {
    const { rpc, deps } = submitHarness();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'idempotency_conflict' } });
    expect(await sendRequest(deps, new ResidentSubmissionAttempt(KEY), legacyDraft)).toMatchObject({ kind: 'rejected', freshKey: true });
    rpc.mockClear();
    const invalid = await sendRequest(deps, new ResidentSubmissionAttempt(KEY), { ...legacyDraft, documentTypeId: 'not-a-uuid' });
    expect(invalid.kind).toBe('rejected');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('warns when the unconfirmed attempt could not be kept on this device', async () => {
    const { rpc, deps, persistAttempt } = submitHarness();
    persistAttempt.mockResolvedValue(false);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } });
    const outcome = await sendRequest(deps, new ResidentSubmissionAttempt(KEY), legacyDraft);
    expect(outcome.kind === 'unknown' ? outcome.message : '').toContain('could not be kept on this device');
  });
  it('does not return another account’s request for a stale attempt', async () => {
    const { deps } = submitHarness();
    const attempt = new ResidentSubmissionAttempt(KEY);
    await sendRequest(deps, attempt, legacyDraft);
    const switched = { ...deps, client: { ...deps.client, auth: { getUser: async () => ({ data: { user: { id: OTHER } }, error: null }) } } as unknown as SupabaseClient<Database> };
    const outcome = await sendRequest(switched, attempt, legacyDraft);
    expect(outcome.kind).toBe('unknown');
  });
});
