import { afterEach, describe, expect, it } from 'vitest';
import { AccountRequestScope, publishIdEvidence } from './id-evidence';
import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

describe('front-only publication', () => {
  afterEach(() => vi.unstubAllGlobals());

  function nativeFixture(savedBytes?: number[]) {
    const userId = 'b1180000-0000-4000-8000-000000000001';
    const submissionId = 'c1180000-0000-4000-8000-000000000001';
    const source = `${userId}/versions/c1180000-0000-4000-8000-000000000002/id-front.jpg`;
    // React Native Blob has no arrayBuffer() instance method. Its FileReader
    // provides readAsArrayBuffer through the native reader module instead.
    const nativeBlob = (bytes: number[]) => ({ size: bytes.length, bytes });
    class NativeReader {
      result: ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      readAsArrayBuffer(blob: { bytes: number[] }) {
        this.result = new Uint8Array(blob.bytes).buffer;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('FileReader', NativeReader);
    const bucket = {
      download: vi.fn(async (path: string) => ({ data: nativeBlob(path === source ? [255, 216, 255] : savedBytes ?? [255, 216, 255]), error: null })),
      upload: vi.fn(async () => ({ error: savedBytes ? new Error('Already uploaded') : null })),
    };
    const rpc = vi.fn(async () => ({ data: submissionId, error: null }));
    const client = { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, storage: { from: () => bucket }, rpc } as unknown as SupabaseClient<Database>;
    const input = { submissionId, idType: 'PhilSys', frontPath: source, confirmedDetails: { fullName: 'Ana Reyes', idNumber: '', birthDate: '', address: '' } };
    return { client, input, bucket, rpc };
  }

  it('submits downloaded Android Blobs without an arrayBuffer method', async () => {
    const { client, input, bucket, rpc } = nativeFixture();
    await publishIdEvidence(client, input);
    expect(bucket.upload).toHaveBeenCalledWith(expect.stringContaining('/id-front.jpg'), new Uint8Array([255, 216, 255]), { upsert: false, contentType: 'image/jpeg' });
    expect(rpc).toHaveBeenCalledOnce();
  });
  it('accepts an identical Android upload after a lost response', async () => {
    const { client, input, rpc } = nativeFixture([255, 216, 255]);
    await publishIdEvidence(client, input);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it('rejects different existing bytes on an Android retry', async () => {
    const { client, input, rpc } = nativeFixture([255, 216, 0]);
    await expect(publishIdEvidence(client, input)).rejects.toThrow('Already uploaded');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('publishes a front photo and reviewed corrections without reading a back photo', async () => {
    const userId = 'b1180000-0000-4000-8000-000000000001';
    const submissionId = 'c1180000-0000-4000-8000-000000000001';
    const frontPath = `${userId}/versions/${submissionId}/id-front.jpg`;
    const bucket = { download: vi.fn(), upload: vi.fn() };
    const rpc = vi.fn(async () => ({ data: submissionId, error: null }));
    const client = { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, storage: { from: () => bucket }, rpc } as unknown as SupabaseClient<Database>;
    const confirmedDetails = { fullName: 'Corrected Name', idNumber: '123', birthDate: '', address: '' };
    await publishIdEvidence(client, { submissionId, idType: 'PhilSys', frontPath, confirmedDetails });
    expect(bucket.download).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('publish_id_submission', { p_input: { submissionId, idType: 'PhilSys', frontPath, confirmedDetails, backPath: undefined } });
  });
});

describe('account reply isolation', () => {
  it('rejects an earlier account response and foreign cached rows', () => {
    const scope = new AccountRequestScope();
    const a = scope.begin('A');
    const b = scope.begin('B');
    expect(scope.accepts(a, 'A')).toBe(false);
    expect(scope.accepts(b, 'A')).toBe(false);
    expect(scope.accepts(b, 'B')).toBe(true);
  });
  it('rejects pending responses after logout or a newer refresh', () => {
    const scope = new AccountRequestScope();
    const first = scope.begin('A');
    const next = scope.begin('A');
    expect(scope.accepts(first, 'A')).toBe(false);
    expect(scope.accepts(next, 'A')).toBe(true);
    scope.clear();
    expect(scope.accepts(next, 'A')).toBe(false);
    const relogin = scope.begin('A');
    expect(scope.accepts(next, 'A')).toBe(false);
    expect(scope.accepts(relogin, 'A')).toBe(true);
  });
});
