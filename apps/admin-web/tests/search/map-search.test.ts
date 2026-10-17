import { describe, expect, it } from 'vitest';
import { matchesMapQuery } from '../../src/app/(admin)/incident-map/map-search';

describe('map search matching', () => {
  it('matches tokens across the title, address, and reporter instead of requiring a single phrase', () => {
    expect(matchesMapQuery(['Blocked drainage', 'General Luna Street', 'Maria Santos'], ' LUNA   maria drainage ')).toBe(true);
    expect(matchesMapQuery(['Blocked drainage', 'General Luna Street', 'Maria Santos'], 'Luna fire')).toBe(false);
  });

  it('treats punctuation as literal text and handles missing fields', () => {
    expect(matchesMapQuery([null, undefined, 'Court (Phase 2)'], '(phase 2)')).toBe(true);
    expect(matchesMapQuery(['Court Phase 2'], '.*')).toBe(false);
  });

  it('keeps all markers when the query is empty and supports center addresses', () => {
    expect(matchesMapQuery([], '  ')).toBe(true);
    expect(matchesMapQuery(['Ampid Elementary School', 'General Luna Street'], 'school luna')).toBe(true);
  });
});
