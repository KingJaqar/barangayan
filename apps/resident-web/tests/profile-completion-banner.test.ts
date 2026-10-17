import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ from: () => fixture }) }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('lucide-react', () => ({ ArrowRight: 'svg', Info: 'svg', UserRoundPen: 'svg' }));

import { ProfileCompletionBanner } from '../src/components/auth/profile-completion-banner';

const complete = {
  id: 'resident-account', role: 'resident', deleted_at: null,
  first_name: 'Ana', last_name: 'Reyes', middle_name: null, suffix: null,
  house_no: '12', street: 'Main Street', sex: 'female', employment_status: 'student', occupation: null,
  mobile_number: '09171234567', birth_date: '2000-02-29', profile_completed_at: '2026-10-01T00:00:00Z',
};
const render = async () => renderToStaticMarkup(await ProfileCompletionBanner({ userId: complete.id }));

beforeEach(() => {
  vi.resetAllMocks();
  fixture.select.mockReturnValue(fixture);
  fixture.eq.mockReturnValue(fixture);
  fixture.abortSignal.mockReturnValue(fixture);
});

describe('resident-web incomplete profile warning', () => {
  it.each(['resident', 'admin'])('hides the warning for a complete %s profile', async role => {
    fixture.maybeSingle.mockResolvedValue({ data: { ...complete, role }, error: null });
    expect(await render()).toBe('');
  });

  it.each(['resident', 'admin'])('checks required details for %s profiles despite a saved completion timestamp', async role => {
    for (const missing of [
      { first_name: '' }, { last_name: null }, { house_no: '' }, { street: null },
      { sex: null }, { employment_status: null }, { mobile_number: 'invalid' }, { birth_date: '2001-02-29' },
    ]) {
      fixture.maybeSingle.mockResolvedValue({ data: { ...complete, role, ...missing }, error: null });
      const html = await render();
      expect(html).toContain('Your next step: complete your profile');
      expect(html).toContain('href="/settings/profile"');
      expect(fixture.eq).toHaveBeenLastCalledWith('id', complete.id);
    }
  });

  it('keeps the same warning when an incomplete resident is promoted to admin', async () => {
    const incomplete = { ...complete, house_no: null, birth_date: null };
    fixture.maybeSingle.mockResolvedValue({ data: incomplete, error: null });
    const before = await render();
    fixture.maybeSingle.mockResolvedValue({ data: { ...incomplete, role: 'admin' }, error: null });
    expect(await render()).toBe(before);
    expect(before).toContain('Complete your resident profile');
  });

  it('clears the admin warning once the missing details are saved', async () => {
    fixture.maybeSingle.mockResolvedValue({ data: { ...complete, role: 'admin', mobile_number: null }, error: null });
    expect(await render()).toContain('Your next step: complete your profile');
    fixture.maybeSingle.mockResolvedValue({ data: { ...complete, role: 'admin' }, error: null });
    expect(await render()).toBe('');
  });

  it('shows unavailable feedback when the profile cannot be checked', async () => {
    fixture.maybeSingle.mockResolvedValue({ data: null, error: { message: 'private backend failure' } });
    const html = await render();
    expect(html).toContain('Profile check unavailable');
    expect(html).not.toContain('Your next step');
    expect(html).not.toContain('private backend failure');
  });
});
