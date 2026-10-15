import { describe, expect, it } from 'vitest';
import { hasStructuredName, ownedAvatarPath, profileFailure, profileSaveSchema } from '../../src/lib/admin-profile/schema';

describe('admin profile boundaries', () => {
  const expected = '2026-10-14T06:00:00.123456+00:00';
  it('rejects target identity, lifecycle, address and resident data injection', () => {
    for (const field of ['id', 'barangay_id', 'role', 'deleted_at', 'first_name', 'home_address', 'email_verified_at', 'household_members']) {
      expect(profileSaveSchema.safeParse({ expected, patch: { email: 'a@example.test', [field]: 'injected' } }).success).toBe(false);
    }
    expect(profileSaveSchema.safeParse({ expected, patch: { email: 'a@example.test' }, id: 'target' }).success).toBe(false);
  });
  it('accepts optional field clearing without inventing empty values', () => {
    expect(profileSaveSchema.parse({ expected, patch: { email: null, mobile_number: null, avatar_url: null } }).patch).toEqual({ email: null, mobile_number: null, avatar_url: null });
  });
  it('validates names, contact formats and version boundaries', () => {
    for (const patch of [{}, { full_name: '  ' }, { full_name: 'a'.repeat(151) }, { email: 'invalid' }, { email: '' }, { mobile_number: '123' }, { avatar_url: 'javascript:alert(1)' }]) {
      expect(profileSaveSchema.safeParse({ expected, patch }).success).toBe(false);
    }
    expect(profileSaveSchema.safeParse({ expected: 'not-a-version', patch: { full_name: 'Admin' } }).success).toBe(false);
    expect(profileSaveSchema.parse({ expected, patch: { full_name: '  Legacy Admin  ', mobile_number: '09171234567' } }).patch.full_name).toBe('Legacy Admin');
  });
  it('never guesses structured name parts', () => {
    expect(hasStructuredName({ first_name: null, last_name: null, middle_name: null, suffix: null })).toBe(false);
    expect(hasStructuredName({ first_name: null, last_name: null, middle_name: 'Given', suffix: null })).toBe(true);
  });
  it('permits owned avatar objects only on the configured project origin', () => {
    const id = 'b1190000-0000-0000-0000-000000000001';
    const name = 'd1190000-0000-0000-0000-000000000001.webp';
    const base = 'https://project.example';
    const url = `${base}/storage/v1/object/public/profile-photos/${id}/${name}`;
    expect(ownedAvatarPath(url, id, base)).toBe(`${id}/${name}`);
    expect(ownedAvatarPath(url.replace(name, 'avatar.jpg'), id, base)).toBe(`${id}/avatar.jpg`);
    for (const invalid of [url.replace(base, 'https://other.example'), url.replace(base, 'https://user:pass@project.example'), `${url}?token=x`, `${url}#x`, url.replace(id, 'other-owner'), url.replace(name, 'folder/photo.webp'), url.replace(name, '../photo.webp'), 'javascript:alert(1)']) expect(ownedAvatarPath(invalid, id, base)).toBeNull();
  });
  it('returns safe actionable outcomes without database details', () => {
    expect(profileFailure('40001')).toMatchObject({ ok: false, code: 'conflict' });
    expect(profileFailure('42501')).toMatchObject({ ok: false, code: 'access' });
    expect(profileFailure('PT429')).toMatchObject({ ok: false, code: 'rate_limit' });
    expect(profileFailure('XX000')).toMatchObject({ ok: false, code: 'unavailable' });
  });
});
