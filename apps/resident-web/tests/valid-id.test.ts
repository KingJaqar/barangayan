import { afterEach, describe, expect, it, vi } from 'vitest';
import { idConfirmedDetailsSchema } from '@barangayan/shared';
import { birthdayIso, birthdayMaximum, birthdayParts, composedIdType, daysInMonth, detailErrors, emptyDetails, limitBirthday, mergeSuggestions, readSuggestions } from '../src/app/(resident)/settings/valid-id/draft';
import { imageDimensions, safeDimensions } from '../src/app/(resident)/settings/valid-id/photo';
import { abortable, createIdClient, deadlineFetch } from '../src/app/(resident)/settings/valid-id/transport';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('confirmed ID draft and calendar boundaries', () => {
  it('uses shared types, Other encoding and its composed length boundary', () => {
    expect(composedIdType('Other', '  Local ID  ')).toBe('Other: Local ID');
    expect(composedIdType('Other', 'x'.repeat(193))).toHaveLength(200);
    expect(composedIdType('Other', 'x'.repeat(194))).toBe('');
    expect(composedIdType('Other', ' ')).toBe('');
    expect(composedIdType('invented', '')).toBe('');
    expect(composedIdType('PhilSys', '')).toBe('PhilSys');
  });
  it('accepts optional blanks and shared trimmed limits without registration-name restrictions', () => {
    expect(detailErrors(emptyDetails()).fullName).toContain('full name');
    const valid = { ...emptyDetails(), fullName: '  A. 123  ' };
    expect(detailErrors(valid)).toEqual({});
    expect(idConfirmedDetailsSchema.parse(valid).fullName).toBe('A. 123');
    expect(detailErrors({ ...valid, fullName: 'x'.repeat(201), idNumber: 'x'.repeat(201), address: 'x'.repeat(1001), birthDate: '2001-02-29' })).toHaveProperty('birthDate');
  });
  it('protects entered and explicitly cleared fields from late suggestions', () => {
    const suggestions = { fullName: 'Photo Name', idNumber: '123', birthDate: '2000-01-01', address: 'Photo address' };
    expect(mergeSuggestions({ ...emptyDetails(), fullName: 'Correction' }, new Set(['idNumber']), suggestions)).toEqual({ fullName: 'Correction', idNumber: '', birthDate: '2000-01-01', address: 'Photo address' });
    expect(mergeSuggestions(emptyDetails(), new Set(['birthDate']), suggestions).birthDate).toBe('');
  });
  it('rejects malformed responses and excessive fields without silently slicing usable fields', () => {
    expect(readSuggestions({ details: { fullName: 'Only one key' } })).toBeNull();
    expect(readSuggestions({ details: { fullName: 'x'.repeat(201), idNumber: '123', birthDate: '2001-02-29', address: '' } })).toEqual({ ...emptyDetails(), idNumber: '123' });
    expect(readSuggestions({ details: { ...emptyDetails(), fullName: '<script>alert(1)</script>' } })?.fullName).toContain('<script>');
  });
  it('clamps short months, leap centuries, ancient years and future dates', () => {
    expect(daysInMonth(1900, 2)).toBe(28); expect(daysInMonth(2000, 2)).toBe(29); expect(daysInMonth(4, 2)).toBe(29);
    expect(limitBirthday({ year: 2001, month: 2, day: 31 }, '2026-10-15')).toEqual({ year: 2001, month: 2, day: 28 });
    expect(birthdayIso(limitBirthday({ year: 2030, month: 12, day: 31 }, '2026-10-15'))).toBe('2026-10-15');
    expect(birthdayIso(birthdayParts('0001-02-28', '2026-10-15'))).toBe('0001-02-28');
    expect(birthdayParts('', '2026-10-15')).toEqual({ year: 2008, month: 1, day: 1 });
  });
  it('uses the earlier local/UTC calendar date around Manila midnight', () => {
    const date = new Date('2026-10-14T16:01:00Z');
    vi.spyOn(date, 'getFullYear').mockReturnValue(2026); vi.spyOn(date, 'getMonth').mockReturnValue(9); vi.spyOn(date, 'getDate').mockReturnValue(15);
    expect(birthdayMaximum(date)).toBe('2026-10-14');
    const west = new Date('2026-10-15T00:01:00Z');
    vi.spyOn(west, 'getDate').mockReturnValue(14);
    expect(birthdayMaximum(west)).toBe('2026-10-14');
  });
  it('checks MIME/content agreement and rejects excessive dimensions before decoding', () => {
    const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64'));
    expect(imageDimensions(png, 'image/png')).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(png, 'image/jpeg')).toBeNull();
    expect(safeDimensions({ width: 16384, height: 16384 })).toBe(false);
    expect(safeDimensions({ width: 0, height: 1 })).toBe(false);
    expect(safeDimensions({ width: 2400, height: 1800 })).toBe(true);
  });
});

describe('isolated authenticated transport', () => {
  it('keeps the SSR auth owner and token while using a cancellable independent REST transport', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.test'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'fixture-token' } }, error: null });
    const requests: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input, init: RequestInit) => { requests.push(init); return Response.json([]); }));
    const controller = new AbortController();
    const client = createIdClient(controller.signal);
    expect(client.auth).toBe(auth);
    const result = await client.from('profiles').select('id');
    expect(result.error).toBeNull();
    expect(new Headers(requests[0].headers).get('authorization')).toBe('Bearer fixture-token');
    expect(requests[0].signal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect((await client.from('profiles').select('id')).error).not.toBeNull();
    expect(requests).toHaveLength(1);
  });
  it('aborts the actual fetch at a finite per-request deadline', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let actual: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn((_input, init: RequestInit) => { actual = init.signal; return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))); }));
    const pending = deadlineFetch('https://supabase.test/storage/v1/object', {}, controller.signal);
    const check = expect(pending).rejects.toThrow('aborted');
    controller.abort();
    await check; expect(actual?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    ['/auth/v1/user', 15000],
    ['/storage/v1/object', 30000],
    ['/functions/v1/extract-resident-id-ocrspace', 30000],
    ['/rest/v1/profiles', 10000],
  ])('enforces the %s deadline even when no one cancels', async (path, duration) => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError'))))));
    const check = expect(deadlineFetch(`https://supabase.test${path}`)).rejects.toThrow('deadline');
    await vi.advanceTimersByTimeAsync(duration); await check; expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps the deadline active after headers arrive until a stalled body is cancelled', async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal('fetch', vi.fn(async (_input, init: RequestInit) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        init.signal?.addEventListener('abort', () => {
          aborted = true;
          controller.error(new DOMException('body deadline', 'AbortError'));
        }, { once: true });
      },
    }))));
    const check = expect(deadlineFetch('https://supabase.test/rest/v1/profiles')).rejects.toThrow('body deadline');
    await vi.advanceTimersByTimeAsync(9999); expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await check;
    expect(aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('ends non-network waits on cancellation and ignores their late completion', async () => {
    const controller = new AbortController();
    const pending = abortable(new Promise<string>(() => {}), controller.signal);
    const check = expect(pending).rejects.toThrow('Action ended');
    controller.abort(); await check;
  });
});
