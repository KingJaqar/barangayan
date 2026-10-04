/** Bound Auth network calls without abandoning a request that could later sign in. */
export const boundedAuthFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/auth/v1/')) return fetch(input, init);
  const controller = new AbortController();
  const inherited = init?.signal ?? (typeof input === 'object' && 'signal' in input ? input.signal : null);
  const abort = () => controller.abort();
  if (inherited?.aborted) abort();
  inherited?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); inherited?.removeEventListener('abort', abort); }
};
