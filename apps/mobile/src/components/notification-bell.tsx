import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Presentational unread indicator. The tap target is provided by the caller — on the
 * Home screen it is wrapped in a `Link href="/reports?tab=announcements"` + `Pressable`,
 * which navigates to the Announcements sub-tab. Keep this component itself tap-target-free
 * so it can be embedded in any context without double-Pressable nesting. */
export function NotificationBell({ size = 24 }: { size?: number }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons name="notifications-outline" size={size} color={theme.text} />
      <View style={[styles.dot, { backgroundColor: theme.accentRed, borderColor: theme.background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
