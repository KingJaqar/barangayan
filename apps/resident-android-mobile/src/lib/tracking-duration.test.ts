import { describe, expect, it } from 'vitest';
import { trackingDuration } from './tracking-duration';

describe('tracking duration presentation', () => {
  it.each([
    [0, 'Less than a minute'], [59.9, 'Less than a minute'], [60, '1 min'],
    [3599, '59 min'], [3600, '1 hr'], [3661, '1 hr 1 min'],
    [86400, '1 day'], [259757, '3 days 9 min'], [604800, '7 days'],
  ])('summarizes %s seconds without a raw clock', (seconds, label) => {
    expect(trackingDuration(seconds)).toBe(label);
  });
  it('preserves every duration unit in exact details', () => {
    expect(trackingDuration(262861.9, true)).toBe('3 days, 1 hour, 1 minute, 1 second');
    expect(trackingDuration(0, true)).toBe('0 seconds');
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('handles invalid input %s', seconds => {
    expect(trackingDuration(seconds)).toBe('Less than a minute');
    expect(trackingDuration(seconds, true)).toBe('0 seconds');
  });
});
