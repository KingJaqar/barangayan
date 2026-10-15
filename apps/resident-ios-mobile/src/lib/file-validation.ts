import { SUPPORTING_FILE_MAX_BYTES } from '@barangayan/shared';
import { PublicError } from './errors';

/**
 * Upload boundary (plan §2/§3, P02-T05). The file's *actual bytes* decide its type; the
 * picker's declared MIME type and name are never trusted. Limits mirror the storage
 * buckets (migrations 0025, 0040, 0042/0073, 0095) so a file the server would reject is
 * refused before upload.
 */
export type UploadMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
export type UploadPurpose = 'request-attachment' | 'id-image' | 'incident-photo' | 'avatar';
export type UploadPolicy = {
  bucket: 'request-attachments' | 'id-documents' | 'incident-photos' | 'profile-photos';
  maxBytes: number;
  mimeTypes: readonly UploadMime[];
  /** Whether storage policies let the resident delete an unlinked object (orphan cleanup). */
  clientDeletable: boolean;
};
const MiB = 1024 * 1024;
const IMAGES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const UPLOAD_POLICIES: Record<UploadPurpose, UploadPolicy> = {
  'request-attachment': { bucket: 'request-attachments', maxBytes: SUPPORTING_FILE_MAX_BYTES, mimeTypes: [...IMAGES, 'application/pdf'], clientDeletable: false },
  'id-image': { bucket: 'id-documents', maxBytes: 5 * MiB, mimeTypes: IMAGES, clientDeletable: false },
  'incident-photo': { bucket: 'incident-photos', maxBytes: 10 * MiB, mimeTypes: IMAGES, clientDeletable: true },
  avatar: { bucket: 'profile-photos', maxBytes: 2 * MiB, mimeTypes: IMAGES, clientDeletable: true },
};

const EXTENSIONS: Record<UploadMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif']);

/** Identifies the format from its signature bytes; `heif` is recognised only to explain it. */
export function sniffType(bytes: Uint8Array): UploadMime | 'heif' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return 'heif';
  return null;
}

function describe(policy: UploadPolicy) {
  const names = policy.mimeTypes.map((type) => EXTENSIONS[type] === 'jpg' ? 'JPG' : EXTENSIONS[type].toUpperCase());
  return `${names.join(', ')} up to ${Math.round(policy.maxBytes / MiB)} MB`;
}

/** Cheap check on the reported size before reading a file into memory. */
export function assertReadableSize(purpose: UploadPurpose, reportedBytes: number | null): void {
  const policy = UPLOAD_POLICIES[purpose];
  // Removing metadata can shrink a file slightly, so only refuse what can never fit.
  if (reportedBytes !== null && reportedBytes > policy.maxBytes * 2) throw new PublicError(`This file is too large. Choose ${describe(policy)}.`);
}

export type ValidatedFile = { bytes: Uint8Array; mimeType: UploadMime; extension: string };

/** Validates final bytes for a purpose and removes image metadata (location, device, time). */
export function validateUpload(purpose: UploadPurpose, bytes: Uint8Array): ValidatedFile {
  const policy = UPLOAD_POLICIES[purpose];
  if (!bytes.length) throw new PublicError('This file is empty. Choose another file.');
  const type = sniffType(bytes);
  if (type === 'heif') throw new PublicError(`HEIC/HEIF photos are not supported yet. Choose ${describe(policy)} — for example, export the photo as JPEG first.`);
  if (!type || !policy.mimeTypes.includes(type)) throw new PublicError(`This file type is not accepted. Choose ${describe(policy)}.`);
  let cleaned: Uint8Array;
  try { cleaned = stripImageMetadata(type, bytes); } catch { throw new PublicError('This image could not be read. Choose another file.'); }
  if (cleaned.length > policy.maxBytes) throw new PublicError(`This file is too large. Choose ${describe(policy)}.`);
  return { bytes: cleaned, mimeType: type, extension: EXTENSIONS[type] };
}

