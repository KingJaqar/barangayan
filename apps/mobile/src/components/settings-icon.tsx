import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** The tinted-circle icon treatment used on every Settings row. */
export function SettingsIcon({
  name,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  /** Defaults to the current accent color; pass accentRed for destructive rows. */
  color?: string;
}) {
  const theme = useTheme();
  const tint = color ?? theme.primary;

  return (
    <View style={[styles.circle, { backgroundColor: `${tint}26` }]}>
      <Ionicons name={name} size={18} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
