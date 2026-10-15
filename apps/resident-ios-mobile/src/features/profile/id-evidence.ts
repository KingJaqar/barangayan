import { DataError, toDataError } from '../../data/outcome';
import { isOwnedPath, type ValidatedFile } from '../../lib/file-validation';
import type { BucketApi } from '../../lib/staged-uploads';
import { uploadOwned } from '../../lib/staged-uploads';

/** Every source ID type (A39-007…022). "Other" asks for the exact ID name. */
export const ID_TYPES = [
  'PhilSys', 'Digital PhilSys', "Driver's License", 'Passport', 'SSS ID', "Voter's ID", 'PhilHealth ID', 'PRC ID',
  'UMID', 'Postal ID', 'Senior Citizen ID', 'PWD ID', 'GSIS ID', 'TIN ID', 'Barangay ID', 'Other',
] as const;
export type IdType = typeof ID_TYPES[number];
/** The shared convention for a resident-named ID: `profiles.id_type` has no enum, so Android, web and admin read this prefix. */
export const OTHER_PREFIX = 'Other: ';
const ID_NAME_MAX = 200;

export function encodeIdType(type: IdType | '', otherName: string): { value: string } | { error: string } {
  if (!type) return { error: 'Select the type of ID' };
  if (type !== 'Other') return { value: type };
  const name = otherName.trim();
  if (!name) return { error: 'Enter the exact name of your ID' };
  if (name.length + OTHER_PREFIX.length > ID_NAME_MAX) return { error: 'Use a shorter ID name' };
  return { value: `${OTHER_PREFIX}${name}` };
}

export function decodeIdType(stored: string | null | undefined): { type: IdType | ''; other: string } {
  if (!stored) return { type: '', other: '' };
  if (stored.startsWith(OTHER_PREFIX)) return { type: 'Other', other: stored.slice(OTHER_PREFIX.length) };
  const known = ID_TYPES.find((type) => type === stored && type !== 'Other');
  // A legacy free-text type is shown as a named "Other" instead of being dropped.
  return known ? { type: known, other: '' } : { type: 'Other', other: stored };
}

export type IdSubmission = {
  id: string; version: number; id_type: string; front_path: string; back_path: string | null;
  decision: string; submitted_at: string; reviewed_at: string | null; rejection_reason: string | null;
};
export type IdState =
  | { kind: 'none' }
  | { kind: 'pending'; version: number }
  | { kind: 'verified'; version: number }
  | { kind: 'rejected'; version: number; reason: string | null }
  | { kind: 'revoked'; version: number; reason: string | null }
  /** The fresh read failed or returned a decision this version does not know: never shown as approved. */
  | { kind: 'unconfirmed' };

/** The state shown to the resident, derived only from a fresh read of the newest submission. */
export function idState(latest: IdSubmission | null): IdState {
  if (!latest) return { kind: 'none' };
  switch (latest.decision) {
    case 'pending': return { kind: 'pending', version: latest.version };
    case 'verified': return { kind: 'verified', version: latest.version };
    case 'verification_failed': return { kind: 'rejected', version: latest.version, reason: latest.rejection_reason };
    case 'revoked': return { kind: 'revoked', version: latest.version, reason: latest.rejection_reason };
    default: return { kind: 'unconfirmed' };
  }
}

export const ID_STATE_COPY: Record<IdState['kind'], { label: string; detail: string }> = {
  none: { label: 'Not submitted', detail: 'Choose your ID type and add clear photos of the front and back.' },
  pending: { label: 'Pending review', detail: 'Barangay staff have your ID and will review it. You can submit a new version if it was wrong.' },
  verified: { label: 'Verified', detail: 'Your ID was approved. Submitting a new version starts a new review.' },
  rejected: { label: 'Not approved', detail: 'Your ID was not approved. Review the reason, then submit clearer photos.' },
  revoked: { label: 'Approval withdrawn', detail: 'A previous approval was withdrawn. Submit your ID again for review.' },
  unconfirmed: { label: 'Status unavailable', detail: 'We could not confirm your ID status. It is not shown as approved until it is confirmed.' },
};

export const idVersionPath = (userId: string, submissionId: string, side: 'front' | 'back', file: Pick<ValidatedFile, 'extension'>) =>
  `${userId}/versions/${submissionId}/id-${side}.${file.extension}`;

export type PublishInput = { submissionId: string; idType: string; front: ValidatedFile; back: ValidatedFile };
export type PublishDeps = {
  bucket: BucketApi;
  /** Calls `publish_id_submission`; rejects with the provider error. */
  publish: (input: { submissionId: string; idType: string; frontPath: string; backPath: string }) => Promise<void>;
  /** Whether the version with this id is already committed for the signed-in resident. */
  exists: (submissionId: string) => Promise<boolean>;
};
export type PublishResult = { kind: 'published' } | { kind: 'unconfirmed' };

/**
 * Uploads both sides to one immutable version folder and publishes them as a single
 * version. Everything is retry-safe with the same `submissionId` and bytes: uploads are
 * insert-only and accept an identical existing object, and the server returns the same
 * version for an identical repeat. If the publication reply is lost, the version is looked
 * up before reporting anything.
 */
export async function publishIdVersion(deps: PublishDeps, userId: string, input: PublishInput): Promise<PublishResult> {
  const frontPath = idVersionPath(userId, input.submissionId, 'front', input.front);
  const backPath = idVersionPath(userId, input.submissionId, 'back', input.back);
  if (!isOwnedPath(frontPath, userId) || !isOwnedPath(backPath, userId)) throw new DataError('authorization', 'Uploads must use your own folder.');
  await uploadOwned(deps.bucket, userId, frontPath, input.front);
  await uploadOwned(deps.bucket, userId, backPath, input.back);
  try {
    await deps.publish({ submissionId: input.submissionId, idType: input.idType, frontPath, backPath });
    return { kind: 'published' };
  } catch (failure) {
    const error = toDataError(failure, { write: true });
    if (error.kind !== 'unknown-commit') throw error;
    return (await deps.exists(input.submissionId).catch(() => false)) ? { kind: 'published' } : { kind: 'unconfirmed' };
  }
}
