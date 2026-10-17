import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it } from 'vitest';
import { residentApi, type MapIncident } from '../src/data/resident-api';
import { centerRow, incidentMapRow } from '../src/data/schemas';
import type { z } from 'zod';
import { LAYER_OPTIONS, bridgeMarkers, centerRecords, distanceLabel, filterRecords, incidentRecords, toggleCategory, withDistance } from '../src/features/maps/map-model';
import { settlesCollapsed } from '../src/features/maps/panel-gesture';
import { deliver, mapHtml, parseMapMessage, readPoint } from '../src/features/profile/location-map';
import { releaseGates } from '../src/lib/release-gates';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const signal = () => new AbortController().signal;
const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const incident = (index: number, patch: Partial<MapIncident> = {}): MapIncident => ({
  id: uuidFor(index), title: `Concern ${index}`, status: 'open', created_at: '2026-10-01T08:00:00.000Z', location: { lat: 14.6 + index / 1000, lng: 121.1 },
  category_id: uuidFor(900 + (index % 2)), incident_categories: { name: index % 2 ? 'Flooding' : 'Road damage', color: index % 2 ? '#2563EB' : '#B45309' }, ...patch,
});
type Center = z.infer<typeof centerRow>;
const center = (index: number, patch: Partial<Center> = {}): Center => ({
  id: uuidFor(500 + index), name: `Center ${index}`, address: `${index} Main Street`, contact_number: '911', current_occupancy: 10, capacity: 100, position: { lat: 14.6 + index / 1000, lng: 121.1 },
  facilities: [], verified: false, availability: 'unknown', updated_at: '2026-10-16T08:00:00.000Z', ...patch,
});

