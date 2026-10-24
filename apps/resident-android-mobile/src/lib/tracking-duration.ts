/** Readable duration summaries; exact detail stays available without a ticking clock. */
export function trackingDuration(seconds: number, exact = false): string {
  let remaining = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (!remaining) return exact ? '0 seconds' : 'Less than a minute';
  if (!exact && remaining < 60) return 'Less than a minute';
  const units = [
    [86400, 'day', 'day'],
    [3600, 'hour', 'hr'],
    [60, 'minute', 'min'],
    [1, 'second', 'sec'],
  ] as const;
  const parts: string[] = [];
  for (const [size, full, short] of units) {
    const count = Math.floor(remaining / size);
    remaining %= size;
    if (count && (exact || size >= 60)) {
      parts.push(`${count} ${exact ? full + (count === 1 ? '' : 's') : short + (size === 86400 && count !== 1 ? 's' : '')}`);
    }
    if (!exact && parts.length === 2) break;
  }
  return parts.join(exact ? ', ' : ' ');
}
