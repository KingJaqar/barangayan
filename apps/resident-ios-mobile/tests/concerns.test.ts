import { createClient } from '@supabase/supabase-js';
import type { Database, LatLng } from '@barangayan/shared';
import type { Polygon } from 'geojson';
import { describe, expect, it, vi } from 'vitest';
import { pendingDestination } from '../src/auth/pending-destination';
import { DataError } from '../src/data/outcome';
import { residentApi, type IncidentCategory, type WasteZone } from '../src/data/resident-api';
import { createStagedUploads, type BucketApi } from '../src/lib/staged-uploads';
import { createProtectedDrafts } from '../src/lib/protected-drafts';
import { createSecureStorage, type KeyValueStore } from '../src/lib/secure-storage-core';
import { residentError } from '../src/lib/errors';
import { validateUpload } from '../src/lib/file-validation';
import { prepareImage } from '../src/lib/image-prep';
import { chooseCategory, buildConcern, emptyConcern, toggleZone, validateConcern, zoneApplies, type ConcernFields } from '../src/features/reports/concern-form';
import { clearConcernDraft, loadConcernDraft, saveConcernDraft } from '../src/features/reports/concern-draft';
import { createIncidentActions } from '../src/features/reports/incident-actions';
import { concernActions, concernTimeline } from '../src/features/reports/incident-model';
import { incidentPhotos } from '../src/features/reports/media';
import { abandonAttempt, confirmAttempt, submitConcern, type ConcernAttempt, type SubmitDeps } from '../src/features/reports/concern-submit';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const signal = () => new AbortController().signal;

type Reply = { status?: number; body?: unknown } | 'network-error';
function harness(replies: Reply[], userId: string | null = USER) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.status === 204 ? null : reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, userId ?? undefined), requests };
}

const SQUARE: Polygon = { type: 'Polygon', coordinates: [[[121, 14], [122, 14], [122, 15], [121, 15], [121, 14]]] };
const INSIDE: LatLng = { lat: 14.5, lng: 121.5 };
const CATEGORIES: IncidentCategory[] = [
  { id: uuidFor(10), name: 'Streetlight', color: '#ff0000', icon: null, is_trash_related: false },
  { id: uuidFor(11), name: 'Illegal dumping', color: '#00ff00', icon: 'trash', is_trash_related: true },
];
const ZONES: WasteZone[] = [{ id: uuidFor(20), name: 'Zone 1' }, { id: uuidFor(21), name: 'Zone 2' }];
const valid = (): ConcernFields => ({ ...emptyConcern(), categoryId: CATEGORIES[0].id, title: 'Broken streetlight' });
const check = (fields: ConcernFields, over: Partial<{ position: LatLng | null; boundary: Polygon | null; photoCount: number }> = {}) =>
  validateConcern({ fields, position: INSIDE, boundary: SQUARE, photoCount: 0, categories: CATEGORIES, zones: ZONES, ...over });