describe('Maps records, layers and filters (A19-008…016, T19)', () => {
  it('offers the incident and evacuation layers', () => {
    expect(LAYER_OPTIONS.map((option) => option.value)).toEqual(['incidents', 'centers']);
  });
  it('turns own concerns into markers coloured by category and reports the ones without a usable pin', () => {
    const { records, unplaced } = incidentRecords([incident(1), incident(2, { location: null }), incident(3, { location: { lat: 'x', lng: 1 } }), incident(4, { location: { lat: 91, lng: 0 } }), incident(5, { incident_categories: null, category_id: null })]);
    expect(records.map((record) => record.id)).toEqual([uuidFor(1), uuidFor(5)]);
    expect(unplaced).toBe(3);
    expect(records[0]).toMatchObject({ layer: 'incidents', color: '#2563EB', kind: uuidFor(901) });
    expect(records[0].detail).toContain('Flooding');
    expect(records[0].detail).toContain('Submitted');
    expect(records[1]).toMatchObject({ categoryId: null, kind: 'incident', color: '#0D6B59' });
    expect(records[1].detail).toContain('Uncategorized');
  });
  it('ignores an unsafe category colour', () => {
    const { records } = incidentRecords([incident(1, { incident_categories: { name: 'Odd', color: 'url(javascript:1)' } })]);
    expect(records[0].color).toBe('#0D6B59');
  });
  it('turns centers into markers with occupancy that never reads unknown capacity as zero', () => {
    const { records, unplaced } = centerRecords([center(1), center(2, { capacity: null }), center(3, { position: {} })]);
    expect(records).toHaveLength(2);
    expect(unplaced).toBe(1);
    expect(records[0].detail).toBe('1 Main Street · 10 of 100 reported occupants');
    expect(records[1].detail).toContain('10 of unknown reported occupants');
    expect(records[0]).toMatchObject({ layer: 'centers', kind: 'evacuation' });
  });
  it('combines the search with category chips; no chip means every category and a selected chip filters concerns only', () => {
    const { records } = incidentRecords([incident(1), incident(2), incident(3), incident(4)]);
    expect(filterRecords(records, { search: '', categoryIds: [] })).toHaveLength(4);
    expect(filterRecords(records, { search: '', categoryIds: [uuidFor(901)] }).map((record) => record.title)).toEqual(['Concern 1', 'Concern 3']);
    expect(filterRecords(records, { search: '', categoryIds: [uuidFor(900), uuidFor(901)] })).toHaveLength(4);
    expect(filterRecords(records, { search: 'concern 2', categoryIds: [] }).map((record) => record.title)).toEqual(['Concern 2']);
    expect(filterRecords(records, { search: ' FLOOD ', categoryIds: [uuidFor(901)] })).toHaveLength(2);
    expect(filterRecords(records, { search: 'flood', categoryIds: [uuidFor(900)] })).toEqual([]);
    expect(filterRecords(records, { search: 'nothing like this', categoryIds: [] })).toEqual([]);
    const centers = centerRecords([center(1), center(2)]).records;
    expect(filterRecords(centers, { search: '', categoryIds: [uuidFor(901)] })).toHaveLength(2);
    expect(filterRecords(centers, { search: 'center 2', categoryIds: [] }).map((record) => record.title)).toEqual(['Center 2']);
    expect(filterRecords(centers, { search: '1 main', categoryIds: [] }).map((record) => record.title)).toEqual(['Center 1']);
  });
  it('selects a category chip on the first tap and clears it on the second', () => {
    expect(toggleCategory([], 'a')).toEqual(['a']);
    expect(toggleCategory(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleCategory(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('orders centers nearest first from a confirmed origin and keeps the order without one', () => {
    const records = centerRecords([center(9), center(1), center(5)]).records;
    expect(withDistance(records, null).map((record) => record.title)).toEqual(['Center 9', 'Center 1', 'Center 5']);
    const sorted = withDistance(records, { lat: 14.6, lng: 121.1 });
    expect(sorted.map((record) => record.title)).toEqual(['Center 1', 'Center 5', 'Center 9']);
    expect(sorted[0].distanceMeters).toBeGreaterThan(0);
    expect(distanceLabel(4)).toBe('About 10 m away in a straight line');
    expect(distanceLabel(842)).toBe('About 840 m away in a straight line');
    expect(distanceLabel(1500)).toBe('About 1.5 km away in a straight line');
  });
  it('sends only ids, pins and colours to the map page, never resident text', () => {
    const { records } = incidentRecords([incident(1, { title: '<script>alert(1)</script>' })]);
    const { markers, kindColors } = bridgeMarkers(records);
    expect(markers).toEqual([{ id: uuidFor(1), position: records[0].position, kind: uuidFor(901) }]);
    expect(kindColors).toEqual({ [uuidFor(901)]: '#2563EB' });
    expect(JSON.stringify({ markers, kindColors })).not.toContain('script');
  });
  it('keeps the tile and other-residents gates closed, so the map has no network and shows own reports only', () => {
    expect(releaseGates.mapProviders).toBe(false);
    expect(releaseGates.publicIncidents).toBe(false);
  });
});

describe('map bridge (A19-016, A19-017, T06 bridge restrictions)', () => {
  it('accepts a marker tap with a short id and refuses anything malformed', () => {
    expect(parseMapMessage(JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: uuidFor(1) } }))).toEqual({ type: 'marker', id: uuidFor(1) });
    for (const bad of [
      JSON.stringify({ type: 'MARKER_TAPPED' }), JSON.stringify({ type: 'MARKER_TAPPED', payload: {} }), JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: '' } }),
      JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: 7 } }), JSON.stringify({ type: 'MARKER_TAPPED', payload: { markerId: 'x'.repeat(65) } }),
    ]) expect(parseMapMessage(bad), bad).toBeNull();
  });
  it('reads a stored point from untrusted JSON', () => {
    expect(readPoint({ lat: 14.6, lng: 121.1 })).toEqual({ lat: 14.6, lng: 121.1 });
    for (const bad of [null, undefined, 'x', 3, [], {}, { lat: 14.6 }, { lat: '14.6', lng: '121.1' }, { lat: NaN, lng: 1 }, { lat: 14, lng: 181 }]) expect(readPoint(bad)).toBeNull();
  });
  it('parses the page script, keeps the no-network policy and draws markers, the resident and the fit from bridge messages', () => {
    for (const tiles of [false, true]) {
      const html = mapHtml({ tiles });
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
      expect(() => new Function(scripts[1])).not.toThrow();
      for (const type of ['SET_MARKERS', 'SET_USER_LOCATION', 'FIT_ALL', 'SET_CENTER', 'MARKER_TAPPED']) expect(html).toContain(type);
    }
    expect(mapHtml({ tiles: false })).toContain('img-src data:;');
    // The bundled Leaflet library is not ours to scan; the page code that handles bridge messages must not build HTML from them.
    const ours = [...mapHtml({ tiles: false }).matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
    expect(ours).not.toMatch(/innerHTML|bindPopup|bindTooltip|document\.write|eval\(/);
  });
  it('delivers a marker batch as a single escaped script', () => {
    const script = deliver({ type: 'SET_MARKERS', payload: { markers: [{ id: 'a', position: { lat: 1, lng: 2 }, kind: 'k' }], kindColors: { k: '#112233' } } });
    expect(script.startsWith('window.receive("')).toBe(true);
    expect(script.endsWith('");true;')).toBe(true);
  });
});

