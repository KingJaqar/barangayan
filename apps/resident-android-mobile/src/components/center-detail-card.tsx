import { StyleSheet, View } from 'react-native';

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
}

export function CenterDetailCard({
  name,
  address,
  distanceKm,
  walkingTimeMins,
  currentOccupancy,
  capacity,
  isRoadRoute,
}: CenterDetailCardProps) {
  const theme = useTheme();

  const occupancyFraction = capacity && capacity > 0 ? currentOccupancy / capacity : 0;
  const occupancyPercent = Math.round(occupancyFraction * 100);

  const isFull = occupancyPercent >= 100;
  const isHigh = occupancyPercent >= 80;

  const barColor = isFull ? '#DC2626' : isHigh ? '#D97706' : '#0F6E5B';
  const textColor = isFull ? '#DC2626' : isHigh ? '#D97706' : '#0F6E5B';

  const displayOccupancy = isFull ? 'FULL' : `${occupancyPercent}%`;
  const capacityText =
    capacity !== null && capacity !== undefined
      ? ` (${currentOccupancy.toLocaleString()}/${capacity.toLocaleString()})`
      : '';

  const distanceDisplay = distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '--';
  const walkingDisplay = walkingTimeMins > 0 ? `${walkingTimeMins} min` : '--';

  return (
    <View style={[styles.card, { backgroundColor: `${theme.background}D9`, borderColor: theme.backgroundSelected }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <ThemedText type="smallBold" style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.address} numberOfLines={1}>
            {address}
          </ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: isFull ? '#FEE2E2' : isHigh ? '#FEF3C7' : '#D1FAE5' }]}>
          <ThemedText type="smallBold" style={[styles.badgeText, { color: textColor }]}>
            {displayOccupancy}{capacityText}
          </ThemedText>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <ThemedText type="smallBold" style={[styles.metricValue, { color: theme.text }]}>
            {walkingDisplay}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.metricLabel}>
            Walking{isRoadRoute ? ' (road)' : ' (est.)'}
          </ThemedText>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.metricItem}>
          <ThemedText type="smallBold" style={[styles.metricValue, { color: theme.text }]}>
            {distanceDisplay}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.metricLabel}>
            Distance
          </ThemedText>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: barColor, width: `${Math.min(occupancyPercent, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  address: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    gap: 1,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  metricDivider: {
    width: 1,
    height: 18,
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
