import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';
import { residentApi, type AnnouncementItem } from '../src/data/resident-api';
import { emergencyInformationRow } from '../src/data/schemas';
import { EMERGENCY_CONTENT_POLICY, freshness } from '../src/data/public-cache';
import {
  activeCustomCount, buildAlertQuery, matchesCustom, parseCustom, sanitizeDigits, sanitizeLetters, toDateWindow,
  type CustomFilter,
} from '../src/features/emergency/alert-filters';
import { alertCounts, alertsRead } from '../src/features/emergency/alerts-read';
import { dialTarget, guidelinesFrom, hotlinesFrom, safeColor, symbolFor, type EmergencyRow } from '../src/features/emergency/content';
import { SEED_GUIDELINES, SEED_HOTLINES } from '../src/features/emergency/seed';
import { resolveSection } from '../src/features/emergency/sections';
import { releaseGates } from '../src/lib/release-gates';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const signal = () => new AbortController().signal;
const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const NONE: CustomFilter = { month: null, day: null, year: null };

const row = (patch: Partial<EmergencyRow> & { id: string; category: string }): EmergencyRow => ({
  title: 'Title', body: '', icon: 'call-outline', icon_color: '#FFFFFF', icon_bg: '#EF4444', content: [], sort_order: 0, ...patch,
});

describe('hotline dialing (A22-004/005, T22 invalid and missing numbers)', () => {
  it('builds a tel: link only for plain phone numbers, short national codes included', () => {
    expect(dialTarget('911')).toBe('tel:911');
    expect(dialTarget('143')).toBe('tel:143');
    expect(dialTarget('8888')).toBe('tel:8888');
    expect(dialTarget(' (02) 8123-4567 ')).toBe('tel:0281234567');
    expect(dialTarget('+63 917 123 4567')).toBe('tel:+639171234567');
    expect(dialTarget('0917.123.4567')).toBe('tel:09171234567');
  });
  it('refuses empty, too short, too long and control-character numbers so no dial code reaches the dialer', () => {
    for (const bad of ['', '   ', '12', '1234567890123456', 'call me', '911;ext=1', '*21*911#', '911,,1', '+', '+-', 'tel:911', '9 1 1 abc', '#31#911']) expect(dialTarget(bad), bad).toBeNull();
  });
  it('keeps a leading plus only at the start', () => {
    expect(dialTarget('63+917123456')).toBeNull();
    expect(dialTarget('+63917123456')).toBe('tel:+63917123456');
  });
});

