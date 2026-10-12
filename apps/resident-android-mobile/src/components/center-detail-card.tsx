import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface CenterDetailCardProps {
  name: string;
  address: string;
  distanceKm: number;
  walkingTimeMins: number;
  currentOccupancy: number;
  capacity: number | null;
  /** True when distance/time come from a real OSRM road-following route (ticket 17)
   *  rather than the Haversine straight-line fallback. */
  isRoadRoute?: boolean;
  onClose?: () => void;
}

export function CenterDetailCard({
  name,
  address,
  distanceKm,
  walkingTimeMins,
  currentOccupancy,
  capacity,
  isRoadRoute,
  onClose,
}: CenterDetailCardProps) {
  const theme = useTheme();

  const occupancyFraction = capacity && capacity > 0 ? currentOccupancy / capacity : 0;
  const occupancyPercent = Math.round(occupancyFraction * 100);

  const isFull = occupancyPercent >= 100;
  const isHigh = occupancyPercent >= 80;

  const barColor = isFull ? '#DC2626' : isHigh ? '#D97706' : '#0F6E5B';
  const badgeBg = isFull ? '#FEE2E2' : isHigh ? '#FEF3C7' : '#D1FAE5';

  const displayOccupancy = isFull ? 'FULL' : `${occupancyPercent}% full`;
  const capacityText =
    capacity !== null && capacity !== undefined
      ? `${currentOccupancy.toLocaleString()} / ${capacity.toLocaleString()}`
      : null;

  const hasRoute = distanceKm > 0 && walkingTimeMins > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <ThemedText type="smallBold" style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.address} numberOfLines={1}>
            {address}
          </ThemedText>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close center details"
            style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <ThemedText type="smallBold" style={[styles.badgeText, { color: barColor }]}>
            {displayOccupancy}
          </ThemedText>
        </View>
        {capacityText ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
            {capacityText}
          </ThemedText>
        ) : null}
        <View style={styles.metaSpacer} />
        <Ionicons name="walk-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="smallBold" style={[styles.metaText, { color: theme.text }]}>
          {hasRoute
            ? `${walkingTimeMins} min · ${distanceKm.toFixed(1)} km${isRoadRoute ? '' : ' (est.)'}`
            : 'Location needed'}
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: barColor, width: `${Math.min(occupancyPercent, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleColumn: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  address: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaSpacer: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});
