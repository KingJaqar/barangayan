import type { LatLng } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AMPID_I_SAN_MATEO_CENTER, MapView } from '@/components/map-view';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useIncidentCategories } from '@/hooks/use-incident-categories';
import { useIncidents } from '@/hooks/use-incidents';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

type MapTab = 'incidents' | 'evacuation';

const DRRM_CARDS = [
  {
    id: 'preparedness',
    title: 'Preparedness Guide &\nHotline Directory',
    icon: 'book-outline' as const,
    iconColor: '#0F6E5B',
    iconBg: '#E6F2EF',
    offline: true,
  },
  {
    id: 'centers',
    title: 'Evacuation\nCenters',
    icon: 'camera-reverse-outline' as const,
    iconColor: '#F59E0B',
    iconBg: '#FEF3C7',
    offline: false,
  },
  {
    id: 'family',
    title: 'Family\nStatus',
    icon: 'home-outline' as const,
    iconColor: '#0F6E5B',
    iconBg: '#E6F2EF',
    offline: false,
  },
] as const;

const cardRows = [[DRRM_CARDS[0], DRRM_CARDS[1], DRRM_CARDS[2]]];

/** Vertical distance (px) the user must drag before release snaps to opposite state. */
const COLLAPSE_THRESHOLD = 60;

/** Height of the always-visible handle + title zone (px). */
const PEEK_HEIGHT = 72;

