const CHUNK = 0x8000;

/** Base64 data URI of in-memory image bytes, for previewing a picked photo without keeping a file. */
export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  return `data:${mimeType};base64,${btoa(binary)}`;
}
