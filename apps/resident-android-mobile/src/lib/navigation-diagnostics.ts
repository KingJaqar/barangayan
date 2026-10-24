/** Temporary Phase 0 diagnostics. Recording is off until started in a development build. */
const CAPACITY = 8192;
export const navigationDiagnosticsAvailable = typeof __DEV__ !== 'undefined' && __DEV__;
type Route = 'home' | 'services' | 'drrm' | 'maps' | 'health' | 'reports' | 'other';
type Owner = Route | 'map' | 'sla-compact' | 'sla-full';
type EventKind = 'start' | 'stop' | 'press' | 'listeners-end' | 'dispatch-end' | 'prevented' | 'selected' | 'focus' | 'blur' | 'commit' | 'mount' | 'unmount' | 'request-start' | 'request-end' | 'request-error' | 'map-send' | 'map-ready' | 'map-load' | 'sla-tick' | 'sla-poll';
type Detail = { durationMs?: number; count?: number; code?: number; phase?: 'mount' | 'update' | 'nested-update'; message?: string };
interface Sample extends Detail { atMs: number; kind: EventKind; owner: Owner; navigationId: number; operationId?: number; }

const owners: Partial<Record<Owner, number>> = {};
let samples: Sample[] = [];
let nextSlot = 0;
let dropped = 0;
let active = false;
let generation = 0;
let navigationId = 0;
let operationId = 0;
let startedAt = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let restoreFetch: (() => void) | undefined;
let counts: Partial<Record<EventKind, number>> = {};

export function diagnosticRoute(name: string | undefined): Route {
  switch (name) {
    case 'home': case 'services': case 'drrm': case 'maps': case 'health': case 'reports': return name;
    default: return 'other';
  }
}

export function recordNavigationDiagnostic(kind: EventKind, owner: Owner, detail: Detail = {}, id?: number) {
  if (!navigationDiagnosticsAvailable || !active) return;
  const sample: Sample = { atMs: performance.now() - startedAt, kind, owner, navigationId, ...detail, ...(id === undefined ? {} : { operationId: id }) };
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (samples.length < CAPACITY) samples.push(sample);
  else { samples[nextSlot] = sample; nextSlot = (nextSlot + 1) % CAPACITY; dropped++; }
}

export function beginDiagnosticNavigation(name: string): number | undefined {
  if (!navigationDiagnosticsAvailable || !active) return;
  navigationId++;
  recordNavigationDiagnostic('press', diagnosticRoute(name));
  return navigationId;
}

/** Counts live owners even when capture starts after screens/cards have mounted. No private IDs. */
export function mountDiagnosticOwner(owner: Owner) {
  if (!navigationDiagnosticsAvailable) return () => {};
  owners[owner] = (owners[owner] ?? 0) + 1;
  recordNavigationDiagnostic('mount', owner);
  let mounted = true;
  return () => {
    if (!mounted) return;
    mounted = false;
    owners[owner] = Math.max(0, (owners[owner] ?? 0) - 1);
    recordNavigationDiagnostic('unmount', owner);
  };
}

function snapshot() {
  return {
    schema: 'resident-navigation-phase0-v1', active, capacity: CAPACITY, dropped,
    clock: 'performance.now; relative milliseconds; not synchronized to native input/presentation',
    startedAtMonotonicMs: startedAt, counts: { ...counts }, owners: { ...owners },
    samples: [...samples.slice(nextSlot), ...samples.slice(0, nextSlot)].map(sample => ({ ...sample })),
  };
}

function stop() {
  if (active) recordNavigationDiagnostic('stop', 'other');
  active = false;
  clearTimeout(stopTimer);
  stopTimer = undefined;
  restoreFetch?.();
  restoreFetch = undefined;
  return snapshot();
}

function start(durationMs = 60000) {
  if (!navigationDiagnosticsAvailable) return false;
  if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 600000) return false;
  stop();
  generation++;
  const run = generation;
  samples = []; nextSlot = 0; dropped = 0; counts = {}; navigationId = 0; operationId = 0;
  startedAt = performance.now();
  active = true;
  recordNavigationDiagnostic('start', 'other');
  // Observe the original transport without inspecting URL, headers, arguments or response bodies.
  const originalFetch = globalThis.fetch;
  const observedFetch: typeof fetch = async (...args) => {
    if (!active || generation !== run) return originalFetch(...args);
    const id = ++operationId;
    const began = performance.now();
    recordNavigationDiagnostic('request-start', 'other', {}, id);
    try {
      const response = await originalFetch(...args);
      if (active && generation === run) recordNavigationDiagnostic('request-end', 'other', { durationMs: performance.now() - began, code: response.status }, id);
      return response;
    } catch (error) {
      if (active && generation === run) recordNavigationDiagnostic('request-error', 'other', { durationMs: performance.now() - began }, id);
      throw error;
    }
  };
  globalThis.fetch = observedFetch;
  restoreFetch = () => { if (globalThis.fetch === observedFetch) globalThis.fetch = originalFetch; };
  stopTimer = setTimeout(stop, durationMs);
  return true;
}

declare global {
  var __residentNavigationDiagnostics: { start: typeof start; stop: typeof stop; snapshot: typeof snapshot } | undefined;
}

if (navigationDiagnosticsAvailable) {
  // Fast Refresh must stop an old capture before replacing its controller.
  globalThis.__residentNavigationDiagnostics?.stop();
  globalThis.__residentNavigationDiagnostics = { start, stop, snapshot };
}
