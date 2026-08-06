import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';

import { DocumentsList } from './_components/documents-list';
import { LogsList } from './_components/logs-list';
import { RequestsList } from './_components/requests-list';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

// Documents/Requests/Logs — confirmed against the design file.
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

      <ScrollView>
        {segment === 'documents' && <DocumentsList />}
        {segment === 'requests' && <RequestsList />}
        {segment === 'logs' && <LogsList />}
      </ScrollView>
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
