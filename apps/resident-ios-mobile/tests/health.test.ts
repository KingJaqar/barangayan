import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it } from 'vitest';
import { DataError } from '../src/data/outcome';
import { residentApi, type DriveItem } from '../src/data/resident-api';
import {
  AVAILABILITY_LABEL, categoryOf, CATEGORY_OPTIONS, dotsByDate, driveAvailability, drivesOnDate, filterByCategory, formatClock, formatDriveDate, formatMonth, formatTimeRange,
  manilaToday, monthBounds, monthGrid, monthOf, shiftMonth, stockFraction, stockSummary,
} from '../src/features/health/drive-model';
import { ageFromBirthDate, NO_CONDITIONS, toggleCondition, validateRegistration, type RegistrationDraft } from '../src/features/health/registration-form';
import { countByStatus, FILTER_ORDER, statusByDrive, STATUS_PRESENTATION, timelineFor } from '../src/features/health/registration-model';
import { residentError } from '../src/lib/errors';
import { releaseGates } from '../src/lib/release-gates';

const TENANT = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT = '44444444-4444-4444-8444-444444444444';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DRIVE = '11111111-1111-4111-8111-111111111111';
const REGISTRATION = '55555555-5555-4555-8555-555555555555';
const signal = () => new AbortController().signal;

type Reply = { status?: number; body?: unknown } | 'network-error';
function harness(replies: Reply[]) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, USER), requests };
}
const refusal = (code: string, message: string, status = 400) => ({ status, body: { code, message, details: null, hint: null } });

const drive: DriveItem = {
  id: DRIVE, title: 'Flu vaccination', type: 'vaccination', drive_date: '2026-10-20', time_start: '08:00:00', time_end: '17:30:00', location: 'Barangay Hall',
  eligible_criteria: 'Residents 18 and over', stock_label: 'Remaining Stock', stock_unit: 'doses', stock_total: 100, stock_remaining: 40,
};
const driveWith = (patch: Partial<DriveItem>): DriveItem => ({ ...drive, ...patch });

