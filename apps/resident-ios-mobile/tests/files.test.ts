import { describe, expect, it } from 'vitest';
import { displayFileName, isOwnedPath, ownedPath, sniffType, stripImageMetadata, validateUpload } from '../src/lib/file-validation';
import { createProtectedDrafts } from '../src/lib/protected-drafts';
import { createSecureStorage } from '../src/lib/secure-storage-core';
import { createSignedPreview, createStagedUploads, previewExpired, uploadOwned, type BucketApi } from '../src/lib/staged-uploads';
import { iosFix, iosPermission } from '../src/lib/location-core';

const bytes = (...values: (number | string)[]) => Uint8Array.from(values.flatMap((value) => typeof value === 'string' ? [...value].map((c) => c.charCodeAt(0)) : [value]));
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24];
const has = (data: Uint8Array, text: string) => Buffer.from(data).includes(Buffer.from(text, 'latin1'));

/** JPEG with EXIF (orientation 6 + a fake GPS marker), XMP, a comment, then scan data. */
function jpeg(orientation = 6) {
  const tiff = [...bytes('MM'), 0x00, 0x2a, ...be32(8), ...be16(2),
    ...be16(0x0112), ...be16(3), ...be32(1), ...be16(orientation), 0, 0,
    ...be16(0x8825), ...be16(4), ...be32(1), ...be32(0), // GPS IFD pointer
    ...be32(0), ...bytes('GPSLAT14.5995')];
  const exif = [...bytes('Exif'), 0, 0, ...tiff];
  const xmp = [...bytes('http://ns.adobe.com/xap/1.0/'), 0, ...bytes('<x:xmpmeta>device</x:xmpmeta>')];
  const segment = (marker: number, payload: number[]) => [0xff, marker, ...be16(payload.length + 2), ...payload];
  return Uint8Array.from([0xff, 0xd8, ...segment(0xe0, [...bytes('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]), ...segment(0xe1, exif), ...segment(0xe1, xmp),
    ...segment(0xfe, [...bytes('Camera comment')]), ...segment(0xdb, Array(67).fill(1)), 0xff, 0xda, ...be16(8), 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0xff, 0xd9]);
}
function png() {
  const chunk = (type: string, data: number[]) => [...be32(data.length), ...bytes(type), ...data, ...be32(0xdeadbeef)];
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', Array(13).fill(0)), ...chunk('tEXt', [...bytes('Author'), 0, ...bytes('Juan')]),
    ...chunk('eXIf', [...bytes('MM')]), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])]);
}
function webp() {
  const chunk = (type: string, data: number[]) => [...bytes(type), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])];
  const body = [...bytes('WEBP'), ...chunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]), ...chunk('VP8 ', [1, 2, 3]), ...chunk('EXIF', [...bytes('GPS')]), ...chunk('XMP ', [...bytes('<xmp/>')])];
  return Uint8Array.from([...bytes('RIFF'), ...le32(body.length), ...body]);
}