describe('concern form validation (A33-002…030, P12-T01)', () => {
  it('accepts a complete report with only the required details', () => {
    expect(check(valid())).toEqual({});
  });
  it('requires a category from the barangay list and a 3–100 character title', () => {
    expect(check({ ...valid(), categoryId: '' }).category).toBeDefined();
    expect(check({ ...valid(), categoryId: uuidFor(99) }).category).toBeDefined();
    expect(check({ ...valid(), title: '   ' }).title).toBe('Enter a title for your report.');
    expect(check({ ...valid(), title: 'ab' }).title).toMatch(/at least 3/);
    expect(check({ ...valid(), title: 'x'.repeat(101) }).title).toMatch(/100/);
    expect(check({ ...valid(), title: 'x'.repeat(100) }).title).toBeUndefined();
  });
  it('enforces the description, address and area limits of the shared schema', () => {
    expect(check({ ...valid(), description: 'x'.repeat(1001) }).description).toBeDefined();
    expect(check({ ...valid(), description: 'x'.repeat(1000) }).description).toBeUndefined();
    expect(check({ ...valid(), address: 'x'.repeat(301) }).address).toBeDefined();
    expect(check({ ...valid(), specificArea: 'x'.repeat(301) }).specificArea).toBeDefined();
  });
  it('requires a pin inside the boundary and says why it cannot check without one', () => {
    expect(check(valid(), { position: null }).location).toMatch(/Pin the location/);
    expect(check(valid(), { position: { lat: 40, lng: 100 } }).location).toMatch(/outside your barangay/);
    expect(check(valid(), { boundary: null }).location).toMatch(/boundary is not available/);
  });
  it('limits photos to five', () => {
    expect(check(valid(), { photoCount: 5 }).photos).toBeUndefined();
    expect(check(valid(), { photoCount: 6 }).photos).toMatch(/at most 5/);
  });
  it('offers a collection zone only for trash-related categories and clears it when it stops applying', () => {
    const dumping = { ...valid(), categoryId: CATEGORIES[1].id };
    expect(zoneApplies(dumping, CATEGORIES, ZONES)).toBe(true);
    expect(zoneApplies(valid(), CATEGORIES, ZONES)).toBe(false);
    expect(zoneApplies(dumping, CATEGORIES, [])).toBe(false);
    const withZone = toggleZone(dumping, ZONES[0].id);
    expect(withZone.zoneId).toBe(ZONES[0].id);
    expect(toggleZone(withZone, ZONES[0].id).zoneId).toBe('');
    expect(chooseCategory(withZone, CATEGORIES[0].id, CATEGORIES, ZONES).zoneId).toBe('');
    expect(chooseCategory({ ...withZone }, CATEGORIES[1].id, CATEGORIES, ZONES).zoneId).toBe(ZONES[0].id);
    expect(check({ ...valid(), zoneId: ZONES[0].id }).zone).toBeDefined();
    expect(check({ ...dumping, zoneId: uuidFor(98) }).zone).toBeDefined();
    expect(check({ ...dumping, zoneId: ZONES[1].id }).zone).toBeUndefined();
  });
  it('builds the server row with trimmed text and nulls for empty optional fields', () => {
    const row = buildConcern(uuidFor(1), { ...valid(), title: '  Broken streetlight  ', description: ' ', address: ' Rizal St ', specificArea: '' }, INSIDE, ['https://x/a.jpg']);
    expect(row).toEqual({
      id: uuidFor(1), categoryId: CATEGORIES[0].id, zoneId: null, title: 'Broken streetlight', description: null, photoUrls: ['https://x/a.jpg'],
      location: { lat: 14.5, lng: 121.5 }, address: 'Rizal St', specificAreaDetails: null,
    });
  });
});

describe('concern photos (A33-013…020, P12-T03)', () => {
  const jpeg = (size: number) => {
    const bytes = new Uint8Array(Math.max(size, 12));
    bytes.set([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02]);
    return bytes;
  };
  it('accepts a photo up to 10 MiB and refuses one above it', () => {
    expect(validateUpload('incident-photo', jpeg(9 * 1024 * 1024)).mimeType).toBe('image/jpeg');
    expect(() => validateUpload('incident-photo', jpeg(10 * 1024 * 1024 + 64))).toThrow();
  });
  it('re-encodes an over-limit photo, bounded to 2048 points, until the final bytes fit', async () => {
    const converter = vi.fn(async () => jpeg(4 * 1024 * 1024));
    const result = await prepareImage('incident-photo', jpeg(12 * 1024 * 1024), { width: 6000, height: 4000 }, converter);
    expect(result.bytes.length).toBe(4 * 1024 * 1024);
    expect(converter).toHaveBeenCalledWith({ longestEdge: 2048, quality: 0.85 });
  });
  it('lists only photos of this project’s incident-photos bucket, in order', () => {
    const project = 'https://example.supabase.co';
    const a = `${project}/storage/v1/object/public/incident-photos/${USER}/a/photo-1.jpg`;
    const b = `${project}/storage/v1/object/public/incident-photos/${USER}/a/photo-2.png`;
    expect(incidentPhotos([a, 'https://evil.example.org/storage/v1/object/public/incident-photos/x.jpg', b, 'javascript:alert(1)'], project)).toEqual([a, b]);
    expect(incidentPhotos([a], 'not a url')).toEqual([]);
  });
});