describe('guideline and hotline content (A21, A22)', () => {
  it('orders by sort order and keeps only readable steps', () => {
    const rows = [
      row({ id: 'b', category: 'guidelines', title: 'Second', sort_order: 2, content: ['One', '  ', 7, null, 'Two'] }),
      row({ id: 'a', category: 'guidelines', title: 'First', sort_order: 1, content: 'not a list' }),
      row({ id: 'c', category: 'hotlines', title: 'Not a guideline' }),
    ];
    const guidelines = guidelinesFrom(rows);
    expect(guidelines.map((guideline) => guideline.title)).toEqual(['First', 'Second']);
    expect(guidelines[0].steps).toEqual([]);
    expect(guidelines[1].steps).toEqual(['One', 'Two']);
  });
  it('lists every number of a hotline, marking invalid ones as not callable and dropping empty entries', () => {
    const [hotline] = hotlinesFrom([row({ id: 'h', category: 'hotlines', title: 'Rescue', content: [
      { label: 'Main', number: '911' }, { label: 'Backup', number: '+63 2 8123 4567' }, { label: 'Bad', number: 'call the office' }, { label: 'Blank', number: '  ' }, { number: '143' }, 'text', null, [],
    ] })]);
    expect(hotline.numbers).toEqual([
      { label: 'Main', number: '911', dial: 'tel:911' },
      { label: 'Backup', number: '+63 2 8123 4567', dial: 'tel:+63281234567' },
      { label: 'Bad', number: 'call the office', dial: null },
      { label: 'Hotline', number: '143', dial: 'tel:143' },
    ]);
  });
  it('shows a hotline with no number as such instead of inventing one', () => {
    const [hotline] = hotlinesFrom([row({ id: 'h', category: 'hotlines', title: 'Council', content: undefined })]);
    expect(hotline.numbers).toEqual([]);
  });
  it('uses a tenant colour only when it is a plain hex value and maps unknown icons to a fallback', () => {
    expect(safeColor('#0F6E5B')).toBe('#0F6E5B');
    for (const bad of ['red', '#FFF', 'url(javascript:1)', '#GGGGGG', '']) expect(safeColor(bad)).toBeNull();
    expect(symbolFor('flame-outline', 'phone')).toBe('flame');
    expect(symbolFor('no-such-icon', 'phone')).toBe('phone');
  });
  it('parses the stored row shape and rejects rows missing required columns', () => {
    const good = row({ id: uuidFor(1), category: 'guidelines' });
    expect(emergencyInformationRow.safeParse(good).success).toBe(true);
    expect(emergencyInformationRow.safeParse({ ...good, sort_order: 'x' }).success).toBe(false);
  });
  it('ships bundled earthquake guidelines (before/during/after) and national hotlines that are all dialable', () => {
    expect(guidelinesFrom(SEED_GUIDELINES).map((guideline) => guideline.title)).toEqual(['Before an Earthquake', 'During an Earthquake', 'After an Earthquake']);
    expect(guidelinesFrom(SEED_GUIDELINES).every((guideline) => guideline.steps.length > 0)).toBe(true);
    const hotlines = hotlinesFrom(SEED_HOTLINES);
    expect(hotlines.length).toBeGreaterThan(0);
    for (const entry of hotlines.flatMap((hotline) => hotline.numbers)) expect(entry.dial, entry.number).not.toBeNull();
    for (const seed of [...SEED_GUIDELINES, ...SEED_HOTLINES]) expect(emergencyInformationRow.omit({ id: true }).safeParse(seed).success, seed.id).toBe(true);
  });
  it('labels an offline copy by its age: saved copies go stale after a day and expire after thirty', () => {
    const DAY = 24 * 60 * 60 * 1000;
    expect(freshness(1000, 1000 + 2 * 60 * 60 * 1000, EMERGENCY_CONTENT_POLICY)).toBe('fresh');
    expect(freshness(1000, 1000 + 2 * DAY, EMERGENCY_CONTENT_POLICY)).toBe('stale');
    expect(freshness(1000, 1000 + 31 * DAY, EMERGENCY_CONTENT_POLICY)).toBe('expired');
  });
});

describe('emergency content gate (OD-10)', () => {
  it('is open for the non-device scope while the processor and other-residents gates stay closed', () => {
    expect(releaseGates.emergencyContent).toBe(true);
    expect(releaseGates.mapProviders).toBe(false);
    expect(releaseGates.publicIncidents).toBe(false);
  });
});

describe('hub sections and aliases (A20, T20)', () => {
  it('opens the named section, accepts Android names and falls back to Guidelines', () => {
    expect(resolveSection('alerts', undefined)).toBe('alerts');
    expect(resolveSection(['hotlines'], undefined)).toBe('hotlines');
    expect(resolveSection(undefined, 'scan')).toBe('qr');
    expect(resolveSection(undefined, 'hub')).toBe('guidelines');
    expect(resolveSection('hotline-directory', undefined)).toBe('hotlines');
    expect(resolveSection('preparedness-guide', undefined)).toBe('guidelines');
    expect(resolveSection('section-that-does-not-exist', undefined)).toBe('guidelines');
    expect(resolveSection(undefined, undefined)).toBe('guidelines');
    expect(resolveSection('centers', 'alerts')).toBe('centers');
  });
});

