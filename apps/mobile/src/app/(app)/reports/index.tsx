import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { AnnouncementsFeed } from '@/components/reports/announcements-feed';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved' | 'announcements';

// "Reports and Announcements" screen — confirmed against the design file. Announcements
// is a sub-tab HERE, not a stack off Home (AGENTS.md §4). Its content is real/functional
// (the "Reports tab's Announcements sub-tab" task); the other three sub-tabs are
// static/mock for the 30% milestone (the "Static shells" task).
export default function ReportsScreen() {
  const params = useLocalSearchParams<{ tab?: ReportsSegment }>();
  const [segment, setSegment] = useState<ReportsSegment>(params.tab ?? 'incident-reports');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      {/* Header — mirrors Settings screen exactly: centred title, no back button */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.headerContent}>
          <ThemedText type="smallBold" style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Reports and Announcements
          </ThemedText>
        </View>
      </View>

      {/* Segmented control */}
      <ThemedView style={styles.segmentWrap}>
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
      {segment === 'announcements' && <AnnouncementsFeed />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Mirrors settings/index.tsx header exactly
  header: {
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
  segmentWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
});
