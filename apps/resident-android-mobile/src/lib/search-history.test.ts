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
    const { data, store } = fixture();
    for (let i = 0; i < 25; i++) await store.remember('alice', `Query ${i}`);
    const history = await store.load('alice');
    expect(SEARCH_HISTORY_LIMIT).toBe(10);
    expect(history).toEqual(Array.from({ length: 10 }, (_, i) => `Query ${24 - i}`));
    expect(JSON.parse(data.get('resident_search_history_v1:alice') ?? '')).toEqual(history);
  });
  it('promotes a repeated query case-insensitively without duplicating it', async () => {
    const { store } = fixture();
    for (const query of ['Clearance', 'Health', 'Permit']) await store.remember('alice', query);
    expect(await store.remember('alice', ' CLEARANCE ')).toEqual(['CLEARANCE', 'Permit', 'Health']);
  });
  it('migrates saves above the limit to the 10 newest on load, and the protected fixture restores exactly', async () => {
    const { data, store } = fixture();
    const legacy = ['Newest', 'newest', ...Array.from({ length: 18 }, (_, i) => `Legacy ${i}`)];
    data.set('resident_search_history_v1:alice', JSON.stringify(legacy));
    data.set('resident_search_history_v1:bob', JSON.stringify(['Bob only']));
    const preimage = new Map(data);
    const expected = ['Newest', ...Array.from({ length: 9 }, (_, i) => `Legacy ${i}`)];
    expect(await store.load('alice')).toEqual(expected);
    expect(JSON.parse(data.get('resident_search_history_v1:alice') ?? '')).toEqual(expected);
    expect(data.get('resident_search_history_v1:bob')).toBe(preimage.get('resident_search_history_v1:bob'));
    // Restore the isolated fixture's preimage and prove it is identical before reuse.
    for (const [key, value] of preimage) data.set(key, value);
    expect(new Map(data)).toEqual(preimage);
    expect(JSON.parse(data.get('resident_search_history_v1:alice') ?? '')).toHaveLength(20);
  });
  it('keeps new entries and deletions when edits race a migrating hydration', async () => {
    const { data, store } = fixture();
    data.set('resident_search_history_v1:alice', JSON.stringify(Array.from({ length: 15 }, (_, i) => `Old ${i}`)));
    const [hydrated] = await Promise.all([store.load('alice'), store.remember('alice', 'Fresh'), store.remove('alice', 'old 0'), store.load('bob')]);
    expect(hydrated).toHaveLength(10);
    // Fresh displaces the oldest kept entry (Old 9) before Old 0 is removed.
    expect(await store.load('alice')).toEqual(['Fresh', ...Array.from({ length: 8 }, (_, i) => `Old ${i + 1}`)]);
    expect(await store.load('bob')).toEqual([]);
  });
  it('recovers corrupt saved data and allows retry after storage failure', async () => {
    const { data, store, storage } = fixture();
    data.set('resident_search_history_v1:alice', '{broken');
    expect(await store.load('alice')).toEqual([]);
    expect(data.get('resident_search_history_v1:alice')).toBe('[]');
    data.set('resident_search_history_v1:alice', JSON.stringify(Array.from({ length: 12 }, (_, i) => `Q${i}`)));
    const readOnly = createSearchHistoryStore({ ...storage, setItem: async () => { throw new Error('disk'); } });
    expect(await readOnly.load('alice')).toHaveLength(10);
    await expect(createSearchHistoryStore({ ...storage, getItem: async () => { throw new Error('read'); } }).load('alice')).rejects.toThrow('read');
    data.delete('resident_search_history_v1:alice');
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
