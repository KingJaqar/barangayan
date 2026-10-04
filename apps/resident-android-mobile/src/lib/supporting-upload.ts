import { SUPPORTING_FILE_MAX_BYTES, SUPPORTING_FILE_MIME_TYPES } from '@barangayan/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type SupportingFile = { name: string; mimeType: string; bytes: Uint8Array };
export async function pickSupportingFile(): Promise<SupportingFile | null> {
  let file: { uri: string; name: string; mimeType: string; size: number | null } | null = null;
  if (Platform.OS !== 'web') {
    try {
      const selected = await File.pickFileAsync({ mimeTypes: [...SUPPORTING_FILE_MIME_TYPES] });
      if (selected.canceled) return null;
      file = {
        uri: selected.result.uri,
        name: selected.result.name,
        mimeType: selected.result.type ?? '',
        size: selected.result.size ?? null,
      };
    } catch {
      /* Providers without a persistable grant use the original content URI. */
    }
  }
  if (!file) {
    const selected = await DocumentPicker.getDocumentAsync({
      type: [...SUPPORTING_FILE_MIME_TYPES],
      multiple: false,
      copyToCacheDirectory: Platform.OS !== 'android',
    });
    if (selected.canceled || !selected.assets[0]) return null;
    const asset = selected.assets[0];
    file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? '', size: asset.size ?? null };
  }
  if (
    !(SUPPORTING_FILE_MIME_TYPES as readonly string[]).includes(file.mimeType) ||
    (file.size !== null && (file.size <= 0 || file.size > SUPPORTING_FILE_MAX_BYTES))
  )
    throw new Error('Choose a JPG, PNG, WEBP or PDF file up to 5 MB.');
  let bytes: Uint8Array;
  try {
    bytes =
      Platform.OS === 'web'
        ? new Uint8Array(await (await fetch(file.uri)).arrayBuffer())
        : await new File(file.uri).bytes();
  } catch {
    throw new Error('Could not read the file. Please pick it again from your device.');
  }
  if (!bytes.length || bytes.length > SUPPORTING_FILE_MAX_BYTES)
    throw new Error('The file must be between 1 byte and 5 MB.');
  return { name: file.name, mimeType: file.mimeType, bytes };
}
