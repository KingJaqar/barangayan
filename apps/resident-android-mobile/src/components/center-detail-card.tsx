import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { centerOccupancy } from '@/lib/center-presentation';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

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
  compact?: boolean;
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
  compact = false,
}: CenterDetailCardProps) {
  const theme = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const showDetails = !compact || detailsExpanded;

  const occupancy = centerOccupancy(currentOccupancy, capacity);
  const barColor = theme.resident[occupancy.tone];
  const badgeBg = occupancy.tone === 'muted' ? theme.resident.surface : theme.resident[`${occupancy.tone}Soft`];
  const displayOccupancy = occupancy.percent === null ? 'Capacity unknown' : occupancy.percent >= 100 ? 'FULL' : `${occupancy.percent}% full`;
  const capacityText = capacity !== null && capacity > 0 ? `${currentOccupancy.toLocaleString()} / ${capacity.toLocaleString()}` : null;
  const hasRoute = distanceKm !== undefined && Number.isFinite(distanceKm) && distanceKm >= 0 && walkingTimeMins !== undefined && walkingTimeMins > 0;

  return (
    <View style={[styles.card, compact && styles.compactCard, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
      <View style={[styles.headerRow, compact && styles.compactHeader]}>
        <View style={[styles.titleColumn, compact && styles.compactCopy]}>
          <ThemedText type="smallBold" style={[!compact && styles.name, { color: theme.resident.text }]}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={!compact && styles.address}>
            {address}
          </ThemedText>
          {compact ? <View style={styles.summaryRow}>
            <Ionicons name="walk-outline" size={16} color={theme.resident.muted} />
            <ThemedText type="small" style={styles.summaryText}>{hasRoute ? `${walkingTimeMins} min · ${distanceKm?.toFixed(1)} km${isRoadRoute ? '' : ' (est.)'}` : 'Walking distance unavailable'}</ThemedText>
          </View> : null}
        </View>
        <View style={compact && styles.compactActions}>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close center details"
            style={[styles.closeButton, compact && styles.compactClose, { backgroundColor: theme.resident.surface }]}>
            <Ionicons name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        {compact ? <Pressable accessibilityRole="button" accessibilityLabel={detailsExpanded ? 'Hide center details' : 'Show center details'} accessibilityState={{ expanded: detailsExpanded }} onPress={() => setDetailsExpanded(value => !value)} style={styles.detailsToggle}>
          <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>{detailsExpanded ? 'Less' : 'Details'}</ThemedText>
          <Ionicons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.resident.accentText} />
        </Pressable> : null}
        </View>
      </View>

      {showDetails ? <View style={styles.metaRow}>
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
        {!compact ? <><View style={styles.metaSpacer} />
        <Ionicons name="walk-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="smallBold" style={[styles.metaText, { color: theme.text }]}>
          {hasRoute
            ? `${walkingTimeMins} min · ${distanceKm?.toFixed(1)} km${isRoadRoute ? '' : ' (est.)'}`
            : 'Walking distance unavailable'}
        </ThemedText></> : null}
      </View> : null}

      {showDetails ? <View style={[styles.track, { backgroundColor: theme.resident.surface }]}>
        <View style={[styles.fill, { backgroundColor: barColor, width: `${occupancy.fill}%` }]} />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, gap: 0 },
  compactHeader: { alignItems: 'center', gap: Spacing.one },
  compactCopy: { gap: Spacing.half, justifyContent: 'center', minWidth: 0 },
  compactActions: { alignItems: 'flex-end', flexShrink: 0 },
  compactClose: { width: 44, height: 44, borderRadius: 22 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  summaryText: { flex: 1, minWidth: 0 },
  detailsToggle: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
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
