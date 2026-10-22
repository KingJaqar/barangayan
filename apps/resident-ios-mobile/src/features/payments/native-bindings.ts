import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { privateFile } from '../../lib/private-files';
import { dataUriBytes, type SaveDeps, type ShareDeps } from './native-actions';

/** The device-backed Photos adapter (`expo-media-library` add-only access, `expo-file-system` cache). */
export const saveDeps: SaveDeps = {
  async requestAccess() {
    const response = await requestPermissionsAsync(true);
    return { granted: response.granted, canAskAgain: response.canAskAgain };
  },
  async readImage(source) {
    if (source.startsWith('data:')) return dataUriBytes(source);
    // A provider-hosted QR image (https only; the caller validated the scheme) is fetched into the cache and read once.
    const target = privateFile(`Barangayan-QR-download-${Date.now().toString(36)}.img`);
    try {
      const downloaded = await File.downloadFileAsync(source, target.file, { idempotent: true });
      return await downloaded.bytes();
    } finally {
      target.remove();
    }
  },
  writeTemp(name, bytes) {
    const target = privateFile(name);
    if (target.file.exists) target.file.delete();
    target.file.create();
    target.file.write(bytes);
    return target;
  },
  async addToPhotos(uri) {
    await Asset.create(uri);
  },
};

/** The device-backed PDF receipt adapter (`expo-print`, `expo-sharing`). */
export const shareDeps: ShareDeps = {
  async renderPdf(html) {
    const result = await printToFileAsync({ html, width: 612, height: 792 });
    const file = new File(result.uri);
    return { uri: file.uri, remove() { if (file.exists) file.delete(); } };
  },
  async nameFile(rendered, name) {
    const target = privateFile(name);
    if (target.file.exists) target.file.delete();
    await new File(rendered.uri).copy(target.file);
    return target;
  },
  canShare: isAvailableAsync,
  async share(uri) {
    await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Payment receipt' });
  },
};
