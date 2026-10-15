import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeInUp,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useAmpid1Boundary } from '@/hooks/use-ampid1-boundary';
import { EvacuationCenterCard } from '@/components/evacuation-center-card';
import { HorizontalCenterPicker, type CenterPickerItem } from '@/components/horizontal-center-picker';
import { CenterDetailCard } from '@/components/center-detail-card';
import { LocationStatusCard } from '@/components/location-status-card';
import { MapView, AMPID_I_SAN_MATEO_CENTER, type MapUserLocation, type MapViewHandle } from '@/components/map-view';
import { ShimmerSkeleton } from '@/components/shimmer-skeleton';
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

function AnimatedCenterCard({
  center,
  index,
  isLast,
}: {
  center: ReturnType<typeof useEvacuationCenters>['centers'][number];
  index: number;
  isLast: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.97, { damping: 26, stiffness: 300, overshootClamping: true });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 26, stiffness: 300, overshootClamping: true });
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(300).delay(index * 50)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.duration(200)}
      style={!isLast && styles.centerCardSeparator}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={animatedStyle}>
          <EvacuationCenterCard
            name={center.name}
            address={center.address ?? ''}
            distanceKm={(center.distanceMeters ?? 0) / 1000}
            estimatedMinutes={center.estimatedMinutes ?? 0}
            currentOccupancy={center.current_occupancy}
            capacity={center.capacity}
            facilities={center.facilities}
            verified={center.verified}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

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
}) {
  const boundary = useAmpid1Boundary();
  const [searchQuery, setSearchQuery] = useState('');
  const locating = location.state.activeRequestId !== null;
  const origin = location.state.origin;
  const originRevision = origin?.revision;
  const pendingFix = location.state.pending?.fix ?? null;
  const [focusCenter, setFocusCenter] = useState<LatLng | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [boundaryRefitKey] = useState(0);
  const mapRef = useRef<MapViewHandle>(null);

  const cardOpacity = useSharedValue(0);
  const [cardCenterId, setCardCenterId] = useState<string | null>(null);

  // Walking routes are computed on this phone from the installed routing pack, verified
  // closures and the resident's own blocked roads (DRRM routing plan R6), so they work
  // offline. A route that cannot be computed is explained in words and never drawn as a
  // straight line (invariant 7).
  const routing = useOfflineRouting(true);
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
    ? displayCenters.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : displayCenters;

  const pickerItems: CenterPickerItem[] = filteredCenters.map((c) => ({
    id: c.id,
    name: c.name,
    distanceKm: c.distanceMeters !== undefined ? c.distanceMeters / 1000 : undefined,
  }));

  const evacuationMarkers: MapMarker[] = filteredCenters.map((center) => ({
    id: center.id,
    position: center.position,
    kind: 'evacuation',
    label: center.name,
  }));

  const centerFromId = (id: string) => centers.find((c) => c.id === id)!;

  const mapCenter = focusCenter ?? AMPID_I_SAN_MATEO_CENTER;

  const selectedCenter = selectedCenterId ? centerFromId(selectedCenterId) : null;
  const cardCenter = cardCenterId ? centers.find((c) => c.id === cardCenterId) ?? null : null;
  // Height of everything floating over the bottom of the map (status, location and center cards,
  // picker), measured so the selected pin and the route are framed in the visible gap.
  const [overlayHeight, setOverlayHeight] = useState(0);
  const coveredTop = MAP_SEARCH_TOP + MAP_SEARCH_HEIGHT;
  const coveredBottom = MAP_OVERLAY_BOTTOM + overlayHeight;
  const routePadding = useMemo(() => ({ top: coveredTop, bottom: coveredBottom }), [coveredTop, coveredBottom]);
  const selectedLat = selectedCenter?.position.lat;
  const selectedLng = selectedCenter?.position.lng;
  const hasRoute = routePoints !== null;
  // Shift the map center south so the selected pin sits in the open area between the search bar
  // and the floating overlay. Once the route is drawn, the route fit frames both ends instead.
  const mapFocusPosition = useMemo(() => {
    if (selectedLat === undefined || selectedLng === undefined || hasRoute) return undefined;
    const zoom = 17;
    const offsetPx = Math.max(0, (coveredBottom - coveredTop) / 2);
    const metersPerPx = (156543.03 * Math.cos((selectedLat * Math.PI) / 180)) / 2 ** zoom;
    return { lat: selectedLat - (offsetPx * metersPerPx) / 111320, lng: selectedLng, zoom };
  }, [selectedLat, selectedLng, hasRoute, coveredTop, coveredBottom]);

  // Ages shown in the status card are refreshed once a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

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
    if (!pack) return;
    const edge = nearestEdge(pack.graph, position);
    setMarkCandidate(edge);
    setNoRoadAtTap(edge === null);
    setMarkError(null);
  };
  const handleConfirmMark = () => {
    if (!markCandidate) return;
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

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
  }));

  const handleMarkerTap = (markerId: string) => {
    const center = centers.find((c) => c.id === markerId);
    if (center) {
      selectCenter(center);
    }
  };

  const selectCenter = (center: ReturnType<typeof useEvacuationCenters>['centers'][number]) => {
    setSelectedCenterId(center.id);
    setCardCenterId(center.id);
    cardOpacity.value = 0;
    cardOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleShowAll = () => {
    setSelectedCenterId(null);
    setSearchQuery('');
    // Keep the card mounted until the fade-out finishes; an interrupted fade (a new
    // selection mid-fade) reports finished=false and leaves the card in place.
    cardOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setCardCenterId)(null);
    });
    mapRef.current?.fitAll();
    onFitAll?.();
  };

  const handleResetMap = () => {
    setFocusCenter({ lat: AMPID_I_SAN_MATEO_CENTER.lat, lng: AMPID_I_SAN_MATEO_CENTER.lng });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originRevision]);

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

  // The toggle reflects `view` immediately; the body below swaps to it only after
  // fading out, then fades back in, so the header stays put like one screen.
  const [bodyView, setBodyView] = useState(view);
  const centersViewOpacity = useSharedValue(1);

  const centersViewStyle = useAnimatedStyle(() => ({
    opacity: centersViewOpacity.value,
  }));

  useEffect(() => {
    if (view === bodyView) {
      centersViewOpacity.value = withTiming(1, { duration: 180 });
      return;
    }
    centersViewOpacity.value = withTiming(0, { duration: 120 }, (finished) => {
      if (finished) runOnJS(setBodyView)(view);
    });
  }, [view, bodyView, centersViewOpacity]);

  return (
    <View style={[styles.centersContent, styles.centersContentMap]}>
      <View style={styles.sectionControlsRow}>
        <View style={styles.segmentWrap}>
          <SegmentedControl
            segments={[
              { key: 'list', label: 'List' },
              { key: 'map', label: 'Map' },
            ]}
            activeKey={view}
            onChange={(key) => onViewChange(key as 'list' | 'map')}
            activeColor="accentRed"
          />
        </View>
        <Pressable
          onPress={() => onNearestToggle(!nearestFirst)}
          accessibilityRole="button"
          accessibilityState={{ selected: nearestFirst }}
          style={[
            styles.nearestButton,
            { borderColor: theme.backgroundSelected },
            nearestFirst && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}>
          <Ionicons name="swap-vertical" size={16} color={nearestFirst ? theme.onPrimary : theme.textSecondary} />
          <ThemedText type="smallBold" style={[styles.nearestText, { color: nearestFirst ? theme.onPrimary : theme.textSecondary }]}>
            Nearest
          </ThemedText>
        </Pressable>
      </View>

      <Animated.View style={[centersViewStyle, styles.centersBody]}>
        {bodyView === 'map' ? (
          <View style={styles.sectionMap}>
            <View style={styles.centersMapContainer}>
            <MapView
              ref={mapRef}
              markers={evacuationMarkers}
              center={mapCenter}
              focusPosition={mapFocusPosition}
              boundary={boundary}
              boundaryRefitKey={boundaryRefitKey}
              userLocation={mapUserLocation}
              kindColors={{ evacuation: '#F59E0B' }}
              style={styles.centersMap}
              onMarkerTap={handleMarkerTap}
              zoomControlTop={MAP_SEARCH_TOP + MAP_SEARCH_HEIGHT + 10}
              showTiles={showTiles}
              packMap={pack?.map ?? null}
              roadMarks={roadMarks}
              route={routePoints}
              routePadding={routePadding}
              onMapTap={marking ? handleMapTap : null}
            />

            <View style={[styles.mapSearchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.mapSearchIcon} />
              <TextInput
                style={[styles.mapSearchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search ${centers.length} evacuation centers...`}
                placeholderTextColor={theme.textSecondary}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            <View style={styles.mapFabColumn}>
              <Pressable
                style={[styles.mapFab, { backgroundColor: theme.background }]}
                onPress={handleLocateMe}
                accessibilityLabel="Use my location"
                disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="navigate" size={18} color={theme.primary} />
                )}
              </Pressable>
              <Pressable
                style={[styles.mapFab, { backgroundColor: theme.background }]}
                onPress={handleResetMap}
                accessibilityLabel="Reset map to Ampid I">
                <Ionicons name="locate-outline" size={20} color={theme.primary} />
              </Pressable>
              {pack ? (
                <Pressable
                  style={[styles.mapFab, { backgroundColor: marking ? theme.accentRed : theme.background }]}
                  onPress={() => (marking ? closeMarking() : setMarking(true))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: marking }}
                  accessibilityLabel="Block a road you cannot pass">
                  <Ionicons name="remove-circle-outline" size={20} color={marking ? theme.onPrimary : theme.accentRed} />
                </Pressable>
              ) : null}
            </View>

            {isLoading && (
              <View style={[styles.mapOverlayCenter, { backgroundColor: `${theme.background}99` }]} pointerEvents="none">
                <View style={[styles.mapSkeletonCard, { backgroundColor: theme.backgroundElement }]}>
                  <ShimmerSkeleton theme={theme} width={100} height={100} borderRadius={50} />
                  <ShimmerSkeleton theme={theme} width={120} height={14} style={{ marginTop: 16 }} />
                  <ShimmerSkeleton theme={theme} width={90} height={12} style={{ marginTop: 8 }} />
                </View>
              </View>
            )}

            {!isLoading && error && (
              <View style={styles.mapErrorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                <ThemedText type="small" themeColor="textSecondary" style={styles.mapErrorText}>
                  {error}
                </ThemedText>
                <Pressable onPress={refetch} style={styles.mapRetryButton}>
                  <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>Retry</ThemedText>
                </Pressable>
              </View>
            )}

            {!isLoading && !error && filteredCenters.length === 0 && (
              <View style={[styles.mapOverlayCenter, { backgroundColor: `${theme.background}99` }]} pointerEvents="none">
                <View style={[styles.mapEmptyCard, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="home-outline" size={28} color={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" style={styles.mapEmptyText}>
                    {searchQuery.trim().length > 0 ? 'No matching centers found' : 'No evacuation centers found'}
                  </ThemedText>
                </View>
              </View>
            )}

            {!isLoading && filteredCenters.length > 0 && (
              <View
                style={styles.mapBottomOverlay}
                pointerEvents="box-none"
                onLayout={(e) => setOverlayHeight(Math.round(e.nativeEvent.layout.height))}>
                {marking ? (
                  <RoadMarkCard
                    selected={markCandidate}
                    noRoadAtTap={noRoadAtTap}
                    records={avoidance}
                    unresolvedIds={unresolvedAvoidanceIds}
                    busy={markBusy}
                    error={markError}
                    onConfirm={handleConfirmMark}
                    onRemove={handleRemoveMark}
                    onClose={closeMarking}
                    style={styles.mapLocationCard}
                  />
                ) : (
                  <OfflineRouteCard
                    routing={routing.state}
                    route={route}
                    mode={mode}
                    connectedFailure={connectedFailure}
                    connectedPending={connectedPending}
                    now={now}
                    onChooseSegment={handleChooseSegment}
                    compact
                    style={styles.mapLocationCard}
                  />
                )}
                <LocationStatusCard state={location.state} onAction={handleLocationAction} style={styles.mapLocationCard} />
                {cardCenter ? (
                  <Animated.View style={[styles.mapDetailWrap, cardAnimatedStyle]}>
                    <CenterDetailCard
                      name={cardCenter.name}
                      address={cardCenter.address ?? 'No address'}
                      distanceKm={(bestRoute?.distanceMeters ?? cardCenter.distanceMeters ?? 0) / 1000}
                      walkingTimeMins={
                        bestRoute
                          ? Math.max(1, Math.round(bestRoute.durationSeconds / 60))
                          : (cardCenter.estimatedMinutes ?? 0)
                      }
                      isRoadRoute={!!bestRoute}
                      currentOccupancy={cardCenter.current_occupancy}
                      capacity={cardCenter.capacity}
                      onClose={handleShowAll}
                    />
                  </Animated.View>
                ) : null}

                <HorizontalCenterPicker
                  items={pickerItems}
                  selectedId={selectedCenterId}
                  onSelect={(id) => {
                    const center = centerFromId(id);
                    if (center) {
                      selectCenter(center);
                    }
                  }}
                  onShowAll={handleShowAll}
                />
              </View>
            )}
          </View>
        </View>
        ) : (
          <ScrollView
            style={styles.centersBody}
            contentContainerStyle={styles.centersListScroll}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.showingText}>
              Showing {centers.length} Locations
            </ThemedText>
            <LocationStatusCard state={location.state} onAction={handleLocationAction} />
            <OfflineRouteCard
              routing={routing.state}
              route={route}
              mode={mode}
              connectedFailure={connectedFailure}
              connectedPending={connectedPending}
              now={now}
              onChooseSegment={handleChooseSegment}
            />
            <View style={styles.sectionList}>
              {isLoading ? (
                <View style={styles.skeletonList}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.skeletonCard, { backgroundColor: theme.backgroundElement }]}>
                      <ShimmerSkeleton theme={theme} width="70%" height={16} />
                      <ShimmerSkeleton theme={theme} width="50%" height={12} style={{ marginTop: 6 }} />
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <ShimmerSkeleton theme={theme} width={60} height={20} borderRadius={10} />
                        <ShimmerSkeleton theme={theme} width={60} height={20} borderRadius={10} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : filteredCenters.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ThemedText themeColor="textSecondary">
                    {searchQuery.trim().length > 0 ? 'No matching centers found.' : 'No evacuation centers configured.'}
                  </ThemedText>
                </View>
              ) : (
                filteredCenters.map((center, index) => (
                  <AnimatedCenterCard
                    key={center.id}
                    center={center}
                    index={index}
                    isLast={index >= filteredCenters.length - 1}
                  />
                ))
              )}
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  )
}

const MAP_SEARCH_TOP = 12;
const MAP_SEARCH_HEIGHT = 44;
const MAP_OVERLAY_BOTTOM = 12;

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  centersContent: {
    gap: Spacing.three,
  },
  centersContentMap: {
    flex: 1,
    minHeight: 0,
  },
  sectionControlsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  segmentWrap: {
    flex: 1,
  },
  centersBody: {
    flex: 1,
  },
  centersListScroll: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  // Bleeds past mapScreen's side/bottom padding so the map runs edge to edge,
  // matching the Maps & DRRM Info Hub tab.
  sectionMap: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: -Spacing.four,
    marginBottom: -Spacing.three,
  },
  sectionList: {
    gap: Spacing.three,
  },
  skeletonList: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  skeletonCard: {
    gap: 6,
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.25)',
  },
  centersMapContainer: {
    flex: 1,
    minHeight: 220,
    overflow: 'hidden',
    position: 'relative',
  },
  centersMap: {
    flex: 1,
  },
  mapSearchBar: {
    position: 'absolute',
    top: MAP_SEARCH_TOP,
    left: 12,
    right: 12,
    height: MAP_SEARCH_HEIGHT,
    borderRadius: MAP_SEARCH_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  mapSearchIcon: {
    marginRight: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  mapFabColumn: {
    position: 'absolute',
    top: MAP_SEARCH_TOP + MAP_SEARCH_HEIGHT + 10,
    right: 12,
    gap: Spacing.two,
    zIndex: 10,
  },
  mapFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  mapBottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: MAP_OVERLAY_BOTTOM,
    gap: Spacing.two,
    zIndex: 10,
  },
  mapLocationCard: {
    marginHorizontal: 12,
  },
  mapDetailWrap: {
    marginHorizontal: 12,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  mapOverlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapSkeletonCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  mapErrorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  mapErrorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
  },
  mapRetryButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapEmptyCard: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  mapEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  showingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  nearestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Spacing.four,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  nearestText: {
    fontSize: 13,
    lineHeight: 18,
  },
  centerCardSeparator: {
    marginBottom: Spacing.three,
  },
});
