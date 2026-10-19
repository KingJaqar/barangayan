import { createClient, type User } from '@supabase/supabase-js';
import type { Database, ResidentAccountSetupStatus } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadAccountSetupStatus } from './account-setup-status';
import { accountSettingsRows, deletionConfirmation, passwordMode } from './sensitive-auth';

const user = { id: 'synthetic-user', app_metadata: {}, identities: [] } as unknown as User;
const completeProfile = {
  id: user.id, role: 'admin', deleted_at: null, first_name: 'Juan', last_name: 'Santos',
  house_no: '12', street: 'Main Street', sex: 'male', employment_status: 'employed',
  mobile_number: '09123456789', birth_date: '1990-01-01',
};
const residentStatus: ResidentAccountSetupStatus = {
  registrationOrigin: 'legacy', profileComplete: true, passwordSet: true, hasGoogleIdentity: false,
};
function fixture(profile: object | null, options: { profileError?: boolean; statusError?: boolean; status?: ResidentAccountSetupStatus } = {}) {
  const request = vi.fn<typeof fetch>(async url => {
    if (String(url).includes('/profiles?')) {
      if (options.profileError) return Response.json({ code: 'PGRST000' }, { status: 400 });
      return Response.json(profile);
    }
    if (String(url).endsWith('/rpc/ensure_google_resident_profile')) return Response.json(user.id);
    if (options.statusError) return Response.json({ code: '55000' }, { status: 400 });
    return Response.json(options.status ?? residentStatus);
  });
  const client = createClient<Database>('https://synthetic.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: request },
  });
  return { client, request };
}
const load = (client: ReturnType<typeof fixture>['client'], account = user) =>
  loadAccountSetupStatus(client, account, new AbortController().signal);

describe('Settings account status loading', () => {
  it('settles admin Settings rows and opens Manage Password without resident-only RPCs', async () => {
    const { client, request } = fixture(completeProfile);
    const result = await load(client);
    expect(result.actor).toBe('staff');
    const setup = { state: 'ready', status: result.status } as const;
    expect(accountSettingsRows(setup)).toMatchObject({
      profile: { subtitle: 'Edit Profile', warning: false },
      password: { title: 'Manage Password', warning: false },
    });
    expect(passwordMode(setup)).toBe('manage');
    expect(deletionConfirmation(setup)).toBe('password');
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toContain('id=eq.synthetic-user');
  });

  it('uses saved admin details for the profile warning and keeps Google-linked staff in Manage Password', async () => {
    const { client, request } = fixture({ ...completeProfile, street: null });
    const result = await load(client, { ...user, identities: [{ provider: 'google' }] } as User);
    const setup = { state: 'ready', status: result.status } as const;
    expect(result.status.hasGoogleIdentity).toBe(true);
    expect(accountSettingsRows(setup).profile).toMatchObject({ subtitle: 'Personal details incomplete', warning: true });
    expect(passwordMode(setup)).toBe('manage');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([true, false, null])('preserves the server password state %s for residents', async passwordSet => {
    const status = { ...residentStatus, passwordSet };
    const { client, request } = fixture({ ...completeProfile, role: 'resident' }, { status });
    await expect(load(client)).resolves.toEqual({ actor: 'resident', status });
    expect(String(request.mock.calls[1][0])).toMatch(/\/rpc\/get_resident_account_setup_status$/);
  });

  it('still provisions a missing Google resident profile before reading the status', async () => {
    const { client, request } = fixture(null);
    await expect(load(client, { ...user, app_metadata: { providers: ['google'] } })).resolves.toEqual({ actor: 'resident', status: residentStatus });
    expect(request.mock.calls.map(call => String(call[0]).split('/rpc/')[1]).slice(1)).toEqual([
      'ensure_google_resident_profile', 'get_resident_account_setup_status',
    ]);
  });

  it('rejects deleted accounts before admitting staff or reading credentials', async () => {
    const { client, request } = fixture({ ...completeProfile, deleted_at: '2026-10-19' });
    await expect(load(client)).rejects.toMatchObject({ code: '42501' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not invent a ready status when the profile or resident status cannot be read', async () => {
    await expect(load(fixture(completeProfile, { profileError: true }).client)).rejects.toMatchObject({ code: 'PGRST000' });
    await expect(load(fixture({ ...completeProfile, role: 'resident' }, { statusError: true }).client))
      .rejects.toMatchObject({ failure: { kind: 'state_unavailable' } });
  });
});
