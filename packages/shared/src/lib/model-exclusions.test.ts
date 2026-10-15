import { describe, expect, it } from 'vitest';
import { EMPTY_EXCLUSION_STATE, applyModelEvent, effectiveBlocks, type ExclusionState, type ModelEvent } from './model-exclusions.ts';

const T0 = Date.parse('2026-10-15T06:00:00Z');
const MIN = 60_000;

function revision(minutes: number, modelStatus: 'ok' | 'degraded' | 'unavailable', floodedEdgeIds: string[]): ModelEvent {
  return { kind: 'revision', evaluatedAt: T0 + minutes * MIN, modelStatus, floodedEdgeIds };
}

function run(events: ModelEvent[], start: ExclusionState = EMPTY_EXCLUSION_STATE): ExclusionState {
  return events.reduce((state, event) => applyModelEvent(state, event).state, start);
}

const summary = (state: ExclusionState) => state.exclusions.map(e => `${e.edgeId}:${e.state}`);

describe('applyModelEvent', () => {
  it('adds the edges of an accepted revision as active exclusions', () => {
    const { state, change } = applyModelEvent(EMPTY_EXCLUSION_STATE, revision(0, 'ok', ['b', 'a', 'a']));
    expect(summary(state)).toEqual(['a:active', 'b:active']);
    expect(change).toEqual({ outcome: 'applied', added: ['a', 'b'], heldOver: [], cleared: [] });
    expect(state.evaluatedAt).toBe(T0);
  });

  it('keeps exclusions as holdover restrictions when the model expires or fails', () => {
    const active = run([revision(0, 'ok', ['a', 'b'])]);
    const expired = applyModelEvent(active, { kind: 'expired' });
    expect(summary(expired.state)).toEqual(['a:holdover', 'b:holdover']);
    expect(expired.change.heldOver).toEqual(['a', 'b']);
    expect(expired.state.evaluatedAt).toBe(T0);

    const failed = applyModelEvent(active, revision(10, 'unavailable', []));
    expect(summary(failed.state)).toEqual(['a:holdover', 'b:holdover']);
    expect(failed.state.evaluatedAt).toBe(T0);
  });

  it('ignores an older or equal revision', () => {
    const state = run([revision(10, 'ok', ['a'])]);
    for (const late of [revision(10, 'ok', []), revision(5, 'ok', [])]) {
      const result = applyModelEvent(state, late);
      expect(result.change.outcome).toBe('ignored_not_newer');
      expect(result.state).toBe(state);
    }
  });

  it('lets a degraded revision add but never clear', () => {
    const state = run([revision(0, 'ok', ['a', 'b']), revision(10, 'degraded', ['b', 'c'])]);
    expect(summary(state)).toEqual(['a:holdover', 'b:active', 'c:active']);
  });

  it('re-activates a holdover edge that a newer revision flags again', () => {
    const state = run([revision(0, 'ok', ['a']), { kind: 'expired' }, revision(10, 'degraded', ['a'])]);
    expect(summary(state)).toEqual(['a:active']);
    expect(state.exclusions[0].since).toBe(T0 + 10 * MIN);
  });

  it('lets a complete newer revision clear its own exclusions, holdovers included', () => {
    const before = run([revision(0, 'ok', ['a', 'b']), { kind: 'expired' }]);
    const { state, change } = applyModelEvent(before, revision(10, 'ok', ['b']));
    expect(summary(state)).toEqual(['b:active']);
    expect(change.cleared).toEqual(['a']);
  });

  it('clears named exclusions only with a reviewer', () => {
    const state = run([revision(0, 'ok', ['a', 'b']), { kind: 'expired' }]);
    expect(applyModelEvent(state, { kind: 'clearance', reviewer: ' ', edgeIds: ['a'] }).change.outcome).toBe('ignored_no_reviewer');
    expect(applyModelEvent(state, { kind: 'clearance', reviewer: 'DRRM officer', edgeIds: ['zzz'] }).change.outcome).toBe('ignored_nothing_to_clear');
    const cleared = applyModelEvent(state, { kind: 'clearance', reviewer: 'DRRM officer', edgeIds: ['a', 'zzz'] });
    expect(summary(cleared.state)).toEqual(['b:holdover']);
    expect(cleared.change.cleared).toEqual(['a']);
  });

  it('never modifies the state it was given', () => {
    const state = run([revision(0, 'ok', ['a'])]);
    const copy = JSON.stringify(state);
    applyModelEvent(state, { kind: 'expired' });
    applyModelEvent(state, revision(10, 'ok', []));
    applyModelEvent(state, { kind: 'clearance', reviewer: 'x', edgeIds: ['a'] });
    expect(JSON.stringify(state)).toBe(copy);
  });
});

describe('effectiveBlocks', () => {
  it('keeps every reason, and a model clearance never reopens a closure or an avoidance mark', () => {
    const flagged = run([revision(0, 'ok', ['closed', 'avoided', 'model-only'])]);
    expect(effectiveBlocks(flagged, ['closed'], ['avoided'])).toEqual([
      { edgeId: 'avoided', reasons: ['avoidance', 'model_active'] },
      { edgeId: 'closed', reasons: ['closure', 'model_active'] },
      { edgeId: 'model-only', reasons: ['model_active'] },
    ]);

    const cleared = run([revision(10, 'ok', [])], flagged);
    expect(effectiveBlocks(cleared, ['closed'], ['avoided'])).toEqual([
      { edgeId: 'avoided', reasons: ['avoidance'] },
      { edgeId: 'closed', reasons: ['closure'] },
    ]);
  });

  it('labels holdover restrictions separately', () => {
    const held = run([revision(0, 'ok', ['a']), { kind: 'expired' }]);
    expect(effectiveBlocks(held, [], [])).toEqual([{ edgeId: 'a', reasons: ['model_holdover'] }]);
  });
});
