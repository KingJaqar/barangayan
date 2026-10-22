import { describe, expect, it } from 'vitest';
import { centerOccupancy } from './center-presentation';

describe('truthful center occupancy', () => {
  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('does not promise space for unknown capacity %s', capacity => {
    expect(centerOccupancy(0, capacity)).toMatchObject({ percent: null, fill: 0, label: 'Capacity unknown' });
  });
  it('keeps almost-full, full and over-capacity states distinct', () => {
    expect(centerOccupancy(999, 1000)).toMatchObject({ percent: 99, tone: 'warning' });
    expect(centerOccupancy(1000, 1000)).toMatchObject({ percent: 100, fill: 100, tone: 'danger' });
    expect(centerOccupancy(1200, 1000)).toMatchObject({ percent: 120, fill: 100, tone: 'danger' });
    expect(centerOccupancy(0, 1000)).toMatchObject({ percent: 0, tone: 'success' });
  });
});
