import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { CountBadge } from '@/components/count-badge';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

/** Presentational unread indicator. The tap target is provided by the caller — on the
 * Home screen it is wrapped in a `Link href="/reports?tab=announcements"` + `Pressable`,
 * which navigates to the Announcements sub-tab. Keep this component itself tap-target-free
 * so it can be embedded in any context without double-Pressable nesting.
 *
 * Shows the same live announcements-unread count as the Reports bottom-tab's red badge
 * (both read from useUnreadCounts(), one source of truth) — deliberately NOT active or
 * resolved reports, per the Home bell's announcements-only scope. Clears the moment the
 * resident taps "Mark all as read" in the Announcements segment, wherever they do it from. */
export function NotificationBell({ size = 24 }: { size?: number }) {
  const theme = useTheme();
  const { announcementsUnreadCount } = useUnreadCounts();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons name="notifications-outline" size={size} color={theme.text} />
      <View style={styles.badge}>
        <CountBadge count={announcementsUnreadCount} background={theme.accentRed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
  },
});
