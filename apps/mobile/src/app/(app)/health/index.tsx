import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type HealthSegment = 'active-drives' | 'my-registrations';

// Active Drives / My Registrations — confirmed against the design file. Applicant
// number prefixes vary by drive type (#VAC-/#MAT-/#DEN-/#BLD-), per AGENTS.md §4.
export default function HealthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<HealthSegment>('active-drives');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topHeader, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.headerContent}>
          <ThemedText type="smallBold" style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Health
          </ThemedText>
        </View>
      </View>
      <ThemedView style={styles.header}>
        <SegmentedControl
          segments={[
            { key: 'active-drives', label: 'Active Drives' },
            { key: 'my-registrations', label: 'My Registrations' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      </ThemedView>

      {segment === 'active-drives' && (
        <PlaceholderPanel label="Active drives calendar goes here." />
      )}
      {segment === 'my-registrations' && (
        <PlaceholderPanel label="My drive registrations go here." />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  headerContent: {
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
  },
  header: {
    padding: Spacing.three,
  },
});
