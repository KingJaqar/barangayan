import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { PublicError } from './errors';
import { type ValidatedFile } from './file-validation';
import { prepareImage, type ImagePurpose } from './image-prep';

export type ImageOrigin = 'library' | 'camera';
export type PickedImage = ValidatedFile & { name: string };

function removeQuietly(uri: string) {
  // Best effort: these copies live in the app's cache, which iOS also clears.
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* already removed */ }
}

/**
 * Picks or captures one photo for an avatar or ID side (OD-08 `expo-image-picker`). The
 * Photos library uses the system picker and shares only the selected photo; the camera asks
 * for permission when used. The photo is read once, normalized to a permitted type and size
 * (`expo-image-manipulator`), and every temporary copy is deleted, so identity material does
 * not linger. Returns null when the resident cancels.
 */
export async function pickImage(purpose: ImagePurpose, origin: ImageOrigin): Promise<PickedImage | null> {
  if (origin === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new PublicError(permission.canAskAgain
        ? 'Camera access is needed to take a photo. You can choose a photo from your library instead.'
        : 'Camera access is off for Barangayan. Turn it on in Settings, or choose a photo from your library.');
    }
  }
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
    return { ...valid, name: purpose === 'avatar' ? `Profile photo.${valid.extension}` : `ID photo.${valid.extension}` };
  } finally {
    temporary.forEach(removeQuietly);
  }
}
