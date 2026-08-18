/**
 * Picking an image and reading its bytes for a Supabase Storage upload.
 *
 * ── The bug this fixes ──────────────────────────────────────────────────────────
 * Submitting an incident report with a photo failed with:
 *
 *   Photo upload failed: Call to function 'FileSystemFile.bytes' has been rejected.
 *   → Caused by: Missing 'READ' permission for accessing the file.
 *
 * Cause: the screens picked with `DocumentPicker.getDocumentAsync({ copyToCacheDirectory:
 * true })` and then read the result with `new File(asset.uri).arrayBuffer()`. On Android
 * the picker copies the document into the *host app's* `context.cacheDir`
 * (`cache/DocumentPicker/…`) and hands back a `file://` URI. `expo-file-system` (SDK 54+)
 * validates every read against its own permission service, which only grants READ for
 * paths it considers app-owned — and under Expo Go / scoped storage that copy is not one
 * of them. So the picker succeeds, the thumbnail renders (expo-image reads it through a
 * different path), and only the upload fails.
 *
 * Fix: pick through `File.pickFileAsync()` instead. The file system module runs the
 * system picker itself, calls `takePersistableUriPermission()` on the result, and returns
 * a `File` bound to the `content://` URI — which its permission check accepts
 * unconditionally (content URIs carry their own grant). On iOS it hands back a temporary
 * copy inside the app container. `DocumentPicker` stays as a fallback for providers that
 * refuse a persistable grant; there we deliberately skip the cache copy on Android so we
 * keep the readable `content://` URI.
 *
 * Docs: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/** Mime types the `incident-photos` and `id-documents` buckets accept (migrations 0020 / 0025). */
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface PickedImage {
  uri: string;
  mimeType: string;
  /** Bytes, or `null` when the provider does not report a size. */
  size: number | null;
  /**
   * Best-effort file name for display. Content providers often expose only an opaque
   * document id, so use `displayName` in the UI rather than this.
   */
  name: string;
}

/**
 * A label safe to show the resident. `File.pickFileAsync` derives `name` from the
 * `content://` URI's last segment, which is usually a bare document id ("1000000042"),
 * so anything without a file extension is replaced with a generic description.
 */
export function displayName(image: PickedImage): string {
  return /\.[a-z0-9]{2,5}$/i.test(image.name)
    ? image.name
    : `Selected image (${imageExtension(image.mimeType).toUpperCase()})`;
}

/** Storage-path extension for a mime type. Defaults to `jpg` for `image/jpeg` and anything odd. */
export function imageExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Opens the system image picker.
 *
 * @returns the picked image, or `null` when the user cancelled.
 */
export async function pickImageAsset(): Promise<PickedImage | null> {
  try {
    const picked = await File.pickFileAsync({ mimeTypes: [...ACCEPTED_IMAGE_MIME_TYPES] });
    if (picked.canceled) return null;

    const file = picked.result;
    return {
      uri: file.uri,
      mimeType: file.type ?? 'image/jpeg',
      size: file.size ?? null,
      name: file.name,
    };
  } catch {
    // Falls through to DocumentPicker — e.g. a content provider that refuses a
    // persistable URI grant, or web, where pickFileAsync is not implemented.
  }

  const picked = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    // Android: the cache copy is exactly what expo-file-system refuses to read (see the
    // file header), so keep the original content:// URI. iOS/web: the copy lands inside
    // the app container and reads fine.
    copyToCacheDirectory: Platform.OS !== 'android',
  });

  if (picked.canceled || !picked.assets[0]) return null;

  const asset = picked.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.size ?? null,
    name: asset.name,
  };
}

/**
 * Reads a picked image into the byte array `supabase.storage.upload()` expects.
 *
 * @throws a resident-readable Error when the file can no longer be read (the URI grant
 *         was revoked, or the file was deleted between picking and submitting).
 */
export async function readImageBytes(image: PickedImage): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    // DocumentPicker returns a blob:/data: URL on web; expo-file-system cannot open it.
    const response = await fetch(image.uri);
    return new Uint8Array(await response.arrayBuffer());
  }

  try {
    return await new File(image.uri).bytes();
  } catch (err) {
    if (__DEV__) console.warn('readImageBytes failed', image.uri, err);
    throw new Error(
      'Could not read the selected image. Please remove it and pick it again from your device.',
    );
  }
}

/** `true` when the image is within the per-file byte limit of its destination bucket. */
export function isWithinSizeLimit(image: PickedImage, maxBytes: number): boolean {
  return image.size === null || image.size <= maxBytes;
}
