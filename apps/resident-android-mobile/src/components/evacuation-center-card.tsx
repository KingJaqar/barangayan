import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FACILITY_ICON_MAP: Record<string, { icon: ComponentProps<typeof Ionicons>['name']; label: string }> = {
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
  minHeight?: number;
  onContentLayout?: (event: LayoutChangeEvent) => void;
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
  minHeight,
  onContentLayout,
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
    <View testID="center-card" style={[styles.card, { minHeight, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
      <View onLayout={onContentLayout} style={styles.content}>
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
        </View>
        {(distanceDisplay !== '--' || estimatedDisplay) ? (
          <View style={styles.distanceColumn}>
            {distanceDisplay !== '--' && (
              <View style={styles.distanceRow}>
                <Ionicons name="walk-outline" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.distanceText, { color: theme.text }]}>{distanceDisplay}</ThemedText>
              </View>
            )}
            {estimatedDisplay ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.estimatedText}>
                {estimatedDisplay}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

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
                  <Ionicons name={facility.icon} size={13} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.tagLabel}>
                    {facility.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
  },
  // Measure natural content, independently of the shared outer minimum height.
  // Long names, wrapped facilities, and larger fonts remain fully visible.
  content: {
    padding: 12,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    flex: 1,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  address: {
    fontSize: 12,
    lineHeight: 16,
  },
  distanceColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  estimatedText: {
    fontSize: 12,
    lineHeight: 16,
  },
  occupancySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  occupancyLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  occupancyValue: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
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
    gap: Spacing.one,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  tagLabel: {
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
  },
});
