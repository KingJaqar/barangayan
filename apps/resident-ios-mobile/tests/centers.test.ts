import { describeDeviceLocation, DeviceLocationController, LOCATION_ACQUISITION_TIMEOUT_MS, LOCATION_SLOW_AFTER_MS, type ConfirmedOrigin, type LocationAdapter, type LocationFix, type LocationPermission, type LocationWatchError } from '@barangayan/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { CENTER_POLICY } from '../src/data/public-cache';
import { CENTER_COLUMNS, centerRow } from '../src/data/schemas';
import {
  availabilityOf, centerRecordsFrom, distanceDisplay, estimateBetween, externalDirectionsUrl, facilitiesOf, formatDistance, occupancyOf, orderCenters,
  searchCenters, shortDistance, updatedLabel, WALKING_METERS_PER_MINUTE, type RouteSummary,
} from '../src/features/centers/center-model';
import { activeOrigin, manualIsCurrent, originSummary, placeManualOrigin } from '../src/features/centers/origin';
import { deliver, mapHtml, parseMapMessage } from '../src/features/profile/location-map';
import { iosFix, iosPermission } from '../src/lib/location-core';
import { releaseGates } from '../src/lib/release-gates';

type Row = z.infer<typeof centerRow>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, patch: Partial<Row> = {}): Row => ({
  id: uuid(n), name: `Center ${n}`, address: `${n} Main Street`, contact_number: '911', current_occupancy: 10, capacity: 100,
  position: { lat: 14.68 + n / 1000, lng: 121.11 }, facilities: [], verified: false, availability: 'unknown', updated_at: '2026-10-16T08:00:00.000Z', ...patch,
});
const ORIGIN = { lat: 14.68, lng: 121.11 };

describe('center schema and cache contract (B13, A23-001, A23-037)', () => {
  it('selects the operational columns the cards render', () => {
    expect(CENTER_COLUMNS.split(',')).toEqual(['id', 'name', 'address', 'contact_number', 'current_occupancy', 'capacity', 'position', 'facilities', 'verified', 'availability', 'updated_at']);
  });
  it('parses a hosted-shaped row and rejects one with a missing or mistyped operational column', () => {
    expect(centerRow.safeParse(row(1, { facilities: ['medical', 'toilets'], verified: true, availability: 'available' })).success).toBe(true);
    expect(centerRow.safeParse({ ...row(1), facilities: null }).success).toBe(false);
    expect(centerRow.safeParse({ ...row(1), verified: 'yes' }).success).toBe(false);
    expect(centerRow.safeParse({ ...row(1), updated_at: '' }).success).toBe(false);
  });
  it('discards older cached copies and ages operational facts quickly', () => {
    expect(CENTER_POLICY.contractVersion).toBe(3);
    expect(CENTER_POLICY.staleAfterMs).toBe(30 * 60 * 1000);
  });
});

describe('occupancy never reads unknown as zero (A23-010…016)', () => {
  it('reports unknown or zero capacity as not reported, with no percentage', () => {
    for (const capacity of [null, 0]) {
      const occupancy = occupancyOf(0, capacity);
      expect(occupancy).toMatchObject({ level: 'unknown', percent: null, capacity: null, headline: 'Capacity not reported' });
      expect(occupancy.detail).toBe('0 reported occupants');
    }
  });
  it('uses normal below 80 %, high from 80 %, full from 100 %, and full when over capacity', () => {
    expect(occupancyOf(79, 100)).toMatchObject({ level: 'normal', percent: 79, headline: '79%' });
    expect(occupancyOf(80, 100)).toMatchObject({ level: 'high', headline: '80%' });
    expect(occupancyOf(99, 100)).toMatchObject({ level: 'high', headline: '99%' });
    expect(occupancyOf(100, 100)).toMatchObject({ level: 'full', headline: 'FULL' });
    expect(occupancyOf(130, 100)).toMatchObject({ level: 'full', headline: 'FULL', percent: 130 });
    expect(occupancyOf(1640, 2000).detail).toBe('1,640 of 2,000 reported occupants');
  });
});