describe('concern reads and writes against the real query builder (P12-T04…T06)', () => {
  const detail = (over: Record<string, unknown> = {}) => ({
    id: uuidFor(1), title: 'Flooded street', description: null, status: 'open', created_at: '2026-10-15T01:00:00Z', updated_at: '2026-10-15T01:00:00Z',
    address: null, specific_area_details: null, location: { lat: 14.5, lng: 121.5 }, photo_urls: [], confirmation_count: 2, reporter_id: USER,
    incident_categories: { name: 'Flooding', color: '#00f', icon: null }, ...over,
  });

  it('reads the categories and active zones of this barangay only', async () => {
    const { api, requests } = harness([{ body: [{ id: uuidFor(10), name: 'Streetlight', color: '#f00', icon: null, is_trash_related: false }] }, { body: [{ id: uuidFor(20), name: 'Zone 1' }] }]);
    expect(await api.incidentCategories(signal())).toHaveLength(1);
    expect(await api.wasteZones(signal())).toEqual([{ id: uuidFor(20), name: 'Zone 1' }]);
    expect(requests[0].url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(requests[1].url.searchParams.get('is_active')).toBe('eq.true');
    expect(requests[1].url.searchParams.get('deleted_at')).toBe('is.null');
  });
  it('restricts an own-scope detail read to the resident’s reports and drops the reporter id', async () => {
    const { api, requests } = harness([{ body: detail() }]);
    const found = await api.incident(uuidFor(1), signal(), 'own');
    expect(found?.own).toBe(true);
    expect(found).not.toHaveProperty('reporter_id');
    expect(requests[0].url.searchParams.get('reporter_id')).toBe(`eq.${USER}`);
    expect(requests[0].url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
  });
  it('marks another resident’s report as not own in barangay scope, without a reporter filter', async () => {
    const { api, requests } = harness([{ body: detail({ reporter_id: OTHER }) }]);
    const found = await api.incident(uuidFor(1), signal(), 'barangay');
    expect(found?.own).toBe(false);
    expect(requests[0].url.searchParams.has('reporter_id')).toBe(false);
  });
  it('treats a malformed id as not found without sending a request, and an absent row as null', async () => {
    const { api, requests } = harness([{ status: 406, body: { code: 'PGRST116', message: 'no rows' } }]);
    expect(await api.incident('not-a-uuid', signal(), 'own')).toBeNull();
    expect(requests).toHaveLength(0);
    await expect(api.incident(uuidFor(1), signal(), 'own')).rejects.toBeInstanceOf(DataError);
  });
  it('fails closed on a malformed detail row', async () => {
    const { api } = harness([{ body: detail({ confirmation_count: 'two' }) }]);
    await expect(api.incident(uuidFor(1), signal(), 'own')).rejects.toMatchObject({ kind: 'schema' });
  });
  it('confirms a report and reports a repeat as already confirmed', async () => {
    const first = harness([{ body: true }]);
    expect(await first.api.confirmIncident(uuidFor(1))).toBe('confirmed');
    expect(JSON.parse(first.requests[0].body ?? '{}')).toEqual({ p_incident_id: uuidFor(1) });
    expect(await harness([{ body: false }]).api.confirmIncident(uuidFor(1))).toBe('already');
    await expect(harness([{ body: 'yes' }]).api.confirmIncident(uuidFor(1))).rejects.toMatchObject({ kind: 'schema' });
  });
  it('explains a refused confirmation with its stable code', async () => {
    const own = harness([{ status: 400, body: { code: 'P0001', message: 'you cannot confirm your own report' } }]);
    const failure = await own.api.confirmIncident(uuidFor(1)).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'incident_own_report' });
    expect(residentError(failure)).toMatch(/cannot confirm/);
    const missing = harness([{ status: 400, body: { code: 'P0001', message: 'incident is not in your barangay' } }]);
    expect(await missing.api.confirmIncident(uuidFor(1)).catch((error: unknown) => error)).toMatchObject({ kind: 'not-found' });
  });
  it('reconciles a lost confirmation reply with the resident’s own confirmation row', async () => {
    const recorded = harness(['network-error', { body: { incident_id: uuidFor(1) } }]);
    expect(await recorded.api.confirmIncident(uuidFor(1))).toBe('confirmed');
    expect(recorded.requests).toHaveLength(2);
    expect(recorded.requests[1].url.searchParams.get('user_id')).toBe(`eq.${USER}`);
    const lost = harness(['network-error', { status: 406, body: { code: 'PGRST116', message: 'no rows' } }]);
    await expect(lost.api.confirmIncident(uuidFor(1))).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('withdraws, reconciles by the stored status and explains the refusals', async () => {
    expect(await harness([{ status: 204 }]).api.withdrawIncident(uuidFor(1))).toBeUndefined();
    const lost = harness(['network-error', { body: { status: 'withdrawn' } }]);
    await lost.api.withdrawIncident(uuidFor(1));
    expect(lost.requests[1].url.searchParams.get('reporter_id')).toBe(`eq.${USER}`);
    await expect(harness(['network-error', { body: { status: 'open' } }]).api.withdrawIncident(uuidFor(1))).rejects.toMatchObject({ kind: 'unknown-commit' });
    const closed = await harness([{ status: 400, body: { code: 'P0001', message: 'the 24-hour withdrawal window for this report has closed' } }]).api.withdrawIncident(uuidFor(1)).catch((error: unknown) => error);
    expect(closed).toMatchObject({ code: 'incident_window_closed' });
    const foreign = await harness([{ status: 400, body: { code: 'P0001', message: 'you can only withdraw a report you filed yourself' } }]).api.withdrawIncident(uuidFor(1)).catch((error: unknown) => error);
    expect(foreign).toMatchObject({ code: 'incident_not_yours' });
  });
  it('files a concern with an app-chosen id, the resident as reporter and the open status', async () => {
    const { api, requests } = harness([{ status: 201 }]);
    await api.createIncident(buildConcern(uuidFor(5), { ...valid(), description: 'Deep water' }, INSIDE, [`https://x/incident-photos/${USER}/a.jpg`]));
    const sent = JSON.parse(requests[0].body ?? '{}');
    expect(requests[0].method).toBe('POST');
    expect(sent).toMatchObject({ id: uuidFor(5), barangay_id: TENANT, reporter_id: USER, category_id: CATEGORIES[0].id, zone_id: null, status: 'open', location: { lat: 14.5, lng: 121.5 } });
    expect(sent.photo_urls).toHaveLength(1);
  });
  it('treats a lost reply or a duplicate id as filed only when the resident’s own row exists', async () => {
    const concern = buildConcern(uuidFor(5), valid(), INSIDE, []);
    const lost = harness(['network-error', { body: { id: uuidFor(5) } }]);
    await lost.api.createIncident(concern);
    expect(lost.requests[1].url.searchParams.get('reporter_id')).toBe(`eq.${USER}`);
    const duplicate = harness([{ status: 409, body: { code: '23505', message: 'duplicate key' } }, { body: { id: uuidFor(5) } }]);
    await duplicate.api.createIncident(concern);
    await expect(harness(['network-error', { status: 406, body: { code: 'PGRST116', message: 'no rows' } }]).api.createIncident(concern)).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('maps the write-guard refusals to explained codes without leaking provider text', async () => {
    const concern = buildConcern(uuidFor(5), valid(), INSIDE, []);
    const failure = await harness([{ status: 400, body: { code: '22023', message: 'invalid_incident_photo' } }]).api.createIncident(concern).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'incident_photo_invalid', kind: 'validation' });
    expect(residentError(failure)).not.toContain('invalid_incident_photo');
  });
  it('explains the server’s completed-profile requirement', async () => {
    const failure = await harness([{ status: 403, body: { code: '42501', message: 'resident_profile_completion_required' } }]).api.createIncident(buildConcern(uuidFor(5), valid(), INSIDE, [])).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'profile_completion_required' });
    expect(residentError(failure)).toMatch(/Complete your profile/);
  });
  it('refuses a write without a session before any request is sent', async () => {
    const { api, requests } = harness([], null);
    await expect(api.createIncident(buildConcern(uuidFor(5), valid(), INSIDE, []))).rejects.toMatchObject({ kind: 'session' });
    await expect(api.confirmIncident(uuidFor(1))).rejects.toMatchObject({ kind: 'session' });
    await expect(api.withdrawIncident(uuidFor(1))).rejects.toMatchObject({ kind: 'session' });
    expect(requests).toHaveLength(0);
  });
  it('checks for an existing own row to reconcile a filing', async () => {
    expect(await harness([{ body: { id: uuidFor(5) } }]).api.incidentExists(uuidFor(5), signal())).toBe(true);
    expect(await harness([{ body: null, status: 200 }]).api.incidentExists(uuidFor(5), signal())).toBe(false);
  });
});

