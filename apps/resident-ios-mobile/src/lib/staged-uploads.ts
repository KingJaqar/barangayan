import { z } from 'zod';
import { DataError, toDataError } from '../data/outcome';
import type { DataScope } from '../data/scope';
import { isOwnedPath, UPLOAD_POLICIES, type UploadPolicy, type ValidatedFile } from './file-validation';
import type { ProtectedDrafts } from './protected-drafts';

/** The subset of a supabase-js storage bucket API this adapter uses. */
export type BucketApi = {
  upload(path: string, body: Uint8Array, options: { contentType: string; upsert: false }): Promise<{ error: unknown }>;
  download(path: string): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> } | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
};

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Uploads to an immutable owned path with `upsert: false` (plan §6.2). If the upload
 * fails — including a lost reply after the object was stored — the stored object is read
 * back; only identical bytes count as success. Otherwise the failure is reported with
 * write semantics (`unknown-commit` for transport failures), never overwritten.
 */
export async function uploadOwned(bucket: BucketApi, userId: string, path: string, file: ValidatedFile): Promise<void> {
  if (!isOwnedPath(path, userId)) throw new DataError('authorization', 'Uploads must use your own folder.');
  const { error } = await bucket.upload(path, file.bytes, { contentType: file.mimeType, upsert: false });
  if (!error) return;
  const stored = await bucket.download(path).catch(() => ({ data: null, error: true }));
  if (stored.data && sameBytes(new Uint8Array(await stored.data.arrayBuffer()), file.bytes)) return;
  throw toDataError(error, { write: true });
}

export type SignedPreview = { url: string; expiresAt: number };
export const PREVIEW_TTL_SECONDS = 300;
/** Re-request a preview this long before it expires, so an image never loads a dead URL. */
const EXPIRY_MARGIN_MS = 30_000;

/** Private (ID/attachment) preview: owner path only, HTTPS only, short-lived. */
export async function createSignedPreview(bucket: BucketApi, userId: string, path: string, now = Date.now()): Promise<SignedPreview> {
  if (!isOwnedPath(path, userId)) throw new DataError('authorization', 'This file is not available to your account.');
  const { data, error } = await bucket.createSignedUrl(path, PREVIEW_TTL_SECONDS);
  if (error) throw toDataError(error);
  const url = data?.signedUrl;
  if (!url || !url.startsWith('https://')) throw new DataError('schema', 'The preview link was not valid.');
  return { url, expiresAt: now + PREVIEW_TTL_SECONDS * 1000 };
}

export function previewExpired(preview: SignedPreview, now = Date.now()): boolean {
  return now >= preview.expiresAt - EXPIRY_MARGIN_MS;
}

// ---------------------------------------------------------------------------------------
// Staged-upload references: an object uploaded for a form that has not been linked to a
// committed record yet. Kept in protected storage so cleanup can find it after a restart.

const STAGED_KIND = 'staged-uploads';
const STAGED_VERSION = 1;
const stagedRef = z.object({ bucket: z.enum(['request-attachments', 'id-documents', 'incident-photos', 'profile-photos']), path: z.string(), stagedAt: z.number() });
export type StagedRef = z.infer<typeof stagedRef>;

export function createStagedUploads(store: ProtectedDrafts, now: () => number = Date.now) {
  const list = async (scope: DataScope) => (await store.read(scope, STAGED_KIND, STAGED_VERSION, z.array(stagedRef)))?.value ?? [];
  return {
    pending: list,
    /** Record before uploading, so an interrupted upload is still known to cleanup. */
    async stage(scope: DataScope, bucket: UploadPolicy['bucket'], path: string) {
      const refs = await list(scope);
      if (!refs.some((ref) => ref.path === path && ref.bucket === bucket)) await store.save(scope, STAGED_KIND, STAGED_VERSION, [...refs, { bucket, path, stagedAt: now() }]);
    },
    /** The committed record now references the object; it is no longer an orphan. */
    async link(scope: DataScope, bucket: UploadPolicy['bucket'], path: string) {
      const refs = await list(scope);
      await store.save(scope, STAGED_KIND, STAGED_VERSION, refs.filter((ref) => !(ref.path === path && ref.bucket === bucket)));
    },
    /**
     * Removes unlinked objects the resident may delete. Buckets whose policies forbid client
     * deletion (request attachments, ID evidence) are returned as `serverCleanupRequired`
     * and kept, so the omission is observable rather than silently forgotten.
     */
    async cleanup(scope: DataScope, buckets: (bucket: UploadPolicy['bucket']) => BucketApi) {
      if (!scope.userId) throw new DataError('session');
      const refs = await list(scope);
      const remaining: StagedRef[] = [];
      for (const ref of refs) {
        const deletable = Object.values(UPLOAD_POLICIES).some((policy) => policy.bucket === ref.bucket && policy.clientDeletable);
        if (!deletable || !isOwnedPath(ref.path, scope.userId)) { remaining.push(ref); continue; }
        const { error } = await buckets(ref.bucket).remove([ref.path]).catch((failure: unknown) => ({ error: failure }));
        if (error) remaining.push(ref);
      }
      await store.save(scope, STAGED_KIND, STAGED_VERSION, remaining);
      const serverCleanupRequired = remaining.filter((ref) => !Object.values(UPLOAD_POLICIES).some((policy) => policy.bucket === ref.bucket && policy.clientDeletable));
      return { removed: refs.length - remaining.length, failed: remaining.length - serverCleanupRequired.length, serverCleanupRequired };
    },
  };
}
