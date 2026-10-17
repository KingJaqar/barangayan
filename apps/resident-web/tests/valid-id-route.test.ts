import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ValidIdPage from '../src/app/(resident)/settings/valid-id/page';

const fixture = vi.hoisted(() => ({ account: vi.fn(), client: {} }));
vi.mock('@/lib/auth/get-optional-user', () => ({ getOptionalUser: fixture.account }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => fixture.client }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
beforeEach(() => { fixture.account.mockReset(); });
describe('Valid ID server access guard', () => {
  it('sends guests through login to the fixed local ID destination', async () => {
    fixture.account.mockResolvedValue({ user: null, profile: null, profileSetupPending: false });
    await expect(ValidIdPage()).rejects.toThrow('redirect:/login?next=%2Fsettings%2Fvalid-id');
  });
  it.each(['resident', 'admin'])('admits an existing incomplete %s profile to the same flow without requiring completion', async role => {
    fixture.account.mockResolvedValue({ user: { id: 'resident' }, profile: { id: 'resident', role, full_name: '' }, profileSetupPending: false });
    const page = await ValidIdPage();
    expect(page.props).toEqual({ userId: 'resident' });
    expect(fixture.account).toHaveBeenCalledWith(fixture.client, { failOnReadError: true });
  });
  it.each([
    { user: { id: 'resident' }, profile: null, profileSetupPending: false },
    { user: { id: 'resident' }, profile: { role: 'resident' }, profileSetupPending: true },
    { user: { id: 'resident' }, profile: { role: 'admin' }, profileSetupPending: true },
    { user: { id: 'staff' }, profile: { role: 'unsupported' }, profileSetupPending: false },
  ])('keeps unavailable/setup-pending/nonresident accounts out without a completion redirect', async account => {
    fixture.account.mockResolvedValue(account);
    const html = renderToStaticMarkup(await ValidIdPage());
    expect(html).toContain('role="alert"'); expect(html).not.toContain('Submit'); expect(html).not.toContain('complete-profile');
  });
  it('uses retry feedback instead of a guest redirect when account retrieval fails', async () => {
    fixture.account.mockRejectedValue(new Error('private backend error'));
    const html = renderToStaticMarkup(await ValidIdPage());
    expect(html).toContain('Your account information is unavailable'); expect(html).not.toContain('private backend error');
  });
});
