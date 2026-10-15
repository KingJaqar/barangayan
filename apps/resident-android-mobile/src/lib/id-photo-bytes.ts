/** Decode Expo Camera's JPEG without relying on browser-only atob in Hermes. */
export function idPhotoBytes(encoded: string): Uint8Array {
  if (encoded.length > Math.ceil(5 * 1024 * 1024 / 3) * 4) throw new Error('Choose a photo no larger than 5 MB.');
  if (!encoded.length || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Could not read the camera photo. Please take it again.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const result = new Uint8Array(encoded.length / 4 * 3 - padding);
  if (result.length > 5 * 1024 * 1024) throw new Error('Choose a photo no larger than 5 MB.');
  let offset = 0;
  for (let i = 0; i < encoded.length; i += 4) {
    const value = (alphabet.indexOf(encoded[i]!) << 18) | (alphabet.indexOf(encoded[i + 1]!) << 12)
      | ((encoded[i + 2] === '=' ? 0 : alphabet.indexOf(encoded[i + 2]!)) << 6)
      | (encoded[i + 3] === '=' ? 0 : alphabet.indexOf(encoded[i + 3]!));
    if (offset < result.length) result[offset++] = (value >> 16) & 255;
    if (offset < result.length) result[offset++] = (value >> 8) & 255;
    if (offset < result.length) result[offset++] = value & 255;
  }
  return result;
}
