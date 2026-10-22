import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DataError } from '../src/data/outcome';
import { residentApi, type CheckInReceipt } from '../src/data/resident-api';
import { residentError } from '../src/lib/errors';
import { guideFrom, SEED_QR_GUIDE, stepsFrom, type QrContentRow } from '../src/features/qr/guide';
import { HOUSEHOLD_QR_GUIDANCE, householdQrNotice, householdQrState } from '../src/features/qr/household-qr';
import { centerPayload, householdPayload, MAX_SCAN_LENGTH, parseCenterScan } from '../src/features/qr/payloads';
import { imageReference, saveCenterCode, shareCenterCode, shareMessage } from '../src/features/qr/qr-actions';
import { encodeQr, MAX_QR_TEXT, QUIET_ZONE, qrDataUri, qrPng } from '../src/features/qr/qr-image';
import { ScanController, UNCONFIRMED_MESSAGE, type ScanDependencies, type ScanState } from '../src/features/qr/scan-controller';
import { pickCenter } from '../src/features/qr/show-qr';
import { dataUriBytes, type SaveDeps } from '../src/features/payments/native-actions';
import { releaseGates } from '../src/lib/release-gates';
import config from '../app.config';

const TENANT = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT = '44444444-4444-4444-8444-444444444444';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CENTER = '33333333-3333-4333-8333-333333333333';
const CHECK_IN = '55555555-5555-4555-8555-555555555555';
const signal = () => new AbortController().signal;

