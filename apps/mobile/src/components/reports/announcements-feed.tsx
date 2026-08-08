import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { AnnouncementCard } from '@/components/reports/announcement-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useTheme } from '@/hooks/use-theme';

type FilterKey = AnnouncementCategory | 'all';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <ThemedView type="backgroundElement" style={skeletonStyles.card}>
      <View style={skeletonStyles.bar} />
      <View style={skeletonStyles.body}>
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '40%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '85%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '70%' }]} />
        <ThemedView type="backgroundSelected" style={[skeletonStyles.line, { width: '30%' }]} />
      </View>
    </ThemedView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 120,
  },
  bar: {
    width: 4,
    backgroundColor: '#E0E1E6',
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
// Filter chips
// ---------------------------------------------------------------------------

/** Chip presentation now lives in `components/filter-chips.tsx` — shared with My Incident Reports. */
function useAnnouncementChips(): FilterChip<FilterKey>[] {
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
export function AnnouncementsFeed() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const { items, loading } = useAnnouncements(activeFilter);
  const chips = useAnnouncementChips();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Section 1 — header: "What's New?" title + filter category controls */}
      <View style={styles.headerSection}>
        <ThemedText
          type="default"
          style={[styles.heading, { color: theme.primary, fontFamily: Fonts.serif }]}>
          What's New?
        </ThemedText>

        <FilterChips chips={chips} active={activeFilter} onSelect={setActiveFilter} />
      </View>

      {/* Section 2 — content: the list of announcement items */}
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
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No announcements yet.
              </ThemedText>
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
  // Section 1 — heading + filters, grouped and visually separated from the feed below
  headerSection: {
    paddingBottom: Spacing.two,
  },
  // Section 2 — dedicated area for the announcement list itself
  contentSection: {
    flex: 1,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
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
