/**
 * Model exclusions, holdover restrictions and explicit clearance (DRRM weather-routing plan,
 * phase R9a; plan section 4, "Aging and model failure").
 *
 * - A model result never silently removes a previously compiled exclusion because it expired
 *   or failed: those edges stay blocked as *holdover* restrictions, labelled separately.
 * - Only an accepted *complete* newer revision (`ok`) replaces the exclusions, and it clears
 *   only model exclusions: it can never reopen a verified closure or a resident avoidance mark.
 * - A reviewer may clear named edges explicitly.
 *
 * Pure and import-free. State persistence and the stage-4 switch belong to the activation
 * work that needs the PAGASA/DEM inputs; this module is the verified logic they will use.
 */

export interface ModelExclusion {
  edgeId: string;
  /** Evaluation time (ms) of the run that last flagged this edge. */
  since: number;
  /** active: flagged by the newest accepted run; holdover: kept after expiry or failure. */
  state: 'active' | 'holdover';
}

export interface ExclusionState {
  /** Evaluation time (ms) of the newest accepted revision; 0 before any. */
  evaluatedAt: number;
  /** Sorted by edge id. */
  exclusions: readonly ModelExclusion[];
}

export const EMPTY_EXCLUSION_STATE: ExclusionState = Object.freeze({ evaluatedAt: 0, exclusions: Object.freeze([]) });

export type ModelEvent =
  | {
      kind: 'revision';
      evaluatedAt: number;
      /** `unavailable` carries no extent and is treated like an expiry. */
      modelStatus: 'ok' | 'degraded' | 'unavailable';
      /** Edges flagged flooded by BFS (road compilation, plan 3.4). */
      floodedEdgeIds: readonly string[];
    }
  | { kind: 'expired' }
  | { kind: 'clearance'; reviewer: string; edgeIds: readonly string[] };

export type EventOutcome =
  | 'applied'
  | 'ignored_not_newer'
  | 'ignored_no_reviewer'
  | 'ignored_nothing_to_clear';

export interface ExclusionChange {
  outcome: EventOutcome;
  added: string[];
  heldOver: string[];
  cleared: string[];
}

function byEdgeId(a: ModelExclusion, b: ModelExclusion): number {
  return a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0;
}

function toState(evaluatedAt: number, map: Map<string, ModelExclusion>): ExclusionState {
  return { evaluatedAt, exclusions: [...map.values()].sort(byEdgeId) };
}

/** Applies one event and reports what changed. The input state is never modified. */
export function applyModelEvent(state: ExclusionState, event: ModelEvent): { state: ExclusionState; change: ExclusionChange } {
  const current = new Map(state.exclusions.map(e => [e.edgeId, e]));
  const change: ExclusionChange = { outcome: 'applied', added: [], heldOver: [], cleared: [] };

  const expire = (): { state: ExclusionState; change: ExclusionChange } => {
    for (const [id, e] of current) {
      if (e.state === 'active') {
        current.set(id, { ...e, state: 'holdover' });
        change.heldOver.push(id);
      }
    }
    change.heldOver.sort();
    return { state: toState(state.evaluatedAt, current), change };
  };

  if (event.kind === 'expired') return expire();

  if (event.kind === 'clearance') {
    if (event.reviewer.trim() === '') return { state, change: { ...change, outcome: 'ignored_no_reviewer' } };
    for (const id of [...new Set(event.edgeIds)].sort()) {
      if (current.delete(id)) change.cleared.push(id);
    }
    if (change.cleared.length === 0) return { state, change: { ...change, outcome: 'ignored_nothing_to_clear' } };
    return { state: toState(state.evaluatedAt, current), change };
  }

  // A revision. An older or equal evaluation never replaces a newer one.
  if (!(event.evaluatedAt > state.evaluatedAt)) return { state, change: { ...change, outcome: 'ignored_not_newer' } };
  if (event.modelStatus === 'unavailable') return expire();

  const flooded = [...new Set(event.floodedEdgeIds)].sort();
  const floodedSet = new Set(flooded);
  if (event.modelStatus === 'ok') {
    // A complete revision replaces everything the model said before, holdovers included.
    for (const [id] of current) {
      if (!floodedSet.has(id)) {
        current.delete(id);
        change.cleared.push(id);
      }
    }
    change.cleared.sort();
  } else {
    // A degraded revision only adds: unknown inputs cannot justify clearing a block.
    for (const [id, e] of current) {
      if (!floodedSet.has(id) && e.state === 'active') {
        current.set(id, { ...e, state: 'holdover' });
        change.heldOver.push(id);
      }
    }
    change.heldOver.sort();
  }
  for (const id of flooded) {
    if (!current.has(id)) change.added.push(id);
    current.set(id, { edgeId: id, since: event.evaluatedAt, state: 'active' });
  }
  return { state: toState(event.evaluatedAt, current), change };
}

export type BlockReason = 'closure' | 'avoidance' | 'model_active' | 'model_holdover';

export interface EffectiveBlock {
  edgeId: string;
  /** Every reason this edge is blocked; a closure or avoidance reason can never be cleared by the model. */
  reasons: BlockReason[];
}

/**
 * Union of verified closures, local avoidance and model exclusions with every reason kept.
 * Clearing a model exclusion cannot unblock an edge that a closure or avoidance mark blocks.
 */
export function effectiveBlocks(
  state: ExclusionState,
  closedEdgeIds: readonly string[],
  avoidedEdgeIds: readonly string[],
): EffectiveBlock[] {
  const reasons = new Map<string, Set<BlockReason>>();
  const add = (id: string, reason: BlockReason): void => {
    const set = reasons.get(id) ?? new Set<BlockReason>();
    set.add(reason);
    reasons.set(id, set);
  };
  closedEdgeIds.forEach(id => add(id, 'closure'));
  avoidedEdgeIds.forEach(id => add(id, 'avoidance'));
  for (const e of state.exclusions) add(e.edgeId, e.state === 'active' ? 'model_active' : 'model_holdover');
  const order: BlockReason[] = ['closure', 'avoidance', 'model_active', 'model_holdover'];
  return [...reasons.keys()]
    .sort()
    .map(edgeId => ({ edgeId, reasons: order.filter(r => reasons.get(edgeId)?.has(r)) }));
}
