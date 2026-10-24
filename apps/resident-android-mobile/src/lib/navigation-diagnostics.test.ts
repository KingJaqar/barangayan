import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('temporary navigation diagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal('__residentNavigationDiagnostics', undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    globalThis.__residentNavigationDiagnostics?.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records nothing by default and bounds samples while retaining exact totals', async () => {
    const diagnostics = await import('./navigation-diagnostics');
    const api = globalThis.__residentNavigationDiagnostics;
    expect(api).toBeDefined();
    diagnostics.recordNavigationDiagnostic('map-ready', 'map');
    expect(api?.snapshot().samples).toEqual([]);
    api?.start();
    for (let i = 0; i < 9000; i++) diagnostics.recordNavigationDiagnostic('map-ready', 'map', { count: i });
    const result = api?.stop();
    expect(result?.samples).toHaveLength(8192);
    expect(result?.counts['map-ready']).toBe(9000);
    expect(result?.dropped).toBe(810);
    const counts = result?.samples.filter(sample => sample.kind === 'map-ready').map(sample => sample.count);
    expect(counts?.[0]).toBe(809);
    expect(counts?.at(-1)).toBe(8999);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores transport at the deadline; preserves responses and excludes private inputs', async () => {
    await import('./navigation-diagnostics');
    const original = globalThis.fetch;
    const api = globalThis.__residentNavigationDiagnostics;
    expect(api?.start(Number.NaN)).toBe(false);
    expect(api?.start(600001)).toBe(false);
    api?.start(1000);
    const response = await fetch('https://private.invalid/resident-id', { headers: { authorization: 'private-token' }, body: 'private-body', method: 'POST' });
    expect(response.status).toBe(204);
    expect(original).toHaveBeenCalledWith('https://private.invalid/resident-id', expect.objectContaining({ body: 'private-body' }));
    const snapshot = api?.snapshot();
    expect(snapshot?.counts['request-start']).toBe(1);
    expect(snapshot?.counts['request-end']).toBe(1);
    expect(snapshot?.samples.find(sample => sample.kind === 'request-end')?.code).toBe(204);
    expect(JSON.stringify(snapshot)).not.toContain('private-');
    vi.advanceTimersByTime(1000);
    expect(globalThis.fetch).toBe(original);
    expect(api?.snapshot().active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates errors unchanged and ignores late completions from an earlier run', async () => {
    const failure = new Error('private-server-error');
    const original = vi.fn();
    let complete: ((response: Response) => void) | undefined;
    original.mockImplementationOnce(() => Promise.reject(failure));
    vi.stubGlobal('fetch', original);
    await import('./navigation-diagnostics');
    const api = globalThis.__residentNavigationDiagnostics;
    api?.start();
    await expect(fetch('https://private.invalid')).rejects.toBe(failure);
    expect(api?.snapshot().counts['request-error']).toBe(1);
    original.mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; }));
    const pending = fetch('https://private.invalid');
    api?.start();
    complete?.(new Response(null, { status: 200 }));
    await pending;
    expect(api?.snapshot().counts['request-end']).toBeUndefined();
    expect(api?.snapshot().counts['request-error']).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('counts existing owners and navigation events without retaining route or account identifiers', async () => {
    const diagnostics = await import('./navigation-diagnostics');
    const unmount = diagnostics.mountDiagnosticOwner('sla-compact');
    const api = globalThis.__residentNavigationDiagnostics;
    api?.start();
    expect(api?.snapshot().owners['sla-compact']).toBe(1);
    diagnostics.beginDiagnosticNavigation('private-route-id');
    diagnostics.recordNavigationDiagnostic('commit', diagnostics.diagnosticRoute('health'), { durationMs: 12, phase: 'update' });
    const result = api?.snapshot();
    expect(result?.samples.find(sample => sample.kind === 'press')?.owner).toBe('other');
    expect(result?.samples.find(sample => sample.kind === 'commit')?.navigationId).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private-route-id');
    unmount(); unmount();
    expect(api?.snapshot().owners['sla-compact']).toBe(0);
    expect(result?.owners['sla-compact']).toBe(1);
  });

  it('does not replace a later transport wrapper on stop', async () => {
    await import('./navigation-diagnostics');
    globalThis.__residentNavigationDiagnostics?.start();
    const later = vi.fn().mockResolvedValue(new Response());
    globalThis.fetch = later;
    globalThis.__residentNavigationDiagnostics?.stop();
    expect(globalThis.fetch).toBe(later);
  });

  it('installs no controller, timers or capture in production', async () => {
    vi.stubGlobal('__DEV__', false);
    const original = globalThis.fetch;
    const diagnostics = await import('./navigation-diagnostics');
    diagnostics.mountDiagnosticOwner('map')();
    diagnostics.beginDiagnosticNavigation('home');
    diagnostics.recordNavigationDiagnostic('map-ready', 'map');
    expect(globalThis.__residentNavigationDiagnostics).toBeUndefined();
    expect(globalThis.fetch).toBe(original);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('remains inert in standalone browser fixtures without the native development global', async () => {
    vi.stubGlobal('__DEV__', undefined);
    const diagnostics = await import('./navigation-diagnostics');
    expect(diagnostics.navigationDiagnosticsAvailable).toBe(false);
    diagnostics.mountDiagnosticOwner('map')();
    diagnostics.recordNavigationDiagnostic('map-ready', 'map');
    expect(globalThis.__residentNavigationDiagnostics).toBeUndefined();
  });
});