describe('facilities and availability (A23-017…024)', () => {
  it('labels Android’s known keys, collapses duplicates and keeps an unknown operator key readable', () => {
    expect(facilitiesOf(['medical_desk', 'pet_friendly', 'generator', 'catering', 'children', 'toilets', 'internet']).map((facility) => facility.label))
      .toEqual(['Medical desk', 'Pet friendly', 'Generator', 'Catering', 'Children', 'Toilets', 'Internet']);
    expect(facilitiesOf(['Medical', 'medical', ' MEDICAL '])).toHaveLength(1);
    expect(facilitiesOf(['wheelchair_ramp'])[0].label).toBe('Wheelchair ramp');
    expect(facilitiesOf(['', '  ', '!!!'])).toEqual([]);
    expect(facilitiesOf(['x'.repeat(100)])[0].label).toHaveLength(32);
  });
  it('reads an unrecognised availability as not confirmed, never as open', () => {
    expect(availabilityOf('available')).toBe('available');
    expect(availabilityOf('unavailable')).toBe('unavailable');
    expect(availabilityOf('open')).toBe('unknown');
    expect(availabilityOf('')).toBe('unknown');
  });
});

describe('center records (A23-002, A23-005…009)', () => {
  it('keeps a center with an unusable pin in the list, without a position', () => {
    const records = centerRecordsFrom([row(1), row(2, { position: {} }), row(3, { position: { lat: 'x', lng: 1 } }), row(4, { address: '   ', contact_number: null })]);
    expect(records.map((record) => record.position === null)).toEqual([false, true, true, false]);
    expect(records[3]).toMatchObject({ address: null, contactNumber: null });
  });
  it('searches the name only, case-insensitively, and keeps all on a blank term', () => {
    const records = centerRecordsFrom([row(1, { name: 'Ampid Elementary' }), row(2, { name: 'Civic Center' }), row(3, { name: 'Barangay Hall', address: 'Ampid Road' })]);
    expect(searchCenters(records, '  AMPID ').map((record) => record.name)).toEqual(['Ampid Elementary']);
    expect(searchCenters(records, '')).toHaveLength(3);
    expect(searchCenters(records, 'zzz')).toEqual([]);
  });
});

