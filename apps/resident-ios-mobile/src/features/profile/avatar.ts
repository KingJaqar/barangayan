import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ownedPath, isOwnedPath, type ValidatedFile } from '../../lib/file-validation';
import { uploadOwned, type BucketApi } from '../../lib/staged-uploads';

const BUCKET = 'profile-photos';

/** The object path inside `profile-photos` for one of the resident's own public avatar URLs, or null. */
export function avatarPathFromUrl(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  let path: string;
  try { path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]); } catch { return null; }
  return isOwnedPath(path, userId) ? path : null;
}

export type AvatarResult =
  /** The new photo is stored and applied to the profile. */
  | { kind: 'applied'; path: string; url: string }
  /** The photo is stored but the profile still shows the old one; `retry` applies it again. */
  | { kind: 'not-applied'; path: string; url: string };

/**
 * Stores a new immutable avatar object, then points the profile at it. A new object per
 * change (never an overwrite) means a failed profile update cannot damage the current
 * photo, and the previous object is removed only after the profile no longer uses it.
 */
export async function replaceAvatar(
  client: SupabaseClient<Database>, bucket: BucketApi, userId: string, uploadId: string, file: ValidatedFile, previousUrl: string | null,
): Promise<AvatarResult> {
  const path = ownedPath(userId, uploadId, 'avatar', file);
  await uploadOwned(bucket, userId, path, file);
  const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const result = await applyAvatar(client, userId, url);
  if (!result) return { kind: 'not-applied', path, url };
  const previous = avatarPathFromUrl(previousUrl, userId);
  if (previous && previous !== path) await bucket.remove([previous]).catch(() => undefined);
  return { kind: 'applied', path, url };
}

/** Writes `avatar_url`; false means the write failed or its outcome is unknown (repeating it is safe). */
export async function applyAvatar(client: SupabaseClient<Database>, userId: string, url: string): Promise<boolean> {
  const { error } = await client.from('profiles').update({ avatar_url: url }).eq('id', userId);
  return !error;
}
