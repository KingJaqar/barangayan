import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { centerOccupancy } from '@/lib/center-presentation';
import { useTheme } from '@/hooks/use-theme';

export interface CenterDetailCardProps {
  name: string;
  address: string;
  distanceKm?: number;
  walkingTimeMins?: number;
  currentOccupancy: number;
  capacity: number | null;
  /** True when metrics come from the selected walking route. */
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

  const occupancy = centerOccupancy(currentOccupancy, capacity);
  const barColor = theme.resident[occupancy.tone];
  const badgeBg = occupancy.tone === 'muted' ? theme.resident.surface : theme.resident[`${occupancy.tone}Soft`];
  const displayOccupancy = occupancy.percent === null ? 'Capacity unknown' : occupancy.percent >= 100 ? 'FULL' : `${occupancy.percent}% full`;
  const capacityText = capacity !== null && capacity > 0 ? `${currentOccupancy.toLocaleString()} / ${capacity.toLocaleString()}` : null;
  const hasRoute = distanceKm !== undefined && Number.isFinite(distanceKm) && distanceKm >= 0 && walkingTimeMins !== undefined && walkingTimeMins > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <ThemedText type="smallBold" style={[styles.name, { color: theme.text }]}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.address}>
            {address}
          </ThemedText>
        </View>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close center details"
            style={[styles.closeButton, { backgroundColor: theme.resident.surface }]}>
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
            ? `${walkingTimeMins} min · ${distanceKm?.toFixed(1)} km${isRoadRoute ? '' : ' (est.)'}`
            : 'Walking distance unavailable'}
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.resident.surface }]}>
        <View style={[styles.fill, { backgroundColor: barColor, width: `${occupancy.fill}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