describe('distance, estimate and ordering (A23-008/009/025, A24-018/022/023)', () => {
  const records = centerRecordsFrom([row(5, { name: 'Far', position: { lat: 14.69, lng: 121.11 } }), row(1, { name: 'Near', position: { lat: 14.681, lng: 121.11 } }), row(9, { name: 'No pin', position: null }), row(2, { name: 'Middle', position: { lat: 14.684, lng: 121.11 } })]);
  const byName = (name: string) => records.find((record) => record.name === name)!;

  it('formats distances', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(842)).toBe('840 m');
    expect(formatDistance(1500)).toBe('1.5 km');
  });
  it('estimates the straight line and a walking time at 72 m per minute, at least one minute', () => {
    expect(estimateBetween(null, ORIGIN)).toBeNull();
    expect(estimateBetween(ORIGIN, null)).toBeNull();
    expect(estimateBetween(ORIGIN, { lat: Number.NaN, lng: 0 })).toBeNull();
    expect(estimateBetween(ORIGIN, ORIGIN)).toEqual({ distanceMeters: 0, minutes: 1 });
    const estimate = estimateBetween(ORIGIN, { lat: 14.69, lng: 121.11 });
    expect(estimate?.minutes).toBe(Math.round((estimate?.distanceMeters ?? 0) / WALKING_METERS_PER_MINUTE));
  });
  it('labels a straight-line figure as an estimate and never shows unknown distance as zero', () => {
    const estimate = distanceDisplay(byName('Near'), ORIGIN, null);
    expect(estimate.kind).toBe('estimate');
    expect(estimate.text).toContain('straight line');
    expect(estimate.text).toContain('(estimate)');
    expect(distanceDisplay(byName('No pin'), ORIGIN, null)).toMatchObject({ kind: 'unknown', text: 'Distance unknown: no map location' });
    expect(distanceDisplay(byName('Near'), null, null)).toMatchObject({ kind: 'unknown', text: 'Distance unknown: location not set' });
  });
  it('prefers the route service’s walking figure and never falls back to a straight line for a center it cannot reach', () => {
    const summaries = new Map<string, RouteSummary>([
      [byName('Near').id, { centerId: byName('Near').id, distanceMeters: 650, durationSeconds: 540 }],
      [byName('Far').id, { centerId: byName('Far').id, distanceMeters: null, durationSeconds: null }],
    ]);
    expect(distanceDisplay(byName('Near'), ORIGIN, summaries)).toMatchObject({ kind: 'walking', text: '650 m walking · about 9 min' });
    expect(distanceDisplay(byName('Far'), ORIGIN, summaries)).toEqual({ kind: 'unreachable', text: 'No open walking route' });
    expect(distanceDisplay(byName('Middle'), ORIGIN, summaries).kind).toBe('estimate');
    expect(shortDistance(distanceDisplay(byName('Near'), ORIGIN, summaries))).toBe('650 m walk');
    expect(shortDistance(distanceDisplay(byName('Middle'), ORIGIN, null))).toContain('straight line');
    expect(shortDistance(distanceDisplay(byName('No pin'), ORIGIN, null))).toBeNull();
  });
  it('orders nearest first with centers lacking a distance last, and keeps name order otherwise', () => {
    const names = (list: typeof records) => list.map((record) => record.name);
    expect(names(orderCenters(records, { nearestFirst: true, origin: ORIGIN, summaries: null }))).toEqual(['Near', 'Middle', 'Far', 'No pin']);
    expect(names(orderCenters(records, { nearestFirst: false, origin: ORIGIN, summaries: null }))).toEqual(['Far', 'Middle', 'Near', 'No pin']);
    expect(names(orderCenters(records, { nearestFirst: true, origin: null, summaries: null }))).toEqual(['Far', 'Middle', 'Near', 'No pin']);
  });
  it('orders by walking distance when the service ranks the centers, and keeps unreachable ones after every reachable center', () => {
    const summaries = new Map<string, RouteSummary>([
      [byName('Near').id, { centerId: byName('Near').id, distanceMeters: null, durationSeconds: null }],
      [byName('Far').id, { centerId: byName('Far').id, distanceMeters: 300, durationSeconds: 250 }],
      [byName('Middle').id, { centerId: byName('Middle').id, distanceMeters: 900, durationSeconds: 760 }],
    ]);
    expect(orderCenters(records, { nearestFirst: true, origin: ORIGIN, summaries }).map((record) => record.name)).toEqual(['Far', 'Middle', 'Near', 'No pin']);
  });
  it('states when occupancy changed, and says so for an unreadable stamp', () => {
    const now = Date.parse('2026-10-16T09:00:00.000Z');
    expect(updatedLabel('2026-10-16T08:00:00.000Z', now)).toBe('Occupancy updated 1 hour ago');
    expect(updatedLabel('2026-10-16T08:59:40.000Z', now)).toBe('Occupancy updated just now');
    expect(updatedLabel('not a date', now)).toBe('Occupancy updated Date unavailable');
  });
  it('builds Apple Maps walking directions only for a center with a pin', () => {
    expect(externalDirectionsUrl(byName('Near'))).toBe('https://maps.apple.com/?daddr=14.681000,121.110000&dirflg=w');
    expect(externalDirectionsUrl(byName('No pin'))).toBeNull();
  });
});

