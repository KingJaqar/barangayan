import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';

/**
 * The three QR meanings stay separate (plan §6.4): an evacuation-center code (scanned for check-in, shown and shared
 * from "Show QR"), a household code (shown to authorized staff) and everything else. A household code is never
 * accepted as a center credential.
 */

/** The text of a center check-in code, validated against the shared schema before it is ever drawn. */
export function centerPayload(center: { id: string; name: string }, barangayId: string): string {
  return JSON.stringify(evacuationCenterQrPayloadSchema.parse({ type: 'EVACUATION_CENTER_CHECKIN', version: '1.0', center_id: center.id, center_name: center.name, barangay_id: barangayId }));
}

/** The text of the resident's household code: the profile id only, nothing else about the person (matches `generate-household-qr`). */
export function householdPayload(profileId: string): string {
  return JSON.stringify({ type: 'household', profileId });
}

/** Scanned text longer than this is not a check-in code; it is rejected before any parsing. */
export const MAX_SCAN_LENGTH = 2048;

export type ScanRejection = 'empty' | 'too-long' | 'malformed' | 'not-center-code' | 'household-code' | 'foreign-barangay';
export type ScanParse = { ok: true; centerId: string } | { ok: false; reason: ScanRejection; message: string };

const REJECTION_COPY: Record<ScanRejection, string> = {
  empty: 'This QR code is empty. Scan the evacuation center’s check-in code.',
  'too-long': 'This is not an evacuation center check-in code.',
  malformed: 'This QR code does not contain a valid check-in code. Scan the evacuation center’s check-in code.',
  'not-center-code': 'This is not an evacuation center check-in code.',
  'household-code': 'This is a household code. It is shown to center staff, not scanned here. Scan the evacuation center’s check-in code instead.',
  'foreign-barangay': 'This QR code belongs to a different barangay, so you cannot check in with it.',
};

function reject(reason: ScanRejection): ScanParse {
  return { ok: false, reason, message: REJECTION_COPY[reason] };
}

/** Validates scanned text: size, JSON, the center check-in schema, then the resident's own barangay. Nothing is sent to the server before this passes. */
export function parseCenterScan(raw: string, barangayId: string): ScanParse {
  const text = raw.trim();
  if (!text) return reject('empty');
  if (text.length > MAX_SCAN_LENGTH) return reject('too-long');
  let value: unknown;
  try { value = JSON.parse(text); } catch { return reject('malformed'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject('not-center-code');
  if ((value as { type?: unknown }).type === 'household') return reject('household-code');
  const parsed = evacuationCenterQrPayloadSchema.safeParse(value);
  if (!parsed.success) return reject('not-center-code');
  if (parsed.data.barangay_id.toLowerCase() !== barangayId.toLowerCase()) return reject('foreign-barangay');
  return { ok: true, centerId: parsed.data.center_id };
}
