import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { File, type PickSingleFileResult } from 'expo-file-system';
import { PublicError } from './errors';
import { assertReadableSize, displayFileName, UPLOAD_POLICIES, validateUpload, type UploadPolicy, type UploadPurpose, type ValidatedFile } from './file-validation';
import type { BucketApi } from './staged-uploads';

export type PickedFile = ValidatedFile & { name: string };

/**
 * Picks one file through the iOS Files picker, limited to the purpose's types (plan
 * P02-T05, A51-020/021 iOS equivalent). The picker hands back an app-owned temporary copy
 * (`UIDocumentPickerViewController(…, asCopy: true)`, materialised from iCloud first); it
 * is read once and deleted, so identity material does not linger in temporary storage.
 * Returns null when the resident cancels.
 */
export async function pickUploadFile(purpose: UploadPurpose): Promise<PickedFile | null> {
  const policy = UPLOAD_POLICIES[purpose];
  let picked: PickSingleFileResult;
  try {
    picked = await File.pickFileAsync({ mimeTypes: [...policy.mimeTypes] });
  } catch {
    throw new PublicError('The file picker could not open. Try again.');
  }
  if (picked.canceled) return null;
  const file = picked.result;
  try {
    assertReadableSize(purpose, file.size > 0 ? file.size : null);
    let bytes: Uint8Array;
    try {
      bytes = await file.bytes();
    } catch {
      throw new PublicError('This file could not be read. If it is stored in iCloud, download it in the Files app, then choose it again.');
    }
    const valid = validateUpload(purpose, bytes);
    return { ...valid, name: displayFileName(file.name, valid.mimeType) };
  } finally {
    // Best effort: the copy lives in the app's temporary directory, which iOS also clears.
    try { if (file.exists) file.delete(); } catch { /* already removed by the system */ }
  }
}

export function storageBucket(client: SupabaseClient<Database>, bucket: UploadPolicy['bucket']): BucketApi {
  return client.storage.from(bucket);
}