describe('starting point: device fix or a placed spot (P14-T02)', () => {
  const device = (revision: number): ConfirmedOrigin => ({ lat: 14.6811, lng: 121.1172, accuracyMeters: 12, deviceTimestamp: 1, source: 'device-auto', fixSource: 'current', revision });
  it('has no origin until a fix is accepted or a spot is placed', () => {
    expect(activeOrigin(null, null)).toBeNull();
    expect(originSummary(null)).toContain('distances are unknown');
  });
  it('uses the device fix, then the placed spot, and returns to the device when a new fix is accepted', () => {
    const first = device(1);
    expect(activeOrigin(first, null)).toMatchObject({ kind: 'device', revision: 1 });
    expect(originSummary(activeOrigin(first, null))).toBe('Starting point: your location (within about 12 m).');
    const placed = placeManualOrigin({ lat: 14.7, lng: 121.2 }, null, first);
    expect(manualIsCurrent(placed, first)).toBe(true);
    expect(activeOrigin(first, placed)).toMatchObject({ kind: 'manual', lat: 14.7, lng: 121.2, revision: 1, accuracyMeters: null });
    expect(originSummary(activeOrigin(first, placed))).toContain('placed on the map');
    const again = placeManualOrigin({ lat: 14.71, lng: 121.2 }, placed, first);
    expect(again.seq).toBe(2);
    expect(manualIsCurrent(placed, device(2))).toBe(false);
    expect(activeOrigin(device(2), placed)).toMatchObject({ kind: 'device', revision: 2 });
  });
  it('lets a spot placed before any device fix hold until a fix is accepted', () => {
    const placed = placeManualOrigin({ lat: 14.7, lng: 121.2 }, null, null);
    expect(activeOrigin(null, placed)?.kind).toBe('manual');
    expect(activeOrigin(device(1), placed)?.kind).toBe('device');
  });
});

