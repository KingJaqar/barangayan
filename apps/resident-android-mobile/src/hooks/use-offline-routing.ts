import * as Crypto from 'expo-crypto';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  ROUTING_AREA_ID,
  STORE_FILES,
  acceptConditions,
  activatePack,
  addAvoidance,
  openStore,
  serializeAvoidance,
  type ActivationDeferral,
  type AddAvoidanceResult,
  type LoadedPack,
  type LocalAvoidanceRecord,
  type OpenedStore,
  type PackRejection,
  type PackRepair,
  type RoutingStoreState,
  type StoredConditions,
} from '@/lib/offline-routing';
import { bundledAmpidPack, bundledAmpidPackVersion, documentRoutingStorage } from '@/lib/offline-routing-storage';
import { supabase } from '@/lib/supabase';

/** Plan section 4: conditions requests have an 8 s deadline and refresh every 30 s while visible, backing off to 5 minutes. */
const CONDITIONS_DEADLINE_MS = 8_000;
const REFRESH_INTERVAL_MS = 30_000;
const MAX_REFRESH_INTERVAL_MS = 300_000;

export interface OfflineRoutingState {
  phase: 'loading' | 'ready' | 'failed';
  pack: LoadedPack | null;
  packProblem: PackRejection | null;
  repair: PackRepair;
  avoidance: LocalAvoidanceRecord[];
  unresolvedAvoidanceIds: string[];
  avoidanceUnreadable: boolean;
  conditions: StoredConditions | null;
  /** Consecutive failed conditions requests; 0 after a success. */
  conditionsFailures: number;
  /** When this session last reached the conditions service. */
  conditionsCheckedAt: number | null;
  /** A bundled graph that could not be activated yet; the current pack stays active. */
  pendingUpdate: { graphVersion: string; reason: ActivationDeferral } | null;
}

const INITIAL: OfflineRoutingState = {
  phase: 'loading',
  pack: null,
  packProblem: null,
  repair: 'none',
  avoidance: [],
  unresolvedAvoidanceIds: [],
  avoidanceUnreadable: false,
  conditions: null,
  conditionsFailures: 0,
  conditionsCheckedAt: null,
  pendingUpdate: null,
};

