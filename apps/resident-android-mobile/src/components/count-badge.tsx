import { StyleSheet, Text, View } from 'react-native';

/**
 * White-on-dark-color round badge used for the Reports bottom-tab's three live unread
 * counts (active reports / resolved reports / announcements) and the Home bell.
 * Renders nothing at count <= 0 — an "always visible, even at 0" badge for a live count
 * the resident hasn't looked at yet reads as UI clutter rather than a status indicator,
 * so this hides at zero and reappears the instant a live count ticks up past it.
 *
 * Fixed width+height (not `minWidth`) up to 2 digits so every badge is always a true
 * circle — active reports tends to sit at 2 digits far more often than the other two
 * (it has no "mark as read" to reset it back down), and letting the box grow with the
 * text turned it into a stretched pill next to the other two's circles. Only the rare
 * "99+" overflow case is allowed to widen into a pill, same as most badge conventions.
 */
export function CountBadge({ count, background }: { count: number; background: string }) {
  if (count <= 0) return null;

  const isOverflow = count > 99;

  return (
    <View
      style={[
        styles.badge,
        isOverflow ? styles.badgeOverflow : styles.badgeCircle,
        { backgroundColor: background },
      ]}>
      <Text style={styles.label} numberOfLines={1}>
        {isOverflow ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  badgeOverflow: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
