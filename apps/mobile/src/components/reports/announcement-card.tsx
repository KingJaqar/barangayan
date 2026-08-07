import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

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

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const category = announcement.category as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {/* Left accent bar — color matches the category */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.content}>
        {/* Icon + category pill row */}
        <View style={styles.metaRow}>
          <Ionicons name={icon as any} size={20} color={color} />
          <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
            <ThemedText type="small" style={[styles.pillText, { color }]}>
              {label}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="default" numberOfLines={2} style={styles.title}>
          {announcement.title}
        </ThemedText>

        <ThemedText themeColor="textSecondary" numberOfLines={3} style={styles.body}>
          {announcement.body}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {timeAgo(announcement.published_at)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  pill: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  pillText: {
    fontWeight: '600',
  },
  title: {
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  body: {
    marginBottom: Spacing.one,
  },
});