export default function MapsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  // The resident's barangay boundary (GeoJSON Polygon/MultiPolygon), drawn as the map's
  // red perimeter overlay and used to focus the initial view — see barangays.boundary.
  const boundary = (profile?.barangays?.boundary as Polygon | MultiPolygon | null) ?? null;

  // ── Map / filter state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MapTab>('incidents');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);
  // Overrides userLocation when the user taps "Maps" to reset the view back to
  // Barangay Ampid I, San Mateo — cleared whenever a fresh GPS fix comes in.
  const [focusCenter, setFocusCenter] = useState<LatLng | null>(null);

  // ── Location permission tooltip ──────────────────────────────────────────
  type PermissionStatus = 'granted' | 'denied' | 'undetermined';
  const [locationPermission, setLocationPermission] = useState<PermissionStatus | null>(null);
  // Separate dismissed state so that setting it triggers a re-render and the
  // tooltip actually unmounts (preventing invisible touch-interception on the map).
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The tooltip is mounted only while permission is unknown/denied AND the user
  // hasn't dismissed it. When permission is later revoked the dismissed flag is
  // cleared (see AppState handler), so it reappears automatically.
  const tooltipVisible =
    locationPermission !== null &&
    locationPermission !== 'granted' &&
    !tooltipDismissed;

  /** Animate the tooltip in, then auto-fade after 10 s. */
  const showTooltip = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    tooltipOpacity.setValue(1);
    fadeTimerRef.current = setTimeout(() => {
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 10_000);
  };

  /** Cancel the fade timer and snap opacity to 0 (the view will unmount next render). */
  const hideTooltip = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    tooltipOpacity.setValue(0);
  };

  /** Check current permission without showing a system dialog. */
  const checkPermission = async (): Promise<PermissionStatus> => {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status as PermissionStatus;
  };

  // On mount: check permission and show tooltip if not granted.
  useEffect(() => {
    let cancelled = false;
    checkPermission().then((status) => {
      if (cancelled) return;
      setLocationPermission(status);
      if (status !== 'granted') showTooltip();
    });
    return () => {
      cancelled = true;
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check on foreground: detects both grants (via Settings) and revocations.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      const status = await checkPermission();
      setLocationPermission((prev) => {
        if (prev === 'granted' && status !== 'granted') {
          // Permission was revoked — clear dismissed so tooltip reappears.
          setTooltipDismissed(false);
        }
        return status;
      });
      if (status !== 'granted') showTooltip();
      if (status === 'granted') hideTooltip();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const resolved = status as PermissionStatus;
    setLocationPermission(resolved);
    if (resolved === 'granted') {
      hideTooltip();
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setFocusCenter(null);
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch { /* silent */ }
    }
  };

  const handleDismissTooltip = () => {
    setTooltipDismissed(true);
    hideTooltip();
  };

  // ── Auto-geolocate on mount (runs after permission check resolves) ───────
  // Depends on locationPermission so it fires as soon as status is known to be
  // granted — avoids a redundant request since handleSetLocation covers the
  // newly-granted path from the tooltip.
  useEffect(() => {
    let cancelled = false;
    if (locationPermission !== 'granted') return;
    Location.getCurrentPositionAsync({}).then((loc) => {
      if (cancelled) return;
      setFocusCenter(null);
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    }).catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [locationPermission]);

  // ── Backend data ─────────────────────────────────────────────────────────
  const { categories, isLoading: categoriesLoading } = useIncidentCategories(barangayId);

  const {
    markers: incidentMarkers,
    isLoading: incidentsLoading,
    error: incidentsError,
    refetch: refetchIncidents,
  } = useIncidents({
    barangayId,
    categoryIds: activeFilters.length ? activeFilters : undefined,
    searchQuery: searchQuery || undefined,
  });

  const {
    markers: evacuationMarkers,
    isLoading: evacuationLoading,
    error: evacuationError,
    refetch: refetchEvacuation,
  } = useEvacuationCenters({
    barangayId,
    userPosition: userLocation,
  });

  const kindColors = Object.fromEntries(categories.map((c) => [c.id, c.color]));

  const activeMarkers = activeTab === 'incidents' ? incidentMarkers : evacuationMarkers;

  // Append a standing-person marker at the device's position so the user can
  // always see where "You" are, even when that location is outside Ampid I.
  const displayMarkers = userLocation
    ? [
      ...activeMarkers,
      {
        id: '__user_location__',
        position: userLocation,
        kind: 'user-location',
        label: 'You are here',
      },
    ]
    : activeMarkers;
  const activeLoading = activeTab === 'incidents' ? incidentsLoading : evacuationLoading;
  const activeError = activeTab === 'incidents' ? incidentsError : evacuationError;
  const activeRefetch = activeTab === 'incidents' ? refetchIncidents : refetchEvacuation;

  // ── Panel animation state ───────────────────────────────────────────────
  // panelY drives translateY: 0 = fully expanded, contentHeight = fully collapsed
  const panelY = useRef(new Animated.Value(0)).current;

  // useRef (not useState) so gesture callbacks always see the current value
  // without stale-closure issues.
  const isCollapsed = useRef(false);

  // Measured at runtime so the panel works across screen sizes.
  const [contentHeight, setContentHeight] = useState(0);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  /**
   * Spring the panel to `toValue`, respecting prefers-reduce-motion:
   * if the user has enabled reduced motion we jump instantly (duration 0).
   */
  const springTo = (toValue: number, cb?: () => void) => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        panelY.setValue(toValue);
        cb?.();
      } else {
        Animated.spring(panelY, {
          toValue,
          bounciness: 4,
          speed: 14,
          useNativeDriver: true,
        }).start(cb);
      }
    });
  };

  /** Tap the handle row to toggle between expanded and collapsed. */
  const togglePanel = () => {
    if (contentHeight === 0) return;
    isCollapsed.current = !isCollapsed.current;
    springTo(isCollapsed.current ? contentHeight : 0);
  };

  // ── PanResponder (attached to the handle row) ───────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture as soon as the user touches the handle zone.
      onStartShouldSetPanResponder: () => true,
      // Also claim once a vertical move is confirmed (in case of ambiguity).
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,

      onPanResponderMove: (_, g) => {
        // Offset from the panel's resting position (0 if expanded, contentHeight if collapsed).
        const base = isCollapsed.current ? contentHeight : 0;
        const next = Math.max(0, Math.min(contentHeight, base + g.dy));
        panelY.setValue(next);
      },

      onPanResponderRelease: (_, g) => {
        // Determine snap target based on drag distance and velocity.
        const shouldCollapse = isCollapsed.current
          ? g.dy > -COLLAPSE_THRESHOLD       // wasn't pulled up far enough to re-expand
          : g.dy > COLLAPSE_THRESHOLD || g.vy > 0.5; // dragged/flicked down

        isCollapsed.current = shouldCollapse;
        springTo(shouldCollapse ? contentHeight : 0);
      },

      // If the gesture is cancelled (e.g. a system gesture intervenes), snap back.
      onPanResponderTerminate: () => {
        springTo(isCollapsed.current ? contentHeight : 0);
      },
    }),
  ).current;

  // Chevron rotates as the panel moves: points up when expanded, down when collapsed.
  const chevronRotation = panelY.interpolate({
    inputRange: [0, Math.max(contentHeight, 1)], // avoid 0-range when not yet measured
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  // ── Location FAB ─────────────────────────────────────────────────────────
  const handleLocateMe = async () => {
    try {
      setLocatingMe(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Enable location access in your device settings to center the map on your position.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setFocusCenter(null);
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert('Unable to get your location', 'Please try again.');
    } finally {
      setLocatingMe(false);
    }
  };

  /**
   * Reset the map view to center on Barangay Ampid I, San Mateo.
   * A fresh object is set each press (rather than reusing the shared constant)
   * so repeated presses always change `focusCenter` by reference — otherwise
   * React bails out of the state update/effect on the 2nd+ press since
   * `Object.is(prev, next)` would be true and MapView never re-sends SET_CENTER.
   */
  const handleResetToAmpidI = () => {
    setFocusCenter({ ...AMPID_I_SAN_MATEO_CENTER });
  };

  // ── DRRM card actions ────────────────────────────────────────────────────
  const handleCardPress = (cardId: string) => {
    switch (cardId) {
      case 'preparedness':
        router.push('/home/emergency-info?tab=hub');
        return;
      case 'centers':
        router.push('/home/emergency-info?tab=centers');
        return;
      case 'family':
        router.push('/home/emergency-info?tab=family');
        return;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      {/* ① Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two },
        ]}
      >
        {/* height:40 matches AppHeader's logo size so all green banners are the same height */}
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Maps & DRRM Info Hub
          </ThemedText>
        </View>
      </View>

      {/* ② Map area — fills everything below the header; search bar, segment toggle,
           and filter pills all float on top of the map as overlays. */}
      <View style={styles.mapArea}>
        <MapView
          markers={displayMarkers}
          center={focusCenter ?? userLocation ?? undefined}
          kindColors={kindColors}
          boundary={boundary}
          style={StyleSheet.absoluteFill}
          onMarkerTap={(markerId) => {
            if (markerId === '__user_location__') return; // suppress popup for "You" pin
            const marker = displayMarkers.find((m) => m.id === markerId);
            if (marker?.label) Alert.alert(marker.label);
          }}
        />

        {/* ② Search bar — floats over the map */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search locations..."
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity style={styles.filterButton} accessibilityLabel="Filter">
            <Ionicons name="filter-outline" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* ③ Segment toggle — floats over the map */}
        <View style={[styles.segmentToggle, { backgroundColor: theme.backgroundElement }]}>
          {(['incidents', 'evacuation'] as MapTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.segmentItem,
                activeTab === tab && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activeTab === tab ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {tab === 'incidents' ? 'Incidents' : 'Evacuation'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ④ Filter pills — dynamic, from the barangay's configured incident categories.
             Floats over the map instead of pushing it down. */}
        {activeTab === 'incidents' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScrollFloating}
            contentContainerStyle={styles.pillsContent}
          >
            {categoriesLoading ? (
              [0, 1, 2].map((i) => (
                <View key={i} style={[styles.pillSkeleton, { backgroundColor: theme.backgroundElement }]} />
              ))
            ) : (
              categories.map((cat) => {
                const active = activeFilters.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pill,
                      active
                        ? { backgroundColor: cat.color, borderColor: cat.color }
                        : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
                    ]}
                    onPress={() => toggleFilter(cat.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${cat.name} filter`}
                  >
                    {active ? (
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    ) : (
                      <View style={[styles.pillDot, { backgroundColor: cat.color }]} />
                    )}
                    <ThemedText style={[styles.pillLabel, { color: active ? '#FFFFFF' : '#374151', fontWeight: active ? '700' : '500' }]}>
                      {cat.name}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Location permission tooltip */}
        {tooltipVisible && (
          <Animated.View style={[styles.locationTooltip, { opacity: tooltipOpacity }]}>
            <View style={styles.locationTooltipHeader}>
              <Ionicons name="location-outline" size={16} color="#B45309" />
              <Text style={styles.locationTooltipTitle}>Location Permission Required</Text>
            </View>
            <Text style={styles.locationTooltipBody}>
              Allow location access so the map can show your position and nearby incidents.
            </Text>
            <View style={styles.locationTooltipActions}>
              <TouchableOpacity
                style={styles.locationTooltipSetBtn}
                onPress={handleSetLocation}
                accessibilityRole="button"
                accessibilityLabel="Set location permission"
              >
                <Ionicons name="navigate-circle-outline" size={15} color="#FFFFFF" />
                <Text style={styles.locationTooltipSetText}>Set Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.locationTooltipDismissBtn}
                onPress={handleDismissTooltip}
                accessibilityRole="button"
                accessibilityLabel="Set up location later"
              >
                <Text style={styles.locationTooltipDismissText}>Setup Later</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Loading overlay */}
        {activeLoading && (
          <View style={[StyleSheet.absoluteFill, styles.overlayCenter]} pointerEvents="none">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {/* Error banner */}
        {!activeLoading && activeError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText} numberOfLines={2}>
              {activeError}
            </Text>
            <TouchableOpacity onPress={activeRefetch} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state */}
        {!activeLoading && !activeError && activeMarkers.length === 0 && (
          <View style={styles.emptyStateContainer} pointerEvents="none">
            <View style={styles.emptyCard}>
              <Ionicons
                name={activeTab === 'incidents' ? 'map-outline' : 'home-outline'}
                size={28}
                color="#9CA3AF"
              />
              <ThemedText style={styles.emptyText}>
                {activeTab === 'incidents'
                  ? 'No incidents reported in this area'
                  : 'No evacuation centers found'}
              </ThemedText>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.mapsResetFab}
          accessibilityLabel="Reset map to Ampid I, San Mateo"
          accessibilityRole="button"
          onPress={handleResetToAmpidI}
        >
          <Ionicons name="map" size={18} color={theme.primary} />
          <Text style={[styles.mapsResetFabText, { color: theme.primary }]}>Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.youFab}
          accessibilityLabel="Center map on your location"
          accessibilityRole="button"
          onPress={handleLocateMe}
          disabled={locatingMe}
        >
          {locatingMe ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="navigate" size={16} color={theme.primary} />
          )}
          <Text style={[styles.mapsResetFabText, { color: theme.primary }]}>You</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          accessibilityLabel="Center map on my location"
          onPress={handleLocateMe}
          disabled={locatingMe}
        >
          {locatingMe ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="locate-outline" size={22} color={theme.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* ⑥ DRRM Info Hub — absolutely positioned, animated bottom panel */}
      <Animated.View
        style={[
          styles.bottomPanel,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: panelY }] },
        ]}
        accessibilityViewIsModal={false}
      >
        {/* Handle zone: tap to toggle, drag to animate */}
        <TouchableOpacity
          style={styles.handleRow}
          onPress={togglePanel}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed.current ? 'Expand DRRM Info Hub' : 'Collapse DRRM Info Hub'}
          activeOpacity={0.7}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <Ionicons name="chevron-up" size={18} color={theme.textSecondary} />
          </Animated.View>
        </TouchableOpacity>

        <ThemedText style={styles.panelTitle}>DRRM Info Hub</ThemedText>

        {/* Card grid — height measured here to derive contentHeight */}
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setContentHeight(h);
          }}
        >
          <View style={styles.cardGrid}>
            {cardRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.cardRow}>
                {row.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[styles.card, { backgroundColor: theme.backgroundElement }]}
                    accessibilityLabel={card.title.replace('\n', ' ')}
                    activeOpacity={0.75}
                    onPress={() => handleCardPress(card.id)}
                  >
                    {card.offline && (
                      <View style={[styles.offlineBadge, { borderColor: theme.primary }]}>
                        <ThemedText style={[styles.offlineText, { color: theme.primary }]}>
                          Offline
                        </ThemedText>
                      </View>
                    )}
                    <View style={[styles.iconCircle, { backgroundColor: card.iconBg }]}>
                      <Ionicons name={card.icon} size={24} color={card.iconColor} />
                    </View>
                    <ThemedText style={styles.cardTitle}>{card.title}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  // height:40 matches AppHeader's logo size — keeps all green banners the same
  // total height (insets.top + Spacing.two + 40 + Spacing.three = same as AppHeader).
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },

  // ── Search bar ──────────────────────────────────────────────────────────
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    paddingVertical: 0,
  },
  filterButton: {
    padding: 4,
    marginLeft: 6,
  },

  // ── Segment toggle ──────────────────────────────────────────────────────
  segmentToggle: {
    position: 'absolute',
    top: 66,   // 12 (searchBar top) + 44 (searchBar height) + 10 gap
    left: 16,
    right: 16,
    borderRadius: 22,
    padding: 3,
    height: 40,
    flexDirection: 'row',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  segmentItem: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Filter pills ────────────────────────────────────────────────────────
  pillsScroll: {
    marginTop: 10,
    flexGrow: 0,
  },
  pillsScrollFloating: {
    position: 'absolute',
    top: 116,  // below search bar (12+44) + segment toggle (10+40) + 10 gap
    left: 0,
    right: 0,
    flexGrow: 0,
    zIndex: 10,
  },
  pillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillSkeleton: {
    width: 90,
    height: 30,
    borderRadius: 99,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Location permission tooltip ─────────────────────────────────────────
  locationTooltip: {
    position: 'absolute',
    top: 158,    // just below filter pills (116 top + 34 height + 8 gap)
    left: 16,
    right: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#92400E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  locationTooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  locationTooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  locationTooltipBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
    marginBottom: 12,
  },
  locationTooltipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationTooltipSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D97706',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  locationTooltipSetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationTooltipDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationTooltipDismissText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400E',
  },

  // ── Map area ────────────────────────────────────────────────────────────
  mapArea: {
    flex: 1,
    minHeight: 220,
    position: 'relative',
  },
  overlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    position: 'absolute',
    // 116 (pills top) + 34 (pill height) + 8 gap = 158 — sits just below the filter strip
    top: 158,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: 158,
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
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
    maxWidth: 240,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  mapsResetFab: {
    position: 'absolute',
    // Sits below Leaflet's top-left +/- zoom control (which itself starts at
    // 158px to clear search bar + segment toggle + filter pills).
    left: 10,
    top: 272,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  youFab: {
    position: 'absolute',
    // 272 (mapsResetFab top) + 36 (its height) + 8 gap
    left: 10,
    top: 316,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  mapsResetFabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Bottom panel (absolutely positioned, floats over the map) ───────────
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    // paddingBottom is set inline (insets.bottom + 16)
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },

  // Handle row: full-width tap + drag target
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },

  // ── DRRM panel content ──────────────────────────────────────────────────
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  cardGrid: {
    gap: 12,
    paddingBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 118,
    position: 'relative',
    justifyContent: 'flex-end',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  offlineBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '600',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
