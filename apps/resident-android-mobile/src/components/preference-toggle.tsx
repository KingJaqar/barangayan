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
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
        thumbColor="#ffffff"
      />
      {value ? (
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <Ionicons name="checkmark" size={9} color="#ffffff" />
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
