import { describe, expect, it } from 'vitest';
import { matchesMapSearch } from '../src/components/maps/map-search';

describe('map search', () => {
  const fields = ['Broken lamp', '12 Mabini Street', 'Damaged Street Light'];
  it('matches words across title, address and category in any order', () => {
    expect(matchesMapSearch('  MABINI   lamp damaged ', fields)).toBe(true);
    expect(matchesMapSearch('damaged flooding', fields)).toBe(false);
  });
  it('handles accents, missing fields and empty queries', () => {
    expect(matchesMapSearch('nino', ['Santo Niño', null])).toBe(true);
    expect(matchesMapSearch('  ', [null, undefined])).toBe(true);
    expect(matchesMapSearch('center', [null, undefined])).toBe(false);
  });
  it('treats punctuation as literal text', () => {
    expect(matchesMapSearch('.*', fields)).toBe(false);
    expect(matchesMapSearch('(annex)', ['Ampid (Annex)'])).toBe(true);
  });
});
