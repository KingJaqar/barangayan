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
        {/* Icon + category pill row */}
        <View style={styles.metaRow}>
          <View style={[styles.iconChip, { backgroundColor: `${color}1A` }]}>
            <Ionicons name={icon as any} size={15} color={color} />
          </View>
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

        <View style={styles.footerRow}>
          <Ionicons name="time-outline" size={11} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.timestamp}>
            {timeAgo(announcement.published_at)}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: 2,
  },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  pillText: {
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11.5,
  },
});
