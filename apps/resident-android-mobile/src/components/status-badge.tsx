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
function useStatusConfig(status: string, resident: boolean): StatusConfig {
  const theme = useTheme();
  const config: Record<string, StatusConfig> = {
    submitted: { label: 'Submitted', icon: 'time-outline', color: theme.textSecondary },
    in_progress: { label: 'Processing', icon: 'sync-outline', color: resident ? theme.resident.info : STATUS_BLUE },
    ready_for_pickup: { label: 'Ready for Pickup', icon: 'storefront-outline', color: resident ? theme.resident.success : STATUS_GREEN },
    completed: { label: 'Completed', icon: 'checkmark-circle-outline', color: resident ? theme.resident.success : STATUS_GREEN },
    cancelled: { label: 'Cancelled', icon: 'close-circle-outline', color: resident ? theme.resident.danger : theme.accentRed },
  };
  return config[status] ?? { label: status, icon: 'help-circle-outline', color: theme.textSecondary };
}

/** Colored pill for a service_requests.status value — icon + label, ~15% alpha-tinted
 * background (the same `${color}26` convention SettingsIcon already uses). */
export function StatusBadge({ status, presentation = 'default' }: { status: string; presentation?: 'default' | 'resident' }) {
  const resident = presentation === 'resident';
  const { label, icon, color } = useStatusConfig(status, resident);
  const theme = useTheme();
  const background = !resident ? `${color}26` : status === 'in_progress' ? theme.resident.infoSoft : status === 'cancelled' ? theme.resident.dangerSoft : status === 'completed' || status === 'ready_for_pickup' ? theme.resident.successSoft : theme.resident.surface;

  return (
    <View style={[styles.pill, { backgroundColor: background }, resident && { maxWidth: '100%' }]}>
      <Ionicons name={icon} size={12} color={color} />
      <ThemedText type="small" style={[{ color }, resident && { fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1 }]}>
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
