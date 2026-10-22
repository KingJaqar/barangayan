import { Ionicons } from '@expo/vector-icons';
import { describeDeviceLocation, type DeviceLocationState, type LocationAction } from '@barangayan/shared';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACTION_LABELS: Record<LocationAction, string> = {
  locate: 'Use my location',
  retry: 'Try again',
  cancel: 'Stop',
  confirm: 'Use this location',
  reject: 'Discard',
  'open-settings': 'Open settings',
};

const TONE_ICONS = {
  info: 'navigate-outline',
  warning: 'alert-circle-outline',
  error: 'close-circle-outline',
} as const;

/** Device-location state and its actions for the Centers screen (DRRM routing plan R1). */
export function LocationStatusCard({
  state,
  onAction,
  style,
}: {
  state: DeviceLocationState;
  onAction: (action: LocationAction) => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const message = describeDeviceLocation(state, 'android');
  if (!message) return null;

  const iconColor = message.tone === 'info' ? theme.resident.accentText : theme.resident.danger;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }, style]}>
      <View style={styles.headerRow}>
        {message.busy ? (
          <ActivityIndicator size="small" color={theme.resident.accentText} />
        ) : (
          <Ionicons name={TONE_ICONS[message.tone]} size={18} color={iconColor} />
        )}
        <View style={styles.textColumn}>
          <ThemedText type="smallBold">{message.title}</ThemedText>
          {message.detail ? (
            <ThemedText type="small" themeColor="textSecondary">
              {message.detail}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {message.actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {message.actions.map((action, index) => {
            const primary = index === 0;
            return (
              <Pressable
                key={action}
                accessibilityRole="button"
                onPress={() => onAction(action)}
                style={[
                  styles.actionButton,
                  primary
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.resident.border },
                ]}>
                <ThemedText type="smallBold" style={{ color: primary ? theme.resident.onAccent : theme.text }}>
                  {ACTION_LABELS[action]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three - 4,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  textColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