describe('drive calendar model (A29; T29 month, year and date boundaries)', () => {
  it('computes the barangay date in Asia/Manila, not UTC, around midnight and year end', () => {
    expect(manilaToday(new Date('2026-10-16T15:59:59Z'))).toBe('2026-10-16');
    expect(manilaToday(new Date('2026-10-16T16:00:00Z'))).toBe('2026-10-17');
    expect(manilaToday(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
  });
  it('moves across month and year boundaries and stops at the supported years', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    const first = { year: 2020, month: 1 };
    expect(shiftMonth(first, -1)).toBe(first);
    const last = { year: 2100, month: 12 };
    expect(shiftMonth(last, 1)).toBe(last);
  });
  it('bounds a month on its real last day, including leap February', () => {
    expect(monthBounds({ year: 2028, month: 2 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds({ year: 2026, month: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds({ year: 2026, month: 12 })).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(monthOf('2026-09-26')).toEqual({ year: 2026, month: 9 });
  });
  it('lays a month out in Sunday-first weeks padded with empty cells', () => {
    const october = monthGrid({ year: 2026, month: 10 });
    expect(october[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(october.flat().filter((day) => day !== null)).toHaveLength(31);
    expect(october.every((week) => week.length === 7)).toBe(true);
    expect(monthGrid({ year: 2026, month: 2 })[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(monthGrid({ year: 2026, month: 2 })).toHaveLength(4);
  });
  it('shows every configured category, and an unknown type as Others instead of dropping the drive', () => {
    expect(CATEGORY_OPTIONS).toHaveLength(12);
    expect(CATEGORY_OPTIONS.map((option) => option.label)).toEqual(expect.arrayContaining(['Vaccination', 'Maternal Care', 'Blood Drive', 'Medicine Distribution', 'Dental Care', 'Optical Care', 'Emergency Kit', 'Medical Screening', 'Medical Consultation', 'Minor Surgical Drive', 'Others']));
    expect(categoryOf('dental').label).toBe('Dental Care');
    expect(categoryOf('something_new')).toMatchObject({ type: 'others', label: 'Others' });
    const drives = [drive, driveWith({ id: 'b', type: 'dental' }), driveWith({ id: 'c', type: 'something_new' })];
    expect(filterByCategory(drives, 'all')).toHaveLength(3);
    expect(filterByCategory(drives, 'dental').map((item) => item.id)).toEqual(['b']);
    expect(filterByCategory(drives, 'others').map((item) => item.id)).toEqual(['c']);
  });
  it('groups drives by day and gives at most three distinct category dots', () => {
    const day = (type: string, id: string) => driveWith({ id, type, drive_date: '2026-10-20' });
    const drives = [day('vaccination', '1'), day('vaccination', '2'), day('dental', '3'), day('optical', '4'), day('blood_drive', '5'), driveWith({ id: '6', drive_date: '2026-10-21' })];
    const dots = dotsByDate(drives);
    expect(dots['2026-10-20'].map((dot) => dot.type)).toEqual(['vaccination', 'dental', 'optical']);
    expect(dots['2026-10-21']).toHaveLength(1);
    expect(drivesOnDate(drives, '2026-10-20')).toHaveLength(5);
    expect(drivesOnDate(drives, '2026-10-22')).toEqual([]);
  });
  it('formats times and dates from their parts, without a time-zone shift', () => {
    expect(formatClock('00:05:00')).toBe('12:05 AM');
    expect(formatClock('12:00:00')).toBe('12:00 PM');
    expect(formatClock('17:30:00')).toBe('5:30 PM');
    expect(formatTimeRange(drive)).toBe('8:00 AM – 5:30 PM');
    expect(formatDriveDate('2026-10-20')).toBe('Tuesday, October 20, 2026');
    expect(formatDriveDate('2028-02-29')).toBe('Tuesday, February 29, 2028');
    expect(formatMonth({ year: 2026, month: 9 })).toBe('September 2026');
  });
  it('decides availability from the barangay date and stock, with a passed date winning over empty stock', () => {
    expect(driveAvailability(drive, '2026-10-20')).toBe('open');
    expect(driveAvailability(drive, '2026-10-21')).toBe('closed');
    expect(driveAvailability(driveWith({ stock_remaining: 0 }), '2026-10-19')).toBe('full');
    expect(driveAvailability(driveWith({ stock_remaining: -1 }), '2026-10-19')).toBe('full');
    expect(driveAvailability(driveWith({ stock_remaining: 0 }), '2026-10-21')).toBe('closed');
    expect(AVAILABILITY_LABEL.full).toBe('No slots left');
  });
  it('states stock in words and never shows a negative or overfull bar', () => {
    expect(stockSummary(drive)).toBe('Remaining Stock: 40 of 100 doses');
    expect(stockSummary(driveWith({ stock_remaining: -3 }))).toBe('Remaining Stock: 0 of 100 doses');
    expect(stockFraction(drive)).toBe(0.4);
    expect(stockFraction(driveWith({ stock_remaining: 500 }))).toBe(1);
    expect(stockFraction(driveWith({ stock_remaining: -2 }))).toBe(0);
    expect(stockFraction(driveWith({ stock_total: 0 }))).toBe(0);
  });
});

const baseDraft: RegistrationDraft = { profileAge: 34, ageText: '', isPwd: false, conditions: NO_CONDITIONS, dose: 'first', priorDoseDate: null, consent: true, today: '2026-10-16' };

describe('registration form rules (A30; T30 age, None, dose and consent)', () => {
  it('keeps None exclusive of every condition in both directions', () => {
    let state = toggleCondition(NO_CONDITIONS, 'Diabetes');
    state = toggleCondition(state, 'Hypertension');
    expect(state).toEqual({ none: false, conditions: ['Hypertension', 'Diabetes'] });
    state = toggleCondition(state, 'None');
    expect(state).toEqual({ none: true, conditions: [] });
    state = toggleCondition(state, 'Allergy');
    expect(state).toEqual({ none: false, conditions: ['Allergy'] });
    expect(toggleCondition(state, 'Allergy')).toEqual(NO_CONDITIONS);
    expect(toggleCondition(toggleCondition(NO_CONDITIONS, 'None'), 'None')).toEqual(NO_CONDITIONS);
  });
  it('derives age from the date of birth by date parts and rejects missing, future and implausible dates', () => {
    expect(ageFromBirthDate('2000-10-16', '2026-10-16')).toBe(26);
    expect(ageFromBirthDate('2000-10-17', '2026-10-16')).toBe(25);
    expect(ageFromBirthDate('2026-10-16', '2026-10-16')).toBe(0);
    expect(ageFromBirthDate('2026-10-17', '2026-10-16')).toBeNull();
    expect(ageFromBirthDate('1900-01-01', '2026-10-16')).toBe(126);
    expect(ageFromBirthDate('1900-01-01', '2040-01-01')).toBeNull();
    expect(ageFromBirthDate(null, '2026-10-16')).toBeNull();
    expect(ageFromBirthDate('2000-02-30', '2026-10-16')).toBeNull();
    expect(ageFromBirthDate('1896-10-16', '2026-10-16')).toBeNull();
  });
  it('accepts ages 0 and 130 and rejects 131, blanks and non-numbers when the age is typed', () => {
    const typed = (ageText: string) => validateRegistration(DRIVE, { ...baseDraft, profileAge: null, ageText });
    expect(typed('0')).toMatchObject({ payload: { age: 0 } });
    expect(typed('130')).toMatchObject({ payload: { age: 130 } });
    for (const bad of ['131', '', '  ', '-1', '1.5', '12a', '1000']) expect(typed(bad)).toHaveProperty('errors.age');
    expect(typed('')).toMatchObject({ errors: { age: 'Enter your age in years.' } });
  });
  it('uses the profile age without asking for one', () => {
    expect(validateRegistration(DRIVE, baseDraft)).toEqual({ payload: { driveId: DRIVE, age: 34, isPwd: false, comorbidities: [] } });
  });
  it('sends no previous-dose date for a first dose, even if one was chosen earlier', () => {
    const result = validateRegistration(DRIVE, { ...baseDraft, dose: 'first', priorDoseDate: '2025-01-01' });
    expect(result).toEqual({ payload: { driveId: DRIVE, age: 34, isPwd: false, comorbidities: [] } });
    expect(JSON.stringify(result)).not.toContain('priorDoseDate');
  });
  it('requires the real previous-dose date for a 2nd dose or booster and never invents one', () => {
    for (const dose of ['second', 'booster'] as const) {
      expect(validateRegistration(DRIVE, { ...baseDraft, dose })).toEqual({ errors: { priorDose: 'Choose the date of your previous dose.' } });
      expect(validateRegistration(DRIVE, { ...baseDraft, dose, priorDoseDate: '2026-02-30' })).toHaveProperty('errors.priorDose');
      expect(validateRegistration(DRIVE, { ...baseDraft, dose, priorDoseDate: '2026-10-17' })).toEqual({ errors: { priorDose: 'The previous dose date cannot be in the future.' } });
      expect(validateRegistration(DRIVE, { ...baseDraft, dose, priorDoseDate: '2026-10-16' })).toMatchObject({ payload: { priorDoseDate: '2026-10-16' } });
      expect(validateRegistration(DRIVE, { ...baseDraft, dose, priorDoseDate: '2026-03-04' })).toMatchObject({ payload: { priorDoseDate: '2026-03-04' } });
    }
  });
  it('requires consent and reports every problem at once', () => {
    expect(validateRegistration(DRIVE, { ...baseDraft, consent: false })).toEqual({ errors: { consent: 'Accept the health-data consent to register.' } });
    const all = validateRegistration(DRIVE, { ...baseDraft, profileAge: null, ageText: '', dose: 'booster', consent: false });
    expect(all).toHaveProperty('errors.age');
    expect(all).toHaveProperty('errors.priorDose');
    expect(all).toHaveProperty('errors.consent');
  });
  it('sends the selected conditions and PWD choice, and nothing for None', () => {
    const withConditions = validateRegistration(DRIVE, { ...baseDraft, isPwd: true, conditions: { none: false, conditions: ['Hypertension', 'Allergy'] } });
    expect(withConditions).toEqual({ payload: { driveId: DRIVE, age: 34, isPwd: true, comorbidities: ['Hypertension', 'Allergy'] } });
    expect(validateRegistration(DRIVE, { ...baseDraft, conditions: { none: true, conditions: [] } })).toMatchObject({ payload: { comorbidities: [] } });
  });
});

describe('registration history model (A31; T31 statuses and cancelled timeline)', () => {
  it('counts every status and the total', () => {
    const rows = [{ status: 'pending' }, { status: 'pending' }, { status: 'confirmed' }, { status: 'cancelled' }] as const;
    expect(countByStatus(rows)).toEqual({ all: 4, pending: 2, confirmed: 1, attended: 0, cancelled: 1 });
    expect(countByStatus([])).toEqual({ all: 0, pending: 0, confirmed: 0, attended: 0, cancelled: 0 });
    expect(FILTER_ORDER).toEqual(['all', 'pending', 'confirmed', 'attended', 'cancelled']);
  });
  it('marks the current step and what is behind or ahead of it', () => {
    expect(timelineFor('pending')).toEqual([{ status: 'pending', state: 'current' }, { status: 'confirmed', state: 'upcoming' }, { status: 'attended', state: 'upcoming' }]);
    expect(timelineFor('confirmed').map((step) => step.state)).toEqual(['done', 'current', 'upcoming']);
    expect(timelineFor('attended').map((step) => step.state)).toEqual(['done', 'done', 'current']);
  });
  it('ends a cancelled timeline at Cancelled without claiming it was confirmed or attended', () => {
    expect(timelineFor('cancelled')).toEqual([{ status: 'pending', state: 'done' }, { status: 'cancelled', state: 'current' }]);
  });
  it('gives every status a label, an icon and a meaning, and indexes the status per drive', () => {
    for (const status of ['pending', 'confirmed', 'attended', 'cancelled'] as const) expect(STATUS_PRESENTATION[status].label.length).toBeGreaterThan(0);
    expect(statusByDrive([{ drive_id: DRIVE, status: 'cancelled' }]).get(DRIVE)).toBe('cancelled');
    expect(statusByDrive([]).get(DRIVE)).toBeUndefined();
  });
});

const driveRow = { ...drive };
const registrationRow = (patch: Record<string, unknown> = {}) => ({
  id: REGISTRATION, drive_id: DRIVE, applicant_number: 'VAC-20261016-0061', status: 'pending', created_at: '2026-10-16T01:00:00+00:00', updated_at: '2026-10-16T01:00:00+00:00',
  drive: { ...driveRow, barangay_id: TENANT }, ...patch,
});

describe('Health reads (B16)', () => {
  it('lists upcoming active drives of this barangay with a category filter, soonest first with a stable tie-break', async () => {
    const { api, requests } = harness([{ body: [driveRow] }]);
    expect(await api.drives('', { type: 'dental', from: '2026-10-16' })({ from: 0, to: 24 }, signal())).toEqual([driveRow]);
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe('/rest/v1/medical_drives');
    expect(params.get('select')).toBe('id,title,type,drive_date,time_start,time_end,location,eligible_criteria,stock_label,stock_unit,stock_total,stock_remaining');
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('is_active')).toBe('eq.true');
    expect(params.get('deleted_at')).toBe('is.null');
    expect(params.get('type')).toBe('eq.dental');
    expect(params.get('drive_date')).toBe('gte.2026-10-16');
    expect(params.get('order')).toBe('drive_date.asc,time_start.asc,id.asc');
  });
  it('refuses an unknown category or a malformed date before any request', async () => {
    const { api, requests } = harness([]);
    await expect(api.drives('', { type: 'x or 1=1' })({ from: 0, to: 24 }, signal())).rejects.toBeInstanceOf(DataError);
    await expect(api.drives('', { from: '2026-10-16; drop' })({ from: 0, to: 24 }, signal())).rejects.toBeInstanceOf(DataError);
    expect(requests).toHaveLength(0);
  });
  it('reads one calendar month completely and reports a contract failure instead of a silently short month', async () => {
    const { api, requests } = harness([{ body: [driveRow] }]);
    expect(await api.drivesBetween('2026-10-01', '2026-10-31', signal())).toEqual([driveRow]);
    const params = requests[0].url.searchParams;
    expect(params.getAll('drive_date')).toEqual(['gte.2026-10-01', 'lte.2026-10-31']);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    const malformed = harness([{ body: [{ ...driveRow, stock_remaining: 'many' }] }]);
    await expect(malformed.api.drivesBetween('2026-10-01', '2026-10-31', signal())).rejects.toMatchObject({ kind: 'schema' });
    await expect(harness([]).api.drivesBetween('2026-10', '2026-10-31', signal())).rejects.toBeInstanceOf(DataError);
  });
  it('treats a malformed or foreign drive id as not found without a query, and scopes a real one to the tenant', async () => {
    const none = harness([]);
    expect(await none.api.drive('not-a-uuid', signal())).toBeNull();
    expect(none.requests).toHaveLength(0);
    const { api, requests } = harness([{ body: driveRow }]);
    expect(await api.drive(DRIVE, signal())).toEqual(driveRow);
    expect(requests[0].url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(requests[0].url.searchParams.get('is_active')).toBe('eq.true');
  });
  it('reads only the resident’s own registrations, without health answers or the administrator score, newest first', async () => {
    const { api, requests } = harness([{ body: [registrationRow()] }]);
    const rows = await api.myRegistrations('all')({ from: 0, to: 24 }, signal());
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe('/rest/v1/drive_registrations');
    expect(params.get('user_id')).toBe(`eq.${USER}`);
    expect(params.get('order')).toBe('created_at.desc,id.asc');
    const select = params.get('select') ?? '';
    for (const hidden of ['age', 'is_pwd', 'comorbidities', 'prior_dose_date', 'priority', 'score']) expect(select).not.toMatch(new RegExp(`(^|[,(])${hidden}`));
    expect(params.get('status')).toBeNull();
    expect(rows[0]).toMatchObject({ id: REGISTRATION, status: 'pending', applicant_number: 'VAC-20261016-0061' });
    expect(rows[0].drive).toEqual(driveRow);
    expect(rows[0].drive).not.toHaveProperty('barangay_id');
  });
  it('filters by status on the server and treats a removed or foreign-tenant drive as not listed', async () => {
    const { api, requests } = harness([{ body: [registrationRow({ status: 'cancelled', drive: null }), registrationRow({ id: '66666666-6666-4666-8666-666666666666', drive: { ...driveRow, barangay_id: OTHER_TENANT } })] }]);
    const rows = await api.myRegistrations('cancelled')({ from: 25, to: 49 }, signal());
    expect(requests[0].url.searchParams.get('status')).toBe('eq.cancelled');
    expect(requests[0].url.searchParams.get('offset')).toBe('25');
    expect(rows.map((row) => row.drive)).toEqual([null, null]);
    expect(rows[0].status).toBe('cancelled');
  });
  it('fails closed on an unknown registration status and on a guest read', async () => {
    const { api } = harness([{ body: [registrationRow({ status: 'waitlisted' })] }]);
    await expect(api.myRegistrations('all')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'schema' });
    const guest = residentApi(createClient<Database>('https://example.supabase.co', 'sb_publishable_test'), TENANT);
    await expect(guest.myRegistrations('all')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'session' });
  });
  it('reads the registration summary in full for counts and registered marks', async () => {
    const { api, requests } = harness([{ body: [{ id: REGISTRATION, drive_id: DRIVE, status: 'confirmed' }] }]);
    expect(await api.registrationSummary(signal())).toEqual([{ id: REGISTRATION, drive_id: DRIVE, status: 'confirmed' }]);
    expect(requests[0].url.searchParams.get('select')).toBe('id,drive_id,status');
    expect(requests[0].url.searchParams.get('user_id')).toBe(`eq.${USER}`);
  });
});

const result = { registration_id: REGISTRATION, applicant_number: 'VAC-20261016-0061', status: 'pending' };
const input = { driveId: DRIVE, age: 34, isPwd: false, comorbidities: [] as string[] };

describe('Self registration contract (B16, register_for_drive; T30/T31 races, duplicates, lost replies)', () => {
  it('sends the typed answers, a previous dose only when supplied, and returns the server’s applicant number', async () => {
    const { api, requests } = harness([{ body: result }, { body: result }]);
    expect(await api.registerForDrive(input)).toEqual({ ...result, reconciled: false });
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/register_for_drive');
    expect(JSON.parse(requests[0].body ?? '')).toEqual({ p_drive_id: DRIVE, p_age: 34, p_is_pwd: false, p_comorbidities: [] });
    await api.registerForDrive({ ...input, comorbidities: ['Diabetes'], priorDoseDate: '2026-03-04' });
    expect(JSON.parse(requests[1].body ?? '')).toEqual({ p_drive_id: DRIVE, p_age: 34, p_is_pwd: false, p_comorbidities: ['Diabetes'], p_prior_dose_date: '2026-03-04' });
  });
  it('strips any administrator-only field the response might carry and rejects a malformed result', async () => {
    const { api } = harness([{ body: { ...result, priority_score: 90, score: { priority_score: 90 } } }]);
    const outcome = await api.registerForDrive(input);
    expect(outcome).toEqual({ ...result, reconciled: false });
    expect(JSON.stringify(outcome)).not.toContain('score');
    for (const body of [{ ...result, applicant_number: '' }, { ...result, status: 'waitlisted' }, { registration_id: 'nope', applicant_number: 'A', status: 'pending' }, null]) {
      await expect(harness([{ body }]).api.registerForDrive(input)).rejects.toBeDefined();
    }
  });
  it('rejects age 131, a negative or fractional age and a malformed date before any request', async () => {
    const { api, requests } = harness([]);
    for (const bad of [{ age: 131 }, { age: -1 }, { age: 1.5 }, { priorDoseDate: '2026-13-01' }, { driveId: 'nope' }]) await expect(api.registerForDrive({ ...input, ...bad })).rejects.toBeDefined();
    expect(requests).toHaveLength(0);
  });
  it('reports each definite refusal as itself, with resident wording, and never looks for a registration to reconcile', async () => {
    const cases: [string, string, string, string, RegExp][] = [
      ['P0003', 'No remaining slots for this drive', 'validation', 'P0003', /no remaining slots/i],
      ['P0004', 'Already registered for this drive', 'conflict', 'P0004', /already registered/i],
      ['P0002', 'Drive not found or inactive', 'not-found', 'P0002', /no longer available/i],
      ['P0005', 'Registration is closed for this drive', 'validation', 'P0005', /closed/i],
      ['22023', 'invalid_age', 'validation', '22023', /not accepted/i],
    ];
    for (const [pg, message, kind, code, wording] of cases) {
      const { api, requests } = harness([refusal(pg, message)]);
      const failure = await api.registerForDrive(input).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(DataError);
      expect(failure).toMatchObject({ kind, code });
      expect(residentError(failure)).toMatch(wording);
      expect(requests).toHaveLength(1);
    }
  });
  it('tells an incomplete profile apart from other refusals', async () => {
    const { api } = harness([refusal('42501', 'resident_profile_completion_required', 403)]);
    const failure = await api.registerForDrive(input).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'registration_profile_required' });
    expect(residentError(failure)).toMatch(/Complete your profile/);
  });
  it('maps a missing session to a session failure', async () => {
    const { api } = harness([refusal('P0001', 'Not authenticated')]);
    await expect(api.registerForDrive(input)).rejects.toBeInstanceOf(DataError);
  });
  it('finds the registration after a lost reply, but only one created during this attempt', async () => {
    const created = new Date().toISOString();
    const stored = { id: REGISTRATION, applicant_number: 'VAC-20261016-0061', status: 'pending', created_at: created };
    const { api, requests } = harness(['network-error', { body: stored }]);
    expect(await api.registerForDrive(input)).toEqual({ registration_id: REGISTRATION, applicant_number: 'VAC-20261016-0061', status: 'pending', reconciled: true });
    expect(requests).toHaveLength(2);
    expect(requests[1].method).toBe('GET');
    expect(requests[1].url.pathname).toBe('/rest/v1/drive_registrations');
    expect(requests[1].url.searchParams.get('user_id')).toBe(`eq.${USER}`);
    expect(requests[1].url.searchParams.get('drive_id')).toBe(`eq.${DRIVE}`);
    const earlier = harness(['network-error', { body: { ...stored, created_at: '2026-01-01T00:00:00+00:00' } }]);
    await expect(earlier.api.registerForDrive(input)).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('leaves a lost reply unconfirmed when nothing is stored or the follow-up read also fails', async () => {
    for (const second of [{ body: null }, 'network-error', refusal('42501', 'denied', 403)] as Reply[]) {
      const { api, requests } = harness(['network-error', second]);
      const failure = await api.registerForDrive(input).catch((error: unknown) => error);
      expect(failure).toMatchObject({ kind: 'unknown-commit' });
      expect(residentError(failure)).toMatch(/could not confirm/i);
      // The write itself is sent once; only the safe follow-up read may be retried by the transport.
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
      expect(requests.slice(1).every((request) => request.method === 'GET')).toBe(true);
    }
  });
  it('does not treat a server error as a refusal either: an HTTP 500 is an unknown outcome that is checked once', async () => {
    const { api, requests } = harness([{ status: 500, body: { message: 'boom' } }, { body: null }]);
    await expect(api.registerForDrive(input)).rejects.toMatchObject({ kind: 'unknown-commit' });
    expect(requests).toHaveLength(2);
  });
});

describe('Health availability gate (G09/G16, OD-13)', () => {
  it('has in-app medical registration open for the non-device scope by owner decision OD-13, while the unrelated gates stay closed', () => {
    expect(releaseGates.medicalRegistration).toBe(true);
    expect(releaseGates.householdEditing).toBe(false);
  });
});
