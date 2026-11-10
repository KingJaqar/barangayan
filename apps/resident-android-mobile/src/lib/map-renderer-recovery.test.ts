import { describe, expect, it } from 'vitest';

import { MapRendererRecovery, RENDERER_DEATH_WINDOW_MS, mapRetained } from './map-renderer-recovery';

describe('MapRendererRecovery', () => {
  it('recreates the map after the system reclaims the renderer', () => {
    const recovery = new MapRendererRecovery();
    expect(recovery.record(0)).toBe('recreate');
    expect(recovery.record(RENDERER_DEATH_WINDOW_MS * 5)).toBe('recreate');
  });

  it('gives up on the third death within the window so a broken page cannot loop', () => {
    const recovery = new MapRendererRecovery();
    expect(recovery.record(0)).toBe('recreate');
    expect(recovery.record(1_000)).toBe('recreate');
    expect(recovery.record(2_000)).toBe('give-up');
  });

  it('forgets deaths older than the window', () => {
    const recovery = new MapRendererRecovery();
    recovery.record(0);
    recovery.record(1_000);
    expect(recovery.record(RENDERER_DEATH_WINDOW_MS + 1_000)).toBe('recreate');
  });
});

describe('mapRetained', () => {
  it('always keeps the focused map, even in the background', () => {
    expect(mapRetained({ focused: true, foreground: false, graceExpired: true })).toBe(true);
  });

  it('keeps a hidden map during the grace period while the app is open', () => {
    expect(mapRetained({ focused: false, foreground: true, graceExpired: false })).toBe(true);
  });

  it('releases a hidden map after the grace period or when the app is backgrounded', () => {
    expect(mapRetained({ focused: false, foreground: true, graceExpired: true })).toBe(false);
    expect(mapRetained({ focused: false, foreground: false, graceExpired: false })).toBe(false);
  });
});
