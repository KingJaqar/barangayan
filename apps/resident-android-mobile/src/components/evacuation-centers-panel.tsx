import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useFloatingTabLayout } from '@/hooks/use-floating-tab-layout';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { MapSelectionOverlay, type MapPlace } from '@/components/maps/map-selection-overlay';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useAmpid1Boundary } from '@/hooks/use-ampid1-boundary';
import { EvacuationCenterCard } from '@/components/evacuation-center-card';
import { CenterDetailCard } from '@/components/center-detail-card';
import { LocationStatusCard } from '@/components/location-status-card';
import { MapView, AMPID_I_SAN_MATEO_CENTER, type MapUserLocation, type MapViewHandle } from '@/components/map-view';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { SegmentedControl } from '@/components/segmented-control';
import { OfflineRouteCard } from '@/components/offline-route-card';
import { RoadMarkCard } from '@/components/road-mark-card';
import { useResidentRoute } from '@/hooks/use-resident-route';
import { useOfflineRouting } from '@/hooks/use-offline-routing';
import { nearestEdge } from '@/lib/offline-routing';
import type { LatLng, LocationAction, MapLngLat, MapMarker } from '@barangayan/shared';
import type { AttachmentCandidate, RoutingEdge } from '@barangayan/shared/src/lib/evacuation-routing';
import { useNetInfo } from '@react-native-community/netinfo';

