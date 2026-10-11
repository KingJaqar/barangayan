import { afterEach, describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { residentEmailVerification } from './resident-email-verification';
function fixture(ids = ['owner', 'owner'], response = { data: { status: 'pending' } as unknown, error: null as unknown }) {
  const getUser = vi.fn().mockImplementation(async () => ({ data: { user: { id: ids.shift() } }, error: null }));
  const invoke = vi.fn(async () => response);
  return { client: { auth: { getUser }, functions: { invoke } } as unknown as SupabaseClient<Database>, getUser, invoke };
}
describe('Settings email verification client ownership', () => {
  afterEach(() => vi.useRealTimers());
  it('sends no client-selected identity and preserves leading zeros', async () => {
    const { client, invoke } = fixture();
    await expect(residentEmailVerification(client, 'owner', 'verify', '012345')).resolves.toBe('pending');
    expect(invoke).toHaveBeenCalledWith('verify-resident-email', { body: { action: 'verify', code: '012345' }, timeout: 30000 });
  });
  it('does not invoke for the wrong caller or malformed code', async () => {
    const { client, invoke } = fixture(['other']);
    await expect(residentEmailVerification(client, 'owner', 'send')).rejects.toThrow('session changed');
    await expect(residentEmailVerification(client, 'owner', 'verify', '12')).rejects.toThrow('six-digit');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('rejects a late success after switching accounts', async () => {
    const { client } = fixture(['owner', 'other'], { data: { status: 'verified' }, error: null });
    await expect(residentEmailVerification(client, 'owner', 'verify', '012345')).rejects.toThrow('session changed');
  });
  it('never accepts a missing server result as verification', async () => {
    const { client } = fixture(undefined, { data: {}, error: null });
    await expect(residentEmailVerification(client, 'owner', 'send')).rejects.toThrow('confirm verification status');
  });
  it('reports throttling without exposing raw provider data', async () => {
    const { client } = fixture(undefined, { data: null, error: new FunctionsHttpError(new Response('private-provider-detail', { status: 429 })) });
    await expect(residentEmailVerification(client, 'owner', 'send')).rejects.toThrow('Please wait');
  });
  it('ends a stalled initial session check without sending, including after its late response', async () => {
    vi.useFakeTimers();
    const { client, getUser, invoke } = fixture();
    let finish!: (value: unknown) => void;
    getUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const result = residentEmailVerification(client, 'owner', 'send').catch(error => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toEqual(expect.objectContaining({ message: expect.stringContaining('Check your connection') }));
    finish({ data: { user: { id: 'owner' } }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('does not report verification when the final ownership check stalls or responds late', async () => {
    vi.useFakeTimers();
    const { client, getUser } = fixture(undefined, { data: { status: 'verified' }, error: null });
    let finish!: (value: unknown) => void;
    getUser.mockImplementationOnce(async () => ({ data: { user: { id: 'owner' } }, error: null }))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const result = residentEmailVerification(client, 'owner', 'verify', '012345').catch(error => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toEqual(expect.objectContaining({ message: expect.stringContaining('Check your connection') }));
    finish({ data: { user: { id: 'owner' } }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toBeInstanceOf(Error);
  });
});
