import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Resident Settings row tile. Semantic destructive colors stay independent of the accent. */
export function SettingsIcon({
  name,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  /** Defaults to the current accent color; pass accentRed for destructive rows. */
  color?: string;
}) {
  const theme = useTheme();
  const tint = color ?? theme.resident.accentText;

  return (
    <View style={[styles.circle, { backgroundColor: color ? theme.resident.dangerSoft : theme.resident.accentSoft }]}>
      <Ionicons name={name} size={20} color={tint} accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