describe('what a resident may do with a concern (A34-017…031, P12-T05/T06)', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  const base = { own: false, status: 'open', createdAt: '2026-10-16T10:00:00Z', now, confirmed: false, publicIncidents: true };
  it('offers confirmation only for another resident’s active report not yet confirmed', () => {
    expect(concernActions(base).canConfirm).toBe(true);
    expect(concernActions({ ...base, status: 'in_progress' }).canConfirm).toBe(true);
    expect(concernActions({ ...base, own: true }).canConfirm).toBe(false);
    expect(concernActions({ ...base, confirmed: true })).toMatchObject({ canConfirm: false, alreadyConfirmed: true });
    for (const status of ['resolved', 'withdrawn', 'unresolved']) expect(concernActions({ ...base, status }).canConfirm).toBe(false);
  });
  it('offers nothing about other residents’ reports while public visibility is closed', () => {
    expect(concernActions({ ...base, publicIncidents: false })).toMatchObject({ canConfirm: false, alreadyConfirmed: false });
  });
  it('offers withdrawal for an own open report inside 24 hours and explains every other case', () => {
    expect(concernActions({ ...base, own: true }).canWithdraw).toBe(true);
    const late = concernActions({ ...base, own: true, createdAt: '2026-10-15T11:00:00Z' });
    expect(late.canWithdraw).toBe(false);
    expect(late.withdrawNote).toMatch(/24-hour/);
    expect(concernActions({ ...base, own: true, status: 'in_progress' }).withdrawNote).toMatch(/already handling/);
    expect(concernActions({ ...base, own: true, status: 'withdrawn' }).withdrawNote).toBe('You withdrew this report.');
    expect(concernActions({ ...base, own: false }).withdrawNote).toBeNull();
    expect(concernActions({ ...base, own: true, createdAt: 'garbage' }).canWithdraw).toBe(false);
  });
  it('shows a status trail without inventing times for steps that were passed', () => {
    const resolved = concernTimeline('resolved', '2026-10-10T00:00:00Z', '2026-10-12T00:00:00Z');
    expect(resolved.steps.map((step) => [step.status, step.state, step.at])).toEqual([
      ['open', 'done', '2026-10-10T00:00:00Z'], ['in_progress', 'done', null], ['resolved', 'current', '2026-10-12T00:00:00Z'],
    ]);
    const withdrawn = concernTimeline('withdrawn', '2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z');
    expect(withdrawn.stopped).toEqual({ label: 'Withdrawn by the reporter', at: '2026-10-11T00:00:00Z' });
    expect(withdrawn.steps.map((step) => step.state)).toEqual(['done', 'pending', 'pending']);
    expect(concernTimeline('mystery', 'a', 'b').stopped).toBeNull();
  });
});

