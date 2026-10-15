import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
} from 'react-native-reanimated';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/hooks/use-auth';
import { GuestAuthCallout } from '@/components/guest-auth-callout';
import { FamilyContent } from '@/components/family-content';
import { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';
import { useEmergencyAnnouncements, type EmergencyAnnouncement } from '@/hooks/use-emergency-announcements';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { EmergencyAccordion } from '@/components/emergency-accordion';
import { HotlineRow } from '@/components/hotline-row';
import { CentersContent } from '@/components/evacuation-centers-panel';
import { ShimmerSkeleton } from '@/components/shimmer-skeleton';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { SegmentedControl } from '@/components/segmented-control';
import { QrGuideContent } from '@/components/qr-guide-content';
import type { AccordionItem } from '@/components/emergency-accordion';
import type { LatLng } from '@barangayan/shared';

type EmergencyInfoTab = 'hub' | 'centers' | 'scan' | 'family' | 'alerts';

const TABS: { key: EmergencyInfoTab; label: string }[] = [
  { key: 'hub', label: 'Hub' },
  { key: 'centers', label: 'Centers' },
  { key: 'scan', label: 'Scan' },
  { key: 'family', label: 'Family' },
  { key: 'alerts', label: 'Alerts' },
];

function isEmergencyInfoTab(value: unknown): value is EmergencyInfoTab {
  return TABS.some((t) => t.key === value);
}

export default function EmergencyInfoScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { session } = useAuth();
  const isGuest = !session;
  const barangayId = profile?.barangay_id ?? null;

  const { guidelines, isLoading: guidelinesLoading } = useEmergencyGuidelines(barangayId);
  const { hotlines, isLoading: hotlinesLoading } = useEmergencyHotlines(barangayId);
  const { items: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useEmergencyAnnouncements();
  const [tab, setTab] = useState<EmergencyInfoTab>(
    isEmergencyInfoTab(tabParam) ? tabParam : 'hub',
  );

  // The confirmed origin (never the map viewport) is the position used for sorting and
  // routing. Acquisition runs only while the Centers tab is shown.
  const location = useDeviceLocation(tab === 'centers');
  const origin = location.state.origin;
  const userPosition = useMemo<LatLng | null>(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin]);
  const { centers, isLoading: centersLoading, error: centersError, refetch: refetchCenters } = useEvacuationCenters({ barangayId, userPosition });

  // Sync when navigated back into this screen with a different `tab` param
  // (e.g. tapping a different Maps DRRM card while this screen stays mounted).
  useEffect(() => {
    if (isEmergencyInfoTab(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);
  const [centersView, setCentersView] = useState<'list' | 'map'>('list');
  const [nearestFirst, setNearestFirst] = useState(true);

  const tabTranslateX = useSharedValue(0);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabWidth = tabBarWidth > 2 * Spacing.three ? (tabBarWidth - 2 * Spacing.three) / TABS.length : 0;

  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === tab);
    if (tabWidth > 0) {
      // Critically damped — same as the List/Map toggle, zero overshoot/bounce.
      tabTranslateX.value = withSpring(index * tabWidth, {
        damping: 26,
        stiffness: 220,
        mass: 0.8,
        overshootClamping: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tabWidth]);

  const tabPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabTranslateX.value }],
  }));

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

      {isCenters ? (
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
            location={location}
            onFitAll={() => {}}
          />
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.contentContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.six }]}
            showsVerticalScrollIndicator={false}>
            {isScan && (isGuest ? (
              <GuestLoginRequired
                icon="qr-code-outline"
                message="Log in or register an account to use QR scanning and check-in."
              />
            ) : (
              <QrGuideContent />
            ))}
            {isHub && (
              <HubContent
                theme={theme}
                guidelines={guidelines}
                hotlines={hotlines}
                isLoading={guidelinesLoading || hotlinesLoading}
              />
            )}
            {isFamily && (isGuest ? (
              <GuestLoginRequired
                message="Log in or register an account to manage your household members and family check-in."
              />
            ) : (
              <FamilyContent />
            ))}
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

