import { describe, expect, it } from 'vitest';

import { haversineDistanceMeters, sortByDistanceFrom } from './haversine';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 14.7006, lng: 121.1257 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 3);
  });

  it('computes a known distance: Manila to Cebu (~570km)', () => {
    const manila = { lat: 14.5995, lng: 120.9842 };
    const cebu = { lat: 10.3157, lng: 123.8854 };
    const km = haversineDistanceMeters(manila, cebu) / 1000;
    expect(km).toBeGreaterThan(560);
    expect(km).toBeLessThan(580);
  });

  it('computes a known short distance within ±0.1km tolerance', () => {
    // Two points roughly 1.1km apart (0.01 degree latitude ~ 1.11km at the equator-ish range).
    const a = { lat: 14.7006, lng: 121.1257 };
    const b = { lat: 14.7106, lng: 121.1257 };
    const km = haversineDistanceMeters(a, b) / 1000;
    expect(km).toBeGreaterThan(1.0);
    expect(km).toBeLessThan(1.2);
  });
});

describe('sortByDistanceFrom', () => {
  it('sorts candidates nearest-first', () => {
    const origin = { lat: 14.7, lng: 121.1 };
    const candidates = [
      { id: 'far', position: { lat: 15.5, lng: 121.9 } },
      { id: 'near', position: { lat: 14.701, lng: 121.101 } },
      { id: 'mid', position: { lat: 14.9, lng: 121.3 } },
    ];
    const sorted = sortByDistanceFrom(origin, candidates);
    expect(sorted.map((c) => c.id)).toEqual(['near', 'mid', 'far']);
    expect(sorted[0].distanceMeters).toBeLessThan(sorted[1].distanceMeters);
    expect(sorted[1].distanceMeters).toBeLessThan(sorted[2].distanceMeters);
  });
});
