import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CentersContent } from '@/components/evacuation-centers-panel';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * Public emergency entry (DRRM routing plan R6, invariant 9): the Centers map and offline
 * routes outside every authentication guard, so session restoration, account setup or a
 * failed sign-in never keeps a resident from evacuation routes. Same Centers panel as the
 * Emergency & DRRM Info screen.
 */
export default function EmergencyCentersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useProfile();
  const location = useDeviceLocation(true);
  const origin = location.state.origin;
  const userPosition = useMemo<LatLng | null>(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin]);
  const { centers, isLoading, error, refetch } = useEvacuationCenters({ barangayId: profile?.barangay_id ?? null, userPosition });
  const [view, setView] = useState<'list' | 'map'>('map');
  const [nearestFirst, setNearestFirst] = useState(true);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color={theme.onPrimary} />
          </Pressable>
          <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: theme.onPrimary }]}>Evacuation Centers</ThemedText>
        </View>
        <View style={styles.body}>
          <CentersContent
            theme={theme}
            centers={centers}
            isLoading={isLoading}
            error={error}
            refetch={refetch}
            view={view}
            onViewChange={setView}
            nearestFirst={nearestFirst}
            onNearestToggle={setNearestFirst}
            userPosition={userPosition}
            location={location}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
});
