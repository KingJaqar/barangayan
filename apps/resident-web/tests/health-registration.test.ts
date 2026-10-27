import { beforeEach, describe, expect, it, vi } from 'vitest';
import { healthRegistrationFailure } from '../src/lib/health-registration-feedback';

const fixture = vi.hoisted(() => ({ requireUser: vi.fn(), createClient: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() } }));
vi.mock('@/lib/auth/require-user', () => ({ requireUser: fixture.requireUser }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: fixture.createClient }));
vi.mock('@/components/health/applicant-form', () => ({ ApplicantForm: () => null }));
vi.mock('@/components/health/registration-account-notice', () => ({ RegistrationAccountNotice: () => null }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));

import RegisterForDrivePage from '../src/app/(resident)/health/register/[driveId]/page';
import { ApplicantForm } from '../src/components/health/applicant-form';
import { RegistrationAccountNotice } from '../src/components/health/registration-account-notice';

describe('medical registration feedback', () => {
  it.each([
    ['P0001', 'session has ended'], ['P0002', 'no longer available'], ['P0003', 'no remaining slots'],
    ['P0004', 'already registered'], ['P0005', 'has closed'], ['P0011', 'own barangay'],
  ])('explains %s without exposing database details', (code, text) => {
    const failure = healthRegistrationFailure({ code, message: 'private internal detail' });
    expect(failure.kind).toBe('rejected');
    expect(failure.message).toContain(text);
    expect(failure.message).not.toContain('private');
  });
  it('offers account switching only for the known role rejection', () => {
    expect(healthRegistrationFailure({ code: 'P0010' }).kind).toBe('account');
    expect(healthRegistrationFailure({ code: '42501', message: 'forbidden' }).kind).toBe('rejected');
  });
  it('distinguishes missing profile details from general access denial', () => {
    expect(healthRegistrationFailure({ code: '42501', message: 'resident_profile_completion_required' }).message).toContain('Complete your resident profile');
  });
  it.each([
    ['invalid_age', 'valid age'], ['invalid_prior_dose_date', 'cannot be in the future'],
    ['invalid_comorbidities', 'comorbidities'], ['unknown_internal_validation', 'registration details'],
  ])('explains input rejection %s', (message, text) => {
    expect(healthRegistrationFailure({ code: '22023', message }).message).toContain(text);
  });
  it.each([null, new Error('lost reply'), { issues: [] }, { code: '', message: 'fetch failed' }, { code: 'PGRST204' }])('preserves uncertainty after a lost or malformed reply: %s', error => {
    expect(healthRegistrationFailure(error)).toMatchObject({ kind: 'unconfirmed', checkRegistrations: true });
  });
  it('directs duplicate registrations to the existing registration', () => {
    expect(healthRegistrationFailure({ code: 'P0004' }).checkRegistrations).toBe(true);
  });
});

describe('direct medical registration page', () => {
  const params = Promise.resolve({ driveId: 'drive-123' });
  beforeEach(() => {
    vi.resetAllMocks();
    fixture.requireUser.mockResolvedValue({ user: { id: 'user' }, profile: { role: 'resident', full_name: 'Test Resident' } });
    fixture.createClient.mockResolvedValue({ from: () => fixture.query });
    fixture.query.select.mockReturnValue(fixture.query);
    fixture.query.eq.mockReturnValue(fixture.query);
    fixture.query.is.mockReturnValue(fixture.query);
    fixture.query.single.mockResolvedValue({ data: { id: 'drive-123', birth_date: '2000-01-01', household_members: [] } });
  });
  it.each(['admin', 'unknown'])('blocks %s before loading the registration form', async role => {
    fixture.requireUser.mockResolvedValue({ user: { id: 'user' }, profile: { role } });
    const page = await RegisterForDrivePage({ params });
    expect(page.type).toBe(RegistrationAccountNotice);
    expect(page.props.next).toBe('/health/register/drive-123');
    expect(fixture.createClient).not.toHaveBeenCalled();
  });
  it('renders the applicant form for a resident admitted by the server account guard', async () => {
    const page = await RegisterForDrivePage({ params });
    expect(page.type).toBe(ApplicantForm);
    expect(page.props.residentName).toBe('Test Resident');
  });
  it('does not render the form when the server account check fails', async () => {
    fixture.requireUser.mockRejectedValue(new Error('Account check unavailable'));
    await expect(RegisterForDrivePage({ params })).rejects.toThrow('Account check unavailable');
    expect(fixture.createClient).not.toHaveBeenCalled();
  });
});
