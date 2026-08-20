/**
 * Web-native rewrite of apps/resident-android-mobile/src/lib/image-upload.ts — plain
 * File API instead of expo-file-system/expo-document-picker, since the browser already
 * hands back a real File with readable bytes (none of the content://-URI permission
 * problems the mobile version's header documents). Same public contract (extension
 * lookup, size check) so callers read the same either way.
 */

/** Mime types the `incident-photos` and `id-documents` buckets accept (migrations 0020 / 0025). */
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Storage-path extension for a mime type. Defaults to `jpg` for `image/jpeg` and anything odd. */
export function imageExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/** `true` when the file is within the per-file byte limit of its destination bucket. */
export function isWithinSizeLimit(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}

/** `true` when the file's mime type is one of the accepted image types. */
export function isAcceptedImageType(file: File): boolean {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
}
