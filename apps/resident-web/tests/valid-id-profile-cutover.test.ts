import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  requireUser: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock('@/lib/auth/require-user', () => ({ requireUser: fixture.requireUser }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ from: () => fixture }) }));
vi.mock('../src/app/(resident)/settings/profile/profile-form', () => ({ ProfileForm: () => createElement('div', null, 'Personal profile form') }));
vi.mock('@/components/auth/google-button', () => ({ GoogleButton: (props: { label: string; link: boolean; next: string }) => createElement('button', { 'data-link': props.link, 'data-next': props.next }, props.label) }));

import ProfilePage from '../src/app/(resident)/settings/profile/page';

beforeEach(() => {
  vi.resetAllMocks();
  fixture.requireUser.mockResolvedValue({ user: { id: 'resident' }, profile: { barangayName: 'Barangay' } });
  fixture.select.mockReturnValue(fixture);
  fixture.eq.mockReturnValue(fixture);
  fixture.single.mockResolvedValue({ data: { id: 'resident', barangay_id: 'barangay' } });
  fixture.maybeSingle.mockResolvedValue({ data: { display_name: 'Locality' } });
});

describe('Profile after the Valid ID cutover', () => {
  it('retains personal/avatar/household fields and Google linking without reading ID-only fields', async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    const fields = fixture.select.mock.calls[0][0].split(',').map((field: string) => field.trim());
    expect(fields).toEqual(['id', 'first_name', 'last_name', 'middle_name', 'suffix', 'sex', 'birth_date', 'email', 'mobile_number', 'house_no', 'street', 'city', 'province', 'employment_status', 'occupation', 'avatar_url', 'barangay_id', 'household_members', 'email_verification_status', 'barangays(name)']);
    expect(fixture.eq).toHaveBeenCalledWith('id', 'resident');
    expect(html).toContain('Personal profile form');
    expect(html).toContain('Link Google to this account');
    expect(html).toContain('data-link="true" data-next="/settings/profile"');
    expect(html).not.toContain('upload-valid-id');
  });
});
