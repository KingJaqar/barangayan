import type { LatLng } from '@barangayan/shared';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { z } from 'zod';
import { Action, Body, Card, EmptyState, Loading, Notice, SearchField, Segmented, Sheet, Toggle } from '../../components/ui';
import { CENTER_POLICY, freshness } from '../../data/public-cache';
import { centerRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { useDebouncedValue } from '../../data/use-paged-resource';
import { usePublicResource } from '../../data/use-public-resource';
import { useResource } from '../../data/use-resource';
import { useDeviceLocation } from '../../lib/device-location';
import { releaseGates } from '../../lib/release-gates';
import { space } from '../../lib/theme';
import { ContentStatus } from '../emergency/content-status';
import { dialTarget } from '../emergency/content';
import { CallAction } from '../emergency/hotlines-section';
import { DiscoveryMap, type MapFocus } from '../maps/discovery-map';
import { LocationCard } from '../maps/location-card';
import { CENTER_COLOR, CENTER_KIND } from '../maps/map-model';
import { readBoundary } from '../profile/location-map';
import { usePinPlacement, PinPicker } from '../profile/pin-picker';
import { CenterCard, CenterPicker, FacilityTags, OccupancyMeter } from './center-card';
import {
  AVAILABILITY_LABEL, centerRecordsFrom, distanceDisplay, externalDirectionsUrl, orderCenters, relativeAge, searchCenters, shortDistance, updatedLabel,
  type CenterRecord, type RouteSummary,
} from './center-model';
import { activeOrigin, manualIsCurrent, originSummary, placeManualOrigin, type ManualOrigin } from './origin';
import { RouteCard } from './route-card';
import { describeRoute } from './route-copy';
import type { RouteInput, SegmentChoice } from './route-controller';
import { originKey } from './route-controller';
import { useCenterRoute } from './use-center-route';

const centers = z.array(centerRow);
type CentersView = 'list' | 'map';
const VIEW_OPTIONS: readonly { value: CentersView; label: string }[] = [{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }];
const MINUTE = 60_000;

/**
 * Evacuation centers (A23, A24): a searchable list and map of every active center with its facilities, occupancy and
 * distance, a nearest-first order, the resident's location or a spot they place, and the walking route to the
 * selected center. The list carries every center, so nothing depends on the map's markers. The selected center lives
 * in the `center` route parameter, so it survives a return from another screen. Distances are straight-line estimates
 * until the route service answers, and they say so.
 */
export function CentersSection() {
  const api = useApi();
  const router = useRouter();
  const params = useLocalSearchParams();
  const focused = useIsFocused();
  const location = useDeviceLocation(focused);
  const resource = usePublicResource('evacuation-centers', api.centers, centers, CENTER_POLICY);
  const boundaryResource = useResource('map-boundary', (signal) => api.barangayProfile(signal));
  const boundary = readBoundary(boundaryResource.data?.boundary);

  // Occupancy and availability are operational facts: read them again whenever the resident comes back to this screen.
  const { refresh } = resource;
  const visited = useRef(false);
  useFocusEffect(useCallback(() => {
    if (visited.current) void refresh();
    visited.current = true;
  }, [refresh]));

  const [view, setView] = useState<CentersView>('list');
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search, 250);
  const [nearestFirst, setNearestFirst] = useState(false);
  const [manual, setManual] = useState<ManualOrigin | null>(null);
  const [segmentChoice, setSegmentChoice] = useState<SegmentChoice | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [frame, setFrame] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);

  const selectedId = typeof params.center === 'string' ? params.center : null;
  const records = useMemo(() => centerRecordsFrom(resource.data ?? []), [resource.data]);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const selectedKey = selected ? selectedId : null;
  const selectionLost = selectedId !== null && selected === null && resource.data !== undefined;

  const deviceOrigin = location.state.origin;
  const origin = useMemo(() => activeOrigin(deviceOrigin, manual), [deviceOrigin, manual]);
  const originPoint = useMemo<LatLng | null>(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin]);
  const routeInput = useMemo<RouteInput | null>(() => (origin ? { origin, centerId: selectedKey, segment: segmentChoice } : null), [origin, selectedKey, segmentChoice]);
  const route = useCenterRoute(routeInput, focused);
  const ranking = route.state.ranking;
  const summaries = useMemo<ReadonlyMap<string, RouteSummary> | null>(() => (ranking ? new Map(ranking.map((summary) => [summary.centerId, summary])) : null), [ranking]);

  const matches = useMemo(() => searchCenters(records, term), [records, term]);
  const ordered = useMemo(() => orderCenters(matches, { nearestFirst, origin: originPoint, summaries }), [matches, nearestFirst, originPoint, summaries]);

  const result = route.state.result;
  const routePoints = useMemo<LatLng[] | null>(
    () => (result && result.status === 'ok' && selectedKey !== null && result.best.centerId === selectedKey ? result.best.geometry.map(([lng, lat]) => ({ lat, lng })) : null),
    [result, selectedKey],
  );
  const mapMarkers = useMemo(() => ordered.flatMap((record) => (record.position ? [{ id: record.id, position: record.position, kind: CENTER_KIND, label: record.name }] : [])), [ordered]);
  const kindColors = useMemo(() => ({ [CENTER_KIND]: CENTER_COLOR }), []);

  const pendingFix = location.state.pending?.fix;
  const user = useMemo(() => {
    if (origin) return { position: { lat: origin.lat, lng: origin.lng }, accuracyMeters: origin.accuracyMeters, pending: false };
    return pendingFix ? { position: { lat: pendingFix.lat, lng: pendingFix.lng }, accuracyMeters: pendingFix.accuracyMeters, pending: true } : null;
  }, [origin, pendingFix]);

  const placement = usePinPlacement(boundary, setDraft);
  const description = describeRoute(route.state, { now, hasStartingPoint: origin !== null, selectedId: selectedKey });
  const message = location.message;
  const messageKey = location.state.status;
  const cardVisible = message !== null && dismissedFor !== messageKey;
  const summaryFor = (record: CenterRecord) => distanceDisplay(record, originPoint, summaries);
  const fetchedAt = resource.fetchedAt ?? null;
  const listAge = fetchedAt === null ? null : relativeAge(new Date(fetchedAt).toISOString(), now);
  const listFreshness = fetchedAt === null ? null : freshness(fetchedAt, now, CENTER_POLICY);

  function select(record: CenterRecord | null) {
    router.setParams({ center: record?.id });
    if (record?.position) setFocus({ point: record.position, nonce: (focus?.nonce ?? 0) + 1 });
  }
  function showAll() {
    router.setParams({ center: undefined });
    setSearch('');
    setFrame((value) => value + 1);
  }
  function locate() {
    location.locate();
    if (originPoint) setFocus({ point: originPoint, nonce: (focus?.nonce ?? 0) + 1 });
  }
  function openSheet() {
    setDraft(originPoint);
    placement.clear();
    setSheetOpen(true);
  }
  function commitManual() {
    if (!draft) return;
    setManual(placeManualOrigin(draft, manual, deviceOrigin));
    setFocus({ point: draft, nonce: (focus?.nonce ?? 0) + 1 });
    setSheetOpen(false);
  }

  return <>
    <Body heading>Evacuation centers</Body>
    <ContentStatus resource={resource} retry={() => void resource.refresh()} />
    {listAge !== null && <Body role="footnote" tone={listFreshness === 'fresh' ? 'secondary' : 'danger'}>
      {listFreshness === 'fresh' ? `Center list checked ${listAge}.` : `Center list last checked ${listAge}. Occupancy and availability may have changed.`}
    </Body>}

    <Segmented<CentersView> label="Centers view" options={VIEW_OPTIONS} selected={view} onChange={setView} />
    <SearchField label="Search evacuation centers" hint="Search centers by name" value={search} onChangeText={setSearch} />
    <Toggle label="Nearest first" value={nearestFirst} onChange={setNearestFirst} />
    {nearestFirst && !origin && <Body role="footnote" tone="secondary">Set a starting point to sort by distance. Until then the centers stay in name order.</Body>}

    <Card>
      <Body role="subheadline" tone="secondary">{originSummary(origin)}</Body>
      <Action label="Use my location" hint="Finds your location and measures distances from it" disabled={location.state.activeRequestId !== null} onPress={locate} />
      <Action label="Place a starting point on the map" secondary onPress={openSheet} />
      {manualIsCurrent(manual, deviceOrigin) && <Action label="Stop using the placed point" secondary onPress={() => setManual(null)} />}
    </Card>
    {cardVisible && message && <LocationCard message={message} handlers={{ locate: location.locate, cancel: location.cancel, confirm: location.confirm, reject: location.reject, openSettings: location.openSettings }}
      onDismiss={() => setDismissedFor(messageKey)} />}

    {view === 'map' && <>
      <DiscoveryMap boundary={boundary} markers={mapMarkers} kindColors={kindColors} user={user} tiles={releaseGates.mapProviders} focus={focus} frame={frame} route={routePoints}
        onMarker={(id) => { const record = records.find((item) => item.id === id); if (record) select(record); }} />
      {!releaseGates.mapProviders && <Body role="footnote" tone="secondary">Street map tiles are not available in this version. The barangay boundary, centers and any route are shown on a plain background; the List view has every center.</Body>}
      {ordered.length > 0 && <CenterPicker items={ordered.map((record) => ({ id: record.id, name: record.name, hint: shortDistance(summaryFor(record)) }))} selectedId={selectedKey} onSelect={(id) => select(records.find((record) => record.id === id) ?? null)} />}
      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, minWidth: '45%' }}><Action label="Show all centers" secondary hint="Clears the selection and fits the map to the barangay" onPress={showAll} /></View>
      </View>
    </>}

    {selectionLost && <Notice tone="danger" message="The center you selected is no longer listed. It may have been closed or removed. Choose another center." />}
    {selected && <CenterDetail record={selected} now={now} display={summaryFor(selected)} onClose={() => select(null)} />}
    {selected && <RouteCard description={description} onRetry={route.retry}
      onChooseSegment={(candidate, graphVersion) => { if (origin) setSegmentChoice({ originKey: originKey(origin), graphVersion, edgeId: candidate.edgeId }); }} />}
    {!selected && origin && description.lines.length > 0 && <RouteCard description={description} onRetry={route.retry} onChooseSegment={() => undefined} />}

    {resource.loading && !resource.data && <Loading />}
    {resource.data && records.length === 0 && <EmptyState title="No evacuation centers" message="Your barangay has not published any active evacuation centers." />}
    {records.length > 0 && ordered.length === 0 && <EmptyState title="No matching centers" message="No center name matches your search. Clear the search to see every center."><Action label="Clear search" secondary onPress={() => setSearch('')} /></EmptyState>}
    {ordered.some((record) => record.position === null) && <Body role="footnote" tone="secondary">Some centers have no map location, so they are listed here but not shown on the map and have no distance.</Body>}
    {view === 'list' && ordered.map((record) => <CenterCard key={record.id} record={record} display={summaryFor(record)} selected={record.id === selectedKey} now={now} onSelect={() => select(record)} />)}

    <Sheet visible={sheetOpen} title="Place a starting point" onClose={() => setSheetOpen(false)}>
      <Body tone="secondary">Place the pin where you are, or where you plan to leave from. It is used only for distances and routes on this screen and is not saved.</Body>
      <PinPicker boundary={boundary} position={draft} placement={placement} tiles={releaseGates.mapProviders} areaName={boundaryResource.data?.name ?? 'your barangay'} />
      <Action label="Use this starting point" disabled={!draft} onPress={commitManual} />
      <Action label="Cancel" secondary onPress={() => setSheetOpen(false)} />
    </Sheet>
  </>;
}

