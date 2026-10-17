import { saveQrToPhotos, type SaveDeps, type SaveOutcome } from '../payments/native-actions';

/** What the share sheet reported; iOS says only whether an activity ran or the sheet was dismissed. */
export type ShareSheetResult = 'shared' | 'dismissed';
export type ShareOutcome = { status: 'opened' | 'cancelled' | 'failed'; message: string };

/** The raw encoded text of the center code, shared exactly as the Android app shares it (plus a one-line title). */
export function shareMessage(payload: string): string {
  return `Evacuation Center Check-in QR\n\n${payload}`;
}

/**
 * Shares the code's encoded text through the iOS share sheet. A closed sheet is neutral ("cancelled"): the system does not
 * say whether anything was sent, so no success is claimed for it.
 */
export async function shareCenterCode(share: (message: string) => Promise<ShareSheetResult>, payload: string): Promise<ShareOutcome> {
  try {
    const result = await share(shareMessage(payload));
    return result === 'shared'
      ? { status: 'opened', message: 'The code was shared.' }
      : { status: 'cancelled', message: 'Sharing was closed. Nothing was shared.' };
  } catch {
    return { status: 'failed', message: 'The code could not be shared. Try again.' };
  }
}

/** A readable, file-safe reference for the saved image: the center's name. */
export function imageReference(centerName: string): string {
  return `center-${centerName}`;
}

/** Saves the code image to Photos with the shared add-only flow (permission asked now, bytes verified, temporary file removed). */
export function saveCenterCode(deps: SaveDeps, dataUri: string, centerName: string): Promise<SaveOutcome> {
  return saveQrToPhotos(deps, dataUri, imageReference(centerName));
}
