import { useEffect, useState } from 'react';

/**
 * Ticks once a second while `expiresAt` is set, returning ms remaining until it
 * (negative once past). Returns null when there's nothing to count down to, so callers
 * can hide/skip the timer entirely instead of showing a stale "0:00".
 *
 * Ported verbatim from apps/resident-android-mobile/src/hooks/use-countdown.ts (no
 * React Native dependencies — pure React). Shared by the OTP resend cooldown here and
 * Phase 3's QR PH payment countdown.
 */
export function useCountdown(expiresAt: number | null): number | null {
  // Lazy initialiser: Date.now() runs once at mount, not on every re-render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return expiresAt === null ? null : expiresAt - now;
}
