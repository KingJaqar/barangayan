/* eslint-disable react-hooks/immutability */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  runOnJS,
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { FamilyContent } from '@/components/family-content';
import { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';
import { useEmergencyAnnouncements, type EmergencyAnnouncement } from '@/hooks/use-emergency-announcements';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useAmpid1Boundary } from '@/hooks/use-ampid1-boundary';
import { EmergencyAccordion } from '@/components/emergency-accordion';
import { HotlineRow } from '@/components/hotline-row';
import { EvacuationCenterCard } from '@/components/evacuation-center-card';
import { HorizontalCenterPicker, type CenterPickerItem } from '@/components/horizontal-center-picker';
import { CenterDetailCard } from '@/components/center-detail-card';
import { Collapsible } from '@/components/ui/collapsible';
import { MapView, AMPID_I_SAN_MATEO_CENTER } from '@/components/map-view';
import { SegmentedControl } from '@/components/segmented-control';
import { QrGuideContent } from '@/components/qr-guide-content';
import type { AccordionItem } from '@/components/emergency-accordion';
import type { LatLng, MapMarker } from '@barangayan/shared';

type EmergencyInfoTab = 'hub' | 'centers' | 'scan' | 'family' | 'alerts';

const TABS: { key: EmergencyInfoTab; label: string }[] = [
  { key: 'hub', label: 'Hub' },
  { key: 'centers', label: 'Centers' },
  { key: 'scan', label: 'Scan' },
  { key: 'family', label: 'Family' },
  { key: 'alerts', label: 'Alerts' },
];

