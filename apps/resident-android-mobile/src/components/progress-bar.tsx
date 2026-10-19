import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Fill-fraction bar shared by RequestsList and the Request Tracking screen — feed it a
 * 0-1 fraction from packages/shared's progressFraction(). */
export function ProgressBar({ fraction, color, presentation = 'default' }: { fraction: number; color: string; presentation?: 'default' | 'resident' }) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const value = resident ? (Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0) : fraction;
  return (
    <View accessibilityRole={resident ? 'progressbar' : undefined} accessibilityValue={resident ? { min: 0, max: 100, now: Math.round(value * 100) } : undefined} style={[styles.track, { backgroundColor: resident ? theme.resident.border : theme.backgroundSelected }]}>
      <View style={[styles.fill, { backgroundColor: color, width: `${value * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
