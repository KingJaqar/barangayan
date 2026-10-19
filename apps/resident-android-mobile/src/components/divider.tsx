import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Hairline separator between rows inside a <Card>. */
export function Divider({ variant = 'default' }: { variant?: 'default' | 'resident' }) {
  const { resident } = useTheme();
  return <ThemedView type="backgroundSelected" style={[styles.divider, variant === 'resident' && { height: 1, marginHorizontal: 0, backgroundColor: resident.border }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
});
