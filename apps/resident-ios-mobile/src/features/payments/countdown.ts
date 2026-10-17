/** Whole seconds left until `expiresAt` (epoch ms), never negative. */
export function secondsRemaining(expiresAt: number, now: number): number {
  return Math.max(Math.ceil((expiresAt - now) / 1000), 0);
}

/** `m:ss`, for a QR payment attempt's expiry (never for service processing time). */
export function formatCountdown(seconds: number): string {
  const total = Math.max(Math.floor(seconds), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

