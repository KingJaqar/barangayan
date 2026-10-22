import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { TempFile } from '../features/payments/native-actions';
import { emptyListing } from './private-files-core';

/** The one cache folder for files that hold a resident's own data: exports, receipts and QR images. */
const PRIVATE_FOLDER = 'Barangayan-private';
/** Cache folders the SDK modules write picked photos, manipulated photos and generated PDFs to. */
const SDK_TEMP_FOLDERS = ['Print', 'ImagePicker', 'ImageManipulator', 'Camera'] as const;

/** A named file inside the private cache folder. `remove` is safe to call twice. */
export function privateFile(name: string): TempFile & { file: File } {
  const directory = new Directory(Paths.cache, PRIVATE_FOLDER);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, name);
  return { file, uri: file.uri, remove() { if (file.exists) file.delete(); } };
}

/**
 * Removes every temporary file that could hold a resident's data. It runs at logout and at launch, so a file left behind by a
 * killed process, a failed share or an earlier account never outlives the session that made it. It never throws; the result says
 * whether everything was removed.
 */
export function purgePrivateFiles(): boolean {
  // A browser test target has no cache folder to clean.
  if (Platform.OS === 'web') return true;
  try {
    const failed = [new Directory(Paths.cache, PRIVATE_FOLDER), ...SDK_TEMP_FOLDERS.map((folder) => new Directory(Paths.cache, folder))]
      .reduce((total, directory) => total + emptyListing(directory), 0);
    return failed === 0;
  } catch {
    // The cache folder is unreadable: nothing was removed.
    return false;
  }
}
