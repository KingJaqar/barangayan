import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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

function FilterChips({
  active,
  onSelect,
}: {
  active: FilterKey;
  onSelect: (key: FilterKey) => void;
}) {
  const theme = useTheme();

  const ALL_CHIPS: { key: FilterKey; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: theme.primary },
    ...ANNOUNCEMENT_CATEGORIES.map((cat) => ({
      key: cat as FilterKey,
      label: ANNOUNCEMENT_CATEGORY_META[cat].label,
      color: ANNOUNCEMENT_CATEGORY_META[cat].color,
    })),
  ];

  return (
    // `alignItems: 'center'` is the critical fix — without it the horizontal ScrollView
    // stretches each Pressable child to fill its full cross-axis height (the "tall pill" bug).
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.row}>
      {ALL_CHIPS.map(({ key, label, color }) => {
        const isActive = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[
              chipStyles.chip,
              isActive
                ? { backgroundColor: color }
                : { borderWidth: 1.5, borderColor: color },
            ]}>
            <ThemedText
              type="small"
              style={[chipStyles.chipLabel, { color: isActive ? '#ffffff' : color }]}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',   // ← prevents cross-axis stretch; keeps chips compact pill height
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',   // belt-and-suspenders for any edge-case nesting
  },
  chipLabel: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
});

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/** The full "What's New?" announcements feed — filter chips + list of AnnouncementCards. */
export function AnnouncementsFeed() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const { items, loading } = useAnnouncements(activeFilter);
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* "What's New?" — dark green, bold, serif to match reference design */}
      <ThemedText
        type="default"
        style={[styles.heading, { color: theme.primary, fontFamily: Fonts.serif }]}>
        What's New?
      </ThemedText>

      <FilterChips active={activeFilter} onSelect={setActiveFilter} />

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: 0,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.one,

  },
  separator: {
    height: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
