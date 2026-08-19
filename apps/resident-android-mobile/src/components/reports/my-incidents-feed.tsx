import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { type FilterChip } from '@/components/filter-chips';
import { IncidentCard } from '@/components/reports/incident-card';
import { Shimmer } from '@/components/reports/shimmer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  INCIDENT_STATUSES,
  INCIDENT_STATUS_META,
  type IncidentStatus,
} from '@/constants/incident-status';
import { Spacing } from '@/constants/theme';
import { useMyIncidents } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  const theme = useTheme();
  return (
    <ThemedView type="background" style={[skeletonStyles.card, { borderColor: theme.backgroundSelected }]}>
      <Shimmer style={skeletonStyles.thumb} />
      <View style={skeletonStyles.lines}>
        <Shimmer style={[skeletonStyles.line, { width: '55%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '90%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '75%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '35%', height: 10 }]} />
      </View>
    </ThemedView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  lines: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  line: {
    height: 12,
    borderRadius: 6,
  },
});

// ─── Empty state ─────────────────────────────────────────────────────────────

// Plain View, not Animated — as `ListEmptyComponent` it's managed by the same FlatList
// render path where a Reanimated `entering` transition got stuck invisible in testing
// (see IncidentCard's note).
function EmptyState({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="document-text-outline" size={36} color={theme.textSecondary} />
      </View>
      <ThemedText themeColor="textSecondary" style={emptyStyles.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

// ─── FAB ─────────────────────────────────────────────────────────────────────

function ReportFab() {
  const theme = useTheme();
  return (
    <View style={fabStyles.wrap}>
      <Pressable
        style={({ pressed }) => [fabStyles.fab, { backgroundColor: theme.primary }, pressed && fabStyles.fabPressed]}
        onPress={() => router.push('/(app)/reports/new')}
        accessibilityRole="button"
        accessibilityLabel="Submit new incident report">
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const fabStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 28,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    // backgroundColor applied inline with the live accent color (Settings > App Theme).
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
});

// ─── Status filter ───────────────────────────────────────────────────────────

export type StatusFilterKey = IncidentStatus | 'all';

/**
 * All / Submitted / Progress / Resolved / Withdrawn / Unresolved — one chip per stage of
 * the workflow in migration 0026, in workflow order. Rendered with the same FilterChips
 * component the Announcements segment uses, so the two filter rows are identical by
 * construction rather than by copy.
 */
export function useStatusChips(): FilterChip<StatusFilterKey>[] {
  const theme = useTheme();
  return [
    { key: 'all', label: 'All', color: theme.primary },
    ...INCIDENT_STATUSES.map((status) => ({
      key: status as StatusFilterKey,
      label: INCIDENT_STATUS_META[status].filterLabel,
      color: INCIDENT_STATUS_META[status].fg,
    })),
  ];
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

interface MyIncidentsFeedProps {
  /**
   * When provided, only incidents matching this status (or any status in the array —
   * e.g. the "Active" segment = open OR in_progress) are shown and the filter chips are
   * suppressed (the segment itself already is the filter).
   * Omit (undefined) to show all of the resident's own reports.
   */
  status?: IncidentStatus | IncidentStatus[];
  /** Message when the filtered list is empty. */
  emptyLabel?: string;
  /** Optional heading rendered above the list. */
  heading?: ReactNode;
  /** Optional filter controls rendered below the heading. */
  filters?: ReactNode;
  /** Controlled active filter key. */
  activeFilter?: StatusFilterKey;
  /** Called when the active filter changes. */
  onFilterChange?: (key: StatusFilterKey) => void;
}

/**
 * The "My Incident Reports" panel used by the Reports tab's three incident-related
 * sub-tabs (All / Active / Resolved). Renders a real-time list of the signed-in
 * resident's own submitted incident reports, each shown as an IncidentCard, plus a
 * floating action button to file a new report.
 */
export function MyIncidentsFeed({
  status,
  emptyLabel = 'You have not submitted any incident reports yet.',
  heading,
  filters,
  activeFilter: controlledActiveFilter,
  onFilterChange,
}: MyIncidentsFeedProps) {
  const [internalActiveFilter] = useState<StatusFilterKey>('all');

  const activeFilter = controlledActiveFilter ?? internalActiveFilter;

  // An explicit `status` prop always wins — the chips only drive the unscoped feed.
  const effectiveStatus =
    status ?? (activeFilter !== 'all' ? activeFilter : undefined);

  const { incidents, isLoading } = useMyIncidents({ status: effectiveStatus });

  const emptyMessage =
    activeFilter !== 'all'
      ? `No ${INCIDENT_STATUS_META[activeFilter].label.toLowerCase()} incident reports.`
      : emptyLabel;

  return (
    <View style={styles.container}>
      {heading}
      {filters}

      {/* List or skeleton */}
      {isLoading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <IncidentCard incident={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState label={emptyMessage} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating action button — always visible so the resident can file a report */}
      <ReportFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: 96, // clearance for FAB
  },
  separator: {
    height: Spacing.two,
  },
});
