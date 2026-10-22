import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Approximates the reference screenshot's ON-state thumb (a small checkmark badge
 * overlapping the switch) on top of a standard RN Switch, rather than a fully custom
 * gesture-driven control.
 */
export function PreferenceToggle({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.resident.accent, false: theme.resident.controlBorder }}
        thumbColor={value ? theme.resident.onAccent : theme.resident.card}
      />
      {value ? (
        <View pointerEvents="none" accessible={false} style={[styles.badge, { backgroundColor: theme.resident.accent, borderColor: theme.resident.card }]}>
          <Ionicons name="checkmark" size={9} color={theme.resident.onAccent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 51,
    height: 31,
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