describe('alert filter input (A28-015/016/017)', () => {
  it('keeps letters in the month and digits in the day and year, and says when it refused something', () => {
    expect(sanitizeLetters('Jan7!')).toEqual({ value: 'Jan', rejected: true });
    expect(sanitizeLetters('January')).toEqual({ value: 'January', rejected: false });
    expect(sanitizeDigits('2a0b26', 4)).toEqual({ value: '2026', rejected: true });
    expect(sanitizeDigits('202699', 4)).toEqual({ value: '2026', rejected: false });
    expect(sanitizeDigits('1-5', 2)).toEqual({ value: '15', rejected: true });
  });
  it('accepts month names and three-letter abbreviations, and flags unknown months, days and years', () => {
    expect(parseCustom({ month: 'January', day: '', year: '' }).filter.month).toBe(1);
    expect(parseCustom({ month: ' sept ', day: '', year: '' }).filter.month).toBe(9);
    expect(parseCustom({ month: 'DEC', day: '', year: '' }).filter.month).toBe(12);
    expect(parseCustom({ month: 'Ju', day: '', year: '' }).errors.month).toBeDefined();
    expect(parseCustom({ month: 'Smarch', day: '', year: '' }).errors.month).toBeDefined();
    for (const day of ['0', '32', '99']) expect(parseCustom({ month: '', day, year: '' }).errors.day, day).toBeDefined();
    expect(parseCustom({ month: '', day: '31', year: '' }).filter.day).toBe(31);
    for (const year of ['26', '202', '0999']) expect(parseCustom({ month: '', day: '', year }).errors.year, year).toBeDefined();
    expect(parseCustom({ month: '', day: '', year: '2026' }).filter.year).toBe(2026);
    expect(parseCustom({ month: '', day: '', year: '' })).toEqual({ filter: NONE, errors: {} });
  });
  it('counts the custom fields that hold text', () => {
    expect(activeCustomCount({ month: '', day: '', year: '' })).toBe(0);
    expect(activeCustomCount({ month: 'May', day: ' ', year: '2026' })).toBe(2);
  });
});

describe('alert periods on the local calendar (A28-005…010, T28 edges)', () => {
  it('Today is the local day: [00:00, next 00:00), with the very last millisecond inside and midnight outside', () => {
    const now = new Date(2026, 9, 16, 15, 30); // 16 Oct 2026 15:30 local
    const { window } = buildAlertQuery('today', NONE, now);
    expect(window.from).toEqual(new Date(2026, 9, 16, 0, 0, 0, 0));
    expect(window.to).toEqual(new Date(2026, 9, 17, 0, 0, 0, 0));
    expect(new Date(2026, 9, 16, 23, 59, 59, 999) >= window.from! && new Date(2026, 9, 16, 23, 59, 59, 999) < window.to!).toBe(true);
    expect(new Date(2026, 9, 17, 0, 0, 0, 0) < window.to!).toBe(false);
    expect(new Date(2026, 9, 15, 23, 59, 59, 999) >= window.from!).toBe(false);
  });
  it('Today crosses a month and a year end without drifting', () => {
    expect(buildAlertQuery('today', NONE, new Date(2026, 11, 31, 23, 59)).window.to).toEqual(new Date(2027, 0, 1));
    expect(buildAlertQuery('today', NONE, new Date(2026, 0, 31, 8)).window.to).toEqual(new Date(2026, 1, 1));
  });
  it('Last Week, Month and Year count back 7, 30 and 365 local days from now with no upper bound', () => {
    const now = new Date(2026, 2, 5, 10, 0);
    expect(buildAlertQuery('week', NONE, now).window).toEqual({ from: new Date(2026, 1, 26, 10, 0), to: null });
    expect(buildAlertQuery('month', NONE, now).window.from).toEqual(new Date(2026, 1, 3, 10, 0));
    expect(buildAlertQuery('year', NONE, now).window.from).toEqual(new Date(2025, 2, 5, 10, 0));
    expect(buildAlertQuery('all', NONE, now)).toEqual({ empty: false, window: { from: null, to: null }, match: null });
  });
  it('serializes a window as ISO instants and leaves open sides null', () => {
    const query = buildAlertQuery('week', NONE, new Date(Date.UTC(2026, 9, 16, 12)));
    const window = toDateWindow(query);
    expect(window.to).toBeNull();
    expect(new Date(window.from!).getTime()).toBe(query.window.from!.getTime());
  });
});