describe('confirmation and withdrawal controller (P12-T06)', () => {
  it('sends one request for two quick taps and reports the committed result', async () => {
    let release: (value: 'confirmed') => void = () => undefined;
    const confirmIncident = vi.fn(() => new Promise<'confirmed'>((resolve) => { release = resolve; }));
    const actions = createIncidentActions({ confirmIncident, withdrawIncident: vi.fn() });
    const first = actions.confirm(uuidFor(1));
    expect(await actions.confirm(uuidFor(1))).toEqual({ kind: 'busy' });
    release('confirmed');
    expect(await first).toEqual({ kind: 'confirmed' });
    expect(confirmIncident).toHaveBeenCalledTimes(1);
    expect(actions.running).toBe(false);
  });
  it('separates a refusal from a lost reply and never retries', async () => {
    const withdrawIncident = vi.fn()
      .mockRejectedValueOnce(new DataError('validation', undefined, 400, 'incident_window_closed'))
      .mockRejectedValueOnce(new DataError('unknown-commit'));
    const actions = createIncidentActions({ confirmIncident: vi.fn(), withdrawIncident });
    expect(await actions.withdraw(uuidFor(1))).toMatchObject({ kind: 'failed', message: expect.stringMatching(/24-hour/) });
    expect(await actions.withdraw(uuidFor(1))).toMatchObject({ kind: 'unknown' });
    expect(withdrawIncident).toHaveBeenCalledTimes(2);
  });
  it('reports a server-side repeat as already confirmed', async () => {
    const actions = createIncidentActions({ confirmIncident: async () => 'already', withdrawIncident: vi.fn() });
    expect(await actions.confirm(uuidFor(1))).toEqual({ kind: 'already' });
  });
});

