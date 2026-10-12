import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DeviceLocationController,
  LOCATION_ACQUISITION_TIMEOUT_MS,
  LOCATION_SLOW_AFTER_MS,
  assessLocationFix,
  describeDeviceLocation,
  initialDeviceLocationState,
  type LocationAdapter,
  type LocationFix,
  type LocationPermission,
  type LocationWatchError,
} from './device-location';

const NOW = 1_800_000_000_000;

function fix(overrides: Partial<LocationFix> = {}): LocationFix {
  return {
    lat: 14.6815,
    lng: 121.1172,
    accuracyMeters: 12,
    deviceTimestamp: NOW - 1_000,
    receivedAt: NOW,
    source: 'current',
    ...overrides,
  };
}

const granted: LocationPermission = { state: 'granted', canAskAgain: true, approximate: false };

/** Adapter whose watch callbacks and subscription timing are driven by the test. */
function fakeAdapter(options: {
  permission?: LocationPermission;
  afterRequest?: LocationPermission;
  services?: boolean;
  availability?: 'ok' | 'unsupported' | 'insecure-context';
  lastKnown?: LocationFix | null;
  deferWatch?: boolean;
  watchThrows?: boolean;
} = {}) {
  let permission = options.permission ?? granted;
  const watchers: { onFix: (f: LocationFix) => void; onError: (e: LocationWatchError) => void; stopped: boolean }[] = [];
  let resolveWatch: (() => void) | null = null;
  const requestPermission = vi.fn(async () => {
    permission = options.afterRequest ?? permission;
    return permission;
  });
  const adapter: LocationAdapter = {
    availability: () => options.availability ?? 'ok',
    getPermission: async () => permission,
    requestPermission,
    servicesEnabled: async () => options.services ?? true,
    watch: (onFix, onError) => {
      if (options.watchThrows) return Promise.reject(new Error('provider failure'));
      const watcher = { onFix, onError, stopped: false };
      watchers.push(watcher);
      const stop = () => {
        watcher.stopped = true;
      };
      if (!options.deferWatch) return Promise.resolve(stop);
      return new Promise<() => void>((resolve) => {
        resolveWatch = () => resolve(stop);
      });
    },
    lastKnown: async () => options.lastKnown ?? null,
  };
  return {
    adapter,
    watchers,
    requestPermission,
    setPermission: (next: LocationPermission) => {
      permission = next;
    },
    resolveWatch: () => resolveWatch?.(),
  };
}

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('assessLocationFix', () => {
  it('accepts a fresh fix within 50 m', () => {
    expect(assessLocationFix(fix({ accuracyMeters: 50 }), false)).toEqual([]);
  });

  it('flags stale, inaccurate, unknown-accuracy, last-known and approximate fixes', () => {
    expect(assessLocationFix(fix({ deviceTimestamp: NOW - 121_000 }), false)).toEqual(['stale']);
    expect(assessLocationFix(fix({ accuracyMeters: 51 }), false)).toEqual(['inaccurate']);
    expect(assessLocationFix(fix({ accuracyMeters: null }), false)).toEqual(['accuracy-unknown']);
    expect(assessLocationFix(fix({ source: 'last-known' }), false)).toEqual(['last-known']);
    expect(assessLocationFix(fix(), true)).toEqual(['approximate-permission']);
  });

  it('treats a provider clock far ahead of the device as stale', () => {
    expect(assessLocationFix(fix({ deviceTimestamp: NOW + 10 * 60_000 }), false)).toEqual(['stale']);
  });
});

describe('describeDeviceLocation', () => {
  it('says nothing for a fresh accepted origin', () => {
    const origin = { lat: 1, lng: 1, accuracyMeters: 10, deviceTimestamp: NOW, source: 'device-auto' as const, fixSource: 'current' as const, revision: 1 };
    expect(describeDeviceLocation({ ...initialDeviceLocationState, status: 'ready', origin }, 'android')).toBeNull();
    expect(describeDeviceLocation({ ...initialDeviceLocationState, status: 'ready', origin: { ...origin, fixSource: 'last-known' } }, 'web')?.title)
      .toBe('Using your last known location');
  });

  it('explains why a fix needs confirmation', () => {
    const message = describeDeviceLocation(
      { ...initialDeviceLocationState, status: 'confirmation-required', pending: { fix: fix({ accuracyMeters: 180.4 }), concerns: ['inaccurate'] } },
      'android',
    );
    expect(message?.detail).toBe('Accuracy is about ±180 m.');
    expect(message?.actions).toEqual(['confirm', 'reject']);
  });

  it('offers Settings only where the platform can open it', () => {
    const blocked = { ...initialDeviceLocationState, status: 'denied' as const, canAskAgain: false };
    expect(describeDeviceLocation(blocked, 'android')?.actions).toEqual(['open-settings']);
    expect(describeDeviceLocation(blocked, 'web')?.actions).toEqual(['retry']);
  });

  it('mentions the kept origin after a failure', () => {
    const origin = { lat: 1, lng: 1, accuracyMeters: 10, deviceTimestamp: NOW, source: 'device-auto' as const, fixSource: 'current' as const, revision: 1 };
    expect(describeDeviceLocation({ ...initialDeviceLocationState, status: 'timed-out', origin }, 'web')?.detail)
      .toContain('previous location is still being used');
  });
});