describe('DRRM panel gestures (A19-027…030)', () => {
  it('collapses on a long or fast downward drag and re-expands on a long upward one', () => {
    expect(settlesCollapsed(false, 80, 0)).toBe(true);
    expect(settlesCollapsed(false, 20, 0.9)).toBe(true);
    expect(settlesCollapsed(false, 20, 0.1)).toBe(false);
    expect(settlesCollapsed(true, -80, 0)).toBe(false);
    expect(settlesCollapsed(true, -20, 0)).toBe(true);
    expect(settlesCollapsed(true, 10, 0)).toBe(true);
  });
});

describe('Maps data reads (B11, B13)', () => {
  function harness(replies: { status?: number; body?: unknown }[], userId: string | null = USER) {
    const requests: { url: URL }[] = [];
    const fetch = async (input: RequestInfo | URL) => {
      requests.push({ url: new URL(String(input)) });
      const reply = replies.shift() ?? { body: [] };
      return new Response(JSON.stringify(reply.body ?? []), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
    };
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
    return { api: residentApi(client, TENANT, userId ?? undefined), requests };
  }
  it('reads only the signed-in resident\'s own concerns in this tenant, newest first, with their pins', async () => {
    const { api, requests } = harness([{ body: [incident(1)] }]);
    expect(await api.mapIncidents(signal())).toHaveLength(1);
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe('/rest/v1/incidents');
    expect(params.get('select')).toBe('id,title,status,created_at,location,category_id,incident_categories(name,color)');
    expect(params.get('reporter_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('deleted_at')).toBe('is.null');
    expect(params.get('order')).toBe('created_at.desc,id.asc');
  });
  it('reads further pages and refuses an unbounded result instead of cutting it', async () => {
    const page = Array.from({ length: 100 }, (_, index) => incident(index + 1));
    const { api, requests } = harness([{ body: page }, { body: page.slice(0, 40).map((item, index) => ({ ...item, id: uuidFor(300 + index) })) }]);
    expect(await api.mapIncidents(signal())).toHaveLength(140);
    expect(requests.map((request) => request.url.searchParams.get('offset'))).toEqual(['0', '100']);
    const huge = Array.from({ length: 100 }, (_, index) => incident(index + 1));
    const { api: bounded } = harness(Array.from({ length: 11 }, () => ({ body: huge })));
    await expect(bounded.mapIncidents(signal())).rejects.toMatchObject({ kind: 'schema' });
  });
  it('has no concerns to read for a guest, who must sign in first', async () => {
    const { api, requests } = harness([{ body: [] }], null);
    await expect(api.mapIncidents(signal())).rejects.toMatchObject({ kind: 'session' });
    expect(requests).toHaveLength(0);
  });
  it('rejects a concern row with a malformed shape rather than drawing a guess', () => {
    expect(incidentMapRow.safeParse(incident(1)).success).toBe(true);
    expect(incidentMapRow.safeParse({ ...incident(1), id: 'nope' }).success).toBe(false);
    expect(incidentMapRow.safeParse({ ...incident(1), incident_categories: { name: 'x' } }).success).toBe(false);
  });
  it('reads active centers of this tenant with their position, for guests too', async () => {
    const { api, requests } = harness([{ body: [center(1)] }], null);
    expect(await api.centers(signal())).toHaveLength(1);
    const params = requests[0].url.searchParams;
    expect(params.get('select')).toBe('id,name,address,contact_number,current_occupancy,capacity,position,facilities,verified,availability,updated_at');
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('is_active')).toBe('eq.true');
    expect(params.get('deleted_at')).toBe('is.null');
  });
});