/** A label safe to show and announce: no path, control characters or opaque provider ids. */
export function displayFileName(name: string | null | undefined, mimeType: UploadMime): string {
  const base = (name ?? '').split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? '';
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) return `Selected file (${EXTENSIONS[mimeType].toUpperCase()})`;
  return base.length > 80 ? `${base.slice(0, 60)}…${base.slice(-12)}` : base;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * Immutable owner path `{userId}/{uploadId}/{slot}.{ext}` — the shape every resident
 * storage policy checks (first folder = auth.uid(); request-attachments also requires two
 * UUID folders). A new uploadId per attempt keeps evidence immutable.
 */
export function ownedPath(userId: string, uploadId: string, slot: string, file: Pick<ValidatedFile, 'extension'>): string {
  if (!UUID.test(userId) || !UUID.test(uploadId) || !/^[a-z0-9-]{1,40}$/.test(slot)) throw new PublicError('This upload could not be prepared. Sign in again and retry.');
  return `${userId}/${uploadId}/${slot}.${file.extension}`;
}

export function isOwnedPath(path: string, userId: string): boolean {
  const parts = path.split('/');
  return parts.length >= 2 && parts[0] === userId && !parts.includes('..') && !parts.includes('');
}

// ---------------------------------------------------------------------------------------
// Metadata removal. Image pixels are untouched; only metadata containers are dropped.

export function stripImageMetadata(type: UploadMime, bytes: Uint8Array): Uint8Array {
  if (type === 'image/jpeg') return stripJpeg(bytes);
  if (type === 'image/png') return stripPng(bytes);
  if (type === 'image/webp') return stripWebp(bytes);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

/** Reads the EXIF Orientation (1–8) from an APP1 payload, or null. */
function exifOrientation(segment: Uint8Array): number | null {
  if (segment.length < 14 || ascii(segment, 0, 6) !== 'Exif\0\0') return null;
  const tiff = segment.subarray(6);
  const little = ascii(tiff, 0, 2) === 'II';
  if (!little && ascii(tiff, 0, 2) !== 'MM') return null;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, little);
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > tiff.length) return null;
  const entries = u16(ifd);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** A minimal big-endian EXIF APP1 segment that carries only the Orientation tag. */
function orientationSegment(orientation: number): Uint8Array {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF header, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const length = payload.length + 2;
  return Uint8Array.from([0xff, 0xe1, length >> 8, length & 0xff, ...payload]);
}

/**
 * Drops APP1 (EXIF/XMP: GPS, device, timestamps), APP13 (IPTC) and comments. The
 * Orientation tag is re-emitted alone so portrait photos still display upright.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: number | null = null;
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Malformed JPEG');
    const marker = bytes[offset + 1];
    if (marker === 0xff) { offset++; continue; } // fill byte
    if (marker === 0xd9) { kept.push(bytes.subarray(offset, offset + 2)); offset += 2; break; }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { kept.push(bytes.subarray(offset, offset + 2)); offset += 2; continue; }
    if (offset + 4 > bytes.length) throw new Error('Malformed JPEG');
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) throw new Error('Malformed JPEG');
    const segment = bytes.subarray(offset, offset + 2 + length);
    if (marker === 0xda) { kept.push(bytes.subarray(offset)); offset = bytes.length; break; } // scan data to the end
    if (marker === 0xe1) orientation ??= exifOrientation(segment.subarray(4));
    else if (marker !== 0xed && marker !== 0xfe) kept.push(segment);
    offset += 2 + length;
  }
  if (orientation && orientation !== 1) kept.splice(1, 0, orientationSegment(orientation));
  return concat(kept);
}

const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
/** Drops PNG text/EXIF/time chunks; chunk CRCs of kept chunks are unchanged. */
function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Malformed PNG');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('Malformed PNG');
    const type = ascii(bytes, offset + 4, 4);
    if (!PNG_DROPPED.has(type)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return concat(kept);
}

/** Drops WebP EXIF/XMP chunks and clears their flags in the VP8X header. */
function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declared = view.getUint32(4, true) + 8;
  if (declared > bytes.length || declared < 12) throw new Error('Malformed WebP');
  const kept: Uint8Array[] = [];
  let offset = 12;
  while (offset < declared) {
    if (offset + 8 > declared) throw new Error('Malformed WebP');
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > declared) throw new Error('Malformed WebP');
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = bytes.slice(offset, end);
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04);
      kept.push(chunk);
    }
    offset = end;
  }
  const body = concat(kept);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}
