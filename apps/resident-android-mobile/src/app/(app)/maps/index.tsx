import type { LatLng } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { MapView, type MapViewHandle } from '@/components/map-view';
import { MapSelectionOverlay, type MapPlace } from '@/components/maps/map-selection-overlay';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { getMobileFontFamily } from '@/constants/fonts';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useFloatingTabLayout } from '@/hooks/use-floating-tab-layout';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useIncidentCategories } from '@/hooks/use-incident-categories';
import { useIncidents } from '@/hooks/use-incidents';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { isMapPosition } from '@/lib/map-presentation';

type MapTab = 'incidents' | 'evacuation';
type PermissionStatus = Location.LocationPermissionResponse['status'];
const layers: { key: MapTab; label: string }[] = [{ key: 'incidents', label: 'Incidents' }, { key: 'evacuation', label: 'Evacuation' }];

export default function MapsScreen() {
  const { resident } = useTheme();
  const { fontId } = useFontPreference();
  const fontFamily = getMobileFontFamily(fontId);
  const bottomTabInset = useFloatingTabInset();
  const fullTabInset = useFloatingTabInset(true);
  const { bottom: systemBottomInset } = useSafeAreaInsets();
  const { mapNavHidden, setMapNavHidden, mapNavProgress } = useFloatingTabLayout();
  const reducedMotion = useResidentReducedMotion(true);
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  const boundary = (profile?.barangays?.boundary as Polygon | MultiPolygon | null) ?? null;
  const map = useRef<MapViewHandle>(null);
  const [activeTab, setActiveTab] = useState<MapTab>('incidents');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);
  const [locationPermission, setLocationPermission] = useState<PermissionStatus | null>(null);
  const permission = useRef<PermissionStatus | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const alive = useRef(false);
  const locationRequest = useRef(0);
  const locationBusy = useRef(false);
  const requestingPermission = useRef(false);
  const cancelLocation = useRef<(() => void) | null>(null);
  const initialPermissionCheck = useRef(true);
  const tooltipOpacity = useRef(new Animated.Value(1)).current;
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const [topHeight, setTopHeight] = useState(0);
  const incidentSearch = useRef<TextInput>(null);
  const revealSearch = useRef<() => void>(() => {});
  const [compactSearch, setCompactSearch] = useState(false);
  const searchActive = Platform.OS === 'android' && focused && activeTab === 'incidents';
  useEffect(() => {
    if (!searchActive) { setCompactSearch(false); return; }
    let revision = 0;
    let frame: number | null = null;
    const reveal = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      const ticket = ++revision;
      frame = requestAnimationFrame(() => {
        frame = null;
        const keyboard = Keyboard.metrics();
        if (!keyboard) return;
        incidentSearch.current?.measureInWindow((_x, y, _width, height) => {
          if (ticket === revision && height > 0 && y + height > keyboard.screenY) setCompactSearch(true);
        });
      });
    };
    revealSearch.current = reveal;
    const show = Keyboard.addListener('keyboardDidShow', reveal);
    const hide = Keyboard.addListener('keyboardDidHide', () => { ++revision; setCompactSearch(false); });
    reveal();
    return () => {
      ++revision;
      if (frame !== null) cancelAnimationFrame(frame);
      revealSearch.current = () => {};
      show.remove(); hide.remove();
    };
  }, [searchActive]);
  const [overlayHeight, setOverlayHeight] = useState(48);
  // Keep the 44dp chevron above system navigation and all map controls above it.
  const revealHiddenBottom = systemBottomInset + 12;
  const revealVisibleBottom = Math.max(revealHiddenBottom, fullTabInset - 4);
  const navHiddenBottom = revealHiddenBottom + 44 + 28;
  const navVisibleBottom = revealVisibleBottom + 44 + 28;
  const overlayBottom = mapNavHidden ? navHiddenBottom : navVisibleBottom;
  const revealTravel = revealVisibleBottom - revealHiddenBottom;
  const overlayMotion = useAnimatedStyle(() => ({ transform: [{ translateY: (navVisibleBottom - navHiddenBottom) * (mapNavProgress?.value ?? 0) }] }));
  const revealMotion = useAnimatedStyle(() => ({ transform: [{ translateY: revealTravel * (mapNavProgress?.value ?? 0) }] }));

  const updatePermission = useCallback((status: PermissionStatus) => {
    if (permission.current === 'granted' && status !== 'granted') setTooltipDismissed(false);
    permission.current = status;
    setLocationPermission(status);
  }, []);
  const acquireLocation = useCallback(async (explicit: boolean) => {
    if (locationBusy.current) return;
    locationBusy.current = true;
    const ticket = ++locationRequest.current;
    const owns = () => alive.current && ticket === locationRequest.current;
    setLocatingMe(true); setLocationError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (explicit) {
        requestingPermission.current = true;
        const result = await Location.requestForegroundPermissionsAsync().finally(() => { requestingPermission.current = false; });
        if (!owns()) return;
        updatePermission(result.status);
        if (result.status !== 'granted') {
          setLocationError('Enable location access in your device settings to show your position.');
          return;
        }
      }
      const location = await Promise.race([
        Location.getCurrentPositionAsync({}),
        new Promise<never>((_, reject) => {
          cancelLocation.current = () => reject(new Error('Location request cancelled'));
          timeout = setTimeout(() => reject(new Error('Location request timed out')), 10_000);
        }),
      ]);
      if (!owns()) return;
      const point = { lat: location.coords.latitude, lng: location.coords.longitude };
      if (!isMapPosition(point)) throw new Error('Invalid location');
      setUserLocation(point); setAccuracy(location.coords.accuracy); setSelectedId(null);
      map.current?.flyTo({ ...point, zoom: 17 });
    } catch {
      if (owns()) setLocationError('Unable to get your location. Try You again, or browse the map.');
    } finally {
      if (timeout) clearTimeout(timeout);
      if (owns()) cancelLocation.current = null;
      if (owns()) { locationBusy.current = false; setLocatingMe(false); }
    }
  }, [updatePermission]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; locationRequest.current += 1; cancelLocation.current?.(); }; }, []);
  useFocusEffect(useCallback(() => {
    setMapNavHidden(true);
    focusedRef.current = true; setFocused(true);
    return () => {
      setMapNavHidden(false);
      focusedRef.current = false; setFocused(false);
      locationRequest.current += 1; locationBusy.current = false; setLocatingMe(false);
      cancelLocation.current?.(); cancelLocation.current = null;
    };
  }, [setMapNavHidden]));
  // Preserve automatic acquisition for granted permission and foreground permission rechecks.
  useEffect(() => {
    if (!focused) return;
    let active = true;
    async function check(initial: boolean) {
      try {
        const result = await Location.getForegroundPermissionsAsync();
        if (!active || !focusedRef.current) return;
        const gained = permission.current !== 'granted' && result.status === 'granted';
        updatePermission(result.status);
        if ((initial || gained) && result.status === 'granted' && focusedRef.current) void acquireLocation(false);
      } catch { if (active) setLocationError('Location permission could not be checked. Try You again.'); }
    }
    void check(initialPermissionCheck.current);
    initialPermissionCheck.current = false;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check(false);
      else {
        setMapNavHidden(false);
        if (!requestingPermission.current) {
          locationRequest.current += 1; locationBusy.current = false; setLocatingMe(false);
          cancelLocation.current?.(); cancelLocation.current = null;
        }
        setTooltipDismissed(true);
      }
    });
    return () => { active = false; subscription.remove(); };
  }, [focused, updatePermission, acquireLocation, setMapNavHidden]);
  const tooltipVisible = focused && locationPermission !== null && locationPermission !== 'granted' && !tooltipDismissed;
  useEffect(() => {
    if (!tooltipVisible) return;
    tooltipOpacity.setValue(reducedMotion ? 1 : 0);
    Animated.timing(tooltipOpacity, { toValue: 1, duration: reducedMotion ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(tooltipOpacity, { toValue: 0, duration: reducedMotion ? 0 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setTooltipDismissed(true); });
    }, 10_000);
    return () => { clearTimeout(timer); tooltipOpacity.stopAnimation(); };
  }, [tooltipVisible, reducedMotion, tooltipOpacity]);

  const { categories, isLoading: categoriesLoading, error: categoriesError, retry: retryCategories } = useIncidentCategories(barangayId);
  const { incidents, markers: incidentMarkers, isLoading: incidentsLoading, error: incidentsError, refetch: refetchIncidents } = useIncidents({
    barangayId, categoryIds: activeFilters.length ? activeFilters : undefined, searchQuery: searchQuery || undefined,
  });
  const { centers, markers: evacuationMarkers, isLoading: evacuationLoading, error: evacuationError, refetch: refetchEvacuation, isOffline } = useEvacuationCenters({
    barangayId, userPosition: userLocation,
  });
  const kindColors = useMemo(() => Object.fromEntries(categories.map(category => [category.id, category.color])), [categories]);
  const markers = activeTab === 'incidents' ? incidentMarkers : evacuationMarkers;
  const loading = activeTab === 'incidents' ? incidentsLoading : evacuationLoading;
  const error = activeTab === 'incidents' ? incidentsError : evacuationError;
  const refetch = activeTab === 'incidents' ? refetchIncidents : refetchEvacuation;
  const selected = markers.find(marker => marker.id === selectedId);
  const selectedMarkerId = selected?.id;
  useEffect(() => { if (selectedId && !selectedMarkerId) setSelectedId(null); }, [selectedId, selectedMarkerId]);
  const selectedCategory = selected && categories.find(category => category.id === selected.kind);
  const incident = activeTab === 'incidents' ? incidents.find(row => row.id === selected?.id) : undefined;
  const center = activeTab === 'evacuation' ? centers.find(row => row.id === selected?.id) : undefined;
  const date = incident ? new Date(incident.created_at) : null;
  const place: MapPlace | null = selected ? {
    id: selected.id, title: selected.label ?? 'Location',
    label: activeTab === 'evacuation' ? 'Evacuation center' : selectedCategory?.name ?? 'Incident',
    detail: center?.address || (date && Number.isFinite(date.getTime()) ? date.toLocaleString() : null),
    color: selectedCategory?.color ?? resident.accent,
    icon: activeTab === 'evacuation' ? 'home-outline' : selectedCategory?.icon && Object.hasOwn(Ionicons.glyphMap, selectedCategory.icon)
      ? selectedCategory.icon as keyof typeof Ionicons.glyphMap : 'location-outline',
  } : null;
  const presentation = useMemo(() => ({
    selectedMarkerId: selected?.id ?? null, reducedMotion,
    padding: { top: topHeight + 24, bottom: overlayBottom + overlayHeight + 24 },
    attributionBottom: Math.max(bottomTabInset + 4, systemBottomInset + 56), surface: resident.card, text: resident.text,
    border: resident.border, fontFamily: fontFamily ?? 'sans-serif',
  }), [selected?.id, reducedMotion, topHeight, overlayBottom, overlayHeight, bottomTabInset, systemBottomInset, resident.card, resident.text, resident.border, fontFamily]);
  function clearSelection() { setSelectedId(null); }
  const controls = <View style={styles.controls}>
    <View style={[styles.pill, { backgroundColor: resident.card, borderColor: resident.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset map to barangay boundary" onPress={() => map.current?.fitBoundary()} style={styles.pillButton}>
        <Ionicons name="map-outline" size={18} color={resident.accentText} accessible={false} />
        <ThemedText style={[styles.controlLabel, { color: resident.accentText }]}>Maps</ThemedText>
      </Pressable>
      <View style={[styles.divider, { backgroundColor: resident.border }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Center map on your location" accessibilityState={{ busy: locatingMe, disabled: locatingMe }}
        disabled={locatingMe} onPress={() => void acquireLocation(true)} style={styles.pillButton}>
        {locatingMe ? <ActivityIndicator size="small" color={resident.accentText} /> : <Ionicons name="navigate-outline" size={18} color={resident.accentText} accessible={false} />}
        <ThemedText style={[styles.controlLabel, { color: resident.accentText }]}>You</ThemedText>
      </Pressable>
    </View>
    <View style={[styles.pill, { backgroundColor: resident.card, borderColor: resident.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => map.current?.zoomOut()} style={styles.zoom}><Ionicons name="remove" size={20} color={resident.text} accessible={false} /></Pressable>
      <View style={[styles.divider, { backgroundColor: resident.border }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => map.current?.zoomIn()} style={styles.zoom}><Ionicons name="add" size={20} color={resident.text} accessible={false} /></Pressable>
    </View>
  </View>;
  return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: resident.card }]}>
    {compactSearch ? null : <SegmentedControl segments={layers} activeKey={activeTab} variant="underline" compact onChange={tab => { setActiveTab(tab); clearSelection(); }} />}
    <View style={styles.mapArea} onLayout={event => { const height = event.nativeEvent.layout.height; setMapHeight(current => current === height ? current : height); }}>
      <View style={StyleSheet.absoluteFill} onTouchStart={() => setMapNavHidden(true)}>
      <MapView key={mapAttempt} ref={map} markers={markers} kindColors={kindColors} boundary={boundary}
        presentation={presentation} userLocation={userLocation ? { position: userLocation, accuracyMeters: accuracy, pending: false } : null}
        onMarkerTap={id => {
          setMapNavHidden(true);
          const marker = markers.find(item => item.id === id);
          if (!marker || !isMapPosition(marker.position)) return;
          setSelectedId(id); map.current?.flyTo({ ...marker.position, zoom: 17 });
        }} onBackgroundTap={() => { setMapNavHidden(true); clearSelection(); }} onMapReady={() => {
          setMapError(false);
          const target = selected?.position ?? userLocation;
          if (target) map.current?.flyTo({ ...target, zoom: 17 });
        }} onMapError={() => setMapError(true)} style={StyleSheet.absoluteFill} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={[styles.top, mapHeight > 0 && { maxHeight: Math.max(48, mapHeight - overlayBottom - 112) }]}
        contentContainerStyle={styles.topContent} onLayout={event => { const height = event.nativeEvent.layout.height; setTopHeight(current => current === height ? current : height); revealSearch.current(); }}>
        <View style={[styles.search, { backgroundColor: resident.card, borderColor: resident.border }]}>
          <Ionicons name="search-outline" size={20} color={resident.text} accessible={false} />
          <TextInput ref={incidentSearch} onFocus={() => revealSearch.current()} accessibilityLabel={activeTab === 'incidents' ? 'Search incidents' : 'Evacuation search unavailable'}
            style={[styles.searchInput, { color: resident.text, fontFamily }]} value={activeTab === 'incidents' ? searchQuery : ''}
            onChangeText={query => { setSearchQuery(query); clearSelection(); }} editable={activeTab === 'incidents'}
            placeholder={activeTab === 'incidents' ? 'Search locations...' : 'Incident search only'} placeholderTextColor={resident.muted} />
          {activeTab === 'incidents' ? <Pressable accessibilityRole="button" accessibilityLabel="Incident filters" accessibilityState={{ expanded: showFilters }}
            onPress={() => setShowFilters(value => !value)} style={[styles.filter, { borderColor: showFilters ? resident.accentText : resident.border, backgroundColor: showFilters ? resident.accentSoft : resident.card }]}>
            <Ionicons name="options-outline" size={18} color={showFilters ? resident.accentText : resident.text} accessible={false} />
          </Pressable> : null}
        </View>
        {activeTab === 'incidents' && showFilters ? categoriesLoading ? <ActivityIndicator accessibilityLabel="Loading incident categories" color={resident.accentText} />
          : <ScrollableChevronRow label="incident types" contentContainerStyle={styles.chips}>
            {categories.map(category => {
              const checked = activeFilters.includes(category.id);
              return <Pressable key={category.id} accessibilityRole="checkbox" accessibilityLabel={`${category.name} filter`} accessibilityState={{ checked }}
                onPress={() => { setActiveFilters(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id]); clearSelection(); }}
                style={[styles.chip, { backgroundColor: checked ? resident.text : resident.card, borderColor: checked ? resident.text : resident.border }]}>
                <View style={[styles.dot, { backgroundColor: /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : resident.accent }]} />
                <ThemedText style={[styles.chipLabel, { color: checked ? resident.card : resident.text }]}>{category.name}</ThemedText>
                {checked ? <Ionicons name="checkmark" size={14} color={resident.card} accessible={false} /> : null}
              </Pressable>;
            })}
          </ScrollableChevronRow> : null}
        <MapNotice message={activeTab === 'incidents' ? categoriesError : null} action="Retry categories" onPress={retryCategories} reducedMotion={reducedMotion} />
        {tooltipVisible ? <Animated.View style={[styles.notice, { backgroundColor: resident.warningSoft, borderColor: resident.border, opacity: tooltipOpacity,
          transform: reducedMotion ? [] : [{ translateY: tooltipOpacity.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
          <ThemedText style={[styles.noticeTitle, { color: resident.warning }]}>Location Permission Required</ThemedText>
          <ThemedText style={[styles.noticeText, { color: resident.text }]}>Allow location access to show your position and nearby incidents.</ThemedText>
          <View style={styles.noticeActions}>
            <Pressable accessibilityRole="button" accessibilityState={{ busy: locatingMe, disabled: locatingMe }} disabled={locatingMe}
              onPress={() => void acquireLocation(true)} style={styles.noticeAction}><ThemedText style={[styles.noticeActionText, { color: resident.accentText }]}>Set Location</ThemedText></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setTooltipDismissed(true)} style={styles.noticeAction}><ThemedText style={[styles.noticeActionText, { color: resident.muted }]}>Setup Later</ThemedText></Pressable>
          </View>
        </Animated.View> : null}
        <MapNotice message={locationError} action="Dismiss location message" dismissible onPress={() => setLocationError(null)} reducedMotion={reducedMotion} />
        <MapNotice message={mapError ? 'Map or map tiles could not load. Check your connection and retry.' : null} action="Retry map" onPress={() => { setMapError(false); setMapAttempt(value => value + 1); }} reducedMotion={reducedMotion} />
        <MapNotice message={error} action="Retry locations" onPress={refetch} reducedMotion={reducedMotion} />
        {activeTab === 'evacuation' && isOffline && markers.length > 0 ? <ThemedText style={[styles.offline, { color: resident.warning, backgroundColor: resident.warningSoft }]}>Showing saved evacuation centers</ThemedText> : null}
      </ScrollView>
      {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator accessibilityLabel="Loading locations" size="large" color={resident.accentText} /></View> : null}
      <Reanimated.View style={[styles.bottom, { bottom: navVisibleBottom }, overlayMotion]} onLayout={event => { const height = event.nativeEvent.layout.height; setOverlayHeight(current => current === height ? current : height); }}>
        <MapSelectionOverlay place={place} controls={controls} reducedMotion={reducedMotion} compact onClose={clearSelection}
          maxHeight={Math.max(76, mapHeight - topHeight - overlayBottom - 32)} />
        {!loading && !error && !place && markers.length === 0 ? <ThemedText style={[styles.empty, { color: resident.muted, backgroundColor: resident.card }]}>
          {activeTab === 'incidents' ? 'No incidents reported in this area' : 'No evacuation centers found'}
        </ThemedText> : null}
      </Reanimated.View>
      <Reanimated.View style={[styles.reveal, { bottom: revealVisibleBottom }, revealMotion]}>
        <Pressable accessibilityRole="button" accessibilityLabel={mapNavHidden ? 'Show bottom tabs' : 'Hide bottom tabs'}
          onPress={() => setMapNavHidden(!mapNavHidden)} style={[styles.revealButton, { backgroundColor: resident.card, borderColor: resident.border }]}>
          <Ionicons name={mapNavHidden ? 'chevron-up' : 'chevron-down'} size={20} color={resident.text} accessible={false} />
        </Pressable>
      </Reanimated.View>
    </View>
  </SafeAreaView>;
}

function MapNotice({ message, action, onPress, dismissible = false, reducedMotion }: {
  message: string | null; action: string; onPress: () => void; dismissible?: boolean; reducedMotion: boolean;
}) {
  const { resident } = useTheme();
  const [shown, setShown] = useState(message);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    if (message) setShown(message);
    const animation = Animated.timing(progress, { toValue: message ? 1 : 0, duration: reducedMotion ? 0 : message ? 180 : 120,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (active && finished && !message) setShown(null); });
    return () => { active = false; animation.stop(); };
  }, [message, reducedMotion, progress]);
  const content = message ?? shown;
  if (!content) return null;
  return <Animated.View pointerEvents={message ? 'auto' : 'none'} accessibilityElementsHidden={!message} importantForAccessibility={message ? 'auto' : 'no-hide-descendants'}
    style={[styles.notice, styles.noticeRow, { backgroundColor: resident.card, borderColor: resident.border, opacity: progress,
      transform: reducedMotion ? [] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
    <ThemedText accessibilityLiveRegion="polite" style={[styles.noticeText, styles.noticeCopy, { color: resident.danger }]}>{content}</ThemedText>
    <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress}
      style={({ pressed }) => [styles.noticeAction, dismissible ? styles.dismissNotice : styles.retryNotice, { backgroundColor: pressed ? resident.pressed : resident.card }]}>
      {dismissible ? <Ionicons name="close" size={18} color={resident.accentText} accessible={false} />
        : <ThemedText style={[styles.noticeActionText, { color: resident.accentText }]}>{action}</ThemedText>}
    </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, mapArea: { flex: 1 },
  top: { position: 'absolute', top: 8, left: 12, right: 12, flexGrow: 0 }, topContent: { gap: 6, paddingBottom: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingLeft: 12, paddingRight: 0, borderRadius: 24, borderWidth: 1, elevation: 4 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '500', paddingVertical: 8 },
  filter: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 6, paddingVertical: 0 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderWidth: 1, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 4 },
  chipLabel: { fontSize: 13, fontWeight: '600' }, dot: { width: 8, height: 8, borderRadius: 4 },
  notice: { borderRadius: 12, borderWidth: 1, padding: 8, gap: 2 }, noticeTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, noticeCopy: { flex: 1, minWidth: 0 },
  noticeText: { fontSize: 13, lineHeight: 18 }, noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noticeAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 10 },
  noticeActionText: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  dismissNotice: { width: 44, alignItems: 'center', flexShrink: 0 }, retryNotice: { maxWidth: '38%', flexShrink: 1 },
  bottom: { position: 'absolute', left: 12, right: 12, gap: 6 },
  reveal: { position: 'absolute', alignSelf: 'center' },
  revealButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 24, overflow: 'hidden', elevation: 4 },
  pillButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  controlLabel: { fontSize: 14, fontWeight: '700' }, zoom: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  divider: { width: 1, alignSelf: 'stretch' }, loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  empty: { alignSelf: 'flex-start', fontSize: 12.5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }, offline: { padding: 10, borderRadius: 12, fontSize: 12.5 },
});
