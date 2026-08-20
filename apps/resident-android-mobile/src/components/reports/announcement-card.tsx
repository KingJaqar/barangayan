import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

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

/** Formats an ISO datetime as an absolute date & time, e.g. "Aug 15, 2026, 9:00 AM". */
function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Limits `text` to the first `maxSentences` sentences, appending an ellipsis if there
 * was more. Falls back to the original text unchanged when it has no sentence-ending
 * punctuation to split on (still visually capped by the card's `numberOfLines`). */
function truncateToSentences(text: string, maxSentences = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (!sentences || sentences.length <= maxSentences) return text.trim();
  return `${sentences.slice(0, maxSentences).join('').trim()}…`;
}

// Note: deliberately no per-row `entering` (Reanimated) animation here — nesting one
// inside a FlatList row got stuck permanently invisible in testing (the entering
// transition's pre-animation `visibility: hidden` state never resolved once the row
// was virtualized/recycled). The skeleton shimmer already carries the loading-in
// motion; rows just appear once data resolves.
export function AnnouncementCard({
  announcement,
  onPress,
}: {
  announcement: Announcement;
  /** Opens the AnnouncementModal with this announcement's full detail. */
  onPress: () => void;
}) {
  const theme = useTheme();
  const { unreadAnnouncementIds, markAnnouncementRead, markAnnouncementUnread } = useUnreadCounts();
  const isUnread = unreadAnnouncementIds.includes(announcement.id);

  const category = announcement.category as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View announcement: ${announcement.title}`}>
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
            {truncateToSentences(announcement.body)}
          </ThemedText>

          {/* Footer: absolute date & time on the left, mark-as-read / mark-as-unread
              icons pinned right. Both icons stay tappable (idempotent upsert/delete) —
              the highlighted one just reflects this resident's current read state. */}
          <View style={styles.footerRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateTime}>
              {formatDateTime(announcement.published_at)}
            </ThemedText>

            <View style={styles.iconActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as read"
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  markAnnouncementRead(announcement.id);
                }}
                style={[styles.iconBtn, !isUnread && { backgroundColor: `${theme.primary}1F` }]}>
                <Ionicons
                  name="mail-open-outline"
                  size={14}
                  color={!isUnread ? theme.primary : theme.textSecondary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as unread"
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  markAnnouncementUnread(announcement.id);
                }}
                style={[styles.iconBtn, isUnread && { backgroundColor: `${theme.accentRed}1F` }]}>
                <Ionicons
                  name="mail-unread-outline"
                  size={14}
                  color={isUnread ? theme.accentRed : theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </ThemedView>
    </Pressable>
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 4,
  },
  dateTime: {
    fontSize: 10,
    lineHeight: 13,
    flexShrink: 1,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  iconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
