import { ACCEPTED_IMAGE_MIME_TYPES } from '@/lib/image-upload';
import { abortable } from './transport';

export const MAX_PHOTO_BYTES = 5242880;
export const MAX_OCR_BYTES = 900000;
export const PHOTO_ERROR = 'Choose a readable JPG, PNG, or WebP photo up to 5 MB.';
/** Inspect dimensions before asking the decoder to allocate image pixels. */
export function imageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) && view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset] !== 255) return null;
      const marker = bytes[offset + 1];
      if (marker === 255) { offset++; continue; }
      if (marker === 0xda || marker === 0xd9) break;
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += length + 2;
    }
  }
  if (mime === 'image/webp' && bytes.length >= 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const kind = view.getUint32(12);
    if (kind === 0x56503858) return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (kind === 0x56503820 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (kind === 0x5650384c && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}
export function safeDimensions(size: { width: number; height: number } | null): boolean {
  return !!size && size.width > 0 && size.height > 0 && size.width <= 16384 && size.height <= 16384 && size.width * size.height <= 40000000;
}
async function decodedImage(blob: Blob, signal: AbortSignal): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await abortable(image.decode(), signal);
    if (!safeDimensions({ width: image.naturalWidth, height: image.naturalHeight })) throw new Error(PHOTO_ERROR);
    return image;
  } catch (cause) { image.src = ''; throw cause; }
  finally { URL.revokeObjectURL(url); }
}
export async function validatePhoto(file: Blob, signal: AbortSignal): Promise<void> {
  if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES) throw new Error(PHOTO_ERROR);
  const bytes = new Uint8Array(await abortable(file.arrayBuffer(), signal));
  if (!safeDimensions(imageDimensions(bytes, file.type))) throw new Error(PHOTO_ERROR);
  const image = await decodedImage(file, signal);
  image.src = '';
}

export async function prepareOcrPhoto(file: Blob, signal: AbortSignal): Promise<Blob> {
  await validatePhoto(file, signal);
  const image = await decodedImage(file, signal);
  const canvas = document.createElement('canvas');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      const scale = Math.min(1, [2400, 1800, 1200][attempt] / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) break;
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await abortable(new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', [0.86, 0.74, 0.62][attempt])), signal);
      if (blob && blob.type === 'image/jpeg' && blob.size > 0 && blob.size <= MAX_OCR_BYTES) { await validatePhoto(blob, signal); return blob; }
    }
    throw new Error('We couldn’t read details from this photo. Enter them below.');
  } finally { canvas.width = canvas.height = 0; image.src = ''; }
}
