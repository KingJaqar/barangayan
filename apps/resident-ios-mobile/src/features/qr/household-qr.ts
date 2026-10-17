import { householdPayload } from './payloads';
import { qrDataUri } from './qr-image';

export type HouseholdQrState =
  | { kind: 'unavailable' }
  | { kind: 'no-account' }
  | { kind: 'mismatch' }
  | { kind: 'failed' }
  | { kind: 'ready'; dataUri: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The resident's household code. It is generated on the device from the signed-in account's own id, so nothing is sent to a QR
 * service and nothing is stored: there is no cache to leak to the next account. The code is made only when the account id
 * and the loaded profile are the same resident, and only while the `householdQr` gate is open.
 */
export function householdQrState(input: { available: boolean; accountId: string | null | undefined; profileId: string | null | undefined }): HouseholdQrState {
  if (!input.available) return { kind: 'unavailable' };
  if (!input.accountId || !input.profileId) return { kind: 'no-account' };
  if (input.accountId.toLowerCase() !== input.profileId.toLowerCase() || !UUID.test(input.accountId)) return { kind: 'mismatch' };
  try { return { kind: 'ready', dataUri: qrDataUri(householdPayload(input.accountId.toLowerCase())) }; } catch { return { kind: 'failed' }; }
}

/** Wording for a household code that is not showing; `ready` has none. */
export function householdQrNotice(state: Exclude<HouseholdQrState, { kind: 'ready' }>): string {
  switch (state.kind) {
    case 'unavailable': return 'The household QR code is not available in this version yet.';
    case 'no-account': return 'Log in to see your household QR code.';
    case 'mismatch': return 'Your household QR code could not be matched to your account. Sign out and sign in again.';
    case 'failed': return 'Your household QR code could not be created. Try again later.';
  }
}

/** What the code is for. It is not a check-in credential: the resident scanner does not read it, and household attendance is marked by staff. */
export const HOUSEHOLD_QR_GUIDANCE = 'This code identifies your household for barangay staff. Show it if center staff ask for it. Scanning it in this app does not check your family in — to check yourself in, scan the evacuation center’s QR code. Staff mark household members’ attendance themselves.';
