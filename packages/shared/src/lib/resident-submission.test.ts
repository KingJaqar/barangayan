import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database';
import { ResidentSubmissionAttempt, uploadSupportingEvidence } from './resident-submission';
import { idVerificationState } from './service-catalog';

const value = {
  documentTypeId: 'd6000000-0000-0000-0000-000000000001',
  purposeCode: 'legacy',
  details: {},
  attachments: [],
};
function fixture() {
  let owner = 'a6000000-0000-0000-0000-000000000001';
  const rpc = vi.fn().mockResolvedValue({ data: 'c6000000-0000-0000-0000-000000000001', error: null });
  const single = vi
    .fn()
    .mockResolvedValue({
      data: { id: 'c6000000-0000-0000-0000-000000000001', reference_number: 'REQ-TEST' },
      error: null,
    });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  } as unknown as SupabaseClient<Database>;
  return {
    client,
    rpc,
    single,
    account: (id: string) => {
      owner = id;
    },
  };
}
describe('resident submission recovery', () => {
  it('reuses the operation key after an unknown lost RPC reply', async () => {
    const { client, rpc } = fixture();
    const attempt = new ResidentSubmissionAttempt();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network interrupted' } });
    await expect(attempt.submit(client, value)).rejects.toMatchObject({ message: 'Network interrupted' });
    await attempt.submit(client, value);
    expect(rpc.mock.calls[0][1].p_input.idempotencyKey).toBe(rpc.mock.calls[1][1].p_input.idempotencyKey);
  });
  it('refuses changed payload after uncertain submission', async () => {
    const { client, rpc } = fixture();
    const attempt = new ResidentSubmissionAttempt();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Lost response' } });
    await expect(attempt.submit(client, value)).rejects.toBeTruthy();
    await expect(attempt.submit(client, { ...value, requesterNotes: 'changed' })).rejects.toThrow(
      'Retry unchanged',
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('recovers reference without resubmitting after a failed read', async () => {
    const { client, rpc, single } = fixture();
    const attempt = new ResidentSubmissionAttempt();
    single.mockResolvedValueOnce({ data: null, error: { message: 'Lost read' } });
    await expect(attempt.submit(client, value)).rejects.toThrow('may have succeeded');
    expect(await attempt.submit(client, value)).toMatchObject({ reference_number: 'REQ-TEST' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('permits correction after a definite validation denial', async () => {
    const { client, rpc } = fixture();
    const attempt = new ResidentSubmissionAttempt();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Invalid input' } });
    await expect(attempt.submit(client, value)).rejects.toBeTruthy();
    await attempt.submit(client, { ...value, requesterNotes: 'corrected' });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('never recovers another account’s request from an old attempt', async () => {
    const { client, rpc, account } = fixture();
    const attempt = new ResidentSubmissionAttempt();
    await attempt.submit(client, value);
    account('b6000000-0000-0000-0000-000000000001');
    await expect(attempt.submit(client, value)).rejects.toThrow('Account changed');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
describe('supporting upload retry integrity', () => {
  function storage(bytes: Uint8Array) {
    const upload = vi.fn().mockResolvedValue({ error: { message: 'Lost upload response' } });
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'a6000000-0000-0000-0000-000000000001' } } }) },
      storage: {
        from: () => ({
          upload,
          download: async () => ({ data: new Blob([new Uint8Array(bytes).buffer]), error: null }),
        }),
      },
    } as unknown as SupabaseClient<Database>;
    return { client, upload };
  }
  const input = {
    uploadId: 'b6000000-0000-0000-0000-000000000001',
    requirementCode: 'dti' as const,
    mimeType: 'application/pdf',
    bytes: new Uint8Array([1, 2, 3]),
  };
  it('recognizes identical immutable bytes after an interrupted upload', async () => {
    const { client, upload } = storage(input.bytes);
    const result = await uploadSupportingEvidence(client, input);
    expect(result.path).toContain('/dti.pdf');
    expect(upload.mock.calls[0][2].upsert).toBe(false);
  });
  it('rejects a conflicting existing object', async () => {
    const { client } = storage(new Uint8Array([1, 2, 4]));
    await expect(uploadSupportingEvidence(client, input)).rejects.toMatchObject({
      message: 'Lost upload response',
    });
  });
  it('rejects unsupported MIME and oversized bytes before storage', async () => {
    const { client, upload } = storage(input.bytes);
    await expect(uploadSupportingEvidence(client, { ...input, mimeType: 'text/html' })).rejects.toBeTruthy();
    await expect(
      uploadSupportingEvidence(client, { ...input, bytes: new Uint8Array(5 * 1024 * 1024 + 1) }),
    ).rejects.toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
  });
});
describe('four verification states', () => {
  const profile = {
    id_verification_status: 'verified',
    current_id_submission_id: 'same',
    approved_id_submission_id: 'same',
    id_repair_required: false,
  } as Tables<'profiles'>;
  it('requires current immutable approval', () => {
    expect(idVerificationState(profile)).toBe('verified');
    expect(idVerificationState({ ...profile, current_id_submission_id: 'replacement' })).toBe('missing');
    expect(idVerificationState({ ...profile, id_repair_required: true })).toBe('failed');
  });
  it('distinguishes missing, pending and failed', () => {
    expect(idVerificationState(null)).toBe('missing');
    expect(idVerificationState({ ...profile, id_verification_status: 'pending' })).toBe('pending');
    expect(idVerificationState({ ...profile, id_verification_status: 'verification_failed' })).toBe('failed');
  });
});