function ShimmerSkeleton({
  theme,
  height = 12,
  width = '100%',
  style,
  borderRadius = 6,
}: {
  theme: ReturnType<typeof useTheme>;
  height?: number;
  width?: number | string;
  style?: ViewStyle;
  borderRadius?: number;
}) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.7,
  }));

  return (
    <Animated.View
      style={[
        { height, width: width as any, backgroundColor: theme.backgroundSelected, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export default function EmergencyInfoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;

  const { guidelines, isLoading: guidelinesLoading } = useEmergencyGuidelines(barangayId);
  const { hotlines, isLoading: hotlinesLoading } = useEmergencyHotlines(barangayId);
  const { items: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useEmergencyAnnouncements();
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const { centers, isLoading: centersLoading, error: centersError, refetch: refetchCenters } = useEvacuationCenters({ barangayId, userPosition });

  const [tab, setTab] = useState<EmergencyInfoTab>('hub');
  const [centersView, setCentersView] = useState<'list' | 'map'>('list');
  const [nearestFirst, setNearestFirst] = useState(true);

  const tabTranslateX = useSharedValue(0);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabWidth = tabBarWidth > 2 * Spacing.three ? (tabBarWidth - 2 * Spacing.three) / TABS.length : 0;

  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === tab);
    if (tabWidth > 0) {
      tabTranslateX.value = withSpring(index * tabWidth, { damping: 18, stiffness: 150 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tabWidth]);

  const tabPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabTranslateX.value }],
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setUserPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // location unavailable — centers will fall back to alphabetical order
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(next: EmergencyInfoTab) {
    setTab(next);
  }

  const isHub = tab === 'hub';
  const isCenters = tab === 'centers';
  const isScan = tab === 'scan';
  const isFamily = tab === 'family';
  const isAlerts = tab === 'alerts';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
        <View style={[styles.root, { backgroundColor: theme.background }]}>
          <View style={[styles.topHeader, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
          hitSlop={Spacing.two}
          onPress={() => router.back()}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={theme.onPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Emergency & DRRM Info
          </ThemedText>
        </View>
      </View>

      <View style={styles.tabBar} onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}>
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.tabPill,
              { width: tabWidth, backgroundColor: theme.primary },
              tabPillStyle,
            ]}
          />
        )}
        {TABS.map((option) => {
          const isActive = option.key === tab;
          return (
            <Pressable
              key={option.key}
              onPress={() => handleChange(option.key)}
              style={styles.tabPressable}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <View style={styles.tabItem}>
                <ThemedText
                  type={isActive ? 'smallBold' : 'small'}
                  themeColor={isActive ? undefined : 'textSecondary'}
                  style={isActive ? { color: theme.primary } : undefined}>
                  {option.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {isCenters && centersView === 'map' ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.mapScreen}>
          <CentersContent
            theme={theme}
            centers={centers}
            isLoading={centersLoading}
            error={centersError}
            refetch={refetchCenters}
            view={centersView}
            onViewChange={setCentersView}
            nearestFirst={nearestFirst}
            onNearestToggle={setNearestFirst}
            userPosition={userPosition}
          />
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.contentContainer}>
          <ScrollView
            scrollEnabled={!(isCenters && centersView === 'map')}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.six }]}
            showsVerticalScrollIndicator={false}>
            {isScan && <QrGuideContent />}
            {isHub && (
              <HubContent
                theme={theme}
                guidelines={guidelines}
                hotlines={hotlines}
                isLoading={guidelinesLoading || hotlinesLoading}
              />
            )}
            {isCenters && (
              <CentersContent
                theme={theme}
                centers={centers}
                isLoading={centersLoading}
                error={centersError}
                refetch={refetchCenters}
                view={centersView}
                onViewChange={setCentersView}
                nearestFirst={nearestFirst}
                onNearestToggle={setNearestFirst}
                userPosition={userPosition}
              />
            )}
            {isFamily && <FamilyContent />}
            {isAlerts && (
              <AlertsContent
                theme={theme}
                alerts={alerts}
                isLoading={alertsLoading}
                error={alertsError}
                refetch={refetchAlerts}
              />
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OfflineBadge({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.offlineBadge, { borderColor: theme.primary }]}>
      <Ionicons name="wifi-outline" size={10} color={theme.primary} />
      <ThemedText style={[styles.offlineText, { color: theme.primary }]}>Offline</ThemedText>
    </View>
  );
}

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
    scale.value = withSpring(0.97, { damping: 18, stiffness: 300 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 18, stiffness: 300 });
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

function HubContent({
  theme,
  guidelines,
  hotlines,
  isLoading,
}: {
  theme: ReturnType<typeof useTheme>;
  guidelines: ReturnType<typeof useEmergencyGuidelines>['guidelines'];
  hotlines: ReturnType<typeof useEmergencyHotlines>['hotlines'];
  isLoading: boolean;
}) {
  const accordionItems: AccordionItem[] = guidelines.map((g) => ({
    title: g.title,
    icon: g.icon,
    iconColor: g.icon_color,
    iconBg: g.icon_bg,
    content: (g.content as string[]) ?? [],
  }));

  return (
    <View style={styles.hubContent}>
      <View style={styles.hubHeader}>
        <ThemedText type="smallBold" style={[styles.hubTitle, { color: theme.primary }]}>
          Emergency Info
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hubSubtitle}>
          Be Prepared
        </ThemedText>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <ThemedText type="smallBold" style={styles.sectionCardTitle}>
            Disaster Preparedness Guidelines
          </ThemedText>
          <OfflineBadge theme={theme} />
        </View>
        <View style={styles.accordionWrapper}>
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <ShimmerSkeleton theme={theme} width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 8, marginLeft: 12 }}>
                    <ShimmerSkeleton theme={theme} width="80%" height={14} />
                    <ShimmerSkeleton theme={theme} width="55%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : accordionItems.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ThemedText themeColor="textSecondary">No guidelines available.</ThemedText>
            </View>
          ) : (
            <EmergencyAccordion items={accordionItems} />
          )}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <ThemedText type="smallBold" style={styles.sectionCardTitle}>
            Emergency Hotlines
          </ThemedText>
          <OfflineBadge theme={theme} />
        </View>
        <View style={styles.hotlinesWrapper}>
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <ShimmerSkeleton theme={theme} width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 8, marginLeft: 12 }}>
                    <ShimmerSkeleton theme={theme} width="60%" height={14} />
                    <ShimmerSkeleton theme={theme} width="40%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : hotlines.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ThemedText themeColor="textSecondary">No hotlines available.</ThemedText>
            </View>
          ) : (
            hotlines.map((h) => (
              <HotlineRow
                key={h.id}
                name={h.title}
                numbers={h.content as { label: string; number: string }[]}
                icon={h.icon}
                iconColor={h.icon_color}
                iconBg={h.icon_bg}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

function CentersContent({
  theme,
  centers,
  isLoading,
  error,
  refetch,
  view,
  onViewChange,
  nearestFirst,
  onNearestToggle,
  userPosition,
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
}) {
  const boundary = useAmpid1Boundary();
  const [searchQuery, setSearchQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [focusCenter, setFocusCenter] = useState<LatLng | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [boundaryRefitKey] = useState(0);

  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(40);

  const displayCenters = nearestFirst && userPosition
    ? [...centers].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    : centers;

  const filteredCenters = searchQuery.trim().length > 0
    ? displayCenters.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : displayCenters;

  const pickerItems: CenterPickerItem[] = filteredCenters.map((c) => ({
    id: c.id,
    name: c.name,
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
  const mapFocusPosition = selectedCenter
    ? { lat: selectedCenter.position.lat, lng: selectedCenter.position.lng, zoom: 17 }
    : undefined;

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const handleMarkerTap = (markerId: string) => {
    const center = centers.find((c) => c.id === markerId);
    if (center) {
      selectCenter(center);
    }
  };

  const selectCenter = (center: ReturnType<typeof useEvacuationCenters>['centers'][number]) => {
    setSelectedCenterId(center.id);
    setFocusCenter({ lat: center.position.lat, lng: center.position.lng });
    cardOpacity.value = withTiming(0, { duration: 150 }, () => {
      cardOpacity.value = withTiming(1, { duration: 300 });
      cardTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    });
  };

  const handleShowAll = () => {
    setSelectedCenterId(null);
    setFocusCenter(null);
    setSearchQuery('');
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardTranslateY.value = withSpring(40, { damping: 20, stiffness: 200 });
  };

  const handleResetMap = () => {
    setFocusCenter({ lat: AMPID_I_SAN_MATEO_CENTER.lat, lng: AMPID_I_SAN_MATEO_CENTER.lng });
  };

  const handleLocateMe = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Enable location access in your device settings to center the map on your position.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setFocusCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert('Unable to get your location', 'Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const centersViewOpacity = useSharedValue(1);

  const centersViewStyle = useAnimatedStyle(() => ({
    opacity: centersViewOpacity.value,
  }));

  useEffect(() => {
    centersViewOpacity.value = withTiming(1, { duration: 200 });
  }, [view, centersViewOpacity]);

  return (
    <View style={[styles.centersContent, view === 'map' && styles.centersContentMap]}>
      <View style={styles.sectionControls}>
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

      <View style={styles.sectionToolbar}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.showingText}>
          Showing {centers.length} Locations
        </ThemedText>
        <Pressable
          onPress={() => onNearestToggle(!nearestFirst)}
          style={[
            styles.nearestButton,
            nearestFirst && { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
          ]}>
          <Ionicons name="options-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.nearestText}>
            Nearest
          </ThemedText>
        </Pressable>
      </View>

      <Animated.View style={centersViewStyle}>
        {view === 'map' ? (
          <View style={styles.sectionMap}>
            <View style={styles.centersMapContainer}>
            <MapView
              markers={evacuationMarkers}
              center={mapCenter}
              focusPosition={mapFocusPosition}
              boundary={boundary}
              boundaryRefitKey={boundaryRefitKey}
              kindColors={{ evacuation: '#F59E0B' }}
              style={styles.centersMap}
              onMarkerTap={handleMarkerTap}
            />

            <View style={styles.mapSearchBar}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.mapSearchIcon} />
              <TextInput
                style={styles.mapSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search evacuation centers..."
                placeholderTextColor="#9CA3AF"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.mapResetFab}
              onPress={handleResetMap}
              accessibilityLabel="Reset map to Ampid I">
              <Ionicons name="map" size={18} color={theme.primary} />
              <ThemedText style={[styles.mapResetFabText, { color: theme.primary }]}>Maps</ThemedText>
            </Pressable>

            <Pressable
              style={styles.mapYouFab}
              onPress={handleLocateMe}
              accessibilityLabel="Center map on your location"
              disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="navigate" size={16} color={theme.primary} />
              )}
              <ThemedText style={[styles.mapResetFabText, { color: theme.primary }]}>You</ThemedText>
            </Pressable>

            {isLoading && (
              <View style={styles.mapOverlayCenter} pointerEvents="none">
                <View style={styles.mapSkeletonCard}>
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
              <View style={styles.mapOverlayCenter} pointerEvents="none">
                <View style={styles.mapEmptyCard}>
                  <Ionicons name="home-outline" size={28} color="#9CA3AF" />
                  <ThemedText style={styles.mapEmptyText}>
                    {searchQuery.trim().length > 0 ? 'No matching centers found' : 'No evacuation centers found'}
                  </ThemedText>
                </View>
              </View>
            )}

          </View>

          <View style={styles.mapControlsContainer}>
            <Collapsible title="Evacuation Centers" defaultOpen>
              {selectedCenter ? (
                <Animated.View style={cardAnimatedStyle}>
                  <CenterDetailCard
                    name={selectedCenter.name}
                    address={selectedCenter.address ?? 'No address'}
                    distanceKm={(selectedCenter.distanceMeters ?? 0) / 1000}
                    walkingTimeMins={selectedCenter.estimatedMinutes ?? 0}
                    occupancyPercent={Math.round((selectedCenter.current_occupancy / (selectedCenter.capacity ?? 1)) * 100)}
                  />
                </Animated.View>
              ) : null}

              <View style={styles.pickerWrapper}>
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
            </Collapsible>
          </View>
        </View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition.duration(200)}>
            <View style={styles.sectionList}>
              {isLoading ? (
                <View style={styles.skeletonList}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.skeletonCard}>
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
          </Animated.View>
        )}
      </Animated.View>
    </View>
  )
}

function AlertsContent({
  theme,
  alerts,
  isLoading,
  error,
  refetch,
  onNavigate,
}: {
  theme: ReturnType<typeof useTheme>;
  alerts: EmergencyAnnouncement[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  onNavigate?: (path: string) => void;
}) {
  type FilterMode = 'all' | 'today' | 'lastWeek' | 'lastMonth' | 'lastYear';

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [monthInput, setMonthInput] = useState('');
  const [dayInput, setDayInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ field: string; message: string; visible: boolean }>({
    field: '',
    message: '',
    visible: false,
  });

  const tooltipOpacity = useSharedValue(0);
  const tooltipTranslateY = useSharedValue(-6);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
    };
  }, []);

  const isSameDay = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  };

  const parseNumber = (value: string) => {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  };

  const parseMonthName = (value: string): number | null => {
    const monthMap: Record<string, number> = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    const normalized = value.toLowerCase().trim();
    return monthMap[normalized] ?? null;
  };

  const showTooltip = (field: string, message: string) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    setTooltip({ field, message, visible: true });
    tooltipTranslateY.value = withSpring(0, { damping: 20, stiffness: 150 });
    tooltipOpacity.value = withTiming(1, { duration: 200 });
    tooltipTimeout.current = setTimeout(() => {
      tooltipTranslateY.value = withSpring(-6, { damping: 20, stiffness: 150 });
      tooltipOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setTooltip)({ field: '', message: '', visible: false });
        }
      });
    }, 2500);
  };

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ translateY: tooltipTranslateY.value }],
  }));

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const publishedDate = new Date(alert.published_at);
      const now = new Date();

      const month = monthInput.trim() ? parseMonthName(monthInput) : null;
      const day = parseNumber(dayInput);
      const year = parseNumber(yearInput);

      if (month !== null && publishedDate.getMonth() + 1 !== month) return false;
      if (day !== null && publishedDate.getDate() !== day) return false;
      if (year !== null && publishedDate.getFullYear() !== year) return false;

      if (filterMode === 'today') {
        return isSameDay(publishedDate, now);
      }
      if (filterMode === 'lastWeek') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return publishedDate >= weekAgo;
      }
      if (filterMode === 'lastMonth') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return publishedDate >= monthAgo;
      }
      if (filterMode === 'lastYear') {
        const yearAgo = new Date(now);
        yearAgo.setDate(yearAgo.getDate() - 365);
        return publishedDate >= yearAgo;
      }

      return true;
    });
  }, [alerts, filterMode, monthInput, dayInput, yearInput]);

  const formatAlertDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return {
      date: `${month} ${day}, ${year}`,
      time: `${hours}:${minutes}:${seconds} ${ampm}`,
    };
  };

  return (
    <View style={styles.alertsContent}>
      <View style={styles.alertSectionHeader}>
        <ThemedText style={styles.alertSectionHeaderText}>Emergency Alerts / Notifications</ThemedText>
      </View>

      <View style={styles.alertFilterContainer}>
        {isLoading ? (
          <View style={styles.skeletonFilter}>
            <ShimmerSkeleton theme={theme} width="100%" height={36} borderRadius={18} />
            <View style={{ gap: 12, marginTop: 12 }}>
              <ShimmerSkeleton theme={theme} width="100%" height={44} borderRadius={10} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ShimmerSkeleton theme={theme} width="33%" height={44} borderRadius={10} />
                <ShimmerSkeleton theme={theme} width="33%" height={44} borderRadius={10} />
                <ShimmerSkeleton theme={theme} width="33%" height={44} borderRadius={10} />
              </View>
            </View>
          </View>
        ) : (
          <>
            <SegmentedControl
              segments={[
                { key: 'all', label: 'All' },
                { key: 'today', label: 'Today' },
                { key: 'lastWeek', label: 'Last Week' },
                { key: 'lastMonth', label: 'Last Month' },
                { key: 'lastYear', label: 'Last Year' },
              ]}
              activeKey={filterMode}
              onChange={(key) => setFilterMode(key as FilterMode)}
              activeColor="accentRed"
            />
            <View style={styles.alertFilterCard}>
              <View style={styles.alertFilterRow}>
                <View style={styles.alertFilterInputWrapper}>
                  <ThemedText type="small" style={styles.alertFilterLabel}>Month</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="calendar-outline" size={16} color={focusedField === 'month' ? theme.primary : '#94A3B8'} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        focusedField === 'month' && { borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
                      ]}
                      value={monthInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^a-zA-Z]/g, '');
                        setMonthInput(cleaned);
                        if (text.length > 0 && cleaned.length === 0) {
                          showTooltip('month', 'Please enter letters only (e.g. January)');
                        }
                      }}
                      placeholder="e.g. January"
                      placeholderTextColor="#94A3B8"
                      onFocus={() => setFocusedField('month')}
                      onBlur={() => setFocusedField(null)}
                      accessibilityLabel="Filter by Month"
                      accessibilityHint="Enter month name using letters only"
                      accessibilityRole="text"
                    />
                    {tooltip.visible && tooltip.field === 'month' && (
                      <Animated.View
                        accessibilityLiveRegion="polite"
                        style={[
                          styles.alertTooltip,
                          tooltipAnimatedStyle,
                        ]}>
                        <ThemedText type="small" style={styles.alertTooltipText}>{tooltip.message}</ThemedText>
                      </Animated.View>
                    )}
                  </View>
                </View>
                <View style={styles.alertFilterInputWrapper}>
                  <ThemedText type="small" style={styles.alertFilterLabel}>Day</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="today-outline" size={16} color={focusedField === 'day' ? theme.primary : '#94A3B8'} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        focusedField === 'day' && { borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
                      ]}
                      value={dayInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setDayInput(cleaned);
                        if (text.length > 0 && cleaned.length === 0) {
                          showTooltip('day', 'Please enter numbers only (1-31)');
                        }
                      }}
                      placeholder="e.g. 15"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      onFocus={() => setFocusedField('day')}
                      onBlur={() => setFocusedField(null)}
                      accessibilityLabel="Filter by Day"
                      accessibilityHint="Enter day using numbers only"
                      accessibilityRole="text"
                    />
                    {tooltip.visible && tooltip.field === 'day' && (
                      <Animated.View
                        accessibilityLiveRegion="polite"
                        style={[
                          styles.alertTooltip,
                          tooltipAnimatedStyle,
                        ]}>
                        <ThemedText type="small" style={styles.alertTooltipText}>{tooltip.message}</ThemedText>
                      </Animated.View>
                    )}
                  </View>
                </View>
                <View style={styles.alertFilterInputWrapper}>
                  <ThemedText type="small" style={styles.alertFilterLabel}>Year</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="time-outline" size={16} color={focusedField === 'year' ? theme.primary : '#94A3B8'} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        focusedField === 'year' && { borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
                      ]}
                      value={yearInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setYearInput(cleaned);
                        if (text.length > 0 && cleaned.length === 0) {
                          showTooltip('year', 'Please enter numbers only (e.g. 2026)');
                        }
                      }}
                      placeholder="e.g. 2026"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      onFocus={() => setFocusedField('year')}
                      onBlur={() => setFocusedField(null)}
                      accessibilityLabel="Filter by Year"
                      accessibilityHint="Enter year using numbers only"
                      accessibilityRole="text"
                    />
                    {tooltip.visible && tooltip.field === 'year' && (
                      <Animated.View
                        accessibilityLiveRegion="polite"
                        style={[
                          styles.alertTooltip,
                          tooltipAnimatedStyle,
                        ]}>
                        <ThemedText type="small" style={styles.alertTooltipText}>{tooltip.message}</ThemedText>
                      </Animated.View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {isLoading ? (
        <View style={styles.skeletonAlerts}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonAlertCard}>
              <ShimmerSkeleton theme={theme} width={44} height={44} borderRadius={22} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ShimmerSkeleton theme={theme} width="90%" height={16} />
                <ShimmerSkeleton theme={theme} width="70%" height={12} style={{ marginTop: 6 }} />
                <ShimmerSkeleton theme={theme} width="50%" height={12} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <ThemedText themeColor="textSecondary">Unable to load alerts.</ThemedText>
          <Pressable onPress={refetch} style={styles.retryButton}>
            <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ThemedText themeColor="textSecondary">No emergency alerts at this time.</ThemedText>
        </View>
      ) : filteredAlerts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ThemedText themeColor="textSecondary">No emergency alerts match your filter.</ThemedText>
        </View>
      ) : (
        filteredAlerts.map((alert) => {
          const { date, time } = formatAlertDateTime(alert.published_at);
          return (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                {
                  backgroundColor: '#FEE2E2',
                  borderColor: '#FECACA',
                },
              ]}>
              <View style={[styles.alertIconCircle, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
              </View>

              <View style={styles.alertBody}>
                <View style={styles.alertTopRow}>
                  <View style={[styles.alertBadge, { backgroundColor: '#EF4444' }]}>
                    <ThemedText style={[styles.alertBadgeText, { color: '#FFFFFF' }]}>
                      EMERGENCY
                    </ThemedText>
                  </View>
                  <View style={styles.alertTimestampContainer}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.alertTimestamp}>
                      {date}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.alertTimestamp}>
                      {time}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText type="smallBold" style={styles.alertTitle}>
                  {alert.title}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary" style={styles.alertDescription}>
                  {alert.body}
                </ThemedText>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  topHeader: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  tabPill: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderBottomLeftRadius: 1.5,
    borderBottomRightRadius: 1.5,
    left: Spacing.three,
  },
  tabPressable: {
    flex: 1,
    zIndex: 1,
  },
  tabItem: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  mapScreen: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  hubContent: {
    gap: Spacing.four,
  },
  hubHeader: {
    gap: Spacing.one,
  },
  hubTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  hubSubtitle: {
    fontSize: 14,
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
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
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '600',
  },
  accordionWrapper: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hotlinesWrapper: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  skeletonContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centersContent: {
    gap: Spacing.two,
  },
  centersContentMap: {
    flex: 1,
    minHeight: 0,
  },
  sectionControls: {},
  sectionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionMap: {
    gap: Spacing.two,
    flex: 1,
    minHeight: 0,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  centersMapContainer: {
    flex: 1,
    minHeight: 240,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  centersMap: {
    flex: 1,
  },
  centersList: {
    gap: Spacing.three,
  },
  mapSearchBar: {
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
  mapSearchIcon: {
    marginRight: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  mapResetFab: {
    position: 'absolute',
    left: 10,
    top: 66,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
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
  mapYouFab: {
    position: 'absolute',
    left: 10,
    top: 110,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
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
  mapControlsContainer: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    overflow: 'hidden',
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
  pickerWrapper: {},
  mapResetFabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapOverlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  mapSkeletonCard: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  mapEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#6B7280',
  },
  centersToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  showingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  nearestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  nearestText: {
    fontSize: 13,
    lineHeight: 18,
  },
  centerCardSeparator: {
    marginBottom: Spacing.three,
  },
  alertsContent: {
    gap: Spacing.three,
  },
  alertFilterContainer: {
    gap: Spacing.three,
  },
  skeletonFilter: {
    gap: 12,
  },
  skeletonAlerts: {
    gap: Spacing.three,
  },
  skeletonAlertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: Spacing.three,
  },
  alertFilterCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  alertFilterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  alertFilterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.half,
  },
  alertFilterInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  alertInputContainer: {
    flex: 1,
    position: 'relative',
  },
  alertFilterInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: Spacing.two,
    fontSize: 14,
    color: '#0F172A',
  },
  alertFilterIcon: {
    position: 'absolute',
    left: Spacing.two,
    top: 14,
    zIndex: 1,
  },
  alertTooltip: {
    position: 'absolute',
    top: -36,
    left: 0,
    right: 0,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  alertTooltipText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  alertTimestampContainer: {
    alignItems: 'flex-end',
  },
  alertSectionHeader: {
    backgroundColor: '#8B0000',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  alertSectionHeaderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.three,
  },
  alertIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  alertBody: {
    flex: 1,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertTimestamp: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginTop: Spacing.two,
  },
  alertDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    marginTop: Spacing.two,
  },
  alertLinkPressable: {
    marginTop: Spacing.three,
  },
  alertLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: Spacing.two,
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
