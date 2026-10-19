import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResidentReducedMotion } from '../hooks/use-resident-reduced-motion';

const runtime = vi.hoisted(() => ({
  effect: undefined as (() => void | (() => void)) | undefined,
  change: undefined as ((value: boolean) => void) | undefined,
  read: vi.fn<() => Promise<boolean>>(),
  update: vi.fn<(value: boolean) => void>(),
  remove: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('react', () => ({
  useState: () => [true, runtime.update],
  useEffect: (effect: () => void | (() => void)) => { runtime.effect = effect; },
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: runtime.read,
    addEventListener: (event: string, callback: (value: boolean) => void) => {
      runtime.subscribe(event);
      runtime.change = callback;
      return { remove: runtime.remove };
    },
  },
}));

describe('opt-in resident motion preference lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.effect = undefined;
    runtime.change = undefined;
    runtime.read.mockResolvedValue(false);
  });

  it('leaves legacy consumers without a query or listener', () => {
    useResidentReducedMotion(false);
    runtime.effect?.();
    expect(runtime.read).not.toHaveBeenCalled();
    expect(runtime.subscribe).not.toHaveBeenCalled();
  });

  it('starts conservatively and applies the native preference', async () => {
    expect(useResidentReducedMotion(true)).toBe(true);
    const cleanup = runtime.effect?.();
    await Promise.resolve();
    expect(runtime.update).toHaveBeenCalledWith(false);
    expect(runtime.subscribe).toHaveBeenCalledExactlyOnceWith('reduceMotionChanged');
    cleanup?.();
    expect(runtime.remove).toHaveBeenCalledOnce();
  });

  it('does not let a slow initial query overwrite a newer system event', async () => {
    let resolveRead: ((value: boolean) => void) | undefined;
    runtime.read.mockReturnValue(new Promise<boolean>((resolve) => { resolveRead = resolve; }));
    useResidentReducedMotion(true);
    const cleanup = runtime.effect?.();
    runtime.change?.(true);
    resolveRead?.(false);
    await Promise.resolve();
    expect(runtime.update.mock.calls).toEqual([[true]]);
    cleanup?.();
  });

  it('ignores query completion and events after unmount', async () => {
    useResidentReducedMotion(true);
    const cleanup = runtime.effect?.();
    cleanup?.();
    runtime.change?.(false);
    await Promise.resolve();
    expect(runtime.update).not.toHaveBeenCalled();
    expect(runtime.remove).toHaveBeenCalledOnce();
  });

  it('retains static motion when the native query is unavailable', async () => {
    runtime.read.mockRejectedValue(new Error('unavailable'));
    expect(useResidentReducedMotion(true)).toBe(true);
    const cleanup = runtime.effect?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runtime.update).not.toHaveBeenCalled();
    cleanup?.();
  });
});
