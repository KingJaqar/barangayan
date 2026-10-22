import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));
import { readHouseholdRoster, readHouseholdAttendance, householdTime } from '../src/lib/household';

const id = 'aaaaaaaa-0000-4000-8000-000000000001';
const member = { id, name: 'Child', relation: 'Child' };
describe('resident household read boundaries', () => {
  it('keeps the exact expected JSON while parsing display fields', () => {
    const raw = [{ id: id.toUpperCase(), name: ' Child ', relation: ' Child ', role: null, legacy: true }];
    const parsed = readHouseholdRoster(raw);
    expect(parsed.raw).toBe(raw);
    expect(parsed.members).toEqual([{ id, name: 'Child', relation: 'Child', role: undefined }]);
    expect(parsed.raw).toEqual(raw);
  });
  it('supports null and zero-member existing rosters without changing the expected snapshot', () => {
    expect(readHouseholdRoster(null)).toEqual({ raw: null, members: [] });
    expect(readHouseholdRoster([]).members).toEqual([]);
  });
  it('allows 30 members and rejects 31', () => {
    const members = Array.from({ length: 31 }, (_, index) => ({ ...member,
      id: `aaaaaaaa-0000-4000-8000-${String(index).padStart(12, '0')}` }));
    expect(readHouseholdRoster(members.slice(0, 30)).members).toHaveLength(30);
    expect(() => readHouseholdRoster(members)).toThrow();
  });
  it.each([
    [{ name: 'No ID', relation: 'Child' }], [{ ...member, id: 'invalid' }],
    [{ ...member, name: ' ' }], [{ ...member, relation: '' }], [member, member],
    [{ ...member, role: 'x'.repeat(51) }], { roster: [] },
  ])('rejects malformed rosters without fabricating identities: %j', raw => {
    expect(() => readHouseholdRoster(raw)).toThrow();
  });
  it('validates household identity and attendance semantics before display', () => {
    const response = { household_profile_id: id, people: [{ kind: 'holder', member_id: null, name: 'Holder',
      relation: null, role: null, current_stay: null, latest_departure: null }] };
    expect(readHouseholdAttendance(response, id).people).toHaveLength(1);
    expect(() => readHouseholdAttendance(response, 'bbbbbbbb-0000-4000-8000-000000000001')).toThrow();
    expect(() => readHouseholdAttendance({ ...response, people: [] }, id)).toThrow();
  });
  it('formats UTC server timestamps in Asia/Manila', () => {
    expect(householdTime('2026-10-21T00:00:00Z')).toContain('8:00');
  });
});
