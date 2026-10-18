import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { CountBadge } from '@/components/count-badge';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

/** Announcement unread count from the shared provider, used by the header bell. */
export function NotificationBell({ size = 24, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const { announcementsUnreadCount } = useUnreadCounts();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons name="notifications-outline" size={size} color={color ?? theme.text} />
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