/** The selected center in full: contact, directions in Apple Maps, and a way back to the whole list. */
function CenterDetail({ record, now, display, onClose }: { record: CenterRecord; now: number; display: ReturnType<typeof distanceDisplay>; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const url = externalDirectionsUrl(record);
  async function openDirections() {
    if (!url) return;
    setFailed(false);
    try { await Linking.openURL(url); } catch { setFailed(true); }
  }
  return <Card>
    <Body heading role="headline">{record.name}</Body>
    {record.verified && <Body role="footnote" tone="secondary">Verified by your barangay</Body>}
    {!!record.address && <Body>{record.address}</Body>}
    <Body tone={display.kind === 'unreachable' ? 'danger' : 'secondary'}>{display.text}</Body>
    <OccupancyMeter occupancy={record.occupancy} />
    <Body role="subheadline">{AVAILABILITY_LABEL[record.availability]}</Body>
    <FacilityTags record={record} />
    <Body role="footnote" tone="secondary">{updatedLabel(record.updatedAt, now)}</Body>
    {record.contactNumber
      ? <CallAction title={record.name} entry={{ label: 'Contact number', number: record.contactNumber, dial: dialTarget(record.contactNumber) }} />
      : <Body tone="secondary">Contact number unavailable</Body>}
    {url ? <Action label="Directions in Apple Maps" secondary hint="Opens Apple Maps with walking directions to this center" onPress={() => void openDirections()} />
      : <Body role="footnote" tone="secondary">This center has no map location, so directions are not available.</Body>}
    {failed && <Notice tone="danger" message="This device could not open Apple Maps." />}
    <Action label="Close details" secondary onPress={onClose} />
  </Card>;
}
