import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWalkingRoute } from './osrm';

const origin = { lat: 14.68, lng: 121.12 };
const destination = { lat: 14.69, lng: 121.13 };

describe('getWalkingRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns points/distance/duration on a successful OSRM response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distance: 500,
            duration: 420,
            geometry: { coordinates: [[121.12, 14.68], [121.125, 14.685], [121.13, 14.69]] },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const route = await getWalkingRoute(origin, destination);

    expect(route).not.toBeNull();
    expect(route!.distanceMeters).toBe(500);
    expect(route!.durationSeconds).toBe(420);
    expect(route!.points).toEqual([
      { lat: 14.68, lng: 121.12 },
      { lat: 14.685, lng: 121.125 },
      { lat: 14.69, lng: 121.13 },
    ]);
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await getWalkingRoute(origin, destination)).toBeNull();
  });

  it('returns null when the response has no routes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) }));
    expect(await getWalkingRoute(origin, destination)).toBeNull();
  });

  it('returns null when fetch throws (network error / timeout abort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await getWalkingRoute(origin, destination)).toBeNull();
  });
});
