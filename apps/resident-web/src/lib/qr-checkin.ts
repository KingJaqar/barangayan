import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';

import type { CheckInFailure, EvacuationCenterCheckin } from '@/hooks/use-qr-checkins';
import { notify, type OperationId } from '@/lib/notify';

/**
 * Shared QR check-in rules for the live scanner and the image-upload fallback, so both
 * validate the same way and report the same single outcome.
 */

export type CenterQrParse = { ok: true; centerId: string } | { ok: false; title: string };

/** Validates a decoded QR string exactly like before: JSON, the center check-in schema,
 * then the resident's own barangay. The barangay/center payload is not changed. */
export function parseCenterQr(raw: string, userBarangayId: string | null): CenterQrParse {
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

export type CheckInOutcome = 'recorded' | 'partial' | 'failed' | 'unconfirmed';

/**
 * Runs the existing check-in then household update and emits exactly one terminal
 * notification for the attempt:
 * - recorded: one success;
 * - partial (check-in saved, household update failed): one warning, no success;
 * - failed: one error (the check-in was rejected, nothing was recorded);
 * - unconfirmed (no answer arrived): one warning saying it may have been recorded — the
 *   resident should not scan again until they know. Nothing is retried.
 * Success is read from the existing return values (a row / true), never from a resolved
 * promise alone.
 */
export async function completeCheckIn(args: {
  centerId: string;
  attempt: OperationId;
  checkIn: (centerId: string) => Promise<EvacuationCenterCheckin | null>;
  updateHouseholdStatus: () => Promise<boolean>;
  lastCheckInFailure: () => CheckInFailure | null;
}): Promise<CheckInOutcome> {
  const { centerId, attempt, checkIn, updateHouseholdStatus, lastCheckInFailure } = args;
  const row = await checkIn(centerId);
  if (!row) {
    if (lastCheckInFailure() === 'unconfirmed') {
      notify.warning("We couldn't confirm your check-in.", {
        id: attempt,
        description: 'It may have been recorded. Ask center staff to confirm before you scan again.',
      });
      return 'unconfirmed';
    }
    notify.error("Couldn't record your check-in.", { id: attempt, description: 'Nothing was recorded. Please try again.' });
    return 'failed';
  }
  const householdUpdated = await updateHouseholdStatus();
  if (!householdUpdated) {
    notify.warning('Check-in recorded.', {
      id: attempt,
      description: "Your own check-in is saved, but we couldn't update your household's status. Tell center staff so they can mark your household.",
    });
    return 'partial';
  }
  notify.success('Your presence has been registered at the evacuation center.', { id: attempt });
  return 'recorded';
}