describe('filing a concern: uploads, reconciliation and cleanup (A33-031…036, P12-T03/T04)', () => {
  const photo = (seed: number) => ({ bytes: Uint8Array.from([0xff, 0xd8, 0xff, seed, 0xff, 0xd9]), mimeType: 'image/jpeg' as const, extension: 'jpg' });
  function setup(options: { failUploadAt?: number; create?: (concern: unknown) => Promise<void>; removeFails?: boolean } = {}) {
    const memory = new Map<string, string>();
    const store: KeyValueStore = { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); }, removeItem: async (key) => { memory.delete(key); } };
    const drafts = createProtectedDrafts(createSecureStorage(store, 'drafts'));
    const staged = createStagedUploads(drafts);
    const scope = { environment: 'staging' as const, barangayId: TENANT, userId: USER };
    const objects = new Map<string, Uint8Array>();
    let uploads = 0;
    const bucket: BucketApi = {
      upload: async (path, body) => {
        uploads++;
        if (options.failUploadAt === uploads) return { error: { message: 'Network request failed', name: 'StorageUnknownError' } };
        objects.set(path, body);
        return { error: null };
      },
      download: async (path) => { const stored = objects.get(path); return stored ? { data: { arrayBuffer: async () => stored.buffer.slice(0) as ArrayBuffer }, error: null } : { data: null, error: { message: 'missing' } }; },
      remove: async (paths) => { if (options.removeFails) return { error: { message: 'denied' } }; paths.forEach((path) => objects.delete(path)); return { error: null }; },
      createSignedUrl: async () => ({ data: null, error: { message: 'unused' } }),
    };
    const persisted: (ConcernAttempt | null)[] = [];
    const create = vi.fn(options.create ?? (async () => undefined));
    const deps: SubmitDeps = {
      bucket, staged, scope, newId: () => uuidFor(7), publicUrl: (path) => `https://example.supabase.co/storage/v1/object/public/incident-photos/${path}`,
      create, persistAttempt: async (attempt) => { persisted.push(attempt); return true; },
    };
    return { deps, objects, persisted, create, staged, scope };
  }
  const input = (photos = [photo(1), photo(2)], attempt: ConcernAttempt | null = null) => ({ fields: valid(), position: INSIDE, photos, attempt });

  it('uploads each photo to an immutable owned path before creating the concern with that path’s URL', async () => {
    const { deps, objects, create, persisted, staged, scope } = setup();
    const progress = vi.fn();
    const outcome = await submitConcern(deps, { ...input(), onProgress: progress });
    expect(outcome).toEqual({ kind: 'committed', id: uuidFor(7) });
    expect([...objects.keys()]).toEqual([`${USER}/${uuidFor(7)}/photo-1.jpg`, `${USER}/${uuidFor(7)}/photo-2.jpg`]);
    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    const sent = create.mock.calls[0][0] as { id: string; photoUrls: string[] };
    expect(sent.id).toBe(uuidFor(7));
    expect(sent.photoUrls[1]).toContain(`${USER}/${uuidFor(7)}/photo-2.jpg`);
    expect(persisted[0]).toEqual({ id: uuidFor(7), paths: [...objects.keys()] });
    expect(persisted.at(-1)).toBeNull();
    expect(await staged.pending(scope)).toEqual([]);
  });
  it('removes the photos uploaded so far when a later upload fails and files nothing', async () => {
    const { deps, objects, create } = setup({ failUploadAt: 2 });
    const outcome = await submitConcern(deps, input());
    expect(outcome).toMatchObject({ kind: 'upload-failed', message: expect.stringContaining('Photo 2 of 2') });
    expect(create).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);
  });
  it('removes fresh photos and clears the attempt when the server definitely refuses the report', async () => {
    const { deps, objects, persisted } = setup({ create: async () => { throw new DataError('validation', undefined, 400, 'incident_category_invalid'); } });
    const outcome = await submitConcern(deps, input());
    expect(outcome).toMatchObject({ kind: 'rejected', message: expect.stringMatching(/category is no longer available/) });
    expect(objects.size).toBe(0);
    expect(persisted.at(-1)).toBeNull();
  });
  it('keeps the photos and reports an unknown outcome when the reply is lost', async () => {
    const { deps, objects } = setup({ create: async () => { throw new DataError('unknown-commit'); } });
    const outcome = await submitConcern(deps, input());
    expect(outcome.kind).toBe('unknown');
    if (outcome.kind === 'unknown') expect(outcome.attempt).toEqual({ id: uuidFor(7), paths: [...objects.keys()] });
    expect(objects.size).toBe(2);
  });
  it('resends the same attempt without uploading again and with the same id', async () => {
    const { deps, create, objects } = setup();
    const attempt: ConcernAttempt = { id: uuidFor(7), paths: [`${USER}/${uuidFor(7)}/photo-1.jpg`] };
    objects.set(attempt.paths[0], photo(1).bytes);
    const outcome = await submitConcern(deps, input([], attempt));
    expect(outcome).toEqual({ kind: 'committed', id: uuidFor(7) });
    expect((create.mock.calls[0][0] as { id: string }).id).toBe(uuidFor(7));
    expect(objects.size).toBe(1);
  });
  it('keeps a staged reference for later cleanup when a photo cannot be removed', async () => {
    const { deps, staged, scope } = setup({ failUploadAt: 2, removeFails: true });
    await submitConcern(deps, input());
    expect((await staged.pending(scope)).length).toBe(2);
  });
  it('confirms an unknown attempt only from the server’s own row', async () => {
    const { deps, persisted } = setup();
    const attempt: ConcernAttempt = { id: uuidFor(7), paths: [] };
    expect(await confirmAttempt(deps, attempt, async () => false)).toBe('not-found');
    expect(await confirmAttempt(deps, attempt, async () => { throw new Error('offline'); })).toBe('unreachable');
    expect(persisted).toEqual([]);
    expect(await confirmAttempt(deps, attempt, async () => true)).toBe('committed');
    expect(persisted).toEqual([null]);
  });
  it('discards an unconfirmed attempt’s photos only after the server confirms nothing was filed', async () => {
    const attempt: ConcernAttempt = { id: uuidFor(7), paths: [`${USER}/${uuidFor(7)}/photo-1.jpg`] };
    const filed = setup();
    filed.objects.set(attempt.paths[0], photo(1).bytes);
    expect(await abandonAttempt(filed.deps, attempt, async () => true)).toBe('committed');
    expect(filed.objects.size).toBe(1);
    const offline = setup();
    offline.objects.set(attempt.paths[0], photo(1).bytes);
    expect(await abandonAttempt(offline.deps, attempt, async () => { throw new Error('offline'); })).toBe('unreachable');
    expect(offline.objects.size).toBe(1);
    const absent = setup();
    absent.objects.set(attempt.paths[0], photo(1).bytes);
    expect(await abandonAttempt(absent.deps, attempt, async () => false)).toBe('not-found');
    expect(absent.objects.size).toBe(0);
  });
});

