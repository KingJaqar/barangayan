/** Formats an integer centavos amount (as stored in `document_types.feeCentavos`, etc.) as PHP currency. */
export function formatCentavosAsPHP(centavos: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    centavos / 100,
  );
}

/**
 * Builds a display reference number for a vaccination/medicine drive registration,
 * e.g. `#VAC-007` — format locked by the mobile screen spec (Health & Medical section).
 */
export function formatDriveRegistrationNumber(sequence: number): string {
  return `#VAC-${String(sequence).padStart(3, '0')}`;
}

/** Short, locale-consistent date+time formatting used across both apps. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Short, locale-consistent date-only formatting (no time) — parallel to formatDateTime. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(iso));
}

/**
 * Buckets a document_types.processing_target_hours value into a human-readable
 * estimate. General/data-driven, not tied to any specific seeded document type — renders
 * correctly for any processing_target_hours value, now or in the future.
 */
export function formatProcessingTime(hours: number): string {
  if (hours <= 24) return 'Same Day';
  if (hours <= 48) return '1-2 Working Days';
  if (hours <= 120) return '3-5 Working Days';
  return `${Math.ceil(hours / 24)} Working Days`;
}

/**
 * 0-1 fill fraction for a service_request's progress bar, derived from real
 * created_at/target-hours data. Shared by the mobile RequestsList and Request Tracking
 * screens (and reusable from the web admin's request detail page) so there's exactly one
 * implementation of "how far along is this request." Never called for 'cancelled'.
 */
export function progressFraction(status: string, createdAt: string, targetHours: number): number {
  if (status === 'completed') return 1;
  const elapsedHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const raw = targetHours > 0 ? elapsedHours / targetHours : 0;
  // Floor so the bar never looks broken/empty; cap below 1 so only a real 'completed'
  // status ever shows a full bar (100% must mean "done", not "on track").
  const min = status === 'submitted' ? 0.08 : 0.15;
  return Math.min(Math.max(raw, min), 0.95);
}

/**
 * "Est. N hour(s)/day(s)" countdown label — a live per-request estimate, distinct from
 * formatProcessingTime's static catalog bucketing. Not called for 'completed' (always
 * "100%") or 'cancelled' (no progress row).
 */
export function estimateLabel(createdAt: string, targetHours: number): string {
  const elapsedHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const remainingHours = Math.max(targetHours - elapsedHours, 0);
  if (remainingHours <= 0) return 'Est. any moment';
  if (remainingHours <= 24) {
    const hours = Math.ceil(remainingHours);
    return `Est. ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.ceil(remainingHours / 24);
  return `Est. ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Time-Decay Weighted Frequency Score for trash/illegal-dumping incidents.
 *
 * Formula: score = confirmationCount * exp(-ln(2) / halfLifeDays * ageInDays)
 *
 * - `confirmationCount` acts as the frequency weight (more confirmations = higher score).
 * - `halfLifeDays` controls how fast old reports decay. A 14-day half-life means a
 *   10-confirmation report from 14 days ago scores ~5, while one from today scores 10.
 * - Returns 0 for incidents with 0 confirmations, regardless of age.
 */
export function trashIncidentScore(createdAt: string, confirmationCount: number, halfLifeDays: number): number {
  if (confirmationCount <= 0 || halfLifeDays <= 0) return 0;
  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  const decay = Math.exp(-Math.LN2 / halfLifeDays * ageInDays);
  return Math.round(confirmationCount * decay * 100) / 100;
}
