import type { LatLng } from '@barangayan/shared';
import { DataError } from '../../data/outcome';
import type { ConcernInsert } from '../../data/resident-api';
import type { DataScope } from '../../data/scope';
import { residentError } from '../../lib/errors';
import { ownedPath, UPLOAD_POLICIES, type ValidatedFile } from '../../lib/file-validation';
import { uploadOwned, type BucketApi, type createStagedUploads } from '../../lib/staged-uploads';
import { buildConcern, type ConcernFields } from './concern-form';

type Staged = ReturnType<typeof createStagedUploads>;
const BUCKET = UPLOAD_POLICIES['incident-photo'].bucket;

/**
 * An uncommitted filing: the id that will become the concern's id (the idempotency key) and the
 * storage paths of the photos already uploaded for it. It is kept in protected storage, so a
 * restart after a lost reply can reconcile or resend the same filing instead of creating another.
 */
export type ConcernAttempt = { id: string; paths: string[] };

export type SubmitDeps = {
  bucket: BucketApi;
  staged: Staged;
  scope: DataScope & { userId: string };
  /** Public address of an object in the `incident-photos` bucket. */
  publicUrl: (path: string) => string;
  create: (concern: ConcernInsert) => Promise<void>;
  /** Stores the attempt before it is sent (null clears it); reports whether protected storage accepted it. */
  persistAttempt: (attempt: ConcernAttempt | null) => Promise<boolean>;
  newId: () => string;
};

export type SubmitOutcome =
  /** The concern exists on the server. */
  | { kind: 'committed'; id: string }
  /** A photo could not be uploaded: nothing was filed and every photo uploaded so far was removed. */
  | { kind: 'upload-failed'; message: string }
  /** The server definitely refused the report: nothing was filed and the uploaded photos were removed. */
  | { kind: 'rejected'; message: string }
  /** The report may have been filed. Only a check or an unchanged resend of this attempt is safe. */
  | { kind: 'unknown'; message: string; attempt: ConcernAttempt };

/** Removes uploaded objects the resident may delete; a failed removal keeps the staged reference for later cleanup. */
async function discard(deps: Pick<SubmitDeps, 'bucket' | 'staged' | 'scope'>, paths: readonly string[]): Promise<void> {
  if (!paths.length) return;
  const removed = await deps.bucket.remove([...paths]).then((result) => !result.error, () => false);
  if (!removed) return;
  for (const path of paths) await deps.staged.link(deps.scope, BUCKET, path).catch(() => undefined);
}

async function settle(deps: Pick<SubmitDeps, 'staged' | 'scope' | 'persistAttempt'>, attempt: ConcernAttempt): Promise<SubmitOutcome> {
  for (const path of attempt.paths) await deps.staged.link(deps.scope, BUCKET, path).catch(() => undefined);
  await deps.persistAttempt(null).catch(() => false);
  return { kind: 'committed', id: attempt.id };
}

/**
 * Files one concern (A33-031…035). Photos are uploaded first to immutable owned paths, then the
 * concern is created with an app-chosen id. A definite refusal removes the fresh uploads; an
 * uncertain reply keeps them and reports `unknown` so the caller reconciles instead of resending
 * blindly. `attempt` is the unconfirmed filing of an earlier run: its photos are reused.
 */
export async function submitConcern(deps: SubmitDeps, input: { fields: ConcernFields; position: LatLng; photos: readonly ValidatedFile[]; attempt: ConcernAttempt | null; onProgress?: (done: number, total: number) => void }): Promise<SubmitOutcome> {
  let attempt = input.attempt;
  if (!attempt) {
    const id = deps.newId();
    const paths: string[] = [];
    for (const [index, photo] of input.photos.entries()) {
      const path = ownedPath(deps.scope.userId, id, `photo-${index + 1}`, photo);
      input.onProgress?.(index + 1, input.photos.length);
      try {
        await deps.staged.stage(deps.scope, BUCKET, path).catch(() => undefined);
        paths.push(path);
        await uploadOwned(deps.bucket, deps.scope.userId, path, photo);
      } catch (failure) {
        await discard(deps, paths);
        return { kind: 'upload-failed', message: `Photo ${index + 1} of ${input.photos.length} could not be uploaded. ${residentError(failure)} Your report is still here, so you can try again.` };
      }
    }
    attempt = { id, paths };
  }
  const saved = await deps.persistAttempt(attempt).catch(() => false);
  try {
    await deps.create(buildConcern(attempt.id, input.fields, input.position, attempt.paths.map(deps.publicUrl)));
  } catch (failure) {
    const message = residentError(failure);
    if (failure instanceof DataError && failure.kind === 'unknown-commit') {
      return { kind: 'unknown', attempt, message: saved ? message : `${message} Your report could not be kept on this device, so keep this screen open until it is confirmed.` };
    }
    await discard(deps, attempt.paths);
    await deps.persistAttempt(null).catch(() => false);
    return { kind: 'rejected', message };
  }
  return settle(deps, attempt);
}

export type Resolution = 'committed' | 'not-found' | 'unreachable';

/** Asks the server whether an unconfirmed attempt was filed; a found concern settles the attempt. */
export async function confirmAttempt(deps: Pick<SubmitDeps, 'staged' | 'scope' | 'persistAttempt'>, attempt: ConcernAttempt, exists: () => Promise<boolean>): Promise<Resolution> {
  let found: boolean;
  try { found = await exists(); } catch { return 'unreachable'; }
  if (!found) return 'not-found';
  await settle(deps, attempt);
  return 'committed';
}

/**
 * Gives up an unconfirmed attempt the resident chose to discard. The photos are removed only when
 * the server confirms that no concern was filed; an unreachable server or a filed concern keeps them.
 */
export async function abandonAttempt(deps: SubmitDeps, attempt: ConcernAttempt, exists: () => Promise<boolean>): Promise<Resolution> {
  const resolution = await confirmAttempt(deps, attempt, exists);
  if (resolution !== 'not-found') return resolution;
  await discard(deps, attempt.paths);
  await deps.persistAttempt(null).catch(() => false);
  return 'not-found';
}
