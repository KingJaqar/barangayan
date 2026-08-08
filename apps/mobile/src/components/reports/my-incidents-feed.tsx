import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { IncidentCard } from '@/components/reports/incident-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  INCIDENT_STATUSES,
  INCIDENT_STATUS_META,
  type IncidentStatus,
} from '@/constants/incident-status';
import { Colors, Spacing } from '@/constants/theme';
import { useMyIncidents } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <ThemedView type="background" style={skeletonStyles.card}>
      {/* thumb */}
      <ThemedView type="backgroundSelected" style={skeletonStyles.thumb} />
      {/* lines */}
      <View style={skeletonStyles.lines}>
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '55%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '90%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '75%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '35%' }]} />
      </View>
    </ThemedView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: {
    width: 82,
    height: 82,
    borderRadius: 10,
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

function EmptyState({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
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
    paddingTop: 60,
    gap: Spacing.three,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});

// ─── FAB ─────────────────────────────────────────────────────────────────────

function ReportFab() {
  return (
    <Pressable
      style={({ pressed }) => [fabStyles.fab, pressed && fabStyles.fabPressed]}
      onPress={() => router.push('/(app)/reports/new')}
      accessibilityRole="button"
      accessibilityLabel="Submit new incident report">
      <Ionicons name="add" size={30} color="#FFFFFF" />
    </Pressable>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary, // always brand green — not accent-theme
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});

// ─── Status filter ───────────────────────────────────────────────────────────

type StatusFilterKey = IncidentStatus | 'all';

/**
 * All / Submitted / Progress / Resolved / Withdrawn / Unresolved — one chip per stage of
 * the workflow in migration 0026, in workflow order. Rendered with the same FilterChips
 * component the Announcements segment uses, so the two filter rows are identical by
 * construction rather than by copy.
 */
function useStatusChips(): FilterChip<StatusFilterKey>[] {
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
   * When provided, only incidents matching this status are shown and the filter chips
   * are suppressed (the segment itself already is the filter).
   * Omit (undefined) to show all of the resident's own reports.
   */
  status?: IncidentStatus;
  /** Show the All / Submitted / … status filter chips under the heading. */
  showFilters?: boolean;
  /** Section heading shown above the list. */
  sectionTitle?: string;
  /** Message when the filtered list is empty. */
  emptyLabel?: string;
}

/**
 * The "My Incident Reports" panel used by the Reports tab's three incident-related
 * sub-tabs (All / Active / Resolved). Renders a real-time list of the signed-in
 * resident's own submitted incident reports, each shown as an IncidentCard, plus a
 * floating action button to file a new report.
 */
export function MyIncidentsFeed({
  status,
  showFilters = false,
  sectionTitle = 'My Incident Reports',
  emptyLabel = 'You have not submitted any incident reports yet.',
}: MyIncidentsFeedProps) {
  const theme = useTheme();
  const chips = useStatusChips();
  const [activeFilter, setActiveFilter] = useState<StatusFilterKey>('all');

  // An explicit `status` prop always wins — the chips only drive the unscoped feed.
  const effectiveStatus =
    status ?? (showFilters && activeFilter !== 'all' ? activeFilter : undefined);

  const { incidents, isLoading } = useMyIncidents({ status: effectiveStatus });

  const emptyMessage =
    showFilters && activeFilter !== 'all'
      ? `No ${INCIDENT_STATUS_META[activeFilter].label.toLowerCase()} incident reports.`
      : emptyLabel;

  return (
    <View style={styles.container}>
      {/* Heading + filters, grouped exactly as the Announcements feed groups its own */}
      <View style={showFilters ? styles.headerSection : undefined}>
        <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
          {sectionTitle}
        </ThemedText>

        {showFilters && (
          <FilterChips chips={chips} active={activeFilter} onSelect={setActiveFilter} />
        )}
      </View>

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
  // Matches announcements-feed's headerSection so both segments space their filter
  // row against the list below identically.
  headerSection: {
    paddingBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 96, // clearance for FAB
  },
  separator: {
    height: Spacing.two,
  },
});