describe('DeviceLocationController', () => {
  it('auto mode never prompts for permission', async () => {
    const fake = fakeAdapter({ permission: { state: 'prompt', canAskAgain: true, approximate: false } });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    expect(fake.requestPermission).not.toHaveBeenCalled();
    expect(fake.watchers).toHaveLength(0);
    expect(controller.getState().status).toBe('idle');
  });

  it('explicit mode prompts, and does not re-prompt a permanently denied permission', async () => {
    const fake = fakeAdapter({
      permission: { state: 'prompt', canAskAgain: true, approximate: false },
      afterRequest: { state: 'denied', canAskAgain: false, approximate: false },
    });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('explicit');
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({ status: 'denied', canAskAgain: false });

    await controller.start('explicit');
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(controller.getState().status).toBe('denied');
  });

  it('reports disabled location services without watching', async () => {
    const fake = fakeAdapter({ services: false });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    expect(controller.getState().status).toBe('services-disabled');
    expect(fake.watchers).toHaveLength(0);
  });

  it('reports an unusable environment (web insecure context) as unavailable', async () => {
    const fake = fakeAdapter({ availability: 'insecure-context' });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('explicit');
    expect(controller.getState()).toMatchObject({ status: 'unavailable', unavailableReason: 'insecure-context' });
  });

  it('accepts a good fix as the origin and stops watching', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    expect(controller.getState().status).toBe('locating');
    fake.watchers[0].onFix(fix());
    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.origin).toMatchObject({ lat: 14.6815, lng: 121.1172, source: 'device-auto', revision: 1 });
    expect(fake.watchers[0].stopped).toBe(true);
  });

  it('holds a poor fix for confirmation while continuing to search for a better one', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('explicit');
    fake.watchers[0].onFix(fix({ accuracyMeters: 300 }));
    expect(controller.getState().status).toBe('confirmation-required');
    expect(controller.getState().origin).toBeNull();
    expect(fake.watchers[0].stopped).toBe(false);

    // A worse fix does not replace the pending one; a good fix is accepted outright.
    fake.watchers[0].onFix(fix({ accuracyMeters: 900 }));
    expect(controller.getState().pending?.fix.accuracyMeters).toBe(300);
    fake.watchers[0].onFix(fix({ accuracyMeters: 20 }));
    expect(controller.getState()).toMatchObject({ status: 'ready', pending: null });
    expect(controller.getState().origin?.accuracyMeters).toBe(20);
  });

  it('confirming a pending fix makes it the origin with a new revision', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('explicit');
    fake.watchers[0].onFix(fix({ accuracyMeters: 120 }));
    controller.confirmPending();
    expect(controller.getState().origin).toMatchObject({ source: 'device-confirmed', accuracyMeters: 120, revision: 1 });
    expect(fake.watchers[0].stopped).toBe(true);
  });

  it('ignores invalid coordinates', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    fake.watchers[0].onFix(fix({ lat: Number.NaN }));
    fake.watchers[0].onFix(fix({ lng: 200 }));
    expect(controller.getState()).toMatchObject({ status: 'locating', origin: null, pending: null });
  });

  it('removes a subscription that initializes after cancellation', async () => {
    const fake = fakeAdapter({ deferWatch: true });
    const controller = new DeviceLocationController(fake.adapter);
    const started = controller.start('auto');
    await flush();
    expect(fake.watchers).toHaveLength(1);
    controller.cancel();
    expect(controller.getState().status).toBe('idle');
    fake.resolveWatch();
    await started;
    expect(fake.watchers[0].stopped).toBe(true);
  });

  it('ignores late callbacks from a superseded request', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('explicit');
    await controller.start('explicit');
    expect(fake.watchers[0].stopped).toBe(true);
    fake.watchers[0].onFix(fix({ lat: 1, lng: 1 }));
    fake.watchers[0].onError('denied');
    expect(controller.getState()).toMatchObject({ status: 'locating', origin: null });
    fake.watchers[1].onFix(fix());
    expect(controller.getState().origin?.lat).toBe(14.6815);
  });

  it('shows progress after 10 s and stops at 45 s with timed-out', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    vi.advanceTimersByTime(LOCATION_SLOW_AFTER_MS);
    expect(controller.getState().slow).toBe(true);
    vi.advanceTimersByTime(LOCATION_ACQUISITION_TIMEOUT_MS - LOCATION_SLOW_AFTER_MS);
    await flush();
    expect(controller.getState()).toMatchObject({ status: 'timed-out', activeRequestId: null, slow: false });
    expect(fake.watchers[0].stopped).toBe(true);
  });

  it('offers a last-known fix after timeout only for confirmation', async () => {
    const fake = fakeAdapter({ lastKnown: fix({ accuracyMeters: 10, source: 'current' }) });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    vi.advanceTimersByTime(LOCATION_ACQUISITION_TIMEOUT_MS);
    await flush();
    const state = controller.getState();
    expect(state.status).toBe('confirmation-required');
    expect(state.origin).toBeNull();
    expect(state.pending?.fix.source).toBe('last-known');
    expect(state.pending?.concerns).toContain('last-known');
  });

  it('keeps the previous origin when a later acquisition fails', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    fake.watchers[0].onFix(fix());
    await controller.start('explicit');
    fake.watchers[1].onError('unavailable');
    expect(controller.getState()).toMatchObject({ status: 'unavailable', unavailableReason: 'provider' });
    expect(controller.getState().origin?.revision).toBe(1);
  });

  it('reports a watch that fails to start as unavailable', async () => {
    const fake = fakeAdapter({ watchThrows: true });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    expect(controller.getState()).toMatchObject({ status: 'unavailable', activeRequestId: null });
  });

  it('a browser-side denial during watch is reported as denied', async () => {
    const fake = fakeAdapter({ permission: { state: 'prompt', canAskAgain: true, approximate: false } });
    const controller = new DeviceLocationController({ ...fake.adapter, requestPermission: undefined });
    await controller.start('explicit');
    fake.watchers[0].onError('denied');
    expect(controller.getState()).toMatchObject({ status: 'denied', activeRequestId: null });
  });

  it('flags fixes under an approximate-only permission for confirmation', async () => {
    const fake = fakeAdapter({ permission: { state: 'granted', canAskAgain: true, approximate: true } });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    fake.watchers[0].onFix(fix({ accuracyMeters: 5 }));
    expect(controller.getState().pending?.concerns).toEqual(['approximate-permission']);
  });

  it('pause stops acquisition and resume restarts it', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    controller.pause();
    expect(fake.watchers[0].stopped).toBe(true);
    expect(controller.getState().activeRequestId).toBeNull();
    await controller.resume();
    expect(fake.watchers).toHaveLength(2);
    expect(controller.getState().status).toBe('locating');
  });

  it('resume without an interrupted session or permission change does nothing', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    fake.watchers[0].onFix(fix());
    await controller.resume();
    expect(fake.watchers).toHaveLength(1);
    expect(controller.getState().status).toBe('ready');
  });

  it('a permission granted in Settings restarts acquisition; a change drops the pending fix', async () => {
    const fake = fakeAdapter({ permission: { state: 'denied', canAskAgain: false, approximate: false } });
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    expect(controller.getState().status).toBe('denied');

    fake.setPermission(granted);
    await controller.resume();
    expect(controller.getState().status).toBe('locating');
    fake.watchers[0].onFix(fix({ accuracyMeters: 400 }));
    expect(controller.getState().pending).not.toBeNull();

    fake.setPermission({ state: 'granted', canAskAgain: true, approximate: true });
    await controller.resume();
    expect(fake.watchers[0].stopped).toBe(true);
    expect(controller.getState().pending).toBeNull();
    expect(controller.getState().approximate).toBe(true);
  });

  it('rejecting a pending fix keeps the previous origin', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    await controller.start('auto');
    fake.watchers[0].onFix(fix());
    await controller.start('explicit');
    fake.watchers[1].onFix(fix({ lat: 14.7, accuracyMeters: 500 }));
    controller.rejectPending();
    expect(controller.getState()).toMatchObject({ status: 'ready', pending: null });
    expect(controller.getState().origin).toMatchObject({ lat: 14.6815, revision: 1 });
    expect(fake.watchers[1].stopped).toBe(true);
  });

  it('notifies subscribers and stops notifying after unsubscribe', async () => {
    const fake = fakeAdapter();
    const controller = new DeviceLocationController(fake.adapter);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    await controller.start('auto');
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    fake.watchers[0].onFix(fix());
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});