describe('custom date filters (A28-012…014)', () => {
  const now = new Date(2026, 9, 16, 12);
  it('a year, a month of a year and a day name one contiguous window', () => {
    expect(buildAlertQuery('all', { ...NONE, year: 2026 }, now).window).toEqual({ from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) });
    expect(buildAlertQuery('all', { month: 2, day: null, year: 2028 }, now).window).toEqual({ from: new Date(2028, 1, 1), to: new Date(2028, 2, 1) });
    expect(buildAlertQuery('all', { month: 12, day: null, year: 2026 }, now).window.to).toEqual(new Date(2027, 0, 1));
    expect(buildAlertQuery('all', { month: 2, day: 29, year: 2028 }, now).window).toEqual({ from: new Date(2028, 1, 29), to: new Date(2028, 2, 1) });
  });
  it('a date that does not exist matches nothing, and does not roll into the next month', () => {
    expect(buildAlertQuery('all', { month: 2, day: 29, year: 2026 }, now).empty).toBe(true);
    expect(buildAlertQuery('all', { month: 4, day: 31, year: 2026 }, now).empty).toBe(true);
  });
  it('a month or day without a year recurs across years, so it is matched on the device', () => {
    expect(buildAlertQuery('all', { month: 3, day: null, year: null }, now)).toMatchObject({ empty: false, match: { month: 3, day: null, year: null }, window: { from: null, to: null } });
    expect(buildAlertQuery('all', { month: null, day: 15, year: null }, now).match).not.toBeNull();
    expect(buildAlertQuery('all', { month: 3, day: 15, year: null }, now).match).not.toBeNull();
    expect(buildAlertQuery('all', { month: null, day: 15, year: 2026 }, now).match).not.toBeNull();
  });
  it('a period and a custom date both apply: the window is their intersection, and disjoint ones match nothing', () => {
    expect(buildAlertQuery('year', { ...NONE, year: 2026 }, now).window).toEqual({ from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) });
    expect(buildAlertQuery('year', { ...NONE, year: 2025 }, now).window.from).toEqual(new Date(2025, 9, 16, 12));
    expect(buildAlertQuery('today', { month: 10, day: 16, year: 2026 }, now).empty).toBe(false);
    expect(buildAlertQuery('today', { month: 10, day: 15, year: 2026 }, now).empty).toBe(true);
    expect(buildAlertQuery('week', { ...NONE, year: 2024 }, now).empty).toBe(true);
    expect(buildAlertQuery('today', { month: 3, day: null, year: null }, now).match).not.toBeNull();
  });
  it('matches the local month, day and year of an instant, and never a malformed date', () => {
    const iso = new Date(2026, 2, 15, 23, 30).toISOString(); // 15 Mar 2026, late evening local
    expect(matchesCustom(iso, { month: 3, day: 15, year: 2026 })).toBe(true);
    expect(matchesCustom(iso, { month: 3, day: null, year: null })).toBe(true);
    expect(matchesCustom(iso, { month: null, day: 15, year: null })).toBe(true);
    expect(matchesCustom(iso, { month: 4, day: null, year: null })).toBe(false);
    expect(matchesCustom(iso, { month: null, day: 14, year: null })).toBe(false);
    expect(matchesCustom(iso, { month: null, day: null, year: 2025 })).toBe(false);
    expect(matchesCustom('not a date', NONE)).toBe(false);
  });
});

function alertItem(index: number, publishedAt: Date): AnnouncementItem {
  return { id: uuidFor(index), title: `Alert ${index}`, category: 'emergency', published_at: publishedAt.toISOString(), body: 'Body', read: null };
}

