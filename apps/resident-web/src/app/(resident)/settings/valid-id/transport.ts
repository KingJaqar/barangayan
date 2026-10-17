import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Cancels the real request and bounds body reads as well as response headers. */
export async function deadlineFetch(input: RequestInfo | URL, init: RequestInit = {}, actionSignal?: AbortSignal): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const timeout = url.includes('/auth/v1/') ? 15000 : url.includes('/storage/v1/') ? 30000 : url.includes('/functions/v1/') ? 30000 : 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = AbortSignal.any([controller.signal, ...(init.signal ? [init.signal] : []), ...(actionSignal ? [actionSignal] : []), ...(input instanceof Request ? [input.signal] : [])]);
  try {
    const response = await fetch(input, { ...init, signal });
    // SDKs consume small JSON or <=5 MB image bodies. Buffer inside the deadline.
    const body = await response.arrayBuffer();
    return new Response([101, 204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { clearTimeout(timer); }
}

/** Isolated transport with the existing SSR cookie session and a single auth owner.
 * A second createBrowserClient creates a duplicate GoTrue warning in this SDK.
 * Delegate auth to the existing client; only this client's REST/Storage use the signal.
 */
export function createIdClient(signal: AbortSignal) {
  const session = createSupabaseBrowserClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('ID submission is unavailable. Please try again later.');
  const client = createClient<Database>(url, key, {
    accessToken: async () => {
      signal.throwIfAborted();
      const { data, error } = await session.auth.getSession();
      signal.throwIfAborted();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
    db: { retry: false },
    global: { fetch: (input, init) => deadlineFetch(input, init, signal) },
  });
  return new Proxy(client, { get(target, property, receiver) {
    return property === 'auth' ? session.auth : Reflect.get(target, property, receiver);
  } });
}

/** The action bound also covers browser APIs and SDK auth-lock waits. Network work
 * uses the same signal; this guard alone is never treated as proof a write failed. */
export function abortable<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException('Action ended', 'AbortError'));
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
