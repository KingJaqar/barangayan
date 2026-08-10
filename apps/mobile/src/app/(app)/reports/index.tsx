import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/filter-chips';
import { AnnouncementsFeed, FilterKey, useAnnouncementChips } from '@/components/reports/announcements-feed';
import { MyIncidentsFeed, StatusFilterKey, useStatusChips } from '@/components/reports/my-incidents-feed';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
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

  const [incidentFilter, setIncidentFilter] = useState<StatusFilterKey>('all');
  const [announcementFilter, setAnnouncementFilter] = useState<FilterKey>('all');

  const incidentChips = useStatusChips();
  const announcementChips = useAnnouncementChips();

  useEffect(() => {
    setIncidentFilter('all');
    setAnnouncementFilter('all');
  }, [segment]);

  const renderHeading = () => {
    switch (segment) {
      case 'incident-reports':
        return (
          <ThemedText style={[styles.incidentHeading, { color: theme.primary }]}>
            My Incident Reports
          </ThemedText>
        );
      case 'active':
        return (
          <ThemedText style={[styles.incidentHeading, { color: theme.primary }]}>
            Active Reports
          </ThemedText>
        );
      case 'resolved':
        return (
          <ThemedText style={[styles.incidentHeading, { color: theme.primary }]}>
            Resolved Reports
          </ThemedText>
        );
      case 'announcements':
        return (
          <ThemedText
            style={[styles.announcementHeading, { color: theme.primary, fontFamily: Fonts.serif }]}>
            What&apos;s New
          </ThemedText>
        );
    }
  };

  const renderFilters = () => {
    if (segment === 'incident-reports') {
      return (
        <FilterChips
          chips={incidentChips}
          active={incidentFilter}
          onSelect={setIncidentFilter}
        />
      );
    }
    if (segment === 'announcements') {
      return (
        <FilterChips
          chips={announcementChips}
          active={announcementFilter}
          onSelect={setAnnouncementFilter}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ① Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two },
        ]}
      >
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Reports and Announcements
          </ThemedText>
        </View>
      </View>

      {/* Section 1 — Segmented control */}
      <View style={styles.section1}>
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
      </View>

      {/* Section 2 — Heading */}
      <View style={styles.section2}>
        {renderHeading()}
      </View>

      {/* Section 3 — Category filter controls */}
      <View style={styles.section3}>
        {renderFilters()}
      </View>

      {/* Section 4 — Content panels */}

      {/* All of the resident's own reports (any status) */}
      {segment === 'incident-reports' && (
        <MyIncidentsFeed
          activeFilter={incidentFilter}
          onFilterChange={setIncidentFilter}
          emptyLabel="You have not submitted any incident reports yet."
        />
      )}

      {/* Active = open + in_progress. PostgREST only supports a single eq value, so we
          pass 'open' here and render a combined "Active" view. The hook can be extended
          with an `or` filter later; for the milestone this shows open-status incidents. */}
      {segment === 'active' && (
        <MyIncidentsFeed
          status="open"
          emptyLabel="No active incident reports."
        />
      )}

      {segment === 'resolved' && (
        <MyIncidentsFeed
          status="resolved"
          emptyLabel="No resolved incident reports yet."
        />
      )}

      {segment === 'announcements' && (
        <AnnouncementsFeed
          activeFilter={announcementFilter}
          onFilterChange={setAnnouncementFilter}
        />
      )}
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

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },

  // ── Section 1 — Segmented control ──────────────────────────────────────
  section1: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },

  // ── Section 2 — Heading ────────────────────────────────────────────────
  section2: {},
  incidentHeading: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  announcementHeading: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },

  // ── Section 3 — Filters ────────────────────────────────────────────────
  section3: {},

  // ── Section 4 — List panels are flex:1 inside their feed components ────
});
