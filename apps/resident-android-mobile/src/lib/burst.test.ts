import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coalesce } from './burst';

describe('coalesce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('turns a burst of calls into one action after the wait', () => {
    const action = vi.fn();
    const burst = coalesce(action, 300);
    for (let row = 0; row < 500; row++) burst.call();
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('keeps firing at the wait interval while events continue, so a long stream is never starved', () => {
    const action = vi.fn();
    const burst = coalesce(action, 300);
    for (let tick = 0; tick < 10; tick++) { burst.call(); vi.advanceTimersByTime(100); }
    expect(action).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(300);
    expect(action).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(1000);
    expect(action).toHaveBeenCalledTimes(4);
  });

  it('never fires after cancel and can be used again', () => {
    const action = vi.fn();
    const burst = coalesce(action, 300);
    burst.call();
    burst.cancel();
    vi.advanceTimersByTime(1000);
    expect(action).not.toHaveBeenCalled();
    burst.call();
    vi.advanceTimersByTime(300);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
