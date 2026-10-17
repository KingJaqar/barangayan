const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * Private destinations a sign-in may return to. Every entry is a path plus validated UUID
 * segments: no arbitrary URLs, query strings, tokens or personal records are ever retained.
 */
const ALLOWED: readonly RegExp[] = [
  /^\/services$/,
  new RegExp(`^/services/${UUID}$`),
  /^\/requests$/,
  /^\/reports$/,
  /^\/reports\/new$/,
  new RegExp(`^/reports/incidents/${UUID}$`),
  new RegExp(`^/request/${UUID}$`),
  new RegExp(`^/services/request/${UUID}$`),
  new RegExp(`^/health/register/${UUID}$`),
  /^\/settings\/(profile|change-password|email-verification)$/,
];

export const PENDING_DESTINATION_VERSION = 1;
export type PendingDestination = { v: typeof PENDING_DESTINATION_VERSION; path: string };

/** Normalizes a candidate (path only; query and hash dropped) or returns null when not allowlisted. */
export function pendingDestination(candidate: string | null | undefined): PendingDestination | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (/[\\\u0000-\u001f]/.test(candidate)) return null;
  const path = candidate.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return ALLOWED.some((pattern) => pattern.test(path)) ? { v: PENDING_DESTINATION_VERSION, path } : null;
}

/** The authorized return after setup: the allowlisted pending path, otherwise Home. */
export function returnPath(pending: PendingDestination | null): string {
  return pending?.v === PENDING_DESTINATION_VERSION ? pending.path : '/home';
}

/** Return target for the complete-profile remediation route; malformed or foreign values fall back to Home. */
export function safeReturnPath(value: string | null | undefined): string {
  return pendingDestination(value)?.path ?? '/home';
}
