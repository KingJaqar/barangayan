import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/filter-chips';
import { AnnouncementsFeed, FilterKey, useAnnouncementChips } from '@/components/reports/announcements-feed';
import { MyIncidentsFeed, StatusFilterKey, useStatusChips } from '@/components/reports/my-incidents-feed';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved' | 'announcements';

// Stable identity (module scope, not recreated per render) — MyIncidentsFeed passes this
// straight through to useMyIncidents, whose fetch effect depends on it; a fresh array
// literal every render would re-fetch on every render instead of once.
const ACTIVE_STATUSES: ('open' | 'in_progress')[] = ['open', 'in_progress'];

/** Single bulk "Mark all as read" action — sits above the Resolved Reports / Announcements
 * lists. Active Reports gets none: it's a live status count, not an unread notification
 * count, so there's nothing to acknowledge. */
function MarkAllReadButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [markReadStyles.button, pressed && markReadStyles.pressed]}>
      <Ionicons name="checkmark-done-outline" size={16} color={theme.primary} />
      <ThemedText type="small" style={[markReadStyles.label, { color: theme.primary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const markReadStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontWeight: '600',
  },
});

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
  const { markResolvedRead, markAnnouncementsRead } = useUnreadCounts();

  // The `?tab=` param — not just the initial useState seed — drives the segment.
  //
  // Without this, the Home screen's bell (Link href="/reports?tab=announcements") only
  // landed on Announcements the very first time: this screen lives in a bottom tab, so it
  // stays mounted, and useState's initial value is ignored on every later navigation. The
  // bell would switch to the Reports tab but leave whatever segment was last open.
  useEffect(() => {
    if (params.tab) setSegment(params.tab);
  }, [params.tab]);

  // Tapping a segment writes it back to the URL, which keeps the param honest as the
  // source of truth. That matters for the effect above: if the resident manually switches
  // to Incident Reports while the URL still said `tab=announcements`, a later bell tap
  // would be a no-op param change and wouldn't move them to Announcements.
  const handleSegmentChange = useCallback((key: ReportsSegment) => {
    setSegment(key);
    router.setParams({ tab: key });
  }, []);

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
          onChange={handleSegmentChange}
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

      {/* Section 3b — Bulk "Mark all as read" action. Only Resolved Reports and
          Announcements have a mark-as-read concept — Active Reports is a live status
          count (open + in_progress), not an unread notification count, so it has no
          button; the bell/badge for it never clears. */}
      {segment === 'resolved' && (
        <MarkAllReadButton label="Mark all as read" onPress={markResolvedRead} />
      )}
      {segment === 'announcements' && (
        <MarkAllReadButton label="Mark all as read" onPress={markAnnouncementsRead} />
      )}

      {/* Section 4 — Content panels */}

      {/* All of the resident's own reports (any status) */}
      {segment === 'incident-reports' && (
        <MyIncidentsFeed
          activeFilter={incidentFilter}
          onFilterChange={setIncidentFilter}
          emptyLabel="You have not submitted any incident reports yet."
        />
      )}

      {/* Active = open + in_progress — matches the Reports-tab badge's active-reports
          count exactly, so the number above the bell icon never disagrees with this list. */}
      {segment === 'active' && (
        <MyIncidentsFeed
          status={ACTIVE_STATUSES}
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
