import { create } from 'qrcode/lib/core/qrcode';
import { bytesToDataUri } from '../../lib/data-uri';

/** A QR symbol: `size` modules per side; `dark` is true for a black module. */
export type QrMatrix = { size: number; dark(row: number, column: number): boolean };

/** Quiet zone in modules; four is the QR specification's minimum, so scanners accept the image on any background. */
export const QUIET_ZONE = 4;
/** Longest text the symbol is asked to hold; centre and household payloads are a few hundred characters. */
export const MAX_QR_TEXT = 1000;

/** Encodes text at error-correction level M (the level the Android app uses). Throws for empty or oversize text. */
export function encodeQr(text: string): QrMatrix {
  if (!text || text.length > MAX_QR_TEXT) throw new RangeError('QR text must be 1 to 1000 characters.');
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (row, column) => modules.get(row, column) === 1 };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function word(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(word(data.length), 0);
  for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);
  out.set(data, 8);
  out.set(word(crc32(out.subarray(4, 8 + data.length))), 8 + data.length);
  return out;
}

/** A zlib stream of uncompressed ("stored") blocks: valid for every PNG reader and needs no compressor. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let block = 0; block < blocks; block += 1) {
    const part = raw.subarray(block * 65535, Math.min(raw.length, (block + 1) * 65535));
    out[at] = block === blocks - 1 ? 1 : 0;
    out[at + 1] = part.length & 0xff;
    out[at + 2] = part.length >>> 8;
    out[at + 3] = ~part.length & 0xff;
    out[at + 4] = (~part.length >>> 8) & 0xff;
    out.set(part, at + 5);
    at += 5 + part.length;
  }
  out.set(word(adler32(raw)), at);
  return out;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The symbol as a 1-bit grayscale PNG with a quiet zone; `scale` pixels per module. Black modules on white. */
export function qrPng(matrix: QrMatrix, scale = 8): Uint8Array {
  if (!Number.isInteger(scale) || scale < 1 || scale > 32) throw new RangeError('QR scale must be a whole number from 1 to 32.');
  const modules = matrix.size + 2 * QUIET_ZONE;
  const width = modules * scale;
  const rowBytes = Math.ceil(width / 8);
  const raw = new Uint8Array(width * (rowBytes + 1)).fill(0xff);
  for (let y = 0; y < width; y += 1) {
    const row = y * (rowBytes + 1);
    raw[row] = 0;
    const moduleRow = Math.floor(y / scale) - QUIET_ZONE;
    if (moduleRow < 0 || moduleRow >= matrix.size) continue;
    for (let x = 0; x < width; x += 1) {
      const moduleColumn = Math.floor(x / scale) - QUIET_ZONE;
      if (moduleColumn >= 0 && moduleColumn < matrix.size && matrix.dark(moduleRow, moduleColumn)) raw[row + 1 + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  const header = new Uint8Array([...word(width), ...word(width), 1, 0, 0, 0, 0]);
  const parts = [new Uint8Array(SIGNATURE), chunk('IHDR', header), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) { png.set(part, at); at += part.length; }
  return png;
}

/** The symbol for `text` as a PNG data URI, for display and for saving to Photos. */
export function qrDataUri(text: string, scale = 8): string {
  return bytesToDataUri(qrPng(encodeQr(text), scale), 'image/png');
}