describe('actual-byte validation (P02-T05, F06)', () => {
  it('identifies formats by signature and ignores the declared MIME type or name', () => {
    expect(sniffType(jpeg())).toBe('image/jpeg');
    expect(sniffType(png())).toBe('image/png');
    expect(sniffType(webp())).toBe('image/webp');
    expect(sniffType(bytes('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffType(Uint8Array.from([0, 0, 0, 0x18, ...bytes('ftypheic'), 0, 0, 0, 0]))).toBe('heif');
    expect(sniffType(bytes('<html>'))).toBeNull();
  });
  it('enforces each bucket policy: PDF only for request attachments, image-only ID evidence, HEIC explained', () => {
    expect(validateUpload('request-attachment', bytes('%PDF-1.7\n')).mimeType).toBe('application/pdf');
    expect(() => validateUpload('id-image', bytes('%PDF-1.7\n'))).toThrow('not accepted');
    expect(() => validateUpload('incident-photo', bytes('<script>'))).toThrow('not accepted');
    expect(() => validateUpload('id-image', Uint8Array.from([0, 0, 0, 0x18, ...bytes('ftypheic'), 0, 0, 0, 0]))).toThrow('HEIC');
    expect(() => validateUpload('avatar', new Uint8Array())).toThrow('empty');
  });
  it('checks the final byte size against the bucket limit', () => {
    const large = new Uint8Array(5 * 1024 * 1024 + 1);
    large.set(bytes('%PDF-'));
    expect(() => validateUpload('request-attachment', large)).toThrow('too large');
    const ok = new Uint8Array(5 * 1024 * 1024);
    ok.set(bytes('%PDF-'));
    expect(validateUpload('request-attachment', ok).bytes.length).toBe(ok.length);
  });
});

describe('metadata removal (P02-T05)', () => {
  it('removes JPEG EXIF/GPS, XMP and comments but keeps orientation and image data', () => {
    const cleaned = stripImageMetadata('image/jpeg', jpeg(6));
    expect(has(cleaned, 'GPSLAT')).toBe(false);
    expect(has(cleaned, 'xmpmeta')).toBe(false);
    expect(has(cleaned, 'Camera comment')).toBe(false);
    expect(has(cleaned, 'JFIF')).toBe(true);
    expect(Array.from(cleaned.slice(-4))).toEqual([0x11, 0x22, 0xff, 0xd9]);
    // Re-emitted minimal EXIF carries Orientation 6 only.
    const index = Buffer.from(cleaned).indexOf(Buffer.from([0x01, 0x12, 0x00, 0x03]));
    expect(index).toBeGreaterThan(0);
    expect(cleaned[index + 9]).toBe(6);
    expect(has(stripImageMetadata('image/jpeg', jpeg(1)), 'Exif')).toBe(false);
  });
  it('removes PNG text/EXIF chunks and WebP EXIF/XMP chunks and flags', () => {
    const cleanedPng = stripImageMetadata('image/png', png());
    expect(has(cleanedPng, 'Juan')).toBe(false);
    expect(has(cleanedPng, 'eXIf')).toBe(false);
    expect(has(cleanedPng, 'IDAT')).toBe(true);
    const cleanedWebp = stripImageMetadata('image/webp', webp());
    expect(has(cleanedWebp, 'GPS')).toBe(false);
    expect(has(cleanedWebp, '<xmp/>')).toBe(false);
    expect(cleanedWebp[20] & 0x0c).toBe(0); // VP8X flags byte
    expect(new DataView(cleanedWebp.buffer).getUint32(4, true)).toBe(cleanedWebp.length - 8);
  });
  it('rejects malformed images instead of uploading them unchecked', () => {
    expect(() => validateUpload('incident-photo', Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toThrow('could not be read');
  });
});

describe('names and owned paths (P02-T05, A50-038)', () => {
  const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const upload = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  it('shows safe readable names and replaces opaque provider ids', () => {
    expect(displayFileName('../../private/Barangay ID.jpg', 'image/jpeg')).toBe('Barangay ID.jpg');
    expect(displayFileName('1000000042', 'application/pdf')).toBe('Selected file (PDF)');
    expect(displayFileName(`${'a'.repeat(100)}.pdf`, 'application/pdf').length).toBeLessThanOrEqual(80);
  });
  it('builds the {uid}/{uploadId}/{slot}.{ext} shape the storage policies require', () => {
    expect(ownedPath(user, upload, 'front', { extension: 'jpg' })).toBe(`${user}/${upload}/front.jpg`);
    expect(() => ownedPath('x', upload, 'front', { extension: 'jpg' })).toThrow();
    expect(() => ownedPath(user, upload, '../x', { extension: 'jpg' })).toThrow();
    expect(isOwnedPath(`${user}/${upload}/front.jpg`, user)).toBe(true);
    expect(isOwnedPath(`other/${upload}/front.jpg`, user)).toBe(false);
    expect(isOwnedPath(`${user}/../other/front.jpg`, user)).toBe(false);
  });
});

function bucket(stored: Map<string, Uint8Array>, options: { failUpload?: unknown; signed?: string | null } = {}): BucketApi & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    async upload(path, body) {
      if (options.failUpload) { stored.set(path, body); return { error: options.failUpload }; } // stored, but the reply was lost
      if (stored.has(path)) return { error: { name: 'StorageApiError', message: 'The resource already exists', status: 409, statusCode: '409' } };
      stored.set(path, body);
      return { error: null };
    },
    async download(path) { const value = stored.get(path); return value ? { data: { arrayBuffer: async () => value.slice().buffer }, error: null } : { data: null, error: { name: 'StorageApiError', message: 'not found', status: 404, statusCode: '404' } }; },
    async remove(paths) { removed.push(...paths); return { error: null }; },
    async createSignedUrl() { return options.signed === null ? { data: null, error: { name: 'StorageApiError', message: 'denied', status: 403, statusCode: '403' } } : { data: { signedUrl: options.signed ?? 'https://project.supabase.co/storage/v1/object/sign/x?token=t' }, error: null }; },
  };
}

describe('staged uploads (P02-T05, F03/F06)', () => {
  const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const path = `${user}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/front.jpg`;
  const file = { bytes: Uint8Array.from([1, 2, 3]), mimeType: 'image/jpeg' as const, extension: 'jpg' };
  it('treats a lost reply as success only when the stored bytes are identical', async () => {
    const stored = new Map<string, Uint8Array>();
    await expect(uploadOwned(bucket(stored, { failUpload: { name: 'StorageUnknownError', message: 'Network request failed' } }), user, path, file)).resolves.toBeUndefined();
    await expect(uploadOwned(bucket(stored), user, path, file)).resolves.toBeUndefined(); // retry of the same attempt
    await expect(uploadOwned(bucket(stored), user, path, { ...file, bytes: Uint8Array.from([9]) })).rejects.toBeTruthy(); // never overwrites
    expect(Array.from(stored.get(path) ?? [])).toEqual([1, 2, 3]);
  });
  it('reports an unconfirmed transport failure as unknown-commit', async () => {
    const failing: BucketApi = { ...bucket(new Map()), upload: async () => ({ error: { name: 'StorageUnknownError', message: 'Network request failed' } }) };
    await expect(uploadOwned(failing, user, path, file)).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('refuses paths outside the owner folder', async () => {
    await expect(uploadOwned(bucket(new Map()), user, `other/${path}`, file)).rejects.toMatchObject({ kind: 'authorization' });
    await expect(createSignedPreview(bucket(new Map()), user, `other/${path}`)).rejects.toMatchObject({ kind: 'authorization' });
  });
  it('creates short-lived HTTPS previews and refreshes them before expiry', async () => {
    const preview = await createSignedPreview(bucket(new Map()), user, path, 0);
    expect(preview.expiresAt).toBe(300_000);
    expect(previewExpired(preview, 200_000)).toBe(false);
    expect(previewExpired(preview, 280_000)).toBe(true);
    await expect(createSignedPreview(bucket(new Map(), { signed: 'http://insecure' }), user, path)).rejects.toMatchObject({ kind: 'schema' });
    await expect(createSignedPreview(bucket(new Map(), { signed: null }), user, path)).rejects.toMatchObject({ kind: 'authorization' });
  });
  it('tracks staged objects in protected storage and cleans up only what the resident may delete', async () => {
    const keychain = new Map<string, string>();
    const store = createProtectedDrafts(createSecureStorage({ getItem: async (k) => keychain.get(k) ?? null, setItem: async (k, v) => { keychain.set(k, v); }, removeItem: async (k) => { keychain.delete(k); } }, 'drafts'));
    const staged = createStagedUploads(store, () => 5);
    const scope = { environment: 'staging' as const, barangayId: '22222222-2222-4222-8222-222222222222', userId: user };
    await staged.stage(scope, 'incident-photos', path);
    await staged.stage(scope, 'request-attachments', path);
    await staged.stage(scope, 'incident-photos', `${user}/dddddddd-dddd-4ddd-8ddd-dddddddddddd/1.jpg`);
    await staged.link(scope, 'incident-photos', `${user}/dddddddd-dddd-4ddd-8ddd-dddddddddddd/1.jpg`);
    const photos = bucket(new Map());
    const result = await staged.cleanup(scope, () => photos);
    expect(photos.removed).toEqual([path]);
    expect(result).toMatchObject({ removed: 1, failed: 0, serverCleanupRequired: [{ bucket: 'request-attachments', path }] });
    expect(await staged.pending(scope)).toEqual([{ bucket: 'request-attachments', path, stagedAt: 5 }]);
  });
});

describe('iOS location adapter mapping (P02-T06, F08)', () => {
  it('maps SDK 57 iOS permission responses, including reduced accuracy', () => {
    expect(iosPermission({ granted: true, canAskAgain: true, status: 'granted', ios: { accuracy: 'full' } })).toEqual({ state: 'granted', canAskAgain: true, approximate: false });
    expect(iosPermission({ granted: true, canAskAgain: true, status: 'granted', ios: { accuracy: 'reduced' } })).toEqual({ state: 'granted', canAskAgain: true, approximate: true });
    expect(iosPermission({ granted: false, canAskAgain: true, status: 'undetermined' })).toEqual({ state: 'prompt', canAskAgain: true, approximate: false });
    expect(iosPermission({ granted: false, canAskAgain: false, status: 'denied', ios: { accuracy: 'reduced' } })).toEqual({ state: 'denied', canAskAgain: false, approximate: false });
  });
  it('carries provider time and accuracy into the shared fix', () => {
    expect(iosFix({ coords: { latitude: 14.6, longitude: 121.0, accuracy: null }, timestamp: 10 }, 'last-known', 20)).toEqual({ lat: 14.6, lng: 121.0, accuracyMeters: null, deviceTimestamp: 10, receivedAt: 20, source: 'last-known' });
  });
});
