import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/filter-chips';
import { AnnouncementsFeed, FilterKey, useAnnouncementChips } from '@/components/reports/announcements-feed';
import { FadeInView } from '@/components/reports/fade-in-view';
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

/** Single bulk "Mark all as read" action, right-aligned inline alongside the segment's
 * heading (Resolved Reports, or "What's New" for Announcements) — see the section2Row
 * layout below. Active Reports gets none: it's a live status count, not an unread
 * notification count, so there's nothing to acknowledge. */
function MarkAllReadButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        markReadStyles.button,
        { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}33` },
        pressed && markReadStyles.pressed,
      ]}>
      <Ionicons name="checkmark-done-outline" size={13} color={theme.primary} />
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
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
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

      {/* Section 2 — Heading. Resolved Reports and Announcements ("What's New") get their
          "Mark all as read" action inline on the right, same row as the heading text on the
          left. Active Reports is a live status count (open + in_progress), not an unread
          notification count, so it has no button; the bell/badge for it never clears. */}
      <View style={styles.section2}>
        <View style={styles.section2Row}>
          {/* `key={segment}` remounts on every switch so the heading crossfades in rather
              than snapping — same shared-value idiom as FadeInView elsewhere, never
              Reanimated's `entering` prop (see fade-in-view.tsx). */}
          <FadeInView key={segment} duration={160} rise={4}>
            {renderHeading()}
          </FadeInView>
          {segment === 'resolved' && (
            <MarkAllReadButton label="Mark all as read" onPress={markResolvedRead} />
          )}
          {segment === 'announcements' && (
            <MarkAllReadButton label="Mark all as read" onPress={markAnnouncementsRead} />
          )}
        </View>
      </View>

      {/* Section 3 — Category filter controls. */}
      <View style={styles.section3}>{renderFilters()}</View>

      {/* Section 4 — Content panel. Deliberately a plain (non-animated) View: nesting this
          in a Reanimated `entering` transition around a FlatList whose own rows each run
          their own `entering` (IncidentCard/AnnouncementCard) produced a stuck-invisible
          panel on web (nested entering transitions never resolved). The heading above
          already gives a cross-fade cue on segment switch; the rows' own stagger-in is
          enough motion for the panel itself. */}
      <View style={styles.panel}>
        {/* Content panels */}

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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // ── Section 2 — Heading ────────────────────────────────────────────────
  section2: {},
  // Row: heading text on the left, "Mark all as read" (Resolved Reports only) pinned
  // to the right of the same row.
  section2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.three,
  },
  incidentHeading: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.3,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  announcementHeading: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one + 2,
  },

  // ── Section 3 — Filters ────────────────────────────────────────────────
  section3: {},

  // ── Section 4 — Content panel (flex:1 so the feed inside it can scroll
  // within the remaining vertical space) ─────────────────────────────────
  panel: {
    flex: 1,
  },
});
