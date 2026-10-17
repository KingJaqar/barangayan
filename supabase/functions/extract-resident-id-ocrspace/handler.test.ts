import { describe, expect, it, vi } from 'vitest';
import { IdExtractionError } from '../extract-resident-id/handler';
import { parseIdText, parseIdTextSuggestions } from '../extract-resident-id/id-text';
import { limitedText, ocrSpaceHandler, ocrSpaceText, validDerivative } from './handler';

const userId = 'b1180000-0000-4000-8000-000000000001';
const path = `${userId}/versions/c1180000-0000-4000-8000-000000000001/id-front.png`;
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64'));
const provider = (text: string) => ({ IsErroredOnProcessing: false, OCRExitCode: 1, ParsedResults: [{ FileParseExitCode: 1, ParsedText: text }] });
function fixture() {
  const deps = { caller: vi.fn(async (): Promise<string | null> => userId), consume: vi.fn(async () => true), image: vi.fn(async () => ({ bytes: png, mime: 'image/png' })), recognize: vi.fn(async () => 'Full Name: Ana Reyes\nID Number: 123\nDate of Birth: February 29, 2000') };
  return { deps, handler: ocrSpaceHandler(deps), request: (input: unknown = { frontPath: path, idType: 'PhilSys' }, auth = 'Bearer fixture') => new Request('https://example.test/extract', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify(input) }) };
}
describe('isolated OCR.space adapter', () => {
  it('returns only suggestions and warnings using caller-scoped storage', async () => {
    const { deps, handler, request } = fixture(); const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ details: { fullName: 'Ana Reyes', idNumber: '123', birthDate: '2000-02-29', address: '' }, warnings: [] });
    expect(deps.image).toHaveBeenCalledWith('Bearer fixture', path, expect.any(AbortSignal));
  });
  it('keeps CORS and JWT/resident guards before provider access', async () => {
    const { deps, handler, request } = fixture();
    expect((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await handler(request(undefined, ''))).status).toBe(401);
    deps.caller.mockResolvedValue(null);
    expect((await handler(request())).status).toBe(401);
    expect(deps.recognize).not.toHaveBeenCalled();
  });
  it.each([path.replace(userId, 'b1180000-0000-4000-8000-000000000002'), `${userId}/id-front.png`, path.replace('id-front', 'id-back'), path.replace('.png', '.webp'), 'https://example.test/id.png', path + '?token=abc', path.replace('/versions/', '/../')])('rejects unsafe path %s', async frontPath => {
    const { deps, handler, request } = fixture();
    expect((await handler(request({ frontPath, idType: 'PhilSys' }))).status).toBe(403);
    expect(deps.image).not.toHaveBeenCalled(); expect(deps.recognize).not.toHaveBeenCalled();
  });
  it('rejects unknown request keys, empty type and excessive request bodies', async () => {
    const { handler, request } = fixture();
    for (const input of [{ frontPath: path, idType: '' }, { frontPath: path, idType: 'x', url: 'https://evil.test' }, { frontPath: 'x'.repeat(1300), idType: 'PhilSys' }]) expect((await handler(request(input))).status).toBe(400);
  });
  it('enforces the resident limiter before download and external recognition', async () => {
    const { deps, handler, request } = fixture(); deps.consume.mockResolvedValue(false);
    expect((await handler(request())).status).toBe(429); expect(deps.image).not.toHaveBeenCalled();
  });
  it('rejects mismatched, empty, truncated and oversized binary input', () => {
    expect(validDerivative(png, 'image/png', path)).toBe(true);
    for (const bytes of [new Uint8Array(), png.slice(0, 25), new Uint8Array(900001)]) expect(validDerivative(bytes, 'image/png', path)).toBe(false);
    expect(validDerivative(png, 'image/jpeg', path)).toBe(false);
    expect(validDerivative(png, 'image/png', path.replace('.png', '.jpg'))).toBe(false);
    const large = png.slice(); new DataView(large.buffer).setUint32(16, 100000);
    expect(validDerivative(large, 'image/png', path)).toBe(false);
  });
  it('accepts the exact derivative byte cap but rejects one byte over', () => {
    function padded(size: number) {
      const bytes = new Uint8Array(size), beforeEnd = png.length - 12, chunkLength = size - png.length - 12;
      bytes.set(png.slice(0, beforeEnd));
      const view = new DataView(bytes.buffer); view.setUint32(beforeEnd, chunkLength); view.setUint32(beforeEnd + 4, 0x74455874);
      bytes.set(png.slice(beforeEnd), size - 12); return bytes;
    }
    expect(validDerivative(padded(900000), 'image/png', path)).toBe(true);
    expect(validDerivative(padded(900001), 'image/png', path)).toBe(false);
  });
  it.each([null, {}, { ...provider(''), OCRExitCode: 2 }, { ...provider('name'), IsErroredOnProcessing: true }, { ...provider('name'), ParsedResults: [{ FileParseExitCode: -10, ParsedText: 'name' }] }, provider(''), provider('x'.repeat(50001))])('rejects malformed, partial and empty provider results', value => {
    expect(() => ocrSpaceText(value)).toThrow(IdExtractionError);
  });
  it('maps quota and provider errors without revealing payloads', () => {
    try { ocrSpaceText({ ErrorMessage: ['Maximum API requests exceeded'], secret: 'never display' }); } catch (cause) { expect(cause).toMatchObject({ status: 429 }); expect(String(cause)).not.toContain('never display'); }
    expect(ocrSpaceText(provider('Full Name: Ana'))).toBe('Full Name: Ana');
  });
  it('accepts documented numeric and string success codes without coercing malformed codes', () => {
    for (const code of [1, '1']) {
      expect(ocrSpaceText({ ...provider('Ana'), OCRExitCode: code, ParsedResults: [{ FileParseExitCode: code, ParsedText: 'Ana' }] })).toBe('Ana');
    }
    for (const code of [true, '01', '1x', null, '2']) {
      expect(() => ocrSpaceText({ ...provider('Ana'), OCRExitCode: code })).toThrow(IdExtractionError);
      expect(() => ocrSpaceText({ ...provider('Ana'), ParsedResults: [{ FileParseExitCode: code, ParsedText: 'Ana' }] })).toThrow(IdExtractionError);
    }
  });
  it('returns manual-entry feedback for missing keys, failures and empty text', async () => {
    const { deps, handler, request } = fixture();
    deps.recognize.mockRejectedValue(new IdExtractionError(503, 'Reading unavailable. Enter details manually.'));
    expect((await handler(request())).status).toBe(503);
    deps.recognize.mockRejectedValue(new Error('private key and ID text'));
    const response = await handler(request()); expect(await response.text()).not.toContain('private key');
    deps.recognize.mockResolvedValue(''); expect((await handler(request())).status).toBe(422);
  });
  it('bounds streamed provider data and cancellation', async () => {
    await expect(limitedText(new Response('x'.repeat(100)).body, 99, new AbortController().signal)).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(limitedText(new Response('text').body, 100, controller.signal)).rejects.toThrow();
  });
  it('preserves old parsing while rejecting long, invalid, future and ambiguous web suggestions', () => {
    const text = `Full Name: ${'A'.repeat(201)}\nID Number: ${'1'.repeat(201)}\nDate of Birth: 01/02/2000\nAddress: ${'B'.repeat(1001)}`;
    expect(parseIdText(text).fullName).toHaveLength(200);
    expect(parseIdText(text).birthDate).toBe('2000-01-02');
    const result = parseIdTextSuggestions(text); expect(result.details).toEqual({ fullName: '', idNumber: '', birthDate: '', address: '' }); expect(result.warnings).toHaveLength(4);
    expect(parseIdTextSuggestions('Date of Birth: 2999-01-01').details.birthDate).toBe('');
    expect(parseIdTextSuggestions('Date of Birth: 2001-02-29').warnings).toHaveLength(1);
  });
  it('leaves uncertain birthday text blank without changing the legacy parser', () => {
    for (const value of ['Januarrry 2, 2000', '2000-01-02 or 2000-02-01', 'approximately 2000-01-02', '01/02/2000']) {
      const text = `Date of Birth: ${value}`;
      expect(parseIdTextSuggestions(text).details.birthDate).toBe('');
      expect(parseIdTextSuggestions(text).warnings).toHaveLength(1);
      expect(parseIdText(text).birthDate).toBe('2000-01-02');
    }
    for (const value of ['January 2, 2000', '2 Jan 2000', '2000-1-2', '01/1/2000']) {
      expect(parseIdTextSuggestions(`Date of Birth: ${value}`).details.birthDate).not.toBe('');
    }
  });
});
