import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type HealthSegment = 'active-drives' | 'my-registrations';

// Active Drives / My Registrations — confirmed against the design file. Applicant
// number prefixes vary by drive type (#VAC-/#MAT-/#DEN-/#BLD-), per AGENTS.md §4.
export default function HealthScreen() {
  const [segment, setSegment] = useState<HealthSegment>('active-drives');

  return (
    <SafeAreaView style={styles.safeArea}>
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
  header: {
    padding: Spacing.three,
  },
});