describe('iOS location through the shared controller (A24-001…016, T24)', () => {
  const NOW = 1_800_000_000_000;
  const fix = (patch: Partial<LocationFix> = {}): LocationFix => ({ lat: 14.6815, lng: 121.1172, accuracyMeters: 12, deviceTimestamp: NOW - 1000, receivedAt: NOW, source: 'current', ...patch });
  type Response = Parameters<typeof iosPermission>[0];
  function adapter(initial: Response, afterRequest?: Response) {
    let response = initial;
    const watchers: { onFix: (f: LocationFix) => void; onError: (e: LocationWatchError) => void; stopped: boolean }[] = [];
    const value: LocationAdapter = {
      availability: () => 'ok',
      getPermission: async () => iosPermission(response),
      requestPermission: async () => { response = afterRequest ?? response; return iosPermission(response); },
      servicesEnabled: async () => true,
      watch: async (onFix, onError) => { const watcher = { onFix, onError, stopped: false }; watchers.push(watcher); return () => { watcher.stopped = true; }; },
      lastKnown: async () => iosFix({ coords: { latitude: 14.68, longitude: 121.11, accuracy: 20 }, timestamp: NOW - 600_000 }, 'last-known', NOW),
    };
    return { value, watchers, set: (next: Response) => { response = next; } };
  }
  const granted = (accuracy: 'full' | 'reduced'): Response => ({ granted: true, canAskAgain: true, status: 'granted', ios: { accuracy } });
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('holds a fix under reduced accuracy for confirmation, and says so in iOS words', async () => {
    const fake = adapter(granted('reduced'));
    const controller = new DeviceLocationController(fake.value);
    await controller.start('auto');
    fake.watchers[0].onFix(fix({ accuracyMeters: 5 }));
    expect(controller.getState().pending?.concerns).toEqual(['approximate-permission']);
    expect(controller.getState().origin).toBeNull();
    const message = describeDeviceLocation(controller.getState(), 'ios');
    expect(message?.actions).toContain('confirm');
    expect(message?.actions).toContain('reject');
    expect(JSON.stringify(message)).toContain('Precise Location');
    controller.confirmPending();
    expect(controller.getState().origin?.source).toBe('device-confirmed');
  });
  it('accepts a fresh full-accuracy fix automatically and never prompts on entry', async () => {
    const fake = adapter({ granted: false, canAskAgain: true, status: 'undetermined' }, granted('full'));
    const controller = new DeviceLocationController(fake.value);
    await controller.start('auto');
    expect(fake.watchers).toHaveLength(0);
    expect(controller.getState().status).toBe('idle');
    await controller.start('explicit');
    fake.watchers[0].onFix(fix());
    expect(controller.getState().origin).toMatchObject({ source: 'device-auto', revision: 1 });
  });
  it('flags a stale fix, shows progress after 10 s, times out at 45 s and offers the last-known fix only to confirm', async () => {
    const fake = adapter(granted('full'));
    const controller = new DeviceLocationController(fake.value);
    await controller.start('auto');
    await vi.advanceTimersByTimeAsync(LOCATION_SLOW_AFTER_MS);
    expect(controller.getState().slow).toBe(true);
    await vi.advanceTimersByTimeAsync(LOCATION_ACQUISITION_TIMEOUT_MS - LOCATION_SLOW_AFTER_MS);
    expect(controller.getState().status).toBe('confirmation-required');
    expect(controller.getState().origin).toBeNull();
    expect(controller.getState().pending?.concerns).toContain('last-known');
  });
  it('drops a callback that arrives after the app went to the background, and re-checks when it returns (Allow Once, Settings)', async () => {
    const fake = adapter({ granted: false, canAskAgain: false, status: 'denied' });
    const controller = new DeviceLocationController(fake.value);
    await controller.start('explicit');
    expect(controller.getState().status).toBe('denied');
    expect(controller.getState().canAskAgain).toBe(false);
    fake.set(granted('full'));
    await controller.resume();
    expect(fake.watchers).toHaveLength(1);
    controller.pause();
    expect(fake.watchers[0].stopped).toBe(true);
    fake.watchers[0].onFix(fix());
    expect(controller.getState().origin).toBeNull();
  });
  it('keeps the earlier origin when a later acquisition fails, so distances stay available', async () => {
    const permission: LocationPermission = { state: 'granted', canAskAgain: true, approximate: false };
    expect(iosPermission(granted('full'))).toEqual(permission);
    const fake = adapter(granted('full'));
    const controller = new DeviceLocationController(fake.value);
    await controller.start('explicit');
    fake.watchers[0].onFix(fix());
    await controller.start('explicit');
    fake.watchers[1].onError('unavailable');
    expect(controller.getState().origin).not.toBeNull();
  });
});

describe('route on the map page (A24-020, T24)', () => {
  const html = mapHtml({ tiles: false });
  it('knows how to draw and clear a route from validated points only', () => {
    expect(html).toContain("message.type === 'DRAW_ROUTE'");
    expect(html).toContain("message.type === 'CLEAR_ROUTE'");
    expect(html).toContain('finite(point.lat) && finite(point.lng)');
  });
  it('delivers the shared bridge messages as one escaped string', () => {
    const script = deliver({ type: 'DRAW_ROUTE', payload: { points: [{ lat: 14.68, lng: 121.11 }, { lat: 14.69, lng: 121.12 }] } });
    expect(script.startsWith('window.receive("')).toBe(true);
    expect(deliver({ type: 'CLEAR_ROUTE' })).toContain('CLEAR_ROUTE');
  });
  it('still ignores a marker message that is not a short string id', () => {
    expect(parseMapMessage(JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: 'x'.repeat(65) } }))).toBeNull();
  });
});

describe('route service gate (G07, P14-T04)', () => {
  it('is open by owner decision OD-11 while tiles and geocoding stay closed', () => {
    expect(releaseGates.routeService).toBe(true);
    expect(releaseGates.mapProviders).toBe(false);
  });
});
