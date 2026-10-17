import { receiptFileName, receiptHtml, type Receipt } from './receipt';

/** A QR code image is a few kilobytes; anything larger is not a QR code. */
export const MAX_QR_IMAGE_BYTES = 2 * 1024 * 1024;

function hasImageSignature(bytes: Uint8Array): boolean {
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return png || jpeg || webp;
}

export function imageExtension(bytes: Uint8Array): 'png' | 'jpg' | 'webp' {
  return bytes[0] === 0x89 ? 'png' : bytes[0] === 0xff ? 'jpg' : 'webp';
}

/** Decodes the base64 payload of a data URI into bytes; throws on a malformed payload. */
export function dataUriBytes(uri: string): Uint8Array {
  const match = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
  if (!match) throw new Error('Not a base64 image data URI.');
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export type TempFile = { uri: string; remove(): void };

export type SaveDeps = {
  /** Add-only Photos access; the library is never read. */
  requestAccess(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  readImage(source: string): Promise<Uint8Array>;
  writeTemp(name: string, bytes: Uint8Array): TempFile;
  addToPhotos(uri: string): Promise<void>;
};
export type SaveOutcome = { status: 'saved' | 'denied' | 'blocked' | 'failed'; message: string };

/**
 * Saves the QR image to Photos (A16-013…018). Permission is asked only when the resident
 * chooses to save, the bytes are checked to be a real, small image, and the temporary file is
 * removed whatever happens. A denial or failure never changes the payment.
 */
export async function saveQrToPhotos(deps: SaveDeps, source: string, reference: string): Promise<SaveOutcome> {
  let access: { granted: boolean; canAskAgain: boolean };
  try {
    access = await deps.requestAccess();
  } catch {
    return { status: 'failed', message: 'Photos could not be reached. Try again.' };
  }
  if (!access.granted) {
    return access.canAskAgain
      ? { status: 'denied', message: 'Barangayan needs permission to add the QR code to your Photos. You can allow it and try again, or take a screenshot instead.' }
      : { status: 'blocked', message: 'Saving to Photos is turned off for Barangayan. Turn it on in Settings, or take a screenshot instead.' };
  }
  let file: TempFile | null = null;
  try {
    const bytes = await deps.readImage(source);
    if (bytes.length === 0 || bytes.length > MAX_QR_IMAGE_BYTES || !hasImageSignature(bytes)) {
      return { status: 'failed', message: 'The QR code image could not be read. Take a screenshot instead.' };
    }
    const safe = reference.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'payment';
    file = deps.writeTemp(`Barangayan-QR-${safe}.${imageExtension(bytes)}`, bytes);
    await deps.addToPhotos(file.uri);
    return { status: 'saved', message: 'The QR code was saved to your Photos.' };
  } catch {
    return { status: 'failed', message: 'The QR code could not be saved. Try again, or take a screenshot instead.' };
  } finally {
    try { file?.remove(); } catch { /* the system also clears the cache */ }
  }
}

export type ShareDeps = {
  renderPdf(html: string): Promise<TempFile>;
  /** Gives the generated file its readable name (and a cleanup handle). */
  nameFile(rendered: TempFile, name: string): Promise<TempFile>;
  canShare(): Promise<boolean>;
  share(uri: string): Promise<void>;
};
export type ShareOutcome = { status: 'opened' | 'unavailable' | 'failed'; message: string };

/**
 * Builds the PDF receipt from the committed paid payment and opens the iOS share sheet
 * (A17-010…015). The sheet does not say whether the resident saved or cancelled, so a closed
 * sheet is reported neutrally, never as "saved". Both temporary files are removed afterwards.
 */
export async function shareReceipt(deps: ShareDeps, receipt: Receipt, now: Date = new Date()): Promise<ShareOutcome> {
  const created: TempFile[] = [];
  try {
    const rendered = await deps.renderPdf(receiptHtml(receipt, now));
    created.push(rendered);
    const named = await deps.nameFile(rendered, receiptFileName(receipt.reference));
    created.push(named);
    if (!(await deps.canShare())) {
      return { status: 'unavailable', message: 'Sharing is not available on this device, so the receipt could not be saved from here. Your receipt stays available in the app.' };
    }
    await deps.share(named.uri);
    return { status: 'opened', message: 'The share sheet was closed. Choose Save to Files or another app whenever you need a copy.' };
  } catch {
    return { status: 'failed', message: 'The receipt could not be prepared or shared. Try again.' };
  } finally {
    for (const file of created) {
      try { file.remove(); } catch { /* already removed */ }
    }
  }
}
