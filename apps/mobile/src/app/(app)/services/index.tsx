import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

// Documents/Requests/Logs — confirmed against the design file. Content wiring (real
// document_types catalog, request submission, Request Tracking drill-down, logs) is the
// "Services tab" task; this screen establishes the real segmented-control navigation.
export default function ServicesScreen() {
  const [segment, setSegment] = useState<ServicesSegment>('documents');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.header}>
        <SegmentedControl
          segments={[
            { key: 'documents', label: 'Documents' },
            { key: 'requests', label: 'Requests' },
            { key: 'logs', label: 'Logs' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      </ThemedView>

      {segment === 'documents' && <PlaceholderPanel label="Document catalog goes here." />}
      {segment === 'requests' && <PlaceholderPanel label="My Requests list goes here." />}
      {segment === 'logs' && <PlaceholderPanel label="Transaction/activity log goes here." />}
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
