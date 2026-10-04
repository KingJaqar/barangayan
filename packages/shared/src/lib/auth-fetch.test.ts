import { afterEach, expect, it, vi } from 'vitest';
import { boundedAuthFetch } from './auth-fetch';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('aborts a stalled Auth request instead of letting it sign in later', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_input, init) => {
    signal = init.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  }));
  const result = expect(boundedAuthFetch('https://test.invalid/auth/v1/token')).rejects.toThrow('aborted');
  await vi.advanceTimersByTimeAsync(15000);
  await result;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('preserves caller cancellation and clears its timeout after success', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  controller.abort();
  const fetchMock = vi.fn(async (_input, init) => {
    expect(init.signal.aborted).toBe(true);
    return new Response();
  });
  vi.stubGlobal('fetch', fetchMock);
  await boundedAuthFetch('https://test.invalid/auth/v1/user', { signal: controller.signal });
  expect(vi.getTimerCount()).toBe(0);
});

it('does not replace cancellation behavior for database or storage requests', async () => {
  const init = { signal: new AbortController().signal };
  const fetchMock = vi.fn(async () => new Response());
  vi.stubGlobal('fetch', fetchMock);
  await boundedAuthFetch('https://test.invalid/rest/v1/profiles', init);
  expect(fetchMock).toHaveBeenCalledWith('https://test.invalid/rest/v1/profiles', init);
});
