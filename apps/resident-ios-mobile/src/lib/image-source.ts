import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { PublicError } from './errors';
import { type ValidatedFile } from './file-validation';
import { prepareImage, type ImagePurpose } from './image-prep';

export type ImageOrigin = 'library' | 'camera';
export type PickedImage = ValidatedFile & { name: string };
/** A picked photo plus, when requested, a small JPEG rendition used only for on-screen previews. */
export type PreviewedImage = PickedImage & { preview: Uint8Array | null };

/** The longest edge of an on-screen preview rendition; the uploaded bytes are never the preview. */
const PREVIEW_EDGE = 720;
const PREVIEW_QUALITY = 0.6;

function removeQuietly(uri: string) {
  // Best effort: these copies live in the app's cache, which iOS also clears.
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* already removed */ }
}

async function requireCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PublicError(permission.canAskAgain
      ? 'Camera access is needed to take a photo. You can choose a photo from your library instead.'
      : 'Camera access is off for Barangayan. Turn it on in Settings, or choose a photo from your library.');
  }
}

/**
 * Reads one picked asset once, normalizes it to a permitted type and size (`expo-image-manipulator`)
 * and deletes every temporary copy, so identity material and report photos do not linger. The final
 * bytes — not the picker's declared type — are what is validated.
 */
async function prepareAsset(purpose: ImagePurpose, asset: ImagePicker.ImagePickerAsset, name: (extension: string) => string, withPreview: boolean): Promise<PreviewedImage> {
  const temporary: string[] = [asset.uri];
  try {
    let bytes: Uint8Array;
    try { bytes = await new File(asset.uri).bytes(); } catch {
      throw new PublicError('This photo could not be read. If it is stored in iCloud, wait for it to download, then try again.');
    }
    const dimensions = asset.width > 0 && asset.height > 0 ? { width: asset.width, height: asset.height } : null;
    const valid = await prepareImage(purpose, bytes, dimensions, async ({ longestEdge, quality }) => {
      const context = ImageManipulator.manipulate(asset.uri);
      if (longestEdge && dimensions) context.resize(dimensions.width >= dimensions.height ? { width: longestEdge } : { height: longestEdge });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
      temporary.push(saved.uri);
      return new File(saved.uri).bytes();
    });
    let preview: Uint8Array | null = null;
    if (withPreview) {
      try {
        const context = ImageManipulator.manipulate(asset.uri);
        if (dimensions && Math.max(dimensions.width, dimensions.height) > PREVIEW_EDGE) context.resize(dimensions.width >= dimensions.height ? { width: PREVIEW_EDGE } : { height: PREVIEW_EDGE });
        const saved = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: PREVIEW_QUALITY });
        temporary.push(saved.uri);
        preview = await new File(saved.uri).bytes();
      } catch {
        // The photo itself is valid; the screen shows a placeholder instead of a thumbnail.
      }
    }
    return { ...valid, name: name(valid.extension), preview };
  } finally {
    temporary.forEach(removeQuietly);
  }
}

/**
 * Picks or captures one photo for an avatar or ID side (OD-08 `expo-image-picker`). The
 * Photos library uses the system picker and shares only the selected photo; the camera asks
 * for permission when used. Returns null when the resident cancels.
 */
export async function pickImage(purpose: ImagePurpose, origin: ImageOrigin): Promise<PickedImage | null> {
  if (origin === 'camera') await requireCamera();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: purpose === 'avatar', aspect: [1, 1], quality: 1, exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  let result: ImagePicker.ImagePickerResult;
  try {
    result = origin === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  } catch {
    throw new PublicError(origin === 'camera' ? 'The camera could not open. Try again.' : 'Your photo library could not open. Try again.');
  }
  const asset = result.canceled ? null : result.assets[0] ?? null;
  if (!asset) return null;
  const { preview: _preview, ...image } = await prepareAsset(purpose, asset, (extension) => purpose === 'avatar' ? `Profile photo.${extension}` : `ID photo.${extension}`, false);
  return image;
}

export type PickedImages = { images: PreviewedImage[]; failures: string[] };

/**
 * Picks or captures up to `limit` photos for a concern. The library picker allows several
 * selections at once (iOS 14+); the camera returns one. Each photo is prepared on its own, so
 * one unreadable or unsuitable photo is reported without dropping the rest. A cancel returns an
 * empty result.
 */
export async function pickImages(purpose: ImagePurpose, origin: ImageOrigin, limit: number): Promise<PickedImages> {
  if (limit < 1) return { images: [], failures: [] };
  if (origin === 'camera') await requireCamera();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], allowsMultipleSelection: origin === 'library', selectionLimit: limit, orderedSelection: true, quality: 1, exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  let result: ImagePicker.ImagePickerResult;
  try {
    result = origin === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  } catch {
    throw new PublicError(origin === 'camera' ? 'The camera could not open. Try again.' : 'Your photo library could not open. Try again.');
  }
  const assets = result.canceled ? [] : result.assets.slice(0, limit);
  const images: PreviewedImage[] = [];
  const failures: string[] = [];
  for (const asset of assets) {
    try {
      images.push(await prepareAsset(purpose, asset, (extension) => `Photo.${extension}`, true));
    } catch (failure) {
      failures.push(failure instanceof PublicError ? failure.message : 'A photo could not be prepared. Choose a different photo.');
    }
  }
  return { images, failures };
}
