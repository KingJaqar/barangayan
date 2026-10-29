import { describe, expect, it } from 'vitest';
import { announcementDateTimeInput, announcementDateTimeIso } from '../../src/lib/announcement-datetime';

describe('Publisher local time conversion', () => {
  it.each(['2026-02-30T10:00', '2026-13-01T10:00', '2026-10-28T25:00', '0000-01-01T00:00', 'not-a-date', ''])('rejects %s', value => {
    expect(announcementDateTimeIso(value)).toBeNull();
  });
  it('round trips a stored expiry without losing seconds or milliseconds', () => {
    const original = '2026-10-28T04:30:15.123Z';
    expect(announcementDateTimeIso(announcementDateTimeInput(original))).toBe(original);
  });
  it('handles empty/invalid stored input without throwing', () => {
    expect(announcementDateTimeInput(null)).toBe('');
    expect(announcementDateTimeInput('not-a-date')).toBe('');
  });
});
