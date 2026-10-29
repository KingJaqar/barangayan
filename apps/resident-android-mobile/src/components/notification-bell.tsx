import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { CountBadge } from '@/components/count-badge';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

/** Announcement unread count from the shared provider, used by the header bell. */
export function NotificationBell({ size = 24, color, presentation = 'default' }: { size?: number; color?: string; presentation?: 'default' | 'resident' }) {
  const theme = useTheme();
  const { announcementsUnreadCount } = useUnreadCounts();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons name="notifications-outline" size={size} color={color ?? theme.text} />
      <View style={[styles.badge, presentation === 'resident' && { top: -7, right: -5 }]}>
        <CountBadge count={announcementsUnreadCount} background={theme.accentRed} presentation={presentation} size={18} outlineWidth={0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wide enough that the "99+" pill is never squeezed to the icon's width; the badge stays right-aligned to its anchor.
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 48,
    alignItems: 'flex-end',
  },
});
