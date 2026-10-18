import { describe, expect, it } from 'vitest';
import { cleanHistory, createSearchHistoryStore, searchSuggestions, SEARCH_HISTORY_LIMIT } from './search-history';

function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value); } };
  return { data, storage, store: createSearchHistoryStore(storage) };
}

describe('resident account search history', () => {
  it('persists across store restarts and isolates accounts', async () => {
    const { store, storage } = fixture();
    await store.remember('alice', 'Clearance');
    await store.remember('bob', 'Medical');
    const reopened = createSearchHistoryStore(storage);
    expect(await reopened.load('alice')).toEqual(['Clearance']);
    expect(await reopened.load('bob')).toEqual(['Medical']);
  });
  it('serializes hydration and rapid edits without losing searches or resurrecting removals', async () => {
    const { store } = fixture();
    await Promise.all([store.load('alice'), store.remember('alice', 'First'), store.remember('alice', 'Second'), store.remember('alice', ' FIRST '), store.remove('alice', 'second')]);
    expect(await store.load('alice')).toEqual(['FIRST']);
    await Promise.all([store.remember('alice', 'Third'), store.clear('alice')]);
    expect(await store.load('alice')).toEqual([]);
  });
  it('bounds, normalizes, and deduplicates stored history', async () => {
    expect(cleanHistory([null, {}, ' % ', '  Clearance\n  form ', 'clearance form', 'a'.repeat(200)])).toEqual(['Clearance form', 'a'.repeat(120)]);
    const { store } = fixture();
    for (let i = 0; i < 25; i++) await store.remember('alice', `Query ${i}`);
    const history = await store.load('alice');
    expect(history).toHaveLength(SEARCH_HISTORY_LIMIT);
    expect(history[0]).toBe('Query 24');
  });
  it('recovers corrupt saved data and allows retry after storage failure', async () => {
    const { data, store, storage } = fixture();
    data.set('resident_search_history_v1:alice', '{broken');
    expect(await store.load('alice')).toEqual([]);
    const failing = createSearchHistoryStore({ ...storage, setItem: async () => { throw new Error('disk'); } });
    await expect(failing.remember('alice', 'Clearance')).rejects.toThrow('disk');
    await store.remember('alice', 'Clearance');
    expect(await store.load('alice')).toEqual(['Clearance']);
  });
  it('prioritizes matching recents, deduplicates titles, excludes the current query, and limits suggestions', () => {
    expect(searchSuggestions('clear', ['My clearance', 'Health'], ['My Clearance', 'Barangay clearance', 'clear'])).toEqual([
      { label: 'My clearance', recent: true }, { label: 'Barangay clearance', recent: false },
    ]);
    expect(searchSuggestions('', [], []).length).toBe(6);
    expect(searchSuggestions('unmatched', ['Health'], ['Clearance'])).toEqual([]);
  });
});
