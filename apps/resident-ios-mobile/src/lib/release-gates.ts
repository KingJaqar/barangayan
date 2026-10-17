/**
 * No gate may be opened without environment-specific evidence in the implementation plan's execution-ledger section.
 * `qrph` and `pickup` are open by owner decision OD-09 (2026-10-16), for the non-device, non-live scope only: the
 * owner's evidence is the Android app's operation, not iOS or settlement evidence (plan §1 and C.3).
 * `emergencyContent` is open by owner decision OD-10 (2026-10-16), also for the non-device, non-live scope: the owner
 * waived the named-DRRM-owner/review-date requirement (PR-12) and accepts the same content the Android app shows.
 * `routeService` is open by owner decision OD-11 (2026-10-16), for the non-device, non-live scope: the resident's chosen starting point is sent to the
 * barangay's own `evacuation-route` function, as the resident web app already does. Tiles and geocoding stay behind `mapProviders`.
 * `evacuationCheckin` and `householdQr` are open by owner decision OD-12 (2026-10-16), also for the non-device, non-live scope: online
 * resident-only check-in against the server's receipt, and the household code generated on the device from the account id.
 */
export const releaseGates = Object.freeze({
  householdEditing: false,
  privateIdUploads: false,
  qrph: true,
  pickup: true,
  mapProviders: false,
  routeService: true,
  emergencyContent: true,
  evacuationCheckin: true,
  householdQr: true,
  publicIncidents: false,
  medicalRegistration: true,
  completeExport: false,
  accountDeletion: false,
  remotePush: false,
});

export function requireGate(gate: keyof typeof releaseGates): void {
  if (!releaseGates[gate]) throw new Error('This service is not available yet. Please contact your barangay for assistance.');
}
