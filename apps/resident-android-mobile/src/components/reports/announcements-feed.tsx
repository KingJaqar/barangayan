import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { Ionicons } from '@expo/vector-icons';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_META,
  type AnnouncementCategory,
  type Tables,
} from '@barangayan/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { type FilterChip } from '@/components/filter-chips';
import { AnnouncementCard } from '@/components/reports/announcement-card';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { Shimmer } from '@/components/reports/shimmer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useTheme } from '@/hooks/use-theme';

type Announcement = Tables<'announcements'>;

export type FilterKey = AnnouncementCategory | 'all';

type AnnouncementsFeedProps = {
  openId?: string;
  onOpenHandled?: () => void;
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
        <Shimmer style={[skeletonStyles.line, { width: '35%', height: 9 }]} />
        <Shimmer style={[skeletonStyles.line, { width: '80%' }]} />
        <Shimmer style={[skeletonStyles.line, { width: '92%', height: 10 }]} />
        <Shimmer style={[skeletonStyles.line, { width: '60%', height: 10 }]} />
      </View>
    </ThemedView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 84,
  },
  bar: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
    gap: 6,
    justifyContent: 'center',
  },
  line: {
    height: 11,
    borderRadius: 5,
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
  openId,
  onOpenHandled,
  categoryFilter,
  emptyLabel = 'No announcements yet.',
  heading,
  filters,
  activeFilter: controlledActiveFilter,
  onFilterChange,
}: AnnouncementsFeedProps) {
  const bottomTabInset = useFloatingTabInset();
  const [internalActiveFilter] = useState<FilterKey>(categoryFilter ?? 'all');
  // The announcement shown in the detail bottom sheet, and whether it's open. Kept as two
  // separate pieces of state (rather than clearing `selected` to null on close) so the
  // sheet's content stays rendered while the modal plays its slide-down close animation —
  // clearing the data immediately would unmount the content mid-animation.
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const activeFilter = controlledActiveFilter ?? internalActiveFilter;

  const queryCategory = categoryFilter === 'emergency' ? 'emergency' : activeFilter;
  const { items, loading, error, retry } = useAnnouncements(queryCategory);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!openId || loading || error) return;
    const item = items.find(item => item.id === openId);
    setUnavailable(!item);
    if (item) { setSelected(item); setModalVisible(true); }
    onOpenHandled?.();
  }, [openId, items, loading, error, onOpenHandled]);

  return (
    <View style={styles.container}>
      {heading}
      {filters}
      {unavailable ? <ThemedText style={{ padding: 16 }} accessibilityRole="alert">This announcement is no longer available.</ThemedText> : null}

      {/* Content: the list of announcement items */}
      <View style={styles.contentSection}>
        {error ? <View style={{ padding: 16, gap: 8 }}><ThemedText accessibilityRole="alert">{error}</ThemedText><Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 48, justifyContent: 'center' }}><ThemedText>Retry announcements</ThemedText></Pressable></View> : loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AnnouncementCard
                announcement={item}
                onPress={() => {
                  setUnavailable(false);
                  setSelected(item);
                  setModalVisible(true);
                }}
              />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: bottomTabInset + Spacing.four }]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <EmptyState label={categoryFilter === 'emergency' ? 'No active emergency alerts.' : emptyLabel} />
            }
          />
        )}
      </View>

      <AnnouncementModal visible={modalVisible} announcement={selected} onClose={() => setModalVisible(false)} />
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
    paddingTop: Spacing.one,
  },
  separator: {
    height: Spacing.two - 2,
  },
});
