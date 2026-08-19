import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Announcement = Tables<'announcements'>;

/** Returns a human-readable relative time string: "X minutes ago", "X hours ago", "X days ago". */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

// Note: deliberately no per-row `entering` (Reanimated) animation here — nesting one
// inside a FlatList row got stuck permanently invisible in testing (the entering
// transition's pre-animation `visibility: hidden` state never resolved once the row
// was virtualized/recycled). The skeleton shimmer already carries the loading-in
// motion; rows just appear once data resolves.
export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const theme = useTheme();
  const category = announcement.category as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      {/* Left accent bar — color matches the category */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.content}>
        {/* Single meta row: icon + category label on the left, timestamp pinned right —
            replaces the old icon-chip/pill/footer three-row layout to save vertical space. */}
        <View style={styles.metaRow}>
          <View style={styles.category}>
            <Ionicons name={icon as any} size={12} color={color} />
            <ThemedText type="small" style={[styles.categoryLabel, { color }]}>
              {label}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.timestamp}>
            {timeAgo(announcement.published_at)}
          </ThemedText>
        </View>

        <ThemedText type="default" numberOfLines={1} style={styles.title}>
          {announcement.title}
        </ThemedText>

        <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.body}>
          {announcement.body}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  accentBar: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: 1,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  categoryLabel: {
    fontWeight: '700',
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  timestamp: {
    fontSize: 10.5,
    lineHeight: 14,
    flexShrink: 0,
  },
});
