/** Matches the server cooldown between exports (EXPORT_COOLDOWN_MS in the export function). The server decides and answers 429 with Retry-After; this only avoids asking again straight after a completed export. */
export const EXPORT_COOLDOWN_SECONDS = 60;
