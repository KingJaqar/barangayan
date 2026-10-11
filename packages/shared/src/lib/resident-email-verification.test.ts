import { describe, it, expect, vi } from 'vitest';
import { emailVerificationHandler, EmailVerificationError, type EmailVerificationDependencies } from '../../../../supabase/functions/verify-resident-email/handler';

const identity = { id: 'owned', email: 'owned@example.com' };
function setup(overrides: Partial<EmailVerificationDependencies> = {}) {
  const deps = {
    caller: vi.fn(async () => identity),
    profile: vi.fn(async () => ({ email: identity.email, status: 'unverified' })),
    send: vi.fn(async () => {}), verify: vi.fn(async () => identity), record: vi.fn(async () => true),
    ...overrides,
  };
  const handler = emailVerificationHandler(deps);
  const request = (body: unknown, auth = true) => handler(new Request('http://localhost/verify', {
    method: 'POST', headers: auth ? { Authorization: 'Bearer dedicated-test-session' } : {}, body: JSON.stringify(body),
  }));
  return { deps, request };
}
describe('caller-bound resident email verification', () => {
  it('requires a real caller before sending', async () => {
    const { request, deps } = setup();
    expect((await request({ action: 'send' }, false)).status).toBe(401);
    expect(deps.send).not.toHaveBeenCalled();
    const absent = setup({ caller: async () => null });
    expect((await absent.request({ action: 'send' })).status).toBe(401);
    expect(absent.deps.record).not.toHaveBeenCalled();
  });
  it.each([{ action: 'send', email: 'other@example.com' }, { action: 'verify', userId: 'other', code: '123456' }, { action: 'verify', code: '12345' }, { action: 'verify', code: 123456 }])('rejects identity overrides and malformed codes: %j', async body => {
    const { request, deps } = setup();
    expect((await request(body)).status).toBe(400);
    expect(deps.send).not.toHaveBeenCalled(); expect(deps.verify).not.toHaveBeenCalled();
  });
  it('does not send to an unsaved or mismatched profile address', async () => {
    const { request, deps } = setup({ profile: async () => ({ email: 'other@example.com', status: 'unverified' }) });
    expect((await request({ action: 'send' })).status).toBe(409);
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('rejects nonresident/deleted profiles before sends or verification', async () => {
    const { request, deps } = setup({ profile: async () => null });
    expect((await request({ action: 'verify', code: '012345' })).status).toBe(403);
    expect(deps.verify).not.toHaveBeenCalled();
  });
  it('records pending only after a successful real sender operation', async () => {
    const { request, deps } = setup();
    expect(await (await request({ action: 'send' })).json()).toEqual({ status: 'pending' });
    expect(deps.send).toHaveBeenCalledWith(identity.email);
    expect(deps.record).toHaveBeenCalledWith(identity, identity.email, false);
    const failing = setup({ send: async () => { throw new EmailVerificationError(429, 'Please wait.'); } });
    expect((await failing.request({ action: 'send' })).status).toBe(429);
    expect(failing.deps.record).not.toHaveBeenCalled();
  });
  it.each([null, { id: 'other', email: identity.email }, { id: identity.id, email: 'other@example.com' }])('rejects wrong OTP identity and makes no badge write: %j', async result => {
    const { request, deps } = setup({ verify: async () => result });
    expect((await request({ action: 'verify', code: '012345' })).status).toBe(400);
    expect(deps.record).not.toHaveBeenCalled();
  });
  it('preserves leading zeroes and returns no credentials on success', async () => {
    const { request, deps } = setup();
    expect(await (await request({ action: 'verify', code: '012345' })).json()).toEqual({ status: 'verified' });
    expect(deps.verify).toHaveBeenCalledWith(identity.email, '012345');
    expect(deps.record).toHaveBeenCalledWith(identity, identity.email, true);
  });
  it('refuses a concurrent address/deletion/role change after OTP success', async () => {
    const { request } = setup({ record: async () => false });
    expect((await request({ action: 'verify', code: '012345' })).status).toBe(409);
  });
  it('makes confirmed-status retries idempotent without another email/session', async () => {
    const { request, deps } = setup({ profile: async () => ({ email: identity.email, status: 'verified' }) });
    expect(await (await request({ action: 'send' })).json()).toEqual({ status: 'verified' });
    expect(deps.send).not.toHaveBeenCalled(); expect(deps.record).not.toHaveBeenCalled();
  });
  it('does not expose provider errors or call unknown actions', async () => {
    const { request } = setup({ verify: async () => { throw Error('private provider diagnostic'); } });
    const response = await request({ action: 'verify', code: '012345' });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private provider');
  });
});
