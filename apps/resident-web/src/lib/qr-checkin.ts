import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';

import { notify, type OperationId } from '@/lib/notify';

/**
 * Shared QR check-in rules for the live scanner and the image-upload fallback, so both
 * validate the same way and report the same single outcome.
 */

export type CenterQrParse = { ok: true; centerId: string } | { ok: false; title: string };

/** Validates a decoded QR string exactly like before: JSON, the center check-in schema,
 * then the resident's own barangay. The barangay/center payload is not changed. */
export function parseCenterQr(raw: string, userBarangayId: string | null): CenterQrParse {
  if (raw.length > 2048) return { ok: false, title: 'This QR code is too large.' };
  let payload: unknown;
  try {
    payload = JSON.parse(raw.trim());
  } catch {
    return { ok: false, title: 'This QR code does not contain a valid payload.' };
  }
  const parsed = evacuationCenterQrPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, title: 'This QR code is not a valid evacuation center check-in code.' };
  if (parsed.data.barangay_id !== userBarangayId) return { ok: false, title: 'This QR code belongs to a different barangay.' };
  return { ok: true, centerId: parsed.data.center_id };
}

/** A resident scan identifies a center; only staff can confirm attendance. */
export function explainStaffCheckIn(attempt: OperationId): void {
  notify.warning('Ask barangay staff to confirm your attendance.', {
    id: attempt,
    description: 'Show staff your Family QR and confirm who is present. This scan did not record attendance.',
  });
}
