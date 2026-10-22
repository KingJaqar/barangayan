import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What an Edge Function answered, without throwing for an error status: callers map each status to resident-facing copy. */
export type FunctionReply =
  | { kind: 'ok'; data: unknown }
  | { kind: 'http'; status: number; body: unknown; retryAfterSeconds: number | null }
  /** No reply arrived (offline, timeout, relay error). The function may or may not have run. */
  | { kind: 'unreachable' };

type FailureLike = { name?: string; context?: unknown };

function retryAfter(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 3600 ? Math.ceil(seconds) : null;
}

export async function callFunction(client: SupabaseClient<Database>, name: string, body: Record<string, unknown>): Promise<FunctionReply> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke(name, { body });
  } catch {
    return { kind: 'unreachable' };
  }
  if (!result.error) return { kind: 'ok', data: result.data };
  const failure = result.error as FailureLike;
  if (failure.name === 'FunctionsHttpError' && failure.context instanceof Response) {
    let parsed: unknown = null;
    try { parsed = await failure.context.json(); } catch { /* not JSON: the status alone classifies it */ }
    return { kind: 'http', status: failure.context.status, body: parsed, retryAfterSeconds: retryAfter(failure.context) };
  }
  return { kind: 'unreachable' };
}

/** The `error` text of a function error body, when it has one. */
export function replyError(body: unknown): string | null {
  const text = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null;
  return typeof text === 'string' ? text : null;
}
