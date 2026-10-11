import { describe, expect, it } from 'vitest';
import { browseUrl, changeBrowseState, pageRange, parseBrowseState, PAGE_SIZES, queryIdentity, type BrowseConfig } from '../../src/lib/admin-tables/browse-state';
import { createQueryGate, createRefreshCoordinator } from '../../src/lib/admin-tables/browse-coordination';

const config: BrowseConfig = { defaultSort: 'name', filters: { tab: { values: ['all', 'active'], defaultValue: 'active' } },
  sorts: [{ key: 'name', label: 'Name', category: 'text', directions: ['asc', 'desc'], initialDirection: 'asc' },
    { key: 'created', label: 'Date created', category: 'date', directions: ['asc', 'desc'], initialDirection: 'desc' }] };
const parse = (search = '') => parseBrowseState(new URLSearchParams(search), config);
describe('validated browsing contracts', () => {
  it('rejects malformed and unsafe URL state', () => {
    for (const page of ['0', '-1', '1.5', 'Infinity', '9007199254740992', '1e2']) expect(parse(`page=${page}`).page).toBe(1);
    expect(parse('pageSize=999&sort=sql&dir=oops&tab=private')).toEqual(parse());
    expect(() => browseUrl('javascript:alert(1)', '', parse(), config)).toThrow();
    expect(() => browseUrl('//outside', '', parse(), config)).toThrow();
  });
  it('resets all immediate changes atomically while page-only changes retain state', () => {
    const state = parse('page=3&q=hello&tab=all');
    for (const change of [{ q: 'new' }, { filters: { tab: 'active' } }, { sort: 'created' }, { dir: 'desc' as const }, { pageSize: 100 as const }]) {
      expect(changeBrowseState(state, change, config).page).toBe(1);
    }
    expect(changeBrowseState(state, { page: 2 }, config)).toEqual({ ...state, page: 2 });
    expect(changeBrowseState(state, { sort: 'created' }, config).dir).toBe('desc');
    expect(browseUrl('/fixture', 'extra=kept', state, config)).toContain('extra=kept');
  });
  it('has a canonical query identity independent of filter insertion order', () => {
    expect(queryIdentity({ ...parse(), filters: { a: '1', b: '2' } }))
      .toBe(queryIdentity({ ...parse(), filters: { b: '2', a: '1' } }));
  });
  for (const total of [0, 1, 7, 10, 11, 23, 100, 101, 1505]) for (const size of PAGE_SIZES) {
    it(`ranges ${total} results at ${size} per page`, () => {
      const last = pageRange(total, Number.MAX_SAFE_INTEGER, size);
      expect(last.end).toBe(total);
      expect(last.pages).toBe(Math.max(1, Math.ceil(total / size)));
      expect(last.start).toBe(total === 0 ? 0 : (last.page - 1) * size + 1);
    });
  }
  it('rejects delayed and disposed query commits', () => {
    const gate = createQueryGate();
    const old = gate.begin('old'), next = gate.begin('new');
    expect(gate.isCurrent(old, 'old')).toBe(false);
    expect(gate.isCurrent(next, 'new')).toBe(true);
    gate.dispose(); expect(gate.isCurrent(next, 'new')).toBe(false);
  });
  it('defers edits, coalesces bursts and stops on dispose', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const coordinator = createRefreshCoordinator(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); }, () => {});
    coordinator.setEditing(true);
    for (let i = 0; i < 30; i++) coordinator.request();
    expect(calls).toBe(0); coordinator.setEditing(false); expect(calls).toBe(1);
    for (let i = 0; i < 30; i++) coordinator.request();
    release(); await Promise.resolve(); await Promise.resolve(); expect(calls).toBe(2);
    coordinator.dispose(); release(); await Promise.resolve(); coordinator.request(); expect(calls).toBe(2);
  });
  it('does not retry a failed refresh', async () => {
    let calls = 0, errors = 0;
    const coordinator = createRefreshCoordinator(async () => { calls++; throw new Error('fixture'); }, () => { errors++; });
    coordinator.request(); coordinator.request(); await Promise.resolve(); await Promise.resolve();
    expect(calls).toBe(1); expect(errors).toBe(1);
  });
});
