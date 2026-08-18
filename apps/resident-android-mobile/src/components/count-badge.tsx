import { StyleSheet, Text, View } from 'react-native';

/**
 * White-on-dark-color round pill used for the Reports bottom-tab's three live unread
 * counts (active reports / resolved reports / announcements) and the Home bell.
 * Renders nothing at count <= 0 — an "always visible, even at 0" badge for a live count
 * the resident hasn't looked at yet reads as UI clutter rather than a status indicator,
 * so this hides at zero and reappears the instant a live count ticks up past it.
 */
export function CountBadge({ count, background }: { count: number; background: string }) {
  if (count <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={styles.label} numberOfLines={1}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