function GuestLoginRequired({ message, icon }: { message: string; icon?: React.ComponentProps<typeof GuestAuthCallout>['icon'] }) {
  return (
    <View style={{ minHeight: 420 }}>
      <GuestAuthCallout tabName="this feature" message={message} icon={icon} />
    </View>
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

      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
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

      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
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
  const [showCustomFilter, setShowCustomFilter] = useState(false);
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
    tooltipTranslateY.value = withTiming(0, { duration: 200 });
    tooltipOpacity.value = withTiming(1, { duration: 200 });
    tooltipTimeout.current = setTimeout(() => {
      tooltipTranslateY.value = withTiming(-6, { duration: 200 });
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${month} ${day}, ${year} · ${hours}:${minutes} ${ampm}`;
  };

  const activeCustomFilterCount = [monthInput, dayInput, yearInput].filter((v) => v.trim().length > 0).length;

  return (
    <View style={styles.alertsContent}>
      <View style={styles.alertSectionHeader}>
        <View style={[styles.alertHeaderIcon, { backgroundColor: theme.accentRed }]}>
          <Ionicons name="warning" size={14} color="#FFFFFF" />
        </View>
        <ThemedText type="smallBold" style={styles.alertSectionHeaderText}>
          Emergency Alerts
        </ThemedText>
        {!isLoading && (
          <View style={[styles.alertCountPill, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.alertCountPillText}>
              {filteredAlerts.length}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.alertFilterContainer}>
        {isLoading ? (
          <View style={styles.skeletonFilter}>
            <ShimmerSkeleton theme={theme} width="100%" height={32} borderRadius={16} />
            <ShimmerSkeleton theme={theme} width="45%" height={18} style={{ marginTop: 10 }} />
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

            <Pressable
              onPress={() => setShowCustomFilter((prev) => !prev)}
              style={styles.customFilterToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCustomFilter }}
              accessibilityLabel="Filter by specific date"
              hitSlop={Spacing.one}>
              <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.customFilterToggleText}>
                Filter by specific date
              </ThemedText>
              {activeCustomFilterCount > 0 && (
                <View style={[styles.alertCountPill, { backgroundColor: theme.accentRed }]}>
                  <ThemedText type="small" style={[styles.alertCountPillText, { color: '#FFFFFF' }]}>
                    {activeCustomFilterCount}
                  </ThemedText>
                </View>
              )}
              <Ionicons
                name="chevron-down"
                size={16}
                color={theme.textSecondary}
                style={showCustomFilter && styles.customFilterChevronOpen}
              />
            </Pressable>

            {showCustomFilter && (
            <View style={[styles.alertFilterCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.alertFilterRow}>
                <View style={styles.alertFilterInputWrapper}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.alertFilterLabel}>Month</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="calendar-outline" size={16} color={focusedField === 'month' ? theme.primary : theme.textSecondary} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
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
                      placeholderTextColor={theme.textSecondary}
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
                  <ThemedText type="small" themeColor="textSecondary" style={styles.alertFilterLabel}>Day</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="today-outline" size={16} color={focusedField === 'day' ? theme.primary : theme.textSecondary} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
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
                      placeholderTextColor={theme.textSecondary}
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
                  <ThemedText type="small" themeColor="textSecondary" style={styles.alertFilterLabel}>Year</ThemedText>
                  <View style={styles.alertInputContainer}>
                    <Ionicons name="time-outline" size={16} color={focusedField === 'year' ? theme.primary : theme.textSecondary} style={styles.alertFilterIcon} />
                    <TextInput
                      style={[
                        styles.alertFilterInput,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
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
                      placeholderTextColor={theme.textSecondary}
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
            )}
          </>
        )}
      </View>

      {!isLoading && !error && alerts.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.alertsSummaryText}>
          Showing {filteredAlerts.length} of {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
        </ThemedText>
      )}

      {isLoading ? (
        <View style={styles.skeletonAlerts}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeletonAlertCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ShimmerSkeleton theme={theme} width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ShimmerSkeleton theme={theme} width="90%" height={14} />
                <ShimmerSkeleton theme={theme} width="70%" height={11} style={{ marginTop: 6 }} />
                <ShimmerSkeleton theme={theme} width="50%" height={11} style={{ marginTop: 4 }} />
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
        filteredAlerts.map((alert) => (
          <View
            key={alert.id}
            style={[
              styles.alertCard,
              {
                backgroundColor: '#FEE2E2',
                borderColor: '#FECACA',
              },
            ]}>
            <View style={styles.alertTopRow}>
              <View style={styles.alertTopRowLeft}>
                <View style={[styles.alertIconCircle, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
                </View>
                <View style={[styles.alertBadge, { backgroundColor: '#EF4444' }]}>
                  <ThemedText style={[styles.alertBadgeText, { color: '#FFFFFF' }]}>
                    EMERGENCY
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={styles.alertTimestamp}>
                {formatAlertDateTime(alert.published_at)}
              </ThemedText>
            </View>

            <ThemedText type="smallBold" style={styles.alertTitle}>
              {alert.title}
            </ThemedText>

            <ThemedText type="small" style={styles.alertDescription}>
              {alert.body}
            </ThemedText>
          </View>
        ))
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
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
    borderWidth: 1,
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
  alertsContent: {
    gap: Spacing.two,
  },
  alertFilterContainer: {
    gap: Spacing.two,
  },
  skeletonFilter: {
    gap: 4,
  },
  skeletonAlerts: {
    gap: Spacing.two,
  },
  skeletonAlertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    gap: Spacing.two,
  },
  customFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  customFilterToggleText: {
    fontSize: 13,
  },
  customFilterChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  alertFilterCard: {
    borderRadius: 14,
    padding: Spacing.two,
    borderWidth: 1,
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
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
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
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 32,
    paddingVertical: Spacing.one,
    fontSize: 13,
  },
  alertFilterIcon: {
    position: 'absolute',
    left: Spacing.two,
    top: 11,
    zIndex: 1,
  },
  alertTooltip: {
    position: 'absolute',
    top: -34,
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
  alertSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  alertHeaderIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertSectionHeaderText: {
    flex: 1,
    fontSize: 15,
  },
  alertCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  alertsSummaryText: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertCard: {
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  alertIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.one,
    rowGap: 4,
  },
  alertTopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  alertBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertTimestamp: {
    fontSize: 11,
    lineHeight: 15,
    color: '#7F1D1D',
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  alertDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  retryButton: {
    marginTop: Spacing.two,
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