async function fetchSnapshot(graphVersion: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONDITIONS_DEADLINE_MS);
  try {
    const { data, error } = await supabase
      .rpc('get_routing_conditions_snapshot', { p_area_id: ROUTING_AREA_ID, p_graph_version: graphVersion })
      .abortSignal(controller.signal);
    if (error) throw error;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One store per app process, shared by the Centers tab and the public emergency screen.
 * Storage operations run one at a time so a refresh, an activation and a new mark never
 * interleave their writes.
 */
class OfflineRoutingController {
  private state: OfflineRoutingState = INITIAL;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private storage = documentRoutingStorage(ROUTING_AREA_ID);
  private storeState: RoutingStoreState | null = null;
  private started = false;
  private refreshing: Promise<boolean> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<OfflineRoutingState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.run(async () => {
      let opened: OpenedStore;
      try {
        opened = await openStore({ storage: this.storage, areaId: ROUTING_AREA_ID, bundled: bundledAmpidPack, now: () => new Date() });
      } catch {
        this.set({ phase: 'failed' });
        return;
      }
      this.storeState = opened.state;
      this.set({
        phase: opened.pack === null ? 'failed' : 'ready',
        pack: opened.pack,
        packProblem: opened.packProblem,
        repair: opened.repair,
        avoidance: opened.avoidance,
        unresolvedAvoidanceIds: opened.unresolvedAvoidanceIds,
        avoidanceUnreadable: opened.avoidanceUnreadable,
        conditions: opened.conditions,
      });
    });
  }

  /** Activates the bundled graph when it differs from the active one and its restrictions map. */
  private async upgradeFromBundle(): Promise<void> {
    const { pack, avoidance, conditions } = this.state;
    if (pack === null || this.storeState === null) return;
    const bundledVersion = bundledAmpidPackVersion();
    if (bundledVersion === null || bundledVersion === pack.graph.version) {
      if (this.state.pendingUpdate !== null) this.set({ pendingUpdate: null });
      return;
    }
    const candidate = bundledAmpidPack();
    const result = await activatePack({
      storage: this.storage,
      areaId: ROUTING_AREA_ID,
      state: this.storeState,
      candidate,
      current: pack,
      avoidance,
      conditions,
      fetchConditions: fetchSnapshot,
      now: () => new Date(),
    });
    if (result.status === 'activated') {
      this.storeState = result.state;
      this.set({ pack: result.pack, avoidance: result.avoidance, unresolvedAvoidanceIds: result.unresolvedAvoidanceIds, conditions: result.conditions, pendingUpdate: null });
    } else if (result.status === 'deferred') {
      this.set({ pendingUpdate: { graphVersion: bundledVersion, reason: result.reason }, unresolvedAvoidanceIds: result.unresolvedAvoidanceIds.length > 0 ? result.unresolvedAvoidanceIds : this.state.unresolvedAvoidanceIds });
    }
  }

  /**
   * Downloads the conditions snapshot for the active graph and stores it when it is valid and
   * not older than the stored one. Resolves to whether the service answered.
   */
  refreshConditions(): Promise<boolean> {
    this.refreshing ??= this.run(async () => {
      const pack = this.state.pack;
      if (pack === null) return false;
      try {
        await this.upgradeFromBundle();
        const active = this.state.pack ?? pack;
        const raw = await fetchSnapshot(active.graph.version);
        const accepted = acceptConditions(this.state.conditions, raw, ROUTING_AREA_ID, active.graph.version, new Date());
        if (accepted.ok) {
          const previous = this.state.conditions;
          // An unchanged revision only refreshes the check time; keeping the snapshot object
          // means the route is not recomputed (and the map not re-fitted) on every refresh.
          const unchanged =
            previous !== null &&
            previous.snapshot.graphVersion === accepted.stored.snapshot.graphVersion &&
            previous.snapshot.revision === accepted.stored.snapshot.revision;
          const stored = unchanged ? { ...accepted.stored, snapshot: previous.snapshot } : accepted.stored;
          await this.storage.writeText(STORE_FILES.conditions, JSON.stringify(stored));
          this.set({ conditions: stored });
        } else if (accepted.reason !== 'older') {
          throw new Error(`conditions ${accepted.reason}`);
        }
        this.set({ conditionsFailures: 0, conditionsCheckedAt: Date.now() });
        return true;
      } catch {
        this.set({ conditionsFailures: this.state.conditionsFailures + 1 });
        return false;
      }
    }).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  markSegment(edgeId: string): Promise<AddAvoidanceResult> {
    return this.run(async () => {
      const pack = this.state.pack;
      if (pack === null) return { ok: false, reason: 'unknown_segment' } as const;
      const result = addAvoidance(this.state.avoidance, pack.graph, edgeId, Crypto.randomUUID(), new Date());
      if (!result.ok) return result;
      await this.storage.writeText(STORE_FILES.avoidance, serializeAvoidance(result.records));
      this.set({ avoidance: result.records });
      return result;
    });
  }

  /** Explicit removal by the resident; never removes a verified closure. */
  unmarkSegment(recordId: string): Promise<void> {
    return this.run(async () => {
      const records = this.state.avoidance.filter(record => record.id !== recordId);
      await this.storage.writeText(STORE_FILES.avoidance, serializeAvoidance(records));
      this.set({ avoidance: records, unresolvedAvoidanceIds: this.state.unresolvedAvoidanceIds.filter(id => id !== recordId) });
    });
  }
}

const offlineRouting = new OfflineRoutingController();

/**
 * Durable offline routing data (plan R6). The store opens on first use; while `active` (the
 * Centers view is on screen and the app is in the foreground) conditions refresh every 30 s,
 * backing off to 5 minutes after failures.
 */
export function useOfflineRouting(active: boolean) {
  const state = useSyncExternalStore(offlineRouting.subscribe, offlineRouting.getState);
  const ready = state.phase === 'ready';

  useEffect(() => {
    offlineRouting.start();
  }, []);

  useEffect(() => {
    if (!active || !ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = (delay: number) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };
    async function tick() {
      timer = null;
      if (stopped || AppState.currentState !== 'active') return;
      const ok = await offlineRouting.refreshConditions();
      if (stopped) return;
      const failures = offlineRouting.getState().conditionsFailures;
      schedule(ok ? REFRESH_INTERVAL_MS : Math.min(MAX_REFRESH_INTERVAL_MS, REFRESH_INTERVAL_MS * 2 ** failures));
    }

    void tick();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && timer === null) void tick();
      else if (next === 'background' && timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    });
    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [active, ready]);

  return {
    state,
    refreshConditions: () => offlineRouting.refreshConditions(),
    markSegment: (edgeId: string) => offlineRouting.markSegment(edgeId),
    unmarkSegment: (recordId: string) => offlineRouting.unmarkSegment(recordId),
  };
}
