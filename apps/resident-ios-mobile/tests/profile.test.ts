import { createClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';
import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_LICENSE, LEAFLET_VERSION } from '../src/lib/leaflet-assets';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

vi.mock('expo-crypto', () => ({ randomUUID: () => '99999999-9999-4999-8999-999999999999' }));
const { residentApi } = await import('../src/data/resident-api');
const { avatarPathFromUrl, replaceAvatar } = await import('../src/features/profile/avatar');
const birthday = await import('../src/features/profile/birthday');
const form = await import('../src/features/profile/profile-form');
const { saveProfile } = await import('../src/features/profile/profile-save');
const household = await import('../src/features/profile/household');
const evidence = await import('../src/features/profile/id-evidence');
const map = await import('../src/features/profile/location-map');
const { prepareImage } = await import('../src/lib/image-prep');
const { bytesToDataUri } = await import('../src/lib/data-uri');
const { PublicError } = await import('../src/lib/errors');

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT = '22222222-2222-4222-8222-222222222222';
const SUBMISSION = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';

type Reply = { status?: number; body?: unknown } | 'network-error';
function harness(replies: Reply[]) {
  const requests: { url: URL; method: string; body?: unknown }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { client, requests };
}

/** A parseable JPEG padded with entropy data to `size` bytes. */
function jpeg(size = 64) {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6];
  const tail = [0xff, 0xd9];
  return Uint8Array.from([...head, ...new Array(Math.max(0, size - head.length - tail.length)).fill(0x11), ...tail]);
}
const heic = () => Uint8Array.from([0, 0, 0, 0x18, ...[...'ftypheic'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, ...[...'mif1heic'].map((c) => c.charCodeAt(0))]);

describe('birthday picker logic (A38, T38)', () => {
  const today = new Date(2026, 9, 15);
  it('accepts only real calendar dates including leap days', () => {
    expect(birthday.parseBirthday('2000-02-29', today)).toEqual({ year: 2000, month: 2, day: 29 });
    expect(birthday.parseBirthday('2001-02-29', today)).toBeNull();
    expect(birthday.parseBirthday('1900-01-01', today)).not.toBeNull();
    expect(birthday.parseBirthday('1899-12-31', today)).toBeNull();
    expect(birthday.parseBirthday('2026-10-16', today)).toBeNull();
    expect(birthday.parseBirthday('2026-10-15', today)).not.toBeNull();
    expect(birthday.parseBirthday('', today)).toBeNull();
  });
  it('keeps a real date when month or year changes and never passes today', () => {
    expect(birthday.limitBirthday({ year: 2001, month: 2, day: 31 }, today)).toEqual({ year: 2001, month: 2, day: 28 });
    expect(birthday.limitBirthday({ year: 2000, month: 2, day: 31 }, today)).toEqual({ year: 2000, month: 2, day: 29 });
    expect(birthday.limitBirthday({ year: 2026, month: 12, day: 31 }, today)).toEqual({ year: 2026, month: 10, day: 15 });
    expect(birthday.limitBirthday({ year: 2999, month: 1, day: 1 }, today).year).toBe(2026);
    expect(birthday.limitBirthday({ year: 1500, month: 1, day: 1 }, today).year).toBe(1900);
  });
  it('offers only valid months, days and years, and an adult fallback when there is no date', () => {
    expect(birthday.selectableMonths(2026, today)).toHaveLength(10);
    expect(birthday.selectableMonths(2025, today)).toHaveLength(12);
    expect(birthday.selectableDays(2026, 10, today)).toHaveLength(15);
    expect(birthday.selectableDays(2024, 2, today)).toHaveLength(29);
    expect(birthday.pickerStart(null, today)).toEqual({ year: 2001, month: 1, day: 1 });
    expect(birthday.pickerStart('1990-06-05', today)).toEqual({ year: 1990, month: 6, day: 5 });
    expect(birthday.birthdayLabel('1990-06-05')).toBe('June 5, 1990');
  });
});

const profileRow = (patch: Partial<Tables<'profiles'>> = {}) => ({
  id: USER, barangay_id: TENANT, first_name: 'Juan', middle_name: null, last_name: 'Dela Cruz', suffix: null, full_name: 'Juan Dela Cruz',
  sex: 'male', birth_date: '1990-06-05', mobile_number: '09171234567', email: 'juan@example.com', house_no: '12', street: 'Mabini', city: 'San Mateo',
  employment_status: 'employed', occupation: 'Driver', household_members: [], ...patch,
}) as unknown as Tables<'profiles'>;

describe('profile form (A37, T37)', () => {
  it('builds a draft from the row and compares edits', () => {
    const draft = form.draftFrom(profileRow());
    expect(draft).toMatchObject({ firstName: 'Juan', email: 'juan@example.com', employmentStatus: 'employed', occupation: 'Driver' });
    expect(form.sameDraft(draft, { ...draft })).toBe(true);
    expect(form.sameDraft(draft, { ...draft, street: 'Rizal' })).toBe(false);
  });
  it('reports every required field and live format problems', () => {
    const empty = form.draftFrom(profileRow({ first_name: null, last_name: null, sex: null, birth_date: null, mobile_number: null, email: null, house_no: null, street: null, city: null, employment_status: null }));
    const result = form.validateDraft(empty, { cityLocked: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['birthDate', 'city', 'email', 'employmentStatus', 'firstName', 'houseNo', 'lastName', 'mobileNumber', 'sex', 'street']);
    expect(form.fieldIssue('mobileNumber', '0917')).toMatch(/11-digit/);
    expect(form.fieldIssue('firstName', 'Juan3')).toMatch(/Letters only/);
    expect(form.fieldIssue('email', 'nope')).toMatch(/valid email/);
    expect(form.fieldIssue('birthDate', '2999-01-01')).toMatch(/future/);
    expect(form.fieldIssue('firstName', '')).toBeUndefined();
  });
  it('does not require or write the city when the locality is configured', () => {
    const draft = form.draftFrom(profileRow({ city: null }));
    const locked = form.validateDraft(draft, { cityLocked: true });
    expect(locked.ok).toBe(true);
    if (locked.ok) expect(locked.patch).not.toHaveProperty('city');
    expect(form.validateDraft(draft, { cityLocked: false }).ok).toBe(false);
    const legacy = form.validateDraft({ ...draft, city: ' Marikina ' }, { cityLocked: false });
    expect(legacy.ok && legacy.patch.city).toBe('Marikina');
  });
  it('builds one patch of structured columns and drops an occupation the status does not use', () => {
    const draft = form.withEmploymentStatus(form.draftFrom(profileRow({ middle_name: 'Santos' })), 'student');
    expect(draft.occupation).toBe('');
    const result = form.validateDraft({ ...draft, email: ' JUAN@example.com ' }, { cityLocked: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual({
        first_name: 'Juan', middle_name: 'Santos', last_name: 'Dela Cruz', suffix: null, sex: 'male', birth_date: '1990-06-05', mobile_number: '09171234567',
        email: 'JUAN@example.com', house_no: '12', street: 'Mabini', employment_status: 'student', occupation: null,
      });
      expect(result.patch).not.toHaveProperty('full_name');
      expect(result.patch).not.toHaveProperty('email_verification_status');
    }
    expect(form.withEmploymentStatus(form.draftFrom(profileRow()), 'self_employed').occupation).toBe('Driver');
  });
  it('retries a stale refusal only when no edited field changed elsewhere', () => {
    const base = profileRow();
    expect(form.reconcileConflict(base, profileRow({ avatar_url: 'x' } as Partial<Tables<'profiles'>>))).toBe('retry');
    expect(form.reconcileConflict(base, profileRow({ street: 'Rizal' }))).toBe('review');
    expect(form.initials(base)).toBe('JD');
  });
});

describe('conditional profile save (T37 stale editor, §3)', () => {
  const base = profileRow({ updated_at: '2026-10-15T03:12:44.123456+00:00' } as Partial<Tables<'profiles'>>);
  const patch = (() => { const r = form.validateDraft(form.draftFrom(base), { cityLocked: true }); if (!r.ok) throw new Error('fixture'); return { ...r.patch, street: 'Rizal' }; })();
  it('writes against the row it was based on, scoped to the owner and tenant', async () => {
    const { client, requests } = harness([{ body: [{ id: USER }] }]);
    expect(await saveProfile(client, base, patch)).toEqual({ kind: 'saved', base });
    const call = requests[0];
    expect(call.method).toBe('PATCH');
    expect(call.url.searchParams.get('id')).toBe(`eq.${USER}`);
    expect(call.url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(call.url.searchParams.get('updated_at')).toBe('eq.2026-10-15T03:12:44.123456+00:00');
    expect(call.url.searchParams.get('select')).toBe('id');
    expect(call.body).toMatchObject({ street: 'Rizal', first_name: 'Juan' });
  });
  it('retries once against a newer row when only unrelated columns changed', async () => {
    const latest = { ...base, avatar_url: 'https://example/avatar.jpg', updated_at: '2026-10-15T04:00:00+00:00' };
    const { client, requests } = harness([{ body: [] }, { body: latest }, { body: [{ id: USER }] }]);
    const outcome = await saveProfile(client, base, patch);
    expect(outcome.kind).toBe('saved');
    expect(requests.map((r) => r.method)).toEqual(['PATCH', 'GET', 'PATCH']);
    expect(requests[2].url.searchParams.get('updated_at')).toBe('eq.2026-10-15T04:00:00+00:00');
  });
  it('writes nothing and asks for review when an edited field changed elsewhere', async () => {
    const latest = { ...base, mobile_number: '09998887777', updated_at: '2026-10-15T04:00:00+00:00' };
    const { client, requests } = harness([{ body: [] }, { body: latest }]);
    const outcome = await saveProfile(client, base, patch);
    expect(outcome.kind).toBe('review');
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(1);
  });
  it('reports a second concurrent change and never reports an unconfirmed write as saved', async () => {
    const latest = { ...base, updated_at: '2026-10-15T04:00:00+00:00' };
    const again = harness([{ body: [] }, { body: latest }, { body: [] }]);
    expect((await saveProfile(again.client, base, patch)).kind).toBe('changed-again');
    const lost = harness(['network-error']);
    await expect(saveProfile(lost.client, base, patch)).rejects.toMatchObject({ kind: 'unknown-commit' });
    const denied = harness([{ status: 403, body: { code: '42501', message: 'denied' } }]);
    await expect(saveProfile(denied.client, base, patch)).rejects.toMatchObject({ kind: 'authorization' });
  });
});

describe('household list (A27, T27)', () => {
  it('reads stored members and counts unreadable entries instead of inventing data', () => {
    const read = household.readMembers([{ id: MEMBER, name: 'Ana Reyes', relation: 'Spouse', role: 'Employed' }, { id: 'x', name: ' ', relation: 'Child' }, 'bad', null] as Json);
    expect(read.members).toEqual([{ id: MEMBER, name: 'Ana Reyes', relation: 'Spouse', role: 'Employed' }]);
    expect(read.unreadable).toBe(3);
    expect(household.readMembers(null)).toEqual({ members: [], unreadable: 0 });
    expect(household.memberInitials('Ana Maria Reyes')).toBe('AR');
    expect(household.memberInitials('Ana')).toBe('AN');
  });
  it('validates a member and keeps the source relationship and role options', () => {
    expect(household.RELATIONS).toHaveLength(7);
    expect(household.ROLES).toHaveLength(6);
    expect(household.validateMember({ name: '', relation: '', role: '' })).toEqual({ name: expect.any(String), relation: expect.any(String), role: expect.any(String) });
    expect(household.validateMember({ name: 'Ana', relation: 'Spouse', role: 'Employed' })).toEqual({});
  });
  it('sends the whole list with the last-read list and regenerates only non-UUID ids', async () => {
    const { client, requests } = harness([{ body: [{ id: MEMBER, name: 'Ana', relation: 'Spouse', role: 'Employed' }, { id: SUBMISSION, name: 'Ben', relation: 'Child' }] }]);
    const expected: Json = [{ id: MEMBER, name: 'Ana', relation: 'Spouse' }];
    const result = await household.saveHousehold(client, [
      { id: MEMBER.toUpperCase(), name: ' Ana ', relation: 'Spouse', role: 'Employed' },
      { id: 'legacy-1', name: 'Ben', relation: 'Child', role: null },
    ], expected, () => SUBMISSION);
    expect(result.kind).toBe('saved');
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/save_resident_household_if_unchanged');
    expect(requests[0].body).toEqual({
      p_members: [{ id: MEMBER, name: 'Ana', relation: 'Spouse', role: 'Employed' }, { id: SUBMISSION, name: 'Ben', relation: 'Child' }],
      p_expected: expected,
    });
  });
  it('reports a stale list as changed and a lost reply as unconfirmed, never as saved', async () => {
    const changed = harness([{ status: 409, body: { code: 'PT409', message: 'resident_household_changed' } }]);
    expect((await household.saveHousehold(changed.client, [], [], () => MEMBER)).kind).toBe('changed');
    const lost = harness(['network-error']);
    expect((await household.saveHousehold(lost.client, [], [], () => MEMBER)).kind).toBe('unconfirmed');
    const malformed = harness([{ body: { not: 'a list' } }]);
    expect((await household.saveHousehold(malformed.client, [], [], () => MEMBER)).kind).toBe('unconfirmed');
    const rejected = harness([{ status: 400, body: { code: '22023', message: 'invalid_household_member' } }]);
    await expect(household.saveHousehold(rejected.client, [], [], () => MEMBER)).rejects.toMatchObject({ kind: 'validation' });
  });
  it('compares lists by content and order', () => {
    const a = [{ id: MEMBER, name: 'Ana', relation: 'Spouse', role: null }];
    expect(household.sameMembers(a, [{ ...a[0] }])).toBe(true);
    expect(household.sameMembers(a, [{ ...a[0], name: 'Anna' }])).toBe(false);
  });
});

describe('ID evidence (A39, T39)', () => {
  it('lists all sixteen ID types and keeps "Other" as a named type', () => {
    expect(evidence.ID_TYPES).toHaveLength(16);
    expect(evidence.encodeIdType('Passport', '')).toEqual({ value: 'Passport' });
    expect(evidence.encodeIdType('Other', ' Barangay Certification ')).toEqual({ value: 'Other: Barangay Certification' });
    expect(evidence.encodeIdType('Other', ' ')).toHaveProperty('error');
    expect(evidence.encodeIdType('', '')).toHaveProperty('error');
    expect(evidence.decodeIdType('Other: Barangay Certification')).toEqual({ type: 'Other', other: 'Barangay Certification' });
    expect(evidence.decodeIdType('UMID')).toEqual({ type: 'UMID', other: '' });
    expect(evidence.decodeIdType('Some legacy id')).toEqual({ type: 'Other', other: 'Some legacy id' });
    expect(evidence.decodeIdType(null)).toEqual({ type: '', other: '' });
  });
  it('derives status only from the newest submission and never shows an unknown decision as approved', () => {
    const row = (decision: string, reason: string | null = null) => ({ id: SUBMISSION, version: 3, id_type: 'UMID', front_path: 'f', back_path: 'b', decision, submitted_at: 't', reviewed_at: null, rejection_reason: reason });
    expect(evidence.idState(null)).toEqual({ kind: 'none' });
    expect(evidence.idState(row('pending'))).toEqual({ kind: 'pending', version: 3 });
    expect(evidence.idState(row('verified'))).toEqual({ kind: 'verified', version: 3 });
    expect(evidence.idState(row('verification_failed', 'Blurry'))).toEqual({ kind: 'rejected', version: 3, reason: 'Blurry' });
    expect(evidence.idState(row('revoked', 'Expired'))).toEqual({ kind: 'revoked', version: 3, reason: 'Expired' });
    expect(evidence.idState(row('approved-ish'))).toEqual({ kind: 'unconfirmed' });
  });

  const file = (mimeType = 'image/jpeg' as const) => ({ bytes: jpeg(), mimeType, extension: 'jpg' });
  function deps(overrides: Partial<Parameters<typeof evidence.publishIdVersion>[0]> = {}) {
    const stored = new Map<string, Uint8Array>();
    const calls: string[] = [];
    return {
      stored, calls,
      deps: {
        bucket: {
          upload: async (path: string, body: Uint8Array) => { calls.push(`upload:${path}`); if (stored.has(path)) return { error: { message: 'exists' } }; stored.set(path, body); return { error: null }; },
          download: async (path: string) => { const found = stored.get(path); return { data: found ? { arrayBuffer: async () => found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength) as ArrayBuffer } : null, error: found ? null : {} }; },
          remove: async () => ({ error: null }),
          createSignedUrl: async () => ({ data: null, error: {} }),
        },
        publish: async () => { calls.push('publish'); },
        exists: async () => false,
        ...overrides,
      } satisfies Parameters<typeof evidence.publishIdVersion>[0],
    };
  }
  it('uploads both sides to one immutable version folder, then publishes once', async () => {
    const t = deps();
    const publish = vi.fn(async () => undefined);
    const result = await evidence.publishIdVersion({ ...t.deps, publish }, USER, { submissionId: SUBMISSION, idType: 'UMID', front: file(), back: file() });
    expect(result).toEqual({ kind: 'published' });
    expect(t.calls).toEqual([`upload:${USER}/versions/${SUBMISSION}/id-front.jpg`, `upload:${USER}/versions/${SUBMISSION}/id-back.jpg`]);
    expect(publish).toHaveBeenCalledWith({ submissionId: SUBMISSION, idType: 'UMID', frontPath: `${USER}/versions/${SUBMISSION}/id-front.jpg`, backPath: `${USER}/versions/${SUBMISSION}/id-back.jpg` });
  });
  it('retries safely: identical existing objects are accepted and a lost reply is reconciled by lookup', async () => {
    const t = deps({
      publish: async () => { throw new (await import('../src/data/outcome')).DataError('unknown-commit'); },
      exists: async () => true,
    });
    t.stored.set(`${USER}/versions/${SUBMISSION}/id-front.jpg`, jpeg());
    expect(await evidence.publishIdVersion(t.deps, USER, { submissionId: SUBMISSION, idType: 'UMID', front: file(), back: file() })).toEqual({ kind: 'published' });
    const unsure = deps({ publish: async () => { throw new (await import('../src/data/outcome')).DataError('unknown-commit'); }, exists: async () => false });
    expect(await evidence.publishIdVersion(unsure.deps, USER, { submissionId: SUBMISSION, idType: 'UMID', front: file(), back: file() })).toEqual({ kind: 'unconfirmed' });
  });
  it('never overwrites a different existing object and surfaces a definite refusal', async () => {
    const clash = deps();
    clash.stored.set(`${USER}/versions/${SUBMISSION}/id-front.jpg`, jpeg(80));
    await expect(evidence.publishIdVersion(clash.deps, USER, { submissionId: SUBMISSION, idType: 'UMID', front: file(), back: file() })).rejects.toBeDefined();
    const refused = deps({ publish: async () => { throw new (await import('../src/data/outcome')).DataError('validation'); } });
    await expect(evidence.publishIdVersion(refused.deps, USER, { submissionId: SUBMISSION, idType: 'UMID', front: file(), back: file() })).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('photo preparation (OD-05 HEIC conversion, F06)', () => {
  const convert = (bytes: Uint8Array) => vi.fn(async () => bytes);
  it('passes an in-limit JPEG through without re-encoding', async () => {
    const converter = convert(jpeg());
    const result = await prepareImage('id-image', jpeg(1000), { width: 800, height: 600 }, converter);
    expect(result.mimeType).toBe('image/jpeg');
    expect(converter).not.toHaveBeenCalled();
  });
  it('converts HEIC and validates the converted bytes, with a bounded edge only when larger', async () => {
    const converter = vi.fn(async () => jpeg(2000));
    const result = await prepareImage('avatar', heic(), { width: 4032, height: 3024 }, converter);
    expect(result.mimeType).toBe('image/jpeg');
    expect(converter).toHaveBeenCalledWith({ longestEdge: 1024, quality: 0.85 });
    const small = vi.fn(async () => jpeg(2000));
    await prepareImage('avatar', heic(), { width: 600, height: 400 }, small);
    expect(small).toHaveBeenCalledWith({ longestEdge: null, quality: 0.85 });
  });
  it('re-encodes an over-limit photo at lower sizes until it fits, then gives up with a clear error', async () => {
    const oversize = jpeg(3 * 1024 * 1024);
    const steps = vi.fn()
      .mockResolvedValueOnce(jpeg(2.5 * 1024 * 1024))
      .mockResolvedValueOnce(jpeg(1024 * 1024));
    const ok = await prepareImage('avatar', oversize, { width: 4000, height: 3000 }, steps);
    expect(ok.bytes.length).toBe(1024 * 1024);
    expect(steps).toHaveBeenCalledTimes(2);
    expect(steps.mock.calls[1][0].quality).toBe(0.7);
    const stuck = vi.fn(async () => jpeg(3 * 1024 * 1024));
    await expect(prepareImage('avatar', oversize, { width: 4000, height: 3000 }, stuck)).rejects.toBeInstanceOf(PublicError);
    expect(stuck).toHaveBeenCalledTimes(3);
  });
  it('rejects unsupported or empty input without conversion', async () => {
    const converter = vi.fn(async () => jpeg());
    await expect(prepareImage('id-image', Uint8Array.from([1, 2, 3, 4]), null, converter)).rejects.toBeInstanceOf(PublicError);
    await expect(prepareImage('id-image', new Uint8Array(), null, converter)).rejects.toBeInstanceOf(PublicError);
    expect(converter).not.toHaveBeenCalled();
    await expect(prepareImage('id-image', heic(), null, async () => { throw new Error('native failure'); })).rejects.toBeInstanceOf(PublicError);
  });
  it('encodes a preview data URI', () => {
    expect(bytesToDataUri(Uint8Array.from([104, 105]), 'image/jpeg')).toBe('data:image/jpeg;base64,aGk=');
  });
});

describe('avatar (A37-004…007)', () => {
  const publicUrl = (path: string) => `https://example.supabase.co/storage/v1/object/public/profile-photos/${path}`;
  const fakeBucket = () => {
    const removed: string[][] = [];
    return {
      removed,
      bucket: {
        upload: async () => ({ error: null }), download: async () => ({ data: null, error: {} }),
        remove: async (paths: string[]) => { removed.push(paths); return { error: null }; }, createSignedUrl: async () => ({ data: null, error: {} }),
      },
    };
  };
  it('recognises only the resident\'s own avatar object in a public URL', () => {
    expect(avatarPathFromUrl(publicUrl(`${USER}/avatar.jpg?t=1`), USER)).toBe(`${USER}/avatar.jpg`);
    expect(avatarPathFromUrl(publicUrl('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar.jpg'), USER)).toBeNull();
    expect(avatarPathFromUrl('https://elsewhere.example/avatar.jpg', USER)).toBeNull();
    expect(avatarPathFromUrl(null, USER)).toBeNull();
  });
  it('uploads a new object, applies it, then removes the previous one', async () => {
    const { client, requests } = harness([{ status: 200, body: [] }]);
    const fake = fakeBucket();
    const result = await replaceAvatar(client, fake.bucket, USER, SUBMISSION, { bytes: jpeg(), mimeType: 'image/jpeg', extension: 'jpg' }, publicUrl(`${USER}/old/avatar.jpg`));
    expect(result).toMatchObject({ kind: 'applied', path: `${USER}/${SUBMISSION}/avatar.jpg` });
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].url.searchParams.get('id')).toBe(`eq.${USER}`);
    expect(fake.removed).toEqual([[`${USER}/old/avatar.jpg`]]);
  });
  it('keeps the previous photo and reports not-applied when the profile update fails', async () => {
    const { client } = harness([{ status: 500, body: { message: 'boom' } }]);
    const fake = fakeBucket();
    const result = await replaceAvatar(client, fake.bucket, USER, SUBMISSION, { bytes: jpeg(), mimeType: 'image/jpeg', extension: 'jpg' }, publicUrl(`${USER}/old/avatar.jpg`));
    expect(result.kind).toBe('not-applied');
    expect(fake.removed).toEqual([]);
  });
});

describe('location map bridge (A41, T41, B22)', () => {
  const polygon = { type: 'Polygon', coordinates: [[[121.1, 14.6], [121.2, 14.6], [121.2, 14.7], [121.1, 14.7], [121.1, 14.6]]] };
  it('reads stored points and boundaries defensively', () => {
    expect(map.readPoint({ lat: 14.65, lng: 121.15 })).toEqual({ lat: 14.65, lng: 121.15 });
    expect(map.readPoint({ lat: 'x', lng: 1 })).toBeNull();
    expect(map.readPoint({ lat: 200, lng: 1 })).toBeNull();
    expect(map.readPoint([1, 2])).toBeNull();
    expect(map.readPoint(null)).toBeNull();
    expect(map.readBoundary(polygon)).toEqual(polygon);
    expect(map.readBoundary({ type: 'Point', coordinates: [1, 2] })).toBeNull();
    expect(map.readBoundary(null)).toBeNull();
    const center = map.boundaryCenter(map.readBoundary(polygon)!);
    expect(center?.lat).toBeCloseTo(14.65);
    expect(center?.lng).toBeCloseTo(121.15);
  });
  it('nudges the pin by a small fixed step', () => {
    expect(map.nudge({ lat: 14.65, lng: 121.15 }, 'north')).toEqual({ lat: 14.6501, lng: 121.15 });
    expect(map.nudge({ lat: 14.65, lng: 121.15 }, 'west')).toEqual({ lat: 14.65, lng: 121.1499 });
  });
  it('accepts only the three known bridge messages with finite coordinates', () => {
    expect(map.parseMapMessage(JSON.stringify({ type: 'MAP_READY' }))).toEqual({ type: 'ready' });
    expect(map.parseMapMessage(JSON.stringify({ type: 'MAP_ERROR' }))).toEqual({ type: 'error' });
    expect(map.parseMapMessage(JSON.stringify({ type: 'PICKER_MOVED', payload: { lat: 14.6, lng: 121.1 } }))).toEqual({ type: 'pin', point: { lat: 14.6, lng: 121.1 } });
    for (const bad of [
      'not json', 42, null, JSON.stringify({ type: 'PICKER_MOVED', payload: { lat: 'NaN', lng: 1 } }), JSON.stringify({ type: 'PICKER_MOVED', payload: { lat: 91, lng: 1 } }),
      JSON.stringify({ type: 'PICKER_MOVED' }), JSON.stringify({ type: 'OPEN_URL', payload: { url: 'https://evil.example' } }),
      JSON.stringify({ type: 'PICKER_MOVED', payload: { lat: 1, lng: 1, pad: 'x'.repeat(3000) } }),
    ]) expect(map.parseMapMessage(bad)).toBeNull();
  });
  it('generates a page script that parses in both modes', () => {
    for (const tiles of [false, true]) {
      const scripts = [...map.mapHtml({ tiles }).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
      expect(scripts).toHaveLength(2);
      expect(() => new Function(scripts[1])).not.toThrow();
    }
  });
  it('blocks every network request unless tiles are enabled, and never loads a script from a network', () => {
    const closed = map.mapHtml({ tiles: false });
    expect(closed).toContain("img-src data:;");
    expect(closed).not.toContain('https://tile.openstreetmap.org');
    expect(closed).toContain("default-src 'none'");
    expect(closed).not.toMatch(/<script[^>]+src=/i);
    expect(map.mapHtml({ tiles: true })).toContain('img-src data: https://tile.openstreetmap.org;');
    expect(map.deliver({ type: 'SET_TILES', payload: { enabled: false } })).toBe('window.receive("{\\"type\\":\\"SET_TILES\\",\\"payload\\":{\\"enabled\\":false}}");true;');
  });
});

describe('bundled Leaflet (no CDN at runtime, OD-08)', () => {
  it('matches the pinned installed package; rerun scripts/generate-leaflet-assets.mjs after upgrading', () => {
    const require = createRequire(resolve(__dirname, '../package.json'));
    const root = dirname(require.resolve('leaflet/package.json'));
    const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
    expect(LEAFLET_VERSION).toBe('1.9.4');
    expect(LEAFLET_VERSION).toBe(JSON.parse(read('package.json')).version);
    expect(LEAFLET_JS).toBe(read('dist/leaflet.js'));
    expect(LEAFLET_CSS).toBe(read('dist/leaflet.css'));
    expect(LEAFLET_LICENSE).toBe(read('LICENSE'));
  });
});

describe('profile data readers (B03/B05)', () => {
  const signal = () => new AbortController().signal;
  it('reads the own barangay boundary and flattens the locality embed', async () => {
    const { client, requests } = harness([{ body: { name: 'Ampid I', boundary: { type: 'Polygon', coordinates: [] }, barangay_localities: { display_name: 'Ampid I', city: 'San Mateo', province: 'Rizal' } } }]);
    const result = await residentApi(client, TENANT, USER).barangayProfile(signal());
    expect(result).toMatchObject({ name: 'Ampid I', locality: { city: 'San Mateo', province: 'Rizal' } });
    expect(requests[0].url.pathname).toBe('/rest/v1/barangays');
    expect(requests[0].url.searchParams.get('select')).toBe('name,boundary,barangay_localities(display_name,city,province)');
    expect(requests[0].url.searchParams.get('id')).toBe(`eq.${TENANT}`);
  });
  it('reads only the signed-in resident\'s newest ID version and fails closed on schema drift', async () => {
    const row = { id: SUBMISSION, version: 2, id_type: 'UMID', front_path: 'f', back_path: 'b', decision: 'pending', submitted_at: '2026-10-15T00:00:00Z', reviewed_at: null, rejection_reason: null };
    const { client, requests } = harness([{ body: [row] }, { body: [] }, { body: [{ ...row, version: 'two' }] }]);
    const api = residentApi(client, TENANT, USER);
    expect(await api.latestIdSubmission(signal())).toEqual(row);
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe('/rest/v1/id_submissions');
    expect(params.get('resident_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('order')).toBe('version.desc');
    expect(params.get('limit')).toBe('1');
    expect(await api.latestIdSubmission(signal())).toBeNull();
    await expect(api.latestIdSubmission(signal())).rejects.toMatchObject({ kind: 'schema' });
  });
});
