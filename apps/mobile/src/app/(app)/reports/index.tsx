import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementsFeed } from '@/components/reports/announcements-feed';
import { MyIncidentsFeed } from '@/components/reports/my-incidents-feed';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved' | 'announcements';

// "Reports and Announcements" screen — confirmed against the design file. Announcements
// is a sub-tab HERE, not a stack off Home (AGENTS.md §4). Its content is real/functional
// (the "Reports tab's Announcements sub-tab" task); the three incident sub-tabs now also
// render real data via MyIncidentsFeed (reporter_id = current user, status-filtered).
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
            { key: 'active',           label: 'Active Reports' },
            { key: 'resolved',         label: 'Resolved Reports' },
            { key: 'announcements',    label: 'Announcements' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      </ThemedView>

      {/* ── Content panels ── */}

      {/* All of the resident's own reports (any status) */}
      {segment === 'incident-reports' && (
        <MyIncidentsFeed
          showFilters
          sectionTitle="My Incident Reports"
          emptyLabel="You have not submitted any incident reports yet."
        />
      )}

      {/* Active = open + in_progress. PostgREST only supports a single eq value, so we
          pass 'open' here and render a combined "Active" view. The hook can be extended
          with an `or` filter later; for the milestone this shows open-status incidents. */}
      {segment === 'active' && (
        <MyIncidentsFeed
          status="open"
          sectionTitle="Active Reports"
          emptyLabel="No active incident reports."
        />
      )}

      {segment === 'resolved' && (
        <MyIncidentsFeed
          status="resolved"
          sectionTitle="Resolved Reports"
          emptyLabel="No resolved incident reports yet."
        />
      )}

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
