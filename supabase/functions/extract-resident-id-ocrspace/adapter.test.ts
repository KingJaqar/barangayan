import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let handler: (request: Request) => Promise<Response>;
const env = new Map([['SUPABASE_URL', 'https://backend.test'], ['SUPABASE_ANON_KEY', 'public-fixture-key'], ['SUPABASE_SERVICE_ROLE_KEY', 'server-fixture-key'], ['OCR_SPACE_API_KEY', 'provider-fixture-key']]);
const userId = 'b1180000-0000-4000-8000-000000000001';
const frontPath = `${userId}/versions/c1180000-0000-4000-8000-000000000001/id-front.png`;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64'));
const providerSuccess = { IsErroredOnProcessing: false, OCRExitCode: 1, ParsedResults: [{ FileParseExitCode: 1, ParsedText: 'Full Name: Synthetic Resident' }] };
const calls: { url: string; init?: RequestInit }[] = [];
let mode = 'success';
let streamCancelled = false;
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => env.get(key) }, serve: (callback: typeof handler) => { handler = callback; } });
  await import('./index');
});
beforeEach(() => {
  mode = 'success'; streamCancelled = false; calls.length = 0; env.set('OCR_SPACE_API_KEY', 'provider-fixture-key');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: mode === 'anonymous' });
    if (url.includes('/rest/v1/profiles')) {
      const query = new URL(url).searchParams;
      const role = mode === 'admin' || mode === 'deleted-admin' ? 'admin' : mode === 'nonresident' ? 'unsupported' : 'resident';
      const active = mode !== 'deleted-admin';
      const roleFilter = query.get('role');
      const allowedRole = roleFilter === `eq.${role}` || !!roleFilter?.startsWith('in.(') && roleFilter.slice(4, -1).split(',').includes(role);
      return Response.json(allowedRole && active && query.get('deleted_at') === 'is.null' ? { id: userId } : null);
    }
    if (url.includes('/rest/v1/rpc/consume_id_extraction_limit')) return Response.json(mode !== 'rate');
    if (url.includes('/storage/v1/object/')) {
      if (mode === 'large-stream') return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(1000001)); },
        cancel() { streamCancelled = true; },
      }), { headers: { 'Content-Type': 'image/png' } });
      return new Response(png, { headers: { 'Content-Type': mode === 'mime' ? 'image/jpeg' : 'image/png' } });
    }
    if (url === 'https://api.ocr.space/parse/image') {
      if (mode === 'timeout') return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('fixture timeout', 'AbortError'))));
      if (mode === 'http') return Response.json({}, { status: 503 });
      if (mode === 'quota') return Response.json({}, { status: 429 });
      if (mode === 'invalid-key') return Response.json({ IsErroredOnProcessing: true, OCRExitCode: 4, ErrorMessage: ['Invalid API key: provider-fixture-key'] });
      if (mode === 'unauthorized') return Response.json({ error: 'provider-fixture-key' }, { status: 401 });
      if (mode === 'json') return new Response('not json');
      if (mode === 'empty') return Response.json({ ...providerSuccess, ParsedResults: [{ FileParseExitCode: 1, ParsedText: '' }] });
      return Response.json(providerSuccess);
    }
    throw new Error('Unexpected adapter request');
  }));
});
afterEach(() => { vi.useRealTimers(); });
const request = () => new Request('https://backend.test/functions/v1/extract-resident-id-ocrspace', { method: 'POST', headers: { Authorization: 'Bearer resident-fixture-token' }, body: JSON.stringify({ frontPath, idType: 'PhilSys' }) });
describe('actual Edge adapter wiring with fixture transports', () => {
  it('uses verified caller/RLS downloads, the server-only limiter, fixed free endpoint and a multipart derivative', async () => {
    const response = await handler(request()); expect(response.status).toBe(200);
    const provider = calls.find(call => call.url === 'https://api.ocr.space/parse/image');
    expect(provider?.init?.body).toBeInstanceOf(FormData);
    const form = provider?.init?.body as FormData;
    expect(form.get('OCREngine')).toBe('2'); expect(form.get('language')).toBe('auto');
    expect(form.get('isOverlayRequired')).toBe('false'); expect(form.get('isCreateSearchablePdf')).toBe('false');
    expect(form.get('url')).toBeNull(); expect(form.get('file')).toBeInstanceOf(Blob);
    const headers = new Headers(provider?.init?.headers); expect(headers.get('apikey')).toBe('provider-fixture-key');
    const download = calls.find(call => call.url.includes('/storage/v1/'));
    expect(new Headers(download?.init?.headers).get('authorization')).toBe('Bearer resident-fixture-token');
    const limiter = calls.find(call => call.url.includes('consume_id_extraction_limit'));
    expect(new Headers(limiter?.init?.headers).get('authorization')).toBe('Bearer server-fixture-key');
    expect(calls.some(call => /google|vision/.test(call.url))).toBe(false);
    const body = await response.text(); expect(body).not.toContain('fixture-key'); expect(body).not.toContain('ParsedText');
  });
  it.each(['resident', 'admin'])('allows a live %s profile with the same owner and limiter checks', async role => {
    mode = role;
    expect((await handler(request())).status).toBe(200);
    const query = new URL(calls.find(call => call.url.includes('/rest/v1/profiles'))!.url).searchParams;
    expect(query.get('id')).toBe(`eq.${userId}`);
    expect(query.get('role')).toBe('in.(resident,admin)');
    expect(query.get('deleted_at')).toBe('is.null');
    expect(JSON.parse(calls.find(call => call.url.includes('consume_id_extraction_limit'))!.init!.body as string)).toEqual({ p_resident_id: userId });
  });
  it.each([['anonymous', 401], ['nonresident', 401], ['deleted-admin', 401], ['rate', 429], ['mime', 400]])('stops %s before provider access', async (scenario, status) => {
    mode = scenario; expect((await handler(request())).status).toBe(status);
    expect(calls.some(call => call.url.includes('ocr.space'))).toBe(false);
  });
  it('keeps a missing key server-only with readable manual-entry feedback', async () => {
    env.delete('OCR_SPACE_API_KEY'); const response = await handler(request());
    expect(response.status).toBe(503); expect(await response.text()).toContain('enter the details');
    expect(calls.some(call => call.url.includes('ocr.space'))).toBe(false);
  });
  it('cancels an excessive download before buffering the entire body or calling the provider', async () => {
    mode = 'large-stream';
    const response = await handler(request());
    expect(response.status).toBe(400);
    expect(streamCancelled).toBe(true);
    expect(calls.some(call => call.url.includes('ocr.space'))).toBe(false);
    expect(await response.text()).not.toContain('fixture-key');
  });
  it.each([['http', 503], ['quota', 429], ['json', 503], ['empty', 422], ['invalid-key', 422], ['unauthorized', 503]])('maps provider %s failure without retries', async (scenario, status) => {
    mode = scenario;
    const response = await handler(request());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('provider-fixture-key');
    expect(calls.filter(call => call.url.includes('ocr.space'))).toHaveLength(1);
  });
  it('cancels a stalled provider after 25 seconds and clears action timers', async () => {
    vi.useFakeTimers(); mode = 'timeout';
    const response = handler(request());
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.some(call => call.url.includes('ocr.space'))).toBe(true);
    await vi.advanceTimersByTimeAsync(25000);
    expect((await response).status).toBe(503);
    expect(calls.filter(call => call.url.includes('ocr.space'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