describe('QR image (A26-005…007, A27-002; P15-T05 proves QR output)', () => {
  it('encodes text into a square symbol and refuses empty or oversize text', () => {
    const matrix = encodeQr('{"type":"household"}');
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect((matrix.size - 17) % 4).toBe(0);
    // The three finder patterns sit in three corners; the fourth corner has none.
    expect(matrix.dark(0, 0)).toBe(true);
    expect(matrix.dark(0, matrix.size - 1)).toBe(true);
    expect(matrix.dark(matrix.size - 1, 0)).toBe(true);
    expect(() => encodeQr('')).toThrow(RangeError);
    expect(() => encodeQr('x'.repeat(MAX_QR_TEXT + 1))).toThrow(RangeError);
  });

  function chunks(png: Uint8Array) {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const found: { type: string; data: Uint8Array; crc: number }[] = [];
    let at = 8;
    while (at < png.length) {
      const length = view.getUint32(at);
      found.push({ type: String.fromCharCode(...png.subarray(at + 4, at + 8)), data: png.subarray(at + 8, at + 8 + length), crc: view.getUint32(at + 8 + length) });
      at += 12 + length;
    }
    return found;
  }
  function crc(bytes: Uint8Array) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  it('writes a valid 1-bit PNG whose pixels are the symbol with a four-module quiet zone', () => {
    const matrix = encodeQr(centerPayload({ id: CENTER, name: 'Ampid 1 Covered Court' }, TENANT));
    const scale = 5;
    const png = qrPng(matrix, scale);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const parts = chunks(png);
    expect(parts.map((part) => part.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    for (const part of parts) {
      const typed = new Uint8Array(4 + part.data.length);
      typed.set([...part.type].map((character) => character.charCodeAt(0)), 0);
      typed.set(part.data, 4);
      expect(part.crc).toBe(crc(typed));
    }
    const header = new DataView(parts[0].data.buffer, parts[0].data.byteOffset, parts[0].data.byteLength);
    const side = (matrix.size + 2 * QUIET_ZONE) * scale;
    expect([header.getUint32(0), header.getUint32(4), parts[0].data[8], parts[0].data[9]]).toEqual([side, side, 1, 0]);
    const raw = inflateSync(Buffer.from(parts[1].data));
    const rowBytes = Math.ceil(side / 8);
    expect(raw.length).toBe(side * (rowBytes + 1));
    for (let y = 0; y < side; y += 1) {
      expect(raw[y * (rowBytes + 1)]).toBe(0);
      for (let x = 0; x < side; x += 1) {
        const row = Math.floor(y / scale) - QUIET_ZONE;
        const column = Math.floor(x / scale) - QUIET_ZONE;
        const inside = row >= 0 && column >= 0 && row < matrix.size && column < matrix.size;
        const black = inside && matrix.dark(row, column);
        const bit = (raw[y * (rowBytes + 1) + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
        expect(bit).toBe(black ? 0 : 1);
      }
    }
  });
  it('spans several stored blocks for a large image and rejects a bad scale', () => {
    const matrix = encodeQr('x'.repeat(900));
    const png = qrPng(matrix, 32);
    const idat = chunks(png)[1];
    expect(inflateSync(Buffer.from(idat.data)).length).toBeGreaterThan(65535);
    expect(() => qrPng(matrix, 0)).toThrow(RangeError);
    expect(() => qrPng(matrix, 33)).toThrow(RangeError);
    expect(() => qrPng(matrix, 1.5)).toThrow(RangeError);
  });
  it('gives a data URI the Photos save flow accepts, well under its size limit', () => {
    const uri = qrDataUri(householdPayload(USER));
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = dataUriBytes(uri);
    expect(bytes[1]).toBe(0x50);
    expect(bytes.length).toBeLessThan(100_000);
  });
});

describe('center and household payloads (A25-018…021, A26-005/006)', () => {
  const payload = centerPayload({ id: CENTER, name: 'Ampid 1 Covered Court' }, TENANT);
  it('builds the schema-valid check-in text and reads it back', () => {
    expect(JSON.parse(payload)).toEqual({ type: 'EVACUATION_CENTER_CHECKIN', version: '1.0', center_id: CENTER, center_name: 'Ampid 1 Covered Court', barangay_id: TENANT });
    expect(parseCenterScan(payload, TENANT)).toEqual({ ok: true, centerId: CENTER });
    expect(parseCenterScan(`  ${payload}\n`, TENANT.toUpperCase())).toEqual({ ok: true, centerId: CENTER });
  });
  it('refuses to draw a code that fails the schema', () => {
    expect(() => centerPayload({ id: 'not-a-uuid', name: 'X' }, TENANT)).toThrow();
    expect(() => centerPayload({ id: CENTER, name: 'X' }, 'nope')).toThrow();
  });
  it('rejects every code that is not this barangay’s center code, with its own wording and before any request', () => {
    const reasons = (raw: string) => { const result = parseCenterScan(raw, TENANT); return result.ok ? 'ok' : result.reason; };
    expect(reasons('')).toBe('empty');
    expect(reasons('   ')).toBe('empty');
    expect(reasons('x'.repeat(MAX_SCAN_LENGTH + 1))).toBe('too-long');
    expect(reasons('https://example.com/check-in')).toBe('malformed');
    expect(reasons('{not json')).toBe('malformed');
    expect(reasons('[1,2]')).toBe('not-center-code');
    expect(reasons('"EVACUATION_CENTER_CHECKIN"')).toBe('not-center-code');
    expect(reasons('null')).toBe('not-center-code');
    expect(reasons(JSON.stringify({ ...JSON.parse(payload), version: '2.0' }))).toBe('not-center-code');
    expect(reasons(JSON.stringify({ ...JSON.parse(payload), center_id: 'x' }))).toBe('not-center-code');
    expect(reasons(householdPayload(USER))).toBe('household-code');
    expect(reasons(centerPayload({ id: CENTER, name: 'X' }, OTHER_TENANT))).toBe('foreign-barangay');
    const household = parseCenterScan(householdPayload(USER), TENANT);
    expect(!household.ok && household.message).toContain('household code');
  });
  it('encodes only the account id in the household code', () => {
    expect(JSON.parse(householdPayload(USER))).toEqual({ type: 'household', profileId: USER });
  });
});

function fakeReceipt(overrides: Partial<CheckInReceipt> = {}): CheckInReceipt {
  return { checkInId: CHECK_IN, centerId: CENTER, centerName: 'Ampid 1 Covered Court', checkedInAt: '2026-10-16T08:00:00.000Z', repeated: false, ...overrides };
}
const SCAN = centerPayload({ id: CENTER, name: 'Ampid 1 Covered Court' }, TENANT);

function controllerWith(checkIn: ScanDependencies['checkIn'], available = true) {
  const controller = new ScanController({ barangayId: TENANT, available, checkIn });
  const states: ScanState[] = [];
  controller.subscribe(() => states.push(controller.getState()));
  return { controller, states };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('scan-to-check-in controller (A25-016…028, §6.8 online resident-only correction)', () => {
  it('is unavailable behind a closed gate: nothing is parsed and nothing is sent', () => {
    let calls = 0;
    const { controller } = controllerWith(async () => { calls += 1; return fakeReceipt(); }, false);
    expect(controller.getState()).toEqual({ kind: 'unavailable' });
    controller.handleScan(SCAN);
    controller.reset();
    expect(controller.getState()).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);
  });
  it('records exactly one check-in however many times the camera reports the same code, and counts it only once confirmed', async () => {
    const gate = deferred<CheckInReceipt>();
    let calls = 0;
    const { controller, states } = controllerWith(() => { calls += 1; return gate.promise; });
    for (let frame = 0; frame < 5; frame += 1) controller.handleScan(SCAN);
    expect(controller.getState()).toEqual({ kind: 'processing', centerId: CENTER });
    expect(calls).toBe(1);
    expect(states.some((state) => state.kind === 'confirmed')).toBe(false);
    gate.resolve(fakeReceipt());
    await tick();
    expect(controller.getState()).toEqual({ kind: 'confirmed', receipt: fakeReceipt() });
    controller.handleScan(SCAN);
    expect(calls).toBe(1);
  });
  it('rejects a code that is not this barangay’s center code without contacting the server, then scans again after a reset', async () => {
    let calls = 0;
    const { controller } = controllerWith(async () => { calls += 1; return fakeReceipt(); });
    controller.handleScan('{"hello":1}');
    expect(controller.getState()).toMatchObject({ kind: 'rejected', reason: 'not-center-code' });
    controller.handleScan(SCAN);
    expect(calls).toBe(0);
    controller.reset();
    expect(controller.getState()).toEqual({ kind: 'scanning' });
    controller.handleScan(centerPayload({ id: CENTER, name: 'X' }, OTHER_TENANT));
    expect(controller.getState()).toMatchObject({ kind: 'rejected', reason: 'foreign-barangay' });
    expect(calls).toBe(0);
  });
  it('shows a definite server refusal as not recorded, with the server-specific wording', async () => {
    const { controller } = controllerWith(async () => { throw new DataError('not-found', undefined, 400, 'checkin_center_unavailable'); });
    controller.handleScan(SCAN);
    await tick();
    const state = controller.getState();
    expect(state).toEqual({ kind: 'failed', message: residentError(new DataError('not-found', undefined, 400, 'checkin_center_unavailable')) });
    expect(state.kind === 'failed' && state.message).toContain('not open for check-in');
    controller.reset();
    expect(controller.getState()).toEqual({ kind: 'scanning' });
  });
  it('treats a reply that never arrived as unconfirmed, keeps no attendance, and retries the same center safely', async () => {
    let calls = 0;
    const { controller } = controllerWith(async () => {
      calls += 1;
      if (calls === 1) throw new DataError('unknown-commit');
      return fakeReceipt({ repeated: true });
    });
    controller.handleScan(SCAN);
    await tick();
    expect(controller.getState()).toEqual({ kind: 'unconfirmed', centerId: CENTER, message: UNCONFIRMED_MESSAGE });
    expect(UNCONFIRMED_MESSAGE).toContain('not counted as attendance');
    controller.handleScan(SCAN);
    expect(calls).toBe(1);
    controller.retry();
    await tick();
    expect(calls).toBe(2);
    expect(controller.getState()).toEqual({ kind: 'confirmed', receipt: fakeReceipt({ repeated: true }) });
    controller.retry();
    expect(calls).toBe(2);
  });
  it('cannot be reset while a request is open, and an attempt cut off by closing the scanner is unconfirmed, not a success', async () => {
    const gate = deferred<CheckInReceipt>();
    const { controller } = controllerWith(() => gate.promise);
    controller.handleScan(SCAN);
    controller.reset();
    expect(controller.getState().kind).toBe('processing');
    controller.setActive(false);
    expect(controller.getState()).toEqual({ kind: 'unconfirmed', centerId: CENTER, message: UNCONFIRMED_MESSAGE });
    gate.resolve(fakeReceipt());
    await tick();
    expect(controller.getState().kind).toBe('unconfirmed');
    controller.handleScan(SCAN);
    expect(controller.getState().kind).toBe('unconfirmed');
    controller.setActive(true);
    controller.reset();
    expect(controller.getState()).toEqual({ kind: 'scanning' });
  });
  it('ignores an answer that arrives while inactive and one for a request that was replaced', async () => {
    const first = deferred<CheckInReceipt>();
    const { controller } = controllerWith(() => first.promise);
    controller.handleScan(SCAN);
    controller.setActive(false);
    controller.setActive(true);
    controller.reset();
    first.resolve(fakeReceipt());
    await tick();
    expect(controller.getState()).toEqual({ kind: 'scanning' });
  });
});

type Reply = { status?: number; body?: unknown } | 'network-error';
function harness(replies: Reply[]) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, USER), requests };
}
const storedRow = { id: CHECK_IN, evacuation_center_id: CENTER, checked_in_at: new Date().toISOString(), evacuation_centers: { name: 'Ampid 1 Covered Court' } };
describe('resident check-in cutover', () => {
  it('never calls the legacy API or reconciles an old scan as confirmed attendance', async () => {
    for (const replies of [[], [{ body: [storedRow] }], ['network-error']] as Reply[][]) {
      const { api, requests } = harness(replies);
      const failure = await api.checkInToCenter(CENTER).catch((error: unknown) => error);
      expect(failure).toMatchObject({ kind: 'authorization', code: 'staff_attendance_required' });
      expect(residentError(failure)).toContain('staff to scan your Family QR');
      expect(requests).toHaveLength(0);
    }
  });
  it('still validates malformed center references before returning the compatibility response', async () => {
    const { api, requests } = harness([]);
    await expect(api.checkInToCenter('x')).rejects.toMatchObject({ kind: 'not-found' });
    expect(requests).toHaveLength(0);
  });
  it('reads only the resident’s own newest check-ins and the barangay’s active QR guidance', async () => {
    const { api, requests } = harness([{ body: [storedRow] }, { body: [] }]);
    expect(await api.recentCheckIns(signal())).toHaveLength(1);
    const own = requests[0].url.searchParams;
    expect(own.get('select')).toBe('id,evacuation_center_id,checked_in_at,evacuation_centers(name)');
    expect(own.get('user_id')).toBe(`eq.${USER}`);
    expect(own.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(own.get('order')).toBe('checked_in_at.desc');
    expect(own.get('limit')).toBe('5');
    await api.emergencyQrContent(signal());
    const guide = requests[1].url;
    expect(guide.pathname).toBe('/rest/v1/emergency_qr_content');
    expect(guide.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(guide.searchParams.get('is_active')).toBe('eq.true');
    expect(guide.searchParams.get('deleted_at')).toBe('is.null');
  });
});

describe('QR guidance content (A25-001…005)', () => {
  const row = (overrides: Partial<QrContentRow>): QrContentRow => ({ id: CHECK_IN, section: 'how_it_works', title: 'How', body: '', content: [], icon: null, icon_color: null, icon_bg: null, sort_order: 1, ...overrides });
  it('keeps valid steps in order, trims operator text and drops incomplete steps without inventing any', () => {
    expect(stepsFrom([{ step: 2, title: ' Second ', desc: ' b ' }, { step: 1, title: 'First', desc: 'a' }, { step: 3, title: '', desc: 'x' }, { step: 0, title: 'Zero', desc: 'x' }, 'text', null, { step: 4, title: '  ', desc: 'y' }]))
      .toEqual([{ step: 1, title: 'First', desc: 'a' }, { step: 2, title: 'Second', desc: 'b' }]);
    expect(stepsFrom('nope')).toEqual([]);
    expect(stepsFrom(null)).toEqual([]);
  });
  it('reads the first published row of each section and only plain hex colours', () => {
    const guide = guideFrom([
      row({ id: 'b', section: 'why_scan', title: 'Later', sort_order: 5 }),
      row({ id: 'a', section: 'why_scan', title: ' Why? ', body: ' Because ', icon: 'shield-outline', icon_color: '#112233', icon_bg: 'url(x)', sort_order: 1 }),
      row({ id: 'c', content: [{ step: 1, title: 'One', desc: 'Do it' }] }),
    ]);
    expect(guide.why).toEqual({ title: 'Why?', body: 'Because', icon: 'shield-outline', color: '#112233', background: null });
    expect(guide.how).toEqual({ title: 'How', body: '', steps: [{ step: 1, title: 'One', desc: 'Do it' }] });
    expect(guideFrom([])).toEqual({ why: null, how: null });
  });
  it('ships a built-in guide that promises a check-in only when the app confirms it', () => {
    const text = JSON.stringify(SEED_QR_GUIDE);
    expect(SEED_QR_GUIDE.how?.steps.map((step) => step.step)).toEqual([1, 2, 3]);
    expect(text).toContain('only when the app says it was confirmed');
    expect(text).not.toMatch(/automatically/i);
  });
});

describe('Show QR center choice (A26-002…004)', () => {
  const centers = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  it('defaults to the first center, keeps a valid choice and falls back, saying so, when the choice disappears', () => {
    expect(pickCenter([], null)).toBeNull();
    expect(pickCenter([], 'a')).toBeNull();
    expect(pickCenter(centers, null)).toEqual({ center: centers[0], replaced: false });
    expect(pickCenter(centers, 'b')).toEqual({ center: centers[1], replaced: false });
    expect(pickCenter(centers, 'gone')).toEqual({ center: centers[0], replaced: true });
  });
});

describe('center QR share and Photos save (A26-009…013, P15-T04)', () => {
  it('shares the raw encoded text with a title line, and reports a closed sheet neutrally', async () => {
    const sent: string[] = [];
    const shared = await shareCenterCode(async (message) => { sent.push(message); return 'shared'; }, SCAN);
    expect(sent).toEqual([`Evacuation Center Check-in QR\n\n${SCAN}`]);
    expect(shareMessage(SCAN)).toBe(sent[0]);
    expect(shared.status).toBe('opened');
    const closed = await shareCenterCode(async () => 'dismissed', SCAN);
    expect(closed.status).toBe('cancelled');
    expect(closed.message).toContain('Nothing was shared');
    const failed = await shareCenterCode(async () => { throw new Error('boom'); }, SCAN);
    expect(failed).toEqual({ status: 'failed', message: 'The code could not be shared. Try again.' });
  });
  function saveDeps(overrides: Partial<SaveDeps> = {}) {
    const removed: string[] = [];
    const written: string[] = [];
    const added: string[] = [];
    const deps: SaveDeps = {
      requestAccess: async () => ({ granted: true, canAskAgain: true }),
      readImage: async (source) => dataUriBytes(source),
      writeTemp: (name) => { written.push(name); return { uri: `file:///cache/${name}`, remove() { removed.push(name); } }; },
      addToPhotos: async (uri) => { added.push(uri); },
      ...overrides,
    };
    return { deps, removed, written, added };
  }
  it('saves the generated PNG under the center’s name and removes the temporary file', async () => {
    const h = saveDeps();
    const outcome = await saveCenterCode(h.deps, qrDataUri(SCAN), 'Ampid 1 Covered Court');
    expect(outcome.status).toBe('saved');
    expect(imageReference('A')).toBe('center-A');
    expect(h.written).toEqual(['Barangayan-QR-center-Ampid-1-Covered-Court.png']);
    expect(h.removed).toEqual(h.written);
    expect(h.added).toHaveLength(1);
  });
  it('explains denied and blocked Photos access and a failed save, leaving nothing behind', async () => {
    const denied = saveDeps({ requestAccess: async () => ({ granted: false, canAskAgain: true }) });
    expect((await saveCenterCode(denied.deps, qrDataUri(SCAN), 'A')).status).toBe('denied');
    const blocked = saveDeps({ requestAccess: async () => ({ granted: false, canAskAgain: false }) });
    expect((await saveCenterCode(blocked.deps, qrDataUri(SCAN), 'A')).status).toBe('blocked');
    expect(denied.written.concat(blocked.written)).toEqual([]);
    const failing = saveDeps({ addToPhotos: async () => { throw new Error('system'); } });
    expect((await saveCenterCode(failing.deps, qrDataUri(SCAN), 'A')).status).toBe('failed');
    expect(failing.removed).toEqual(failing.written);
  });
});

describe('household QR (A27-002…007, P15-T05/T06)', () => {
  it('is generated on the device from the signed-in account, only when the gate is open and the profile matches', () => {
    const ready = householdQrState({ available: true, accountId: USER, profileId: USER.toUpperCase() });
    expect(ready.kind).toBe('ready');
    expect(ready.kind === 'ready' && dataUriBytes(ready.dataUri).length).toBeGreaterThan(100);
    expect(householdQrState({ available: false, accountId: USER, profileId: USER })).toEqual({ kind: 'unavailable' });
    expect(householdQrState({ available: true, accountId: null, profileId: USER })).toEqual({ kind: 'no-account' });
    expect(householdQrState({ available: true, accountId: USER, profileId: undefined })).toEqual({ kind: 'no-account' });
    expect(householdQrState({ available: true, accountId: USER, profileId: CENTER })).toEqual({ kind: 'mismatch' });
    expect(householdQrState({ available: true, accountId: 'x', profileId: 'x' })).toEqual({ kind: 'mismatch' });
  });
  it('is a different code from a center code: the check-in scanner refuses it', () => {
    expect(parseCenterScan(householdPayload(USER), TENANT)).toMatchObject({ ok: false, reason: 'household-code' });
    expect(householdPayload(USER)).not.toBe(SCAN);
  });
  it('explains every placeholder and corrects the guidance: staff use it, the resident scanner does not check the family in', () => {
    for (const kind of ['unavailable', 'no-account', 'mismatch', 'failed'] as const) expect(householdQrNotice({ kind }).length).toBeGreaterThan(10);
    expect(HOUSEHOLD_QR_GUIDANCE).toContain('does not check your family in');
    expect(HOUSEHOLD_QR_GUIDANCE).toContain('Staff mark household members’ attendance');
    expect(HOUSEHOLD_QR_GUIDANCE).not.toMatch(/quick family check-in/i);
  });
});

describe('release gates and native configuration for QR (G08, G15, G02)', () => {
  it('opens the check-in and household-code gates only by owner decision OD-12, and nothing else with them', () => {
    expect(releaseGates.evacuationCheckin).toBe(true);
    expect(releaseGates.householdQr).toBe(true);
    expect(releaseGates.mapProviders).toBe(false);
    expect(releaseGates.publicIncidents).toBe(false);
    expect(releaseGates.householdEditing).toBe(false);
  });
  it('declares one camera purpose that covers photos and QR scanning, and no microphone', () => {
    const plugins = (config.plugins ?? []) as [string, Record<string, unknown>][];
    const camera = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-camera');
    const picker = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
    expect(camera?.[1]).toMatchObject({ microphonePermission: false });
    expect(typeof camera?.[1].cameraPermission).toBe('string');
    expect(camera?.[1].cameraPermission).toBe(picker?.[1].cameraPermission);
    expect(camera?.[1].cameraPermission).toMatch(/QR code/);
    expect(camera?.[1].cameraPermission).toMatch(/photo/);
  });
});
