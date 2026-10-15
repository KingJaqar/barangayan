/**
 * Stable public failure classification for every data boundary (plan P02-T01, B.1).
 * Raw provider errors can contain SQL, URLs or personal data, so screens only ever see
 * a `FailureKind` (and the resident copy derived from it in `lib/errors.ts`).
 */
export type FailureKind =
  | 'cancelled' // the caller aborted (screen left, superseded read)
  | 'offline' // no response reached the app
  | 'timeout' // the request ran out of time before a response
  | 'session' // expired or missing session
  | 'authorization' // RLS/role/tenant denial
  | 'not-found' // the addressed record does not exist for this account
  | 'conflict' // uniqueness/concurrency conflict
  | 'rate-limited'
  | 'validation' // the server rejected the input
  | 'schema' // the response did not match the expected contract
  | 'http' // other HTTP failure
  | 'unknown-commit' // a write may or may not have committed; reconcile, never blind-retry
  | 'unknown';

export class DataError extends Error {
  constructor(readonly kind: FailureKind, message: string = kind, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'DataError';
  }
}

type Failure = { code?: unknown; message?: unknown; hint?: unknown; status?: unknown; name?: unknown; issues?: unknown };
const SESSION_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303', 'bad_jwt', 'refresh_token_not_found', 'session_not_found', 'session_expired', 'no_authorization']);
const VALIDATION_CODES = new Set(['22023', '22P02', '23502', '23514', '22001', '22007', '22008', 'P0001']);

function field(value: unknown, key: keyof Failure): unknown {
  return value && typeof value === 'object' && key in value ? (value as Failure)[key] : undefined;
}

/**
 * Classifies a thrown value or a supabase-js `{ error, status }` pair.
 * `write: true` turns transport failures into `unknown-commit`: the request may have
 * reached the server, so the caller must reconcile instead of retrying.
 */
export function classifyFailure(error: unknown, options: { status?: number; write?: boolean; signal?: AbortSignal } = {}): FailureKind {
  if (error instanceof DataError) return error.kind;
  if (options.signal?.aborted) return 'cancelled';
  // Local schema validation (zod) fails before any request is sent.
  if (Array.isArray(field(error, 'issues'))) return 'validation';
  const code = String(field(error, 'code') ?? '');
  const name = String(field(error, 'name') ?? '');
  const message = String(field(error, 'message') ?? '');
  const hint = String(field(error, 'hint') ?? '');
  const rawStatus = options.status ?? field(error, 'status');
  const status = typeof rawStatus === 'number' ? rawStatus : undefined;

  const aborted = name === 'AbortError' || code === 'ABORT_ERR' || message.startsWith('AbortError') || hint.startsWith('Request was aborted');
  // postgrest-js reports transport failures with status 0 and the fetch error in `message`;
  // storage-js wraps them in a StorageUnknownError without a status.
  const transport = aborted || status === 0 || name === 'StorageUnknownError' || /^(TypeError|FetchError): /.test(message) || message === 'Network request failed';
  if (transport) {
    if (options.write) return 'unknown-commit';
    return aborted ? 'timeout' : 'offline';
  }
  if (SESSION_CODES.has(code) || status === 401) return 'session';
  if (code === '42501' || code === 'P0010' || code === 'P0011' || code === 'P0012' || status === 403) return 'authorization';
  if (code === '23505' || code === '40001' || code === 'P0004' || status === 409) return 'conflict';
  if (code === 'PGRST116' || code === 'P0002' || status === 404) return 'not-found';
  if (code.includes('rate_limit') || status === 429) return 'rate-limited';
  if (VALIDATION_CODES.has(code) || code === 'P0003' || status === 400 || status === 422) return 'validation';
  if (status !== undefined && status >= 500) return options.write ? 'unknown-commit' : 'http';
  if (status !== undefined && status >= 400) return 'http';
  return options.write ? 'unknown-commit' : 'unknown';
}

/** Wraps any failure into a `DataError` without copying raw provider text into the message. */
export function toDataError(error: unknown, options: { status?: number; write?: boolean; signal?: AbortSignal } = {}): DataError {
  if (error instanceof DataError) return error;
  const code = field(error, 'code');
  return new DataError(classifyFailure(error, options), undefined, options.status, typeof code === 'string' && code ? code : undefined);
}

export function isCancelled(error: unknown): boolean {
  return error instanceof DataError ? error.kind === 'cancelled' : field(error, 'name') === 'AbortError';
}
