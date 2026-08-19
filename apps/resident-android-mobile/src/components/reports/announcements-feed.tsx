import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { type FilterChip } from '@/components/filter-chips';
import { AnnouncementCard } from '@/components/reports/announcement-card';
import { Shimmer } from '@/components/reports/shimmer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useTheme } from '@/hooks/use-theme';

export type FilterKey = AnnouncementCategory | 'all';

type AnnouncementsFeedProps = {
  categoryFilter?: 'emergency';
  emptyLabel?: string;
  /** Optional heading rendered above the list. */
  heading?: ReactNode;
  /** Optional filter controls rendered below the heading. */
  filters?: ReactNode;
  /** Controlled active filter key. */
  activeFilter?: FilterKey;
  /** Called when the active filter changes. */
  onFilterChange?: (key: FilterKey) => void;
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[skeletonStyles.card, { borderColor: theme.backgroundSelected }]}>
      <View style={[skeletonStyles.bar, { backgroundColor: theme.backgroundSelected }]} />
      <View style={skeletonStyles.body}>
        <Shimmer style={[skeletonStyles.line, { width: '40%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '85%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '70%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '30%', height: 10 }]} />
      </View>
    </ThemedView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 128,
  },
  bar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  line: {
    height: 12,
    borderRadius: 6,
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

// Plain View, not Animated — as `ListEmptyComponent` it's managed by the same FlatList
// render path where a Reanimated `entering` transition got stuck invisible in testing
// (see IncidentCard's note in my-incidents-feed.tsx).
function EmptyState({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="megaphone-outline" size={34} color={theme.textSecondary} />
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

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

/** Chip presentation now lives in `components/filter-chips.tsx` — shared with My Incident Reports. */
export function useAnnouncementChips(): FilterChip<FilterKey>[] {
  const theme = useTheme();
  return [
    { key: 'all', label: 'All', color: theme.primary },
    ...ANNOUNCEMENT_CATEGORIES.map((cat) => ({
      key: cat as FilterKey,
      label: ANNOUNCEMENT_CATEGORY_META[cat].label,
      color: ANNOUNCEMENT_CATEGORY_META[cat].color,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/** The full "What's New?" announcements feed — filter chips + list of AnnouncementCards. */
export function AnnouncementsFeed({
  categoryFilter,
  emptyLabel = 'No announcements yet.',
  heading,
  filters,
  activeFilter: controlledActiveFilter,
  onFilterChange,
}: AnnouncementsFeedProps) {
  const [internalActiveFilter] = useState<FilterKey>(categoryFilter ?? 'all');

  const activeFilter = controlledActiveFilter ?? internalActiveFilter;

  const queryCategory = categoryFilter === 'emergency' ? 'emergency' : activeFilter;
  const { items, loading } = useAnnouncements(queryCategory);

  return (
    <View style={styles.container}>
      {heading}
      {filters}

      {/* Content: the list of announcement items */}
      <View style={styles.contentSection}>
        {loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AnnouncementCard announcement={item} />}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <EmptyState label={categoryFilter === 'emergency' ? 'No active emergency alerts.' : emptyLabel} />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Dedicated area for the announcement list itself
  contentSection: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
