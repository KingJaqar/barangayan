/**
 * Shared ID-verification conventions — used by both apps/resident-android-mobile's
 * Profile screen and apps/resident-web's Profile form, which both write into the same
 * `profiles.id_type` (text, no enum) and `profiles.id_photo_urls` (text[]) columns.
 *
 * Two things are encoded into those existing columns instead of new DB schema:
 *  - "Other" ID type: when the resident picks "Other" and types their exact ID name,
 *    the saved value is `"Other: <their text>"` (prefix OTHER_ID_TYPE_PREFIX). On load,
 *    a value starting with that prefix re-selects "Other" and repopulates the free-text box.
 *  - Front/back photos: uploaded to fixed per-side storage paths
 *    `{profileId}/id-front.<ext>` / `{profileId}/id-back.<ext>` (upsert:true, so a
 *    re-upload replaces in place instead of accumulating extra files). Which array
 *    element is which side is determined by filename (idPhotoSide()), not array position.
 *
 * See the resident-web-id-verification-convention project memory for background.
 */

export const ID_TYPES = [
  'PhilSys',
  'Digital PhilSys',
  "Driver's License",
  'Passport',
  'SSS ID',
  "Voter's ID",
  'PhilHealth ID',
  'PRC ID',
  'UMID',
  'Postal ID',
  'Senior Citizen ID',
  'PWD ID',
  'GSIS ID',
  'TIN ID',
  'Barangay ID',
  'Other',
] as const;

/** profiles.id_type has no enum constraint — when the resident picks "Other" we persist
 * their exact ID name under this prefix instead of adding a new column. */
export const OTHER_ID_TYPE_PREFIX = 'Other: ';

/** Which side of the ID a stored id-documents path belongs to, based on the
 * `id-front.<ext>` / `id-back.<ext>` filename convention. */
export function idPhotoSide(path: string): 'front' | 'back' | null {
  const name = path.split('/').pop() ?? '';
  if (name.startsWith('id-front.')) return 'front';
  if (name.startsWith('id-back.')) return 'back';
  return null;
}

/** ID verification workflow states written to profiles.id_verification_status.
 * Residents may only ever write 'pending' (or leave it null/unchanged) — 'verified'
 * and 'verification_failed' are admin-only, enforced by the guard_id_verification_status
 * DB trigger (migrations 0041, 0089). */
export const ID_VERIFICATION_STATUSES = ['pending', 'verified', 'verification_failed'] as const;
export type IdVerificationStatus = (typeof ID_VERIFICATION_STATUSES)[number];
