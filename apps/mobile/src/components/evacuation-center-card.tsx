import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FACILITY_ICON_MAP: Record<string, { icon: string; label: string }> = {
  medical_desk: { icon: 'medkit-outline', label: 'Medical Desk' },
  medical: { icon: 'medkit-outline', label: 'Medical' },
  pet_friendly: { icon: 'paw-outline', label: 'Pet Friendly' },
  generator: { icon: 'flash-outline', label: 'Generator' },
  catering: { icon: 'restaurant-outline', label: 'Catering' },
  children: { icon: 'people-outline', label: 'Children' },
  toilets: { icon: 'water-outline', label: 'Toilets' },
  internet: { icon: 'wifi-outline', label: 'Internet' },
};

export type EvacuationCenterCardProps = {
  name: string;
  address: string;
  distanceKm: number;
  estimatedMinutes: number;
  currentOccupancy: number;
  capacity: number | null;
  facilities: string[];
  verified?: boolean;
};

export function EvacuationCenterCard({
  name,
  address,
  distanceKm,
  estimatedMinutes,
  currentOccupancy,
  capacity,
  facilities,
  verified = false,
}: EvacuationCenterCardProps) {
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
      ? `(${currentOccupancy.toLocaleString()}/${capacity.toLocaleString()})`
      : '';

  const distanceDisplay =
    distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '--';
  const estimatedDisplay =
    estimatedMinutes > 0 ? `Est. ${estimatedMinutes} min` : '';

  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={[styles.name, { color: theme.text }]}>
              {name}
            </ThemedText>
            {verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: '#0F6E5B' }]}>
                <ThemedText style={[styles.verifiedIcon, { color: '#FFFFFF' }]}>✓</ThemedText>
              </View>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.address}>
            {address}
          </ThemedText>
        </View>
        <View style={styles.distanceColumn}>
          {distanceDisplay !== '--' && (
            <View style={styles.distanceRow}>
              <ThemedText style={[styles.distanceText, { color: theme.text }]}>📍 {distanceDisplay}</ThemedText>
            </View>
          )}
          {estimatedDisplay ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.estimatedText}>
              {estimatedDisplay}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.occupancySection}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.occupancyLabel}>
          Occupancy
        </ThemedText>
        <ThemedText type="smallBold" style={[styles.occupancyValue, { color: textColor }]}>
          {displayOccupancy} {capacityText}
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: barColor, width: `${Math.min(occupancyFraction * 100, 100)}%` }]} />
      </View>

      {facilities.length > 0 && (
        <View style={styles.tagsRow}>
          {facilities.map((facilityKey) => {
            const facility = FACILITY_ICON_MAP[facilityKey];
            if (!facility) return null;
            return (
              <View key={facilityKey} style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[styles.tagIcon, { color: theme.textSecondary }]}>{facility.icon}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.tagLabel}>
                  {facility.label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  titleColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    flex: 1,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
    lineHeight: 18,
  },
  distanceColumn: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  estimatedText: {
    fontSize: 12,
    lineHeight: 16,
  },
  occupancySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  occupancyLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  occupancyValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagIcon: {
    fontSize: 14,
  },
  tagLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
});
