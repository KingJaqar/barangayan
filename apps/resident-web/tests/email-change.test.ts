import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const fx = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), updateUser: vi.fn(), exchangeCodeForSession: vi.fn() },
  query: { select: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() },
  from: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: fx.auth, from: fx.from }) }));
import { requestResidentEmailChange } from '../src/lib/auth/email-change';
import { syncResidentSignInEmail } from '../src/app/(resident)/settings/email-verification/actions';
import { GET } from '../src/app/auth/email-change/route';

const user = { id: 'resident-a', email: 'current@example.test', new_email: '', is_anonymous: false };
const client = { auth: fx.auth } as unknown as SupabaseClient<Database>;
beforeEach(() => {
  vi.resetAllMocks();
  fx.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  fx.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
  fx.auth.exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });
  fx.from.mockReturnValue(fx.query);
  for (const method of ['select', 'update', 'eq', 'is'] as const) fx.query[method].mockReturnValue(fx.query);
  fx.query.single.mockResolvedValue({ data: { email: user.email, email_verification_status: 'verified' }, error: null });
});

describe('email change callback', () => {
  it('returns a first inbox confirmation with no PKCE code to settings', async () => {
    const response = await GET(new Request('https://resident.test/auth/email-change?message=Check+the+other+inbox'));
    expect(response.headers.get('location')).toBe('https://resident.test/settings/email-verification');
    expect(fx.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('exchanges a final confirmation code for the same account', async () => {
    const response = await GET(new Request('https://resident.test/auth/email-change?code=test-code'));
    expect(fx.auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(response.headers.get('location')).toBe('https://resident.test/settings/email-verification');
  });
  it.each(['?error=expired', '?code=a&code=b', '?code='])('rejects failed or malformed callbacks: %s', async query => {
    const response = await GET(new Request(`https://resident.test/auth/email-change${query}`));
    expect(response.headers.get('location')).toContain('emailChangeError=1');
    expect(fx.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('does not sync another account after a session switch', async () => {
    fx.auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { ...user, id: 'resident-b' } }, error: null });
    const response = await GET(new Request('https://resident.test/auth/email-change?code=test-code'));
    expect(response.headers.get('location')).toContain('emailChangeError=1');
    expect(fx.from).not.toHaveBeenCalled();
  });
  it('asks for sign-in when the original session is unavailable', async () => {
    fx.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(new Request('https://resident.test/auth/email-change?code=test-code'));
    expect(response.headers.get('location')).toBe('https://resident.test/login?next=%2Fsettings%2Femail-verification');
    expect(fx.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('request email change', () => {
  it.each(['invalid', ' Current@Example.test '])('rejects invalid or unchanged addresses before contacting Auth: %s', async address => {
    await expect(requestResidentEmailChange(client, user.id, user.email, address, 'https://resident.test')).rejects.toThrow();
    expect(fx.auth.updateUser).not.toHaveBeenCalled();
  });
  it.each([
    { ...user, id: 'resident-b' }, { ...user, email: 'changed@example.test' }, { ...user, is_anonymous: true }, null,
  ])('does not change a different or unavailable session', async current => {
    fx.auth.getUser.mockResolvedValue({ data: { user: current }, error: null });
    await expect(requestResidentEmailChange(client, user.id, user.email, 'new@example.test', 'https://resident.test')).rejects.toThrow('session changed');
    expect(fx.auth.updateUser).not.toHaveBeenCalled();
  });
  it('requests an Auth change with a normalized address and settings callback, without writing the profile', async () => {
    expect(await requestResidentEmailChange(client, user.id, user.email, ' NEW@EXAMPLE.TEST ', 'https://resident.test')).toBe('new@example.test');
    expect(fx.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.test' }, { emailRedirectTo: 'https://resident.test/auth/email-change' });
    expect(fx.from).not.toHaveBeenCalled();
  });
  it('reports rate limiting instead of claiming instructions were sent', async () => {
    fx.auth.updateUser.mockResolvedValue({ data: { user: null }, error: { status: 429 } });
    await expect(requestResidentEmailChange(client, user.id, user.email, 'new@example.test', 'https://resident.test')).rejects.toThrow('Please wait');
  });
});

describe('sync confirmed sign-in email', () => {
  it('retains the current profile address and badge while a new address is pending', async () => {
    fx.auth.getUser.mockResolvedValue({ data: { user: { ...user, new_email: 'pending@example.test' } }, error: null });
    expect(await syncResidentSignInEmail(user.id)).toMatchObject({ ok: true, email: user.email, pendingEmail: 'pending@example.test', status: 'verified' });
    expect(fx.query.update).not.toHaveBeenCalled();
  });
  it('copies only the confirmed Auth address and takes the reset status from the database', async () => {
    fx.auth.getUser.mockResolvedValue({ data: { user: { ...user, email: 'confirmed@example.test' } }, error: null });
    fx.query.single.mockResolvedValueOnce({ data: { email: user.email, email_verification_status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: { email_verification_status: 'unverified' }, error: null });
    expect(await syncResidentSignInEmail(user.id)).toMatchObject({ ok: true, email: 'confirmed@example.test', status: 'unverified' });
    expect(fx.query.update).toHaveBeenCalledWith({ email: 'confirmed@example.test' });
    expect(fx.query.eq).toHaveBeenCalledWith('id', user.id);
    expect(fx.query.eq).toHaveBeenCalledWith('role', 'resident');
    expect(fx.query.eq).toHaveBeenCalledWith('email', user.email);
    expect(fx.query.is).toHaveBeenCalledWith('deleted_at', null);
  });
  it('never writes for a stale owner', async () => {
    expect(await syncResidentSignInEmail('resident-b')).toMatchObject({ ok: false });
    expect(fx.from).not.toHaveBeenCalled();
  });
  it('does not claim success for a failed or concurrent profile update', async () => {
    fx.auth.getUser.mockResolvedValue({ data: { user: { ...user, email: 'confirmed@example.test' } }, error: null });
    fx.query.single.mockResolvedValueOnce({ data: { email: user.email, email_verification_status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    expect(await syncResidentSignInEmail(user.id)).toMatchObject({ ok: false });
  });
});