describe('alert reads over more than one page (T28 multiple pages)', () => {
  it('passes the server window and category, and pages the unmatched query without reading everything', async () => {
    const calls: unknown[] = [];
    const reader = vi.fn((category: 'emergency', window?: { from: string | null; to: string | null }) => async (range: { from: number; to: number }) => { calls.push({ category, window, range }); return []; });
    const query = buildAlertQuery('all', { ...NONE, year: 2026 }, new Date(2026, 5, 1));
    await alertsRead(reader, query)({ from: 25, to: 49 }, signal());
    expect(calls).toEqual([{ category: 'emergency', window: toDateWindow(query), range: { from: 25, to: 49 } }]);
  });
  it('reads nothing for a filter that can match nothing', async () => {
    const reader = vi.fn();
    expect(await alertsRead(reader, buildAlertQuery('all', { month: 2, day: 30, year: 2026 }, new Date()))({ from: 0, to: 24 }, signal())).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
  });
  it('matches a recurring month on the device across several server pages and serves it page by page', async () => {
    const all: AnnouncementItem[] = Array.from({ length: 260 }, (_, index) => alertItem(index + 1, new Date(2026 - Math.floor(index / 12), 11 - (index % 12), 10, 9)));
    const serverPages: { from: number; to: number }[] = [];
    const reader = () => async ({ from, to }: { from: number; to: number }) => { serverPages.push({ from, to }); return all.slice(from, to + 1); };
    const read = alertsRead(reader, buildAlertQuery('all', { month: 3, day: null, year: null }, new Date(2026, 9, 16)));
    const first = await read({ from: 0, to: 9 }, signal());
    expect(first).toHaveLength(10);
    expect(first.every((item) => matchesCustom(item.published_at, { month: 3, day: null, year: null }))).toBe(true);
    expect(serverPages.length).toBe(3); // 260 rows in pages of 100
    const second = await read({ from: 10, to: 19 }, signal());
    expect(serverPages.length).toBe(3); // later pages come from the snapshot
    expect(second.map((item) => item.id)).not.toEqual(first.map((item) => item.id));
    const matches = all.filter((item) => matchesCustom(item.published_at, { month: 3, day: null, year: null })).length;
    expect(await read({ from: 0, to: matches + 4 }, signal())).toHaveLength(matches);
    expect(serverPages.length).toBe(6); // reloading from the first page takes a fresh snapshot
  });
  it('counts the whole category and the window on the server, and leaves device-matched filters to the loaded rows', async () => {
    const count = vi.fn(async (_category: 'emergency', window: { from: string | null; to: string | null } | undefined) => window ? 3 : 40);
    const windowed = buildAlertQuery('week', NONE, new Date(2026, 9, 16));
    expect(await alertCounts(count, windowed, signal())).toEqual({ total: 40, matching: 3 });
    expect(await alertCounts(count, buildAlertQuery('all', { month: 1, day: null, year: null }, new Date()), signal())).toEqual({ total: 40, matching: null });
    expect(await alertCounts(count, buildAlertQuery('all', { month: 2, day: 31, year: 2026 }, new Date()), signal())).toEqual({ total: 40, matching: 0 });
  });
});

describe('announcement reads with a publication window (B12)', () => {
  type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
  function harness(replies: Reply[], userId: string | null = USER) {
    const requests: { url: URL; method: string }[] = [];
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET' });
      const reply = replies.shift() ?? { body: [] };
      return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json', ...reply.headers } });
    };
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
    return { api: residentApi(client, TENANT, userId ?? undefined), requests };
  }
  it('restricts the emergency category and the half-open publication window on the server, newest first with an id tie-break', async () => {
    const { api, requests } = harness([{ body: [] }]);
    await api.announcements('emergency', { from: '2026-10-16T00:00:00.000Z', to: '2026-10-17T00:00:00.000Z' })({ from: 0, to: 24 }, signal());
    const params = requests[0].url.searchParams;
    expect(params.get('category')).toBe('eq.emergency');
    expect(params.getAll('published_at')).toEqual(['gte.2026-10-16T00:00:00.000Z', 'lt.2026-10-17T00:00:00.000Z']);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('deleted_at')).toBe('is.null');
    expect(params.get('order')).toBe('published_at.desc,id.asc');
  });
  it('adds no window clause when none is given, and a guest read has no read-state embed', async () => {
    const { api, requests } = harness([{ body: [] }], null);
    await api.announcements('emergency')({ from: 0, to: 24 }, signal());
    expect(requests[0].url.searchParams.has('published_at')).toBe(false);
    expect(requests[0].url.searchParams.get('select')).not.toContain('announcement_reads');
  });
  it('counts exactly on the server with the same scope and window, and fails when the server sends no count', async () => {
    const { api, requests } = harness([{ body: [], headers: { 'content-range': '*/7' } }, { body: [] }]);
    expect(await api.announcementCount('emergency', { from: '2026-10-01T00:00:00.000Z', to: null }, signal())).toBe(7);
    const params = requests[0].url.searchParams;
    expect(requests[0].method).toBe('HEAD');
    expect(params.get('category')).toBe('eq.emergency');
    expect(params.get('published_at')).toBe('gte.2026-10-01T00:00:00.000Z');
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    await expect(api.announcementCount('emergency', undefined, signal())).rejects.toMatchObject({ kind: 'schema' });
  });
});
