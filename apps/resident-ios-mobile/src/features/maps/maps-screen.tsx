import type { LatLng } from '@barangayan/shared';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { z } from 'zod';
import { Action, Body, Card, Destination, EmptyState, ErrorState, Loading, Screen, SearchField, Segmented, SymbolIcon } from '../../components/ui';
import { CENTER_POLICY } from '../../data/public-cache';
import { subscribeToChanges } from '../../data/realtime';
import { centerRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { useDebouncedValue } from '../../data/use-paged-resource';
import { usePublicResource } from '../../data/use-public-resource';
import { useResource } from '../../data/use-resource';
import { useDeviceLocation } from '../../lib/device-location';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { layout, radius, space, useColors } from '../../lib/theme';
import { ContentStatus } from '../emergency/content-status';
import { readBoundary } from '../profile/location-map';
import { DiscoveryMap, type MapFocus } from './discovery-map';
import { DrrmPanel } from './drrm-panel';
import { LocationCard } from './location-card';
import {
  bridgeMarkers, centerRecords, distanceLabel, filterRecords, incidentRecords, LAYER_OPTIONS, toggleCategory, withDistance,
  type MapLayer, type MapRecord,
} from './map-model';

const centers = z.array(centerRow);
const PAGE = 25;
/** Room kept under the list so the DRRM panel never covers the last row. */
const PANEL_HANDLE = 64;

/**
 * Maps discovery (A19): incident and evacuation-center layers over the barangay boundary, scoped
 * search, category chips, the resident's location and the DRRM shortcut panel. The list under
 * the map carries every place, so the map is never the only way to reach one. Tiles and other
 * residents' reports stay behind the `mapProviders` / `publicIncidents` gates.
 */
export function MapsScreen() {
  const api = useApi();
  const colors = useColors();
  const { session, client } = useResident();
  const focused = useIsFocused();
  const location = useDeviceLocation(focused);
  const userId = session?.user.id;

  const [layer, setLayer] = useState<MapLayer>('incidents');
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search, 250);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [frame, setFrame] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [limit, setLimit] = useState<{ key: string; count: number }>({ key: '', count: PAGE });

  const boundaryResource = useResource('map-boundary', (signal) => api.barangayProfile(signal));
  const categories = useResource('map-categories', (signal) => api.incidentCategories(signal));
  const incidents = useResource(`map-incidents:${userId ?? 'guest'}`, (signal) => userId ? api.mapIncidents(signal) : Promise.resolve([]));
  const centerResource = usePublicResource('evacuation-centers', api.centers, centers, CENTER_POLICY);

  // New or changed own reports appear without a manual refresh; the payload is only a refresh signal.
  const { refresh: refreshIncidents } = incidents;
  useEffect(() => {
    if (!userId) return;
    return subscribeToChanges(client, 'map-incidents', [{ table: 'incidents', filter: `reporter_id=eq.${userId}` }], () => void refreshIncidents());
  }, [client, userId, refreshIncidents]);

  const boundary = readBoundary(boundaryResource.data?.boundary);
  const incidentModel = useMemo(() => incidentRecords(incidents.data ?? []), [incidents.data]);
  const centerModel = useMemo(() => centerRecords(centerResource.data ?? []), [centerResource.data]);
  const model = layer === 'incidents' ? incidentModel : centerModel;
  const { origin } = location.state;
  const originPoint = useMemo<LatLng | null>(() => origin ? { lat: origin.lat, lng: origin.lng } : null, [origin]);
  const filterKey = `${layer}:${term}:${categoryIds.join(',')}`;
  const visible = useMemo(() => {
    const matches = filterRecords(model.records, { search: term, categoryIds });
    return layer === 'centers' ? withDistance(matches, originPoint) : matches;
  }, [model.records, term, categoryIds, layer, originPoint]);
  const bridge = useMemo(() => bridgeMarkers(visible), [visible]);
  const selected = visible.find((record) => record.id === selectedId) ?? null;
  const shown = visible.slice(0, limit.key === filterKey ? limit.count : PAGE);

  const pendingFix = location.state.pending?.fix;
  const user = useMemo(() => {
    if (origin) return { position: { lat: origin.lat, lng: origin.lng }, accuracyMeters: origin.accuracyMeters, pending: false };
    return pendingFix ? { position: { lat: pendingFix.lat, lng: pendingFix.lng }, accuracyMeters: pendingFix.accuracyMeters, pending: true } : null;
  }, [origin, pendingFix]);

  function select(record: MapRecord) {
    setSelectedId(record.id);
    setFocus({ point: record.position, nonce: (focus?.nonce ?? 0) + 1 });
  }
  function changeLayer(next: MapLayer) { setLayer(next); setSelectedId(null); setSearch(''); }
  function locate() {
    location.locate();
    if (originPoint) setFocus({ point: originPoint, nonce: (focus?.nonce ?? 0) + 1 });
  }

  const loading = layer === 'incidents' ? incidents.loading && !incidents.data : centerResource.loading && !centerResource.data;
  const incidentError = layer === 'incidents' && !incidents.data ? incidents.error : undefined;
  const message = location.message;
  const messageKey = location.state.status;
  const cardVisible = message !== null && dismissedFor !== messageKey;
  const signedOutIncidents = layer === 'incidents' && !userId;

  return <View style={{ flex: 1 }}>
    <Screen>
      <Segmented<MapLayer> label="Map layer" options={LAYER_OPTIONS} selected={layer} onChange={changeLayer} />
      <SearchField label={layer === 'incidents' ? 'Search your reports' : 'Search evacuation centers'} hint={layer === 'incidents' ? 'Search your reports' : 'Search centers'} value={search} onChangeText={setSearch} />
      {layer === 'incidents' && (categories.data?.length ?? 0) > 0 && <View accessibilityLabel="Report categories" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {categories.data?.map((category) => {
          const active = categoryIds.includes(category.id);
          return <Pressable key={category.id} accessibilityRole="checkbox" accessibilityLabel={`${category.name} filter`} accessibilityState={{ checked: active }}
            onPress={() => setCategoryIds((current) => toggleCategory(current, category.id))}
            style={{ minHeight: layout.controlMin, flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[3], borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceSelected : colors.surface }}>
            <SymbolIcon name={active ? 'checkmark.circle.fill' : 'circle'} color={colors.primary} size={14} />
            <Body role="subheadline">{category.name}</Body>
          </Pressable>;
        })}
      </View>}
      {layer === 'incidents' && categories.error && !categories.data && <Body role="footnote" tone="danger">{`Report categories could not be loaded, so category filters are unavailable. ${categories.error}`}</Body>}

      <DiscoveryMap boundary={boundary} markers={bridge.markers} kindColors={bridge.kindColors} user={user} tiles={releaseGates.mapProviders} focus={focus} frame={frame} onMarker={(id) => { const record = visible.find((item) => item.id === id); if (record) select(record); }} />
      {!releaseGates.mapProviders && <Body role="footnote" tone="secondary">Street map tiles are not available in this version. Your barangay boundary and the markers are shown on a plain background; the list below has every place.</Body>}
      {!boundary && !boundaryResource.loading && <Body role="footnote" tone="secondary">Your barangay boundary could not be loaded, so the map is centered on the places shown.</Body>}
      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, minWidth: '45%' }}><Action label="Barangay view" secondary hint="Fits the map to your barangay" onPress={() => setFrame((value) => value + 1)} /></View>
        <View style={{ flexGrow: 1, minWidth: '45%' }}><Action label="My location" secondary hint="Finds your location and centers the map on it" disabled={location.state.activeRequestId !== null} onPress={locate} /></View>
      </View>
      {cardVisible && message && <LocationCard message={message} handlers={{ locate: location.locate, cancel: location.cancel, confirm: location.confirm, reject: location.reject, openSettings: location.openSettings }}
        onDismiss={() => setDismissedFor(messageKey)} />}

      {selected && <Card>
        <Body heading role="headline">{selected.title}</Body>
        <Body tone="secondary">{selected.detail}</Body>
        {selected.distanceMeters !== undefined && <Body role="footnote" tone="secondary">{distanceLabel(selected.distanceMeters)}</Body>}
        {selected.layer === 'incidents'
          ? <Destination title="View report" href={{ pathname: '/reports/incidents/[incidentId]', params: { incidentId: selected.id } }} />
          : <Destination title="Center details and directions" href={{ pathname: '/emergency', params: { section: 'centers', center: selected.id } }} />}
        <Action label="Clear selection" secondary onPress={() => setSelectedId(null)} />
      </Card>}

      <Body heading role="headline">{layer === 'incidents' ? 'Your reports' : 'Evacuation centers'}</Body>
      {layer === 'incidents' && <Body role="footnote" tone="secondary">Only your own reports are shown. Reports from other residents are not shown on this map.</Body>}
      {layer === 'centers' && <ContentStatus resource={centerResource} retry={() => void centerResource.refresh()} />}
      {loading && <Loading />}
      {incidentError && <ErrorState message={incidentError} retry={() => void incidents.refresh()} />}
      {signedOutIncidents && <EmptyState title="Log in to see your reports" message="Your reports appear on the map once you log in. Evacuation centers are available without an account.">
        <Destination title="Log in or create an account" href="/auth/choice" />
      </EmptyState>}
      {!signedOutIncidents && !loading && !incidentError && model.records.length === 0 && <EmptyState title={layer === 'incidents' ? 'No reports on the map' : 'No evacuation centers found'}
        message={layer === 'incidents' ? 'Reports you file with a pinned location appear here.' : 'Your barangay has not published any evacuation centers with a map location.'} />}
      {!signedOutIncidents && model.records.length > 0 && visible.length === 0 && <EmptyState title="No matches" message="No place matches your search or category filters. Clear them to see everything." />}
      {model.unplaced > 0 && <Body role="footnote" tone="secondary">{`${model.unplaced} ${model.unplaced === 1 ? 'place has' : 'places have'} no map location and ${model.unplaced === 1 ? 'is' : 'are'} not listed.`}</Body>}
      {shown.map((record) => <PlaceRow key={record.id} record={record} selected={record.id === selectedId} onSelect={() => select(record)} />)}
      {visible.length > shown.length && <Action label={`Show more (${visible.length - shown.length} left)`} secondary onPress={() => setLimit({ key: filterKey, count: shown.length + PAGE })} />}
      <View style={{ height: panelHeight + PANEL_HANDLE }} />
    </Screen>
    <DrrmPanel onMeasured={setPanelHeight} />
  </View>;
}

function PlaceRow({ record, selected, onSelect }: { record: MapRecord; selected: boolean; onSelect: () => void }) {
  const colors = useColors();
  const distance = record.distanceMeters !== undefined ? ` · ${distanceLabel(record.distanceMeters)}` : '';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${record.title}. ${record.detail}${distance}`} accessibilityState={{ selected }} accessibilityHint="Selects this place and centers the map on it" onPress={onSelect}
    style={{ minHeight: layout.listRowMin, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : colors.surface }}>
    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: record.color }} />
    <View style={{ flex: 1, gap: space[1] }}><Body role="headline">{record.title}</Body><Body role="footnote" tone="secondary">{`${record.detail}${distance}`}</Body></View>
  </Pressable>;
}
