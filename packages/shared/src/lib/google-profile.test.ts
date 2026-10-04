import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { ensureGoogleResidentProfile, GoogleResidentProfileError, residentProfileComplete } from './resident-auth';

const google: Pick<User, 'app_metadata' | 'identities'> = { app_metadata: { providers: ['google'] } };
function clientWith(fetcher: typeof fetch) {
  return createClient<Database>('https://synthetic.test.invalid', 'test-only-public-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },
  });
}
afterEach(() => vi.useRealTimers());

describe('Google minimal-profile transport and recovery', () => {
  it('sends no caller-controlled user, tenant, name or role payload', async () => {
    const request = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe('https://synthetic.test.invalid/rest/v1/rpc/ensure_google_resident_profile');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe('{}');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify('b6040000-0000-0000-0000-000000000001'));
    });
    await ensureGoogleResidentProfile(clientWith(request), google);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('keeps non-Google password/invitation paths unchanged', async () => {
    const request = vi.fn<typeof fetch>();
    await ensureGoogleResidentProfile(clientWith(request), { app_metadata: { providers: ['email'] } });
    expect(request).not.toHaveBeenCalled();
  });
  it('recognizes a linked Auth identity even when the provider list is stale', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify('user-id')));
    const user = { app_metadata: { providers: ['email'] }, identities: [
      { id: 'identity', user_id: 'user-id', identity_id: 'identity', provider: 'google' },
    ] } satisfies Pick<User, 'app_metadata' | 'identities'>;
    await ensureGoogleResidentProfile(clientWith(request), user);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('surfaces a rejected save rather than reporting account setup succeeded', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ code: '22023', message: 'registration_locality_not_configured' }), { status: 400 }));
    await expect(ensureGoogleResidentProfile(clientWith(request), google)).rejects.toThrow('Unable to save your resident account');
  });
  it('retains a safe database error code for recovery without exposing raw provider details', async () => {
    const request: typeof fetch = async () => new Response(JSON.stringify({ code: 'PGRST202', message: 'Private raw database response' }), { status: 404 });
    await expect(ensureGoogleResidentProfile(clientWith(request), google)).rejects.toMatchObject({ name: 'GoogleResidentProfileError', code: 'PGRST202' });
    expect(new GoogleResidentProfileError('PGRST202').message).not.toContain('Private raw database response');
  });
  it('rejects a successful response without a saved profile identifier', async () => {
    await expect(ensureGoogleResidentProfile(clientWith(async () => new Response('null')), google)).rejects.toThrow('Unable to save');
  });
  it('allows a retry after an earlier failed save', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'temporary error' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify('user-id')));
    const client = clientWith(request);
    await expect(ensureGoogleResidentProfile(client, google)).rejects.toThrow('Unable to save');
    await expect(ensureGoogleResidentProfile(client, google)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('aborts a stalled save and clears its timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const request: typeof fetch = async (_url, init) => {
      signal = init?.signal;
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    };
    const result = expect(ensureGoogleResidentProfile(clientWith(request), google)).rejects.toThrow('Unable to save');
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not treat a minimal row as a completed resident profile', () => {
    type Profile = Database['public']['Tables']['profiles']['Row'];
    const profile = { id: 'user-id', role: 'resident', deleted_at: null, first_name: 'Juan', last_name: 'Santos',
      house_no: null, street: null, sex: null, employment_status: null, mobile_number: null, birth_date: null } as Profile;
    expect(residentProfileComplete(profile)).toBe(false);
  });
});
