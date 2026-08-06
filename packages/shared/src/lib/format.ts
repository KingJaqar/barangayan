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
