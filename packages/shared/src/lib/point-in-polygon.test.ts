import { describe, expect, it } from 'vitest';

import { isPointInPolygon } from './point-in-polygon';

// A simple 4x4 square: (0,0) (0,4) (4,4) (4,0), GeoJSON [lng, lat] order.
const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
      [0, 0],
    ],
  ],
};

describe('isPointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(isPointInPolygon({ lat: 2, lng: 2 }, SQUARE)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(isPointInPolygon({ lat: 10, lng: 10 }, SQUARE)).toBe(false);
  });

  it('returns false for a point on the opposite side', () => {
    expect(isPointInPolygon({ lat: -2, lng: -2 }, SQUARE)).toBe(false);
  });

  it('handles a MultiPolygon by checking every member polygon', () => {
    const multi = {
      type: 'MultiPolygon' as const,
      coordinates: [
        SQUARE.coordinates,
        [
          [
            [10, 10],
            [10, 14],
            [14, 14],
            [14, 10],
            [10, 10],
          ],
        ],
      ],
    };
    expect(isPointInPolygon({ lat: 2, lng: 2 }, multi)).toBe(true);
    expect(isPointInPolygon({ lat: 12, lng: 12 }, multi)).toBe(true);
    expect(isPointInPolygon({ lat: 20, lng: 20 }, multi)).toBe(false);
  });
});
