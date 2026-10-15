import { PublicError } from './errors';
import { sniffType, UPLOAD_POLICIES, validateUpload, type UploadPurpose, type ValidatedFile } from './file-validation';

/** Photo purposes handled here; documents and incident photos arrive with their phases. */
export type ImagePurpose = Extract<UploadPurpose, 'avatar' | 'id-image'>;
export type ImageDimensions = { width: number; height: number };
export type Rendition = { longestEdge: number | null; quality: number };
/** Re-encodes the picked image as JPEG at the given rendition and returns its bytes. */
export type Converter = (rendition: Rendition) => Promise<Uint8Array>;

/** A phone photo can be many megabytes; this only protects memory, the purpose limit applies to the final bytes. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

const EDGES: Record<ImagePurpose, number> = { avatar: 1024, 'id-image': 2400 };
const QUALITIES = [0.85, 0.7, 0.55] as const;

/**
 * Makes a picked photo acceptable for its purpose (plan §2: HEIC converted before final-byte
 * validation, P02-D02/OD-05). A JPEG/PNG/WebP within the limit passes untouched; HEIC/HEIF or
 * an over-limit photo is re-encoded as JPEG at decreasing size and quality until the final
 * bytes fit. The final bytes — not the picker's declared type — are what is validated.
 */
export async function prepareImage(purpose: ImagePurpose, bytes: Uint8Array, dimensions: ImageDimensions | null, convert: Converter): Promise<ValidatedFile> {
  if (!bytes.length) throw new PublicError('This photo is empty. Choose another photo.');
  if (bytes.length > MAX_SOURCE_BYTES) throw new PublicError('This photo is too large to use. Choose a smaller photo.');
  const type = sniffType(bytes);
  const policy = UPLOAD_POLICIES[purpose];
  // Anything that is not HEIC/HEIF and already fits, or cannot be re-encoded as a photo, is validated as it is.
  if (type !== 'heif' && (bytes.length <= policy.maxBytes || type === null || !policy.mimeTypes.includes(type))) return validateUpload(purpose, bytes);
  const edge = EDGES[purpose];
  const longest = dimensions ? Math.max(dimensions.width, dimensions.height) : 0;
  let failure: unknown = null;
  for (const [index, quality] of QUALITIES.entries()) {
    // Only ever downscale; later attempts also reduce the edge so very large originals fit.
    const target = Math.round(edge * (index === 0 ? 1 : 0.7 ** index));
    const longestEdge = longest > target ? target : null;
    let converted: Uint8Array;
    try { converted = await convert({ longestEdge, quality }); } catch { throw new PublicError('This photo could not be prepared. Choose a different photo.'); }
    try { return validateUpload(purpose, converted); } catch (error) { failure = error; }
  }
  throw failure instanceof PublicError ? failure : new PublicError('This photo is too large to use. Choose a smaller photo.');
}
