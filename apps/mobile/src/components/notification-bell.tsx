import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Presentational-only unread indicator — no notifications table/screen exists yet, so
 * there's no real tap target; a plain View (not Pressable) is more honest than a dead one. */
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
