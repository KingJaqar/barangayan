/** No gate may be opened without environment-specific evidence in the implementation plan's execution-ledger section. */
export const releaseGates = Object.freeze({
  householdEditing: false,
  privateIdUploads: false,
  qrph: false,
  pickup: false,
  mapProviders: false,
  emergencyContent: false,
  evacuationCheckin: false,
  householdQr: false,
  publicIncidents: false,
  medicalRegistration: false,
  completeExport: false,
  accountDeletion: false,
  remotePush: false,
});

export function requireGate(gate: keyof typeof releaseGates): void {
  if (!releaseGates[gate]) throw new Error('This service is not available yet. Please contact your barangay for assistance.');
}
