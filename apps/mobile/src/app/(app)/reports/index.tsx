import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved' | 'announcements';

// "Reports and Announcements" screen — confirmed against the design file. Announcements
// is a sub-tab HERE, not a stack off Home (AGENTS.md §4). Its content is real/functional
// (the "Reports tab's Announcements sub-tab" task); the other three sub-tabs are
// static/mock for the 30% milestone (the "Static shells" task).
export default function ReportsScreen() {
  const [segment, setSegment] = useState<ReportsSegment>('incident-reports');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.header}>
        <SegmentedControl
          segments={[
            { key: 'incident-reports', label: 'Incident Reports' },
            { key: 'active', label: 'Active Reports' },
            { key: 'resolved', label: 'Resolved Reports' },
            { key: 'announcements', label: 'Announcements' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      </ThemedView>

      {segment === 'incident-reports' && <PlaceholderPanel label="All incident reports go here." />}
      {segment === 'active' && <PlaceholderPanel label="Active incident reports go here." />}
      {segment === 'resolved' && <PlaceholderPanel label="Resolved incident reports go here." />}
      {segment === 'announcements' && (
        <PlaceholderPanel label="Real announcements feed goes here." />
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