export function CentersContent({
  theme,
  centers: fetchedCenters,
  isLoading,
  error,
  refetch,
  view,
  onViewChange,
  nearestFirst,
  onNearestToggle,
  userPosition,
  location,
  onFitAll,
  resident = false,
}: {
  theme: ReturnType<typeof useTheme>;
  centers: ReturnType<typeof useEvacuationCenters>['centers'];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  view: 'list' | 'map';
  onViewChange: (v: 'list' | 'map') => void;
  nearestFirst: boolean;
  onNearestToggle: (v: boolean) => void;
  userPosition: LatLng | null;
  location: ReturnType<typeof useDeviceLocation>;
  onFitAll?: () => void;
  resident?: boolean;
}) {
  const boundary = useAmpid1Boundary();
  const [searchQuery, setSearchQuery] = useState('');
  const reducedMotion = useResidentReducedMotion(true);
  const { fontId } = useFontPreference();
  const isFocused = useIsFocused();
  const fullTabInset = useFloatingTabInset(true);
  const { mapNavHidden, setMapNavHidden, mapNavProgress } = useFloatingTabLayout();
  const navVisibleBottom = resident ? Math.max(48, fullTabInset + 12) : 12;
  const navHiddenBottom = resident ? 48 : 12;
  const navBottom = resident && !mapNavHidden ? navVisibleBottom : navHiddenBottom;
  const overlayMotion = useAnimatedStyle(() => ({ bottom: resident ? navVisibleBottom + (navHiddenBottom - navVisibleBottom) * (mapNavProgress?.value ?? 0) : 12 }));
  const revealMotion = useAnimatedStyle(() => ({ bottom: 10 + (1 - (mapNavProgress?.value ?? 0)) * Math.max(0, fullTabInset - 14) }));
  useFocusEffect(useCallback(() => {
    if (!resident || view !== 'map') return;
    setMapNavHidden(true);
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') setMapNavHidden(false); });
    return () => { subscription.remove(); setMapNavHidden(false); };
  }, [resident, view, setMapNavHidden]));
  const locating = location.state.activeRequestId !== null;
  const origin = location.state.origin;
  const originRevision = origin?.revision;
  const pendingFix = location.state.pending?.fix ?? null;
  const [focusCenter, setFocusCenter] = useState<LatLng | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  useEffect(() => {
    if (focusCenter) mapRef.current?.flyTo({ ...focusCenter, zoom: 17 });
  }, [focusCenter]);


  // Walking routes are computed on this phone from the installed routing pack, verified
  // closures and the resident's own blocked roads (DRRM routing plan R6), so they work
  // offline. A route that cannot be computed is explained in words and never drawn as a
  // straight line (invariant 7).
  const routing = useOfflineRouting(isFocused);
  const { pack, conditions, avoidance, unresolvedAvoidanceIds } = routing.state;
  const conditionsSnapshot = conditions?.snapshot ?? null;
  const netInfo = useNetInfo();
  // Online tiles only when the internet is known to be reachable; offline, the pack's vector
  // roads are the basemap and no tile requests are made.
  const showTiles = netInfo.isInternetReachable === true;

  // A street chosen from the attachment chooser belongs to one origin revision and graph.
  const [segmentChoice, setSegmentChoice] = useState<{ revision: number; graphVersion: string; edgeId: string } | null>(null);
  const originEdgeId =
    segmentChoice !== null && segmentChoice.revision === originRevision && segmentChoice.graphVersion === pack?.graph.version
      ? segmentChoice.edgeId
      : null;
  const { route, mode, connectedFailure, connectedPending, ranking } = useResidentRoute({
    pack,
    conditions,
    avoidance,
    origin,
    centerId: selectedCenterId,
    originEdgeId,
    internetUnreachable: netInfo.isInternetReachable === false,
  });
  // Only the route to the selected center is drawn; the automatic run exists to rank the list, and
  // a result still on screen for a previous selection is never shown for the new one.
  const bestRoute =
    selectedCenterId !== null && route.status === 'done' && route.result.status === 'ok' && route.result.best.centerId === selectedCenterId
      ? route.result.best
      : null;
  const routePoints = useMemo<LatLng[] | null>(
    () => (bestRoute ? bestRoute.geometry.map(([lng, lat]) => ({ lat, lng })) : null),
    [bestRoute],
  );
  const handleChooseSegment = (candidate: AttachmentCandidate) => {
    if (originRevision === undefined || !pack) return;
    setSegmentChoice({ revision: originRevision, graphVersion: pack.graph.version, edgeId: candidate.edgeId });
  };

  // Walking distance replaces the straight-line estimate once a route result ranks the centers.
  // A center the result cannot reach shows no distance rather than a misleading straight line.
  const centers = useMemo(() => {
    if (ranking === null) return fetchedCenters;
    const byId = new Map(ranking.map((summary) => [summary.centerId, summary]));
    return fetchedCenters.map((center) => {
      const summary = byId.get(center.id);
      if (summary === undefined) return center;
      if (summary.distanceMeters === null || summary.durationSeconds === null) {
        return { ...center, distanceMeters: undefined, estimatedMinutes: undefined };
      }
      return {
        ...center,
        distanceMeters: summary.distanceMeters,
        estimatedMinutes: Math.max(1, Math.round(summary.durationSeconds / 60)),
      };
    });
  }, [fetchedCenters, ranking]);

  const displayCenters = nearestFirst && userPosition
    ? [...centers].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    : centers;

  const filteredCenters = searchQuery.trim().length > 0
    ? displayCenters.filter((c) => c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : displayCenters;
  const evacuationMarkers: MapMarker[] = filteredCenters.map((center) => ({
    id: center.id,
    position: center.position,
    kind: 'evacuation',
    label: center.name,
  }));

  const selectedCenter = selectedCenterId ? filteredCenters.find(c => c.id === selectedCenterId) ?? null : null;
  useEffect(() => {
    if (selectedCenterId !== null && selectedCenter === null) setSelectedCenterId(null);
  }, [selectedCenterId, selectedCenter]);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [mapHeight, setMapHeight] = useState(400);
  const [searchHeight, setSearchHeight] = useState(44);
  const coveredTop = 12 + searchHeight + 12;
  const coveredBottom = navBottom + overlayHeight + 20;
  const routePadding = useMemo(() => ({ top: coveredTop, bottom: coveredBottom }), [coveredTop, coveredBottom]);
  const selectedLat = selectedCenter?.position.lat;
  const selectedLng = selectedCenter?.position.lng;
  const hasRoute = routePoints !== null;
  const cameraPadding = useRef(routePadding);
  cameraPadding.current = routePadding;
  const focusSelected = useCallback(() => {
    if (selectedLat === undefined || selectedLng === undefined || hasRoute) return;
    const zoom = 17;
    const offsetPx = Math.max(0, (cameraPadding.current.bottom - cameraPadding.current.top) / 2);
    const metersPerPx = (156543.03 * Math.cos(selectedLat * Math.PI / 180)) / 2 ** zoom;
    mapRef.current?.flyTo({ lat: selectedLat - offsetPx * metersPerPx / 111320, lng: selectedLng, zoom });
  }, [selectedLat, selectedLng, hasRoute]);
  // Layout/theme changes update clearance without replaying camera movement.
  useEffect(() => { if (view === 'map') focusSelected(); }, [view, focusSelected]);
  // Ages shown in the status card are refreshed once a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [isFocused]);

  // Marking a road as blocked on this phone (local avoidance).
  const [marking, setMarking] = useState(false);
  const [markCandidate, setMarkCandidate] = useState<RoutingEdge | null>(null);
  const [noRoadAtTap, setNoRoadAtTap] = useState(false);
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const closeMarking = () => {
    setMarking(false);
    setMarkCandidate(null);
    setNoRoadAtTap(false);
    setMarkError(null);
  };
  const handleMapTap = (position: LatLng) => {
    if (resident) setMapNavHidden(true);
    if (!pack) return;
    const edge = nearestEdge(pack.graph, position);
    setMarkCandidate(edge);
    setNoRoadAtTap(edge === null);
    setMarkError(null);
  };
  const handleConfirmMark = () => {
    if (!markCandidate || markBusy) return;
    setMarkBusy(true);
    routing
      .markSegment(markCandidate.id)
      .then((result) => {
        if (result.ok) {
          setMarkCandidate(null);
          setMarkError(null);
        } else {
          setMarkError(
            result.reason === 'already_marked'
              ? 'This road is already blocked on this phone.'
              : result.reason === 'limit_reached'
                ? 'You have blocked the most roads allowed. Remove one first.'
                : 'This road is not on the installed map.',
          );
        }
      })
      .catch(() => setMarkError('The blocked road could not be saved on this phone. Try again.'))
      .finally(() => setMarkBusy(false));
  };
  const handleRemoveMark = (recordId: string) => {
    if (markBusy) return;
    setMarkBusy(true);
    routing
      .unmarkSegment(recordId)
      .then(() => setMarkError(null))
      .catch(() => setMarkError('The blocked road could not be removed. Try again.'))
      .finally(() => setMarkBusy(false));
  };

  const roadMarks = useMemo(() => {
    const closureLines: (readonly MapLngLat[])[] = (conditionsSnapshot?.closures ?? []).flatMap((closure) => closure.geometry.coordinates);
    const avoidedLines: (readonly MapLngLat[])[] = avoidance.flatMap((record) => record.edges.map((edge) => edge.geometry));
    return { closures: closureLines, avoided: avoidedLines, selected: markCandidate ? markCandidate.geometry : null };
  }, [conditionsSnapshot, avoidance, markCandidate]);

  const selectCenter = (center: ReturnType<typeof useEvacuationCenters>['centers'][number]) => {
    setSelectedCenterId(center.id);
    if (resident) setMapNavHidden(true);
    if (view !== 'map') onViewChange('map');
  };
  const handleMarkerTap = (id: string) => {
    const center = filteredCenters.find(c => c.id === id);
    if (center) selectCenter(center);
  };
  const dismissCenter = () => setSelectedCenterId(null);
  const handleShowAll = () => {
    dismissCenter();
    setSearchQuery('');
    mapRef.current?.fitAll();
    onFitAll?.();
  };
  const handleResetMap = () => {
    dismissCenter();
    mapRef.current?.fitBoundary();
  };
  // "Locate me" updates the shared controller (marker + routing origin), not just the
  // viewport. The map follows the result of an explicit request only.
  const locateRequestedRef = useRef(false);

  const handleLocateMe = () => {
    locateRequestedRef.current = true;
    location.locate();
  };

  useEffect(() => {
    if (!locateRequestedRef.current || !origin) return;
    locateRequestedRef.current = false;
    setFocusCenter({ lat: origin.lat, lng: origin.lng });
  }, [origin]);

  useEffect(() => {
    if (!locateRequestedRef.current || !pendingFix) return;
    setFocusCenter({ lat: pendingFix.lat, lng: pendingFix.lng });
  }, [pendingFix]);

  const handleLocationAction = (action: LocationAction) => {
    switch (action) {
      case 'locate':
      case 'retry':
        handleLocateMe();
        break;
      case 'cancel':
        location.cancel();
        break;
      case 'confirm':
        location.confirm();
        break;
      case 'reject':
        location.reject();
        break;
      case 'open-settings':
        location.openSettings();
        break;
    }
  };

  // Show the fix awaiting confirmation if there is one, otherwise the accepted origin.
  const mapUserLocation = useMemo<MapUserLocation | null>(() => {
    if (pendingFix) {
      return { position: { lat: pendingFix.lat, lng: pendingFix.lng }, accuracyMeters: pendingFix.accuracyMeters, pending: true };
    }
    if (origin) {
      return { position: { lat: origin.lat, lng: origin.lng }, accuracyMeters: origin.accuracyMeters, pending: false };
    }
    return null;
  }, [pendingFix, origin]);

  const place: MapPlace | null = selectedCenter ? {
    id: selectedCenter.id, title: selectedCenter.name, label: 'Evacuation center', detail: selectedCenter.address,
    color: theme.resident.warning, icon: 'home-outline',
  } : null;
  const diagnosticProps = { routing: routing.state, route, mode, connectedFailure, connectedPending, now, onChooseSegment: handleChooseSegment };
  const controls = <View style={styles.controlRow}>
    <View style={[styles.controlPill, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset map to Ampid I" onPress={handleResetMap} style={styles.controlButton}>
        <Ionicons name="map-outline" size={18} color={theme.resident.accentText} /><ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>Maps</ThemedText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Use my location" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={handleLocateMe} style={styles.controlButton}>
        {locating ? <ActivityIndicator color={theme.resident.accentText} /> : <Ionicons name="navigate-outline" size={18} color={theme.resident.accentText} />}<ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>You</ThemedText>
      </Pressable>
    </View>
    <View style={[styles.controlPill, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => mapRef.current?.zoomOut()} style={styles.zoomButton}><Ionicons name="remove" size={20} color={theme.resident.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => mapRef.current?.zoomIn()} style={styles.zoomButton}><Ionicons name="add" size={20} color={theme.resident.text} /></Pressable>
    </View>
  </View>;
  const feedback = isLoading ? <View style={styles.feedback}><ActivityIndicator color={theme.resident.accentText} /><ThemedText type="small">Loading evacuation centers…</ThemedText></View>
    : error ? <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: theme.resident.dangerSoft }]}><ThemedText type="small" style={{ color: theme.resident.danger, flex: 1 }}>{error}</ThemedText><Pressable accessibilityRole="button" onPress={refetch} style={styles.action}><ThemedText type="smallBold" style={{ color: theme.resident.danger }}>Retry</ThemedText></Pressable></View>
    : filteredCenters.length === 0 ? <ThemedText style={styles.empty}>{searchQuery.trim() ? 'No matching centers found.' : 'No evacuation centers configured.'}</ThemedText> : null;
  return <View style={styles.root}>
    <View style={styles.toolbar}>
      <View style={styles.viewToggle}><SegmentedControl segments={[{ key: 'list', label: 'List' }, { key: 'map', label: 'Map' }]} activeKey={view} onChange={onViewChange} presentation="resident" compact /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={nearestFirst ? 'Sorted by nearest. Change sort' : 'Default order. Change sort'} accessibilityState={{ selected: nearestFirst }} onPress={() => onNearestToggle(!nearestFirst)} style={[styles.sort, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
        <Ionicons name="swap-vertical" size={14} color={theme.resident.accentText} /><ThemedText style={styles.sortLabel}>{nearestFirst ? 'Nearest' : 'Default order'}</ThemedText>
      </Pressable>
    </View>
    {view === 'map' ? <View style={styles.map} onLayout={e => { const height = Math.round(e.nativeEvent.layout.height); setMapHeight(current => current === height ? current : height); }}>
      <View style={StyleSheet.absoluteFill} onTouchStart={() => { if (resident) setMapNavHidden(true); }}>
      <MapView ref={mapRef} markers={evacuationMarkers} center={AMPID_I_SAN_MATEO_CENTER} onMapReady={focusSelected} boundary={boundary}
        userLocation={mapUserLocation} kindColors={{ evacuation: theme.resident.warning }} style={{ flex: 1 }} onMarkerTap={handleMarkerTap}
        showTiles={showTiles} packMap={pack?.map ?? null} roadMarks={roadMarks} route={routePoints} routePadding={routePadding}
        presentation={{ selectedMarkerId: selectedCenter?.id ?? null, padding: routePadding, attributionBottom: navBottom + overlayHeight + 4,
          reducedMotion, surface: theme.resident.card, text: theme.resident.text, border: theme.resident.border, fontFamily: getMobileFontFamily(fontId) ?? 'sans-serif' }}
        onBackgroundTap={() => { if (resident) setMapNavHidden(true); dismissCenter(); }} onMapTap={marking ? handleMapTap : null} />
      </View>
      <View style={[styles.search, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]} onLayout={e => { const height = Math.ceil(e.nativeEvent.layout.height); setSearchHeight(current => current === height ? current : height); }}>
        <Ionicons name="search-outline" size={18} color={theme.resident.text} />
        <TextInput accessibilityLabel="Search evacuation centers" value={searchQuery} onChangeText={setSearchQuery} placeholder={`Search ${centers.length} evacuation centers...`} placeholderTextColor={theme.resident.muted} style={[styles.input, { color: theme.resident.text, fontFamily: getMobileFontFamily(fontId) }]} />
        {searchQuery ? <Pressable accessibilityRole="button" accessibilityLabel="Clear center search" onPress={() => setSearchQuery('')} style={styles.action}><Ionicons name="close" size={18} color={theme.resident.text} /></Pressable> : null}
      </View>
      <Animated.View style={[styles.overlay, overlayMotion]}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.max(44, mapHeight - coveredTop - navBottom - 24) }} contentContainerStyle={styles.overlayContent}
          onLayout={event => { const height = Math.ceil(event.nativeEvent.layout.height); setOverlayHeight(current => current === height ? current : height); }}>
          {feedback}
          <OfflineRouteCard {...diagnosticProps} compact />
          <LocationStatusCard state={location.state} onAction={handleLocationAction} />
          {marking ? <RoadMarkCard selected={markCandidate} noRoadAtTap={noRoadAtTap} records={avoidance} unresolvedIds={unresolvedAvoidanceIds} busy={markBusy} error={markError} onConfirm={handleConfirmMark} onRemove={handleRemoveMark} onClose={closeMarking} /> : null}
          <MapSelectionOverlay place={place} controls={controls} onClose={dismissCenter} reducedMotion={reducedMotion} maxHeight={mapHeight}
            renderPlace={shown => {
              const center = centers.find(item => item.id === shown.id);
              return center ? <CenterDetailCard name={center.name} address={center.address ?? 'No address'} distanceKm={center.distanceMeters === undefined ? undefined : center.distanceMeters / 1000} walkingTimeMins={center.estimatedMinutes} isRoadRoute={!!bestRoute && bestRoute.centerId === center.id} currentOccupancy={center.current_occupancy} capacity={center.capacity} onClose={dismissCenter} /> : null;
            }} />
          <View style={styles.routeActions}>
            {selectedCenter ? <Pressable accessibilityRole="button" onPress={handleShowAll} style={styles.action}><ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>Clear route / Show all</ThemedText></Pressable> : null}
            {pack ? <Pressable accessibilityRole="button" accessibilityLabel="Block a road you cannot pass" accessibilityState={{ selected: marking }} onPress={() => marking ? closeMarking() : setMarking(true)} style={styles.action}><Ionicons name="remove-circle-outline" size={18} color={theme.resident.danger} /><ThemedText type="smallBold" style={{ color: theme.resident.danger }}>{marking ? 'Finish road blocking' : 'Block road'}</ThemedText></Pressable> : null}
          </View>
        </ScrollView>
      </Animated.View>
      {resident ? <Animated.View style={[styles.reveal, revealMotion]}><Pressable accessibilityRole="button" accessibilityLabel={mapNavHidden ? 'Show bottom tabs' : 'Hide bottom tabs'} onPress={() => setMapNavHidden(!mapNavHidden)} style={[styles.revealButton, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}><Ionicons name={mapNavHidden ? 'chevron-up' : 'chevron-down'} size={20} color={theme.resident.text} /></Pressable></Animated.View> : null}
    </View> : <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.list, { paddingBottom: resident ? fullTabInset + 20 : 20 }]} keyboardShouldPersistTaps="handled">
      <ThemedText type="small" themeColor="textSecondary">Showing {filteredCenters.length} Locations</ThemedText>
      <LocationStatusCard state={location.state} onAction={handleLocationAction} />
      <OfflineRouteCard {...diagnosticProps} dense />
      {feedback}
      <View style={[styles.group, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
        {filteredCenters.map(center => <Pressable key={center.id} accessibilityRole="button" accessibilityLabel={`View ${center.name} on map`} onPress={() => selectCenter(center)}>
          <EvacuationCenterCard name={center.name} address={center.address ?? ''} distanceKm={center.distanceMeters === undefined ? undefined : center.distanceMeters / 1000} estimatedMinutes={center.estimatedMinutes} currentOccupancy={center.current_occupancy} capacity={center.capacity} facilities={center.facilities} verified={center.verified} />
        </Pressable>)}
      </View>
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, marginHorizontal: -24, marginBottom: -16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingBottom: 6, marginTop: -8 },
  viewToggle: { flex: 1, maxWidth: 168, minWidth: 0 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexShrink: 1 },
  sortLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  list: { paddingHorizontal: 16, gap: 8 }, group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1, minHeight: 220, overflow: 'hidden' },
  search: { position: 'absolute', left: 16, right: 16, top: 12, borderRadius: 28, borderWidth: 1, paddingLeft: 16, paddingRight: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 4 },
  input: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 14, paddingVertical: 8 },
  overlay: { position: 'absolute', left: 16, right: 16 }, overlayContent: { gap: 6 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  controlPill: { flexDirection: 'row', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  controlButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  zoomButton: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  action: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  routeActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, padding: 12 }, empty: { padding: 12, fontSize: 13 },
  reveal: { position: 'absolute', alignSelf: 'center' }, revealButton: { width: 48, height: 44, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
