import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Fixed brand green for the "completed" pill — deliberately Colors.light.primary, NOT
// theme.primary. theme.primary is the user's Settings > App Theme accent color (which can
// itself be blue/red/purple), so it must never drive status semantics — otherwise two
// different statuses (e.g. Processing/blue and a blue-accent user's Completed) could
// render identically.
const STATUS_GREEN = Colors.light.primary; // === Colors.dark.primary, '#0F6E5B'
const STATUS_BLUE = '#2563EB'; // matches the ACCENT_COLORS blue swatch value

interface StatusConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

/** service_requests.status -> {label, icon, color} the whole app should agree on. */
function useStatusConfig(status: string): StatusConfig {
  const theme = useTheme();
  const config: Record<string, StatusConfig> = {
    submitted: { label: 'Submitted', icon: 'time-outline', color: theme.textSecondary },
    in_progress: { label: 'Processing', icon: 'sync-outline', color: STATUS_BLUE },
    completed: { label: 'Ready for Pickup', icon: 'checkmark-circle-outline', color: STATUS_GREEN },
    cancelled: { label: 'Cancelled', icon: 'close-circle-outline', color: theme.accentRed },
  };
  return config[status] ?? { label: status, icon: 'help-circle-outline', color: theme.textSecondary };
}

/** Colored pill for a service_requests.status value — icon + label, ~15% alpha-tinted
 * background (the same `${color}26` convention SettingsIcon already uses). */
export function StatusBadge({ status }: { status: string }) {
  const { label, icon, color } = useStatusConfig(status);

  return (
    <View style={[styles.pill, { backgroundColor: `${color}26` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
    alignSelf: 'flex-start',
  },
});
