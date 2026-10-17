import { residentServiceError, ResidentSubmissionAttempt, supportingAttachmentMetadata, type Database, type ServiceSubmissionInput } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataScope } from '../../data/scope';
import { residentError } from '../../lib/errors';
import { ownedPath, UPLOAD_POLICIES, type ValidatedFile } from '../../lib/file-validation';
import type { createStagedUploads, BucketApi } from '../../lib/staged-uploads';
import { uploadOwned } from '../../lib/staged-uploads';
import type { Evidence, Requirement, SubmissionDraft } from './request-form';

type Staged = ReturnType<typeof createStagedUploads>;

export type UploadState = 'waiting' | 'uploading' | 'uploaded' | 'failed';
export type UploadDeps = { bucket: BucketApi; staged: Staged; scope: DataScope & { userId: string } };

export type UploadResult = { ok: true } | { ok: false; message: string };

/**
 * Uploads each selected file once to its immutable owned path (`upsert: false`). A file that
 * already reached storage is not sent again, so a retry after a failure only sends what is
 * missing. The path is staged before the upload so an interrupted upload stays observable.
 */
export async function uploadEvidence(deps: UploadDeps, evidence: Evidence, onState: (code: Requirement, state: UploadState) => void): Promise<UploadResult> {
  const entries = (Object.entries(evidence) as [Requirement, NonNullable<Evidence[Requirement]>][]);
  for (const [code] of entries) onState(code, 'waiting');
  for (const [code, file] of entries) {
    const attachment = supportingAttachmentMetadata(deps.scope.userId, { uploadId: file.uploadId, requirementCode: code, mimeType: file.mimeType, sizeBytes: file.bytes.length });
    if (!file.uploaded) {
      onState(code, 'uploading');
      const validated: ValidatedFile = { bytes: file.bytes, mimeType: file.mimeType, extension: attachment.path.split('.').pop() ?? '' };
      try {
        await deps.staged.stage(deps.scope, UPLOAD_POLICIES['request-attachment'].bucket, attachment.path).catch(() => undefined);
        await uploadOwned(deps.bucket, deps.scope.userId, attachment.path, validated);
      } catch (failure) {
        onState(code, 'failed');
        return { ok: false, message: `${residentError(failure)} Your file is still selected, so you can try again.` };
      }
      file.uploaded = true;
    }
    onState(code, 'uploaded');
  }
  return { ok: true };
}

export type LegacyIdResult = { ok: true; path: string } | { ok: false; message: string };

/** The optional ID photo of a legacy request (A11-040…044), stored privately before the request is created. */
export async function uploadLegacyId(deps: Pick<UploadDeps, 'staged' | 'scope'> & { bucket: BucketApi }, uploadId: string, file: ValidatedFile): Promise<LegacyIdResult> {
  const path = ownedPath(deps.scope.userId, uploadId, 'id', file);
  try {
    await deps.staged.stage(deps.scope, UPLOAD_POLICIES['id-image'].bucket, path).catch(() => undefined);
    await uploadOwned(deps.bucket, deps.scope.userId, path, file);
    return { ok: true, path };
  } catch (failure) {
    return { ok: false, message: `${residentError(failure)} Your photo is still selected, so you can try again.` };
  }
}

export type SendDeps = {
  client: SupabaseClient<Database>;
  staged: Staged;
  scope: DataScope & { userId: string };
  /** Stores the exact payload before it is sent (null clears it); reports whether protected storage accepted it. */
  persistAttempt: (payload: ServiceSubmissionInput | null) => Promise<boolean>;
};

export type SendOutcome =
  | { kind: 'committed'; id: string; reference: string }
  /** The server definitely refused it: nothing was created and the form may be corrected. `freshKey` asks for a new operation key. */
  | { kind: 'rejected'; message: string; freshKey: boolean }
  /** The request may have been created. Only an unchanged retry (same key, same payload) is safe. */
  | { kind: 'unknown'; message: string };

const DEFINITE_CODES = new Set(['22023', '42501']);
const failureCode = (failure: unknown) => (failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '');
const failureMessage = (failure: unknown) => (failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '');
const hasIssues = (failure: unknown) => !!failure && typeof failure === 'object' && 'issues' in failure && Array.isArray(failure.issues);

/**
 * Sends one request through `submit_service_request` (never a table insert). The attempt
 * binds the UUID key, owner and exact payload; an uncertain reply is reported as `unknown`
 * and the form stays locked to that payload until the resident retries unchanged.
 */
export async function sendRequest(deps: SendDeps, attempt: ResidentSubmissionAttempt, payload: SubmissionDraft): Promise<SendOutcome> {
  const saved = await deps.persistAttempt({ ...payload, idempotencyKey: attempt.key }).catch(() => false);
  try {
    const row = await attempt.submit(deps.client, payload);
    for (const file of payload.attachments) await deps.staged.link(deps.scope, UPLOAD_POLICIES['request-attachment'].bucket, file.path).catch(() => undefined);
    if (payload.legacyIdPath) await deps.staged.link(deps.scope, UPLOAD_POLICIES['id-image'].bucket, payload.legacyIdPath).catch(() => undefined);
    return { kind: 'committed', id: row.id, reference: row.reference_number };
  } catch (failure) {
    const message = residentServiceError(failure, 'submit');
    // Local validation failed before anything was sent, or the server reported a definite refusal.
    if (hasIssues(failure) || DEFINITE_CODES.has(failureCode(failure))) {
      await deps.persistAttempt(null).catch(() => false);
      return { kind: 'rejected', message, freshKey: failureMessage(failure).includes('idempotency_conflict') };
    }
    return { kind: 'unknown', message: saved ? message : `${message} Your details could not be kept on this device, so keep this screen open until the request is confirmed.` };
  }
}
