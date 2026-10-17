import { IdExtractionError } from '../extract-resident-id/handler.ts';
import { parseIdTextSuggestions } from '../extract-resident-id/id-text.ts';

export const unavailable = "We couldn't read your ID photo. You can enter the details below.";
export const limited = 'Photo reading is temporarily unavailable. Enter the details below or try again later.';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export type OcrDependencies = {
  caller: (authorization: string, signal: AbortSignal) => Promise<string | null>;
  consume: (userId: string, signal: AbortSignal) => Promise<boolean>;
  image: (authorization: string, path: string, signal: AbortSignal) => Promise<{ bytes: Uint8Array; mime: string } | null>;
  recognize: (bytes: Uint8Array, mime: string, signal: AbortSignal) => Promise<string>;
};

export async function limitedBytes(body: ReadableStream<Uint8Array> | null, maximum: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  if (!body) throw new IdExtractionError(503, unavailable);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new IdExtractionError(422, unavailable);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function limitedText(body: ReadableStream<Uint8Array> | null, maximum: number, signal: AbortSignal): Promise<string> {
  return new TextDecoder().decode(await limitedBytes(body, maximum, signal));
}

/** Validate supported container, dimensions and MIME before any provider transfer. */
export function validDerivative(bytes: Uint8Array, mime: string, path: string): boolean {
  if (!bytes.length || bytes.length > 900000) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const safe = (width: number, height: number) => width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 40000000;
  if (mime === 'image/png' && path.endsWith('.png') && bytes.length >= 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) {
    if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452 || !safe(view.getUint32(16), view.getUint32(20))) return false;
    let data = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset), kind = view.getUint32(offset + 4);
      if (offset + 12 + size > bytes.length) return false;
      if (kind === 0x49444154 && size) data = true;
      if (kind === 0x49454e44) return data && size === 0 && offset + 12 === bytes.length;
      offset += size + 12;
    }
  }
  if (mime === 'image/jpeg' && /\.jpe?g$/.test(path) && bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) {
    let dimensions = false;
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 255) return false;
      const marker = bytes[offset + 1];
      if (marker === 255) { offset++; continue; }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) return false;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) dimensions = length >= 8 && safe(view.getUint16(offset + 7), view.getUint16(offset + 5));
      if (marker === 0xda) return dimensions && offset + length + 4 < bytes.length;
      offset += length + 2;
    }
  }
  return false;
}

export function ocrSpaceText(value: unknown): string {
  if (!value || typeof value !== 'object') throw new IdExtractionError(503, unavailable);
  const payload = value as Record<string, unknown>;
  const providerError = JSON.stringify([payload.ErrorMessage, payload.ErrorDetails]);
  if (/quota|limit|maximum|rate|exceed/i.test(providerError)) throw new IdExtractionError(429, limited);
  // The provider documents integer codes but also shows string codes in its JSON examples.
  const successful = (code: unknown) => code === 1 || code === '1';
  if (payload.IsErroredOnProcessing !== false || !successful(payload.OCRExitCode) || !Array.isArray(payload.ParsedResults) || payload.ParsedResults.length !== 1) throw new IdExtractionError(422, unavailable);
  const result: unknown = payload.ParsedResults[0];
  if (!result || typeof result !== 'object' || !('FileParseExitCode' in result) || !successful(result.FileParseExitCode) || !('ParsedText' in result) || typeof result.ParsedText !== 'string' || !result.ParsedText.trim() || result.ParsedText.length > 50000) throw new IdExtractionError(422, unavailable);
  return result.ParsedText;
}

export function ocrSpaceHandler(deps: OcrDependencies) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST to read an ID photo.' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85000);
    const signal = AbortSignal.any([controller.signal, request.signal]);
    try {
      const authorization = request.headers.get('Authorization');
      if (!authorization?.match(/^Bearer\s+\S+$/i)) return reply(401, { error: 'Sign in again to read your ID photo.' });
      let input: unknown;
      try { input = JSON.parse(await limitedText(request.body, 1200, signal)); } catch { return reply(400, { error: 'Invalid ID photo request.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Invalid ID photo request.' });
      const payload = input as Record<string, unknown>;
      if (Object.keys(payload).some(key => !['frontPath', 'idType'].includes(key)) || typeof payload.frontPath !== 'string' || typeof payload.idType !== 'string' || !payload.idType.trim() || payload.idType.length > 200) return reply(400, { error: 'Invalid ID photo request.' });
      const userId = await deps.caller(authorization, signal);
      if (!userId) return reply(401, { error: 'Sign in with a resident account to read your ID photo.' });
      const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      if (!new RegExp(`^${uuid}$`).test(userId) || !new RegExp(`^${userId}/versions/${uuid}/id-front\\.(jpg|jpeg|png)$`).test(payload.frontPath)) return reply(403, { error: 'Select your own front ID photo.' });
      if (!await deps.consume(userId, signal)) return reply(429, { error: limited });
      const image = await deps.image(authorization, payload.frontPath, signal);
      if (!image || !validDerivative(image.bytes, image.mime, payload.frontPath)) return reply(400, { error: 'Choose a readable JPEG or PNG photo for reading.' });
      const text = await deps.recognize(image.bytes, image.mime, signal);
      signal.throwIfAborted();
      if (!text.trim()) return reply(422, { error: unavailable });
      return reply(200, parseIdTextSuggestions(text));
    } catch (cause) {
      return cause instanceof IdExtractionError ? reply(cause.status, { error: cause.message }) : reply(503, { error: unavailable });
    } finally { clearTimeout(timer); }
  };
}