describe('protected concern draft and return paths (P12-T04)', () => {
  const memory = () => {
    const map = new Map<string, string>();
    const store: KeyValueStore = { getItem: async (key) => map.get(key) ?? null, setItem: async (key, value) => { map.set(key, value); }, removeItem: async (key) => { map.delete(key); } };
    return createProtectedDrafts(createSecureStorage(store, 'drafts'));
  };
  const scope = { environment: 'staging' as const, barangayId: TENANT, userId: USER };
  it('round-trips the typed answers, the pin and an unconfirmed attempt, and clears them', async () => {
    const drafts = memory();
    const draft = { fields: { ...valid(), description: 'Deep water' }, position: INSIDE, attempt: { id: uuidFor(7), paths: [`${USER}/${uuidFor(7)}/photo-1.jpg`] } };
    await saveConcernDraft(drafts, scope, draft);
    expect(await loadConcernDraft(drafts, scope)).toEqual(draft);
    expect(await loadConcernDraft(drafts, { ...scope, userId: OTHER })).toBeNull();
    await clearConcernDraft(drafts, scope);
    expect(await loadConcernDraft(drafts, scope)).toBeNull();
  });
  it('discards a draft whose shape is no longer valid', async () => {
    const drafts = memory();
    await drafts.save(scope, 'concern-report', 1, { fields: { title: 3 }, position: { lat: 999, lng: 0 }, attempt: null });
    expect(await loadConcernDraft(drafts, scope)).toBeNull();
  });
  it('allows sign-in to return to the report form and to one report by its id only', () => {
    expect(pendingDestination('/reports/new')?.path).toBe('/reports/new');
    expect(pendingDestination(`/reports/incidents/${uuidFor(1)}`)?.path).toBe(`/reports/incidents/${uuidFor(1)}`);
    expect(pendingDestination('/reports/incidents/not-an-id')).toBeNull();
    expect(pendingDestination('/reports/new/../../settings')).toBeNull();
  });
});
