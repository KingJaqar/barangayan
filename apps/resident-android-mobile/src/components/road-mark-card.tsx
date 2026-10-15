import { Ionicons } from '@expo/vector-icons';
import type { RoutingEdge } from '@barangayan/shared/src/lib/evacuation-routing';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LocalAvoidanceRecord } from '@/lib/offline-routing';

/**
 * Local avoidance (DRRM routing plan section 4): the resident taps a road segment and blocks
 * it in both directions for routes on this phone only. It is never sent as a verified closure,
 * never expires on its own, and is removed only here.
 */
export function RoadMarkCard({
  selected,
  noRoadAtTap,
  records,
  unresolvedIds,
  busy,
  error,
  onConfirm,
  onRemove,
  onClose,
  style,
}: {
  selected: RoutingEdge | null;
  noRoadAtTap: boolean;
  records: readonly LocalAvoidanceRecord[];
  unresolvedIds: readonly string[];
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onRemove: (recordId: string) => void;
  onClose: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }, style]}>
      <View style={styles.header}>
        <Ionicons name="remove-circle-outline" size={18} color={theme.accentRed} />
        <ThemedText type="smallBold" style={styles.flex}>
          Block a road you cannot pass
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Close road blocking" hitSlop={8} onPress={onClose}>
          <Ionicons name="close" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Tap the road on the map. It is avoided by routes on this phone only and is not reported to the barangay.
      </ThemedText>
      {noRoadAtTap ? (
        <ThemedText type="small" style={{ color: theme.accentRed }}>
          No road within 25 m of that spot. Tap closer to the road line.
        </ThemedText>
      ) : null}
      {selected ? (
        <View style={styles.confirmRow}>
          <ThemedText type="smallBold" style={styles.flex}>
            {selected.name ?? 'Unnamed path'}
            {selected.bridge ? ' (bridge)' : ''} · {Math.round(selected.lengthMeters)} m
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onConfirm}
            style={[styles.button, { backgroundColor: theme.accentRed }]}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.buttonText}>Block road</ThemedText>}
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.accentRed }}>
          {error}
        </ThemedText>
      ) : null}
      {records.length > 0 ? (
        <ScrollView style={styles.list} nestedScrollEnabled>
          <ThemedText type="smallBold">Your blocked roads ({records.length})</ThemedText>
          {records.map(record => (
            <View key={record.id} style={styles.recordRow}>
              <View style={styles.flex}>
                <ThemedText type="small">{record.name ?? 'Unnamed path'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {unresolvedIds.includes(record.id) ? 'Does not match the installed map · ' : ''}
                  Blocked {new Date(record.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => onRemove(record.id)} hitSlop={6}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  button: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 96,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
  },
  list: {
    maxHeight: 132,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 4,
  },
});
