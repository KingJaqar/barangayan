import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useIsFocused, useLocalSearchParams } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/hooks/use-auth';
import { GuestAuthCallout } from '@/components/guest-auth-callout';
import { FamilyContent } from '@/components/family-content';
import { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';
import { useEmergencyAnnouncements } from '@/hooks/use-emergency-announcements';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { HubContent } from '@/components/drrm/hub-content';
import { AlertsContent } from '@/components/drrm/alerts-content';
import { CentersContent } from '@/components/evacuation-centers-panel';
import { useEmergencyMapHeader } from '@/hooks/use-emergency-map-header';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { SegmentedControl } from '@/components/segmented-control';
import { QrGuideContent } from '@/components/qr-guide-content';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { PullRefreshControl, PullRefreshScope, usePullRefresh } from '@/components/pull-refresh';
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
  const bottomTabInset = useFloatingTabInset();
  const focused = useIsFocused();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const theme = useTheme();
  const { profile } = useProfile();
  const { session } = useAuth();
  const isGuest = !session;
  const barangayId = profile?.barangay_id ?? null;

  const guidelinesSource = useEmergencyGuidelines(barangayId);
  const hotlinesSource = useEmergencyHotlines(barangayId);
  const { items: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts, isOffline: alertsOffline } = useEmergencyAnnouncements();
  const [tab, setTab] = useState<EmergencyInfoTab>(
    isEmergencyInfoTab(tabParam) ? tabParam : 'hub',
  );

  // The confirmed origin (never the map viewport) is the position used for sorting and
  // routing. Acquisition runs only while the Centers tab is shown.
  const location = useDeviceLocation(focused && tab === 'centers');
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

  const isHub = tab === 'hub';
  const isCenters = tab === 'centers';
  const { searchAvoidance } = useEmergencyMapHeader();
  const isScan = tab === 'scan';
  const isFamily = tab === 'family';
  const isAlerts = tab === 'alerts';
  // Hub and Alerts sources live here; Scan and Family register their own while mounted. Centers has no control.
  const { refreshing, onRefresh, register } = usePullRefresh(
    isHub ? [guidelinesSource.refetch, hotlinesSource.refetch] : isAlerts ? [refetchAlerts] : undefined,
  );

  return (
      <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
        <View style={[styles.root, { backgroundColor: theme.background }]}>
      {searchAvoidance ? null : <SegmentedControl segments={TABS} activeKey={tab} onChange={setTab} variant="underline" />}

      {isCenters ? (
        <Animated.View
          style={[styles.mapScreen, { paddingBottom: Spacing.three }]}>
          <CentersContent
            resident
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
          />
        </Animated.View>
      ) : (
        <Animated.View
          entering={isHub || isAlerts || isScan || isFamily ? undefined : FadeIn.duration(200)}
          style={styles.contentContainer}>
          <PullRefreshScope register={register}>
          <ScrollView
            refreshControl={<PullRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomTabInset + Spacing.three },
              (isHub || isAlerts || isScan || isFamily) && { paddingHorizontal: 16, paddingTop: 12 },
            ]}
            keyboardShouldPersistTaps="handled"
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
              <HubContent guidelinesSource={guidelinesSource} hotlinesSource={hotlinesSource} />
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
                alerts={alerts}
                isOffline={alertsOffline}
                isLoading={alertsLoading}
                error={alertsError}
                refetch={refetchAlerts}
              />
            )}
          </ScrollView>
          </PullRefreshScope>
        </Animated.View>
      )}
    </View>
    </SafeAreaView>
  );
}

function GuestLoginRequired({ message, icon }: { message: string; icon?: React.ComponentProps<typeof GuestAuthCallout>['icon'] }) {
  return (
    <View style={{ minHeight: 420 }}>
      <GuestAuthCallout tabName="this feature" message={message} icon={icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  contentContainer: { flex: 1 },
  scrollView: { flex: 1 },
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
});
