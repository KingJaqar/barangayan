import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../src/lib/format';

describe('relative announcement timestamps', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it('uses singular and plural units up to a week', () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe('Just now');
    expect(formatRelativeTime(ago(60_000), now)).toBe('1 minute ago');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(3_600_000), now)).toBe('1 hour ago');
    expect(formatRelativeTime(ago(23 * 3_600_000), now)).toBe('23 hours ago');
    expect(formatRelativeTime(ago(24 * 3_600_000), now)).toBe('1 day ago');
    expect(formatRelativeTime(ago(6 * 86_400_000), now)).toBe('6 days ago');
  });
  it('falls back to the calendar date after a week and handles bad or future input', () => {
    expect(formatRelativeTime(ago(8 * 86_400_000), now)).toMatch(/2026/);
    expect(formatRelativeTime('not a date', now)).toBe('Date unavailable');
    expect(formatRelativeTime(ago(-60_000), now)).toBe('Just now');
  });
});
