import type { ReactNode } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ResidentLayout } from '@/constants/resident-theme';
import { useTheme } from '@/hooks/use-theme';

/** Rounded, clipped backgroundElement container for grouped rows — pair with <Divider /> between rows. */
export function Card({ children, style, variant = 'default', ...props }: ViewProps & { children: ReactNode; variant?: 'default' | 'resident' | 'residentRow' }) {
  const { resident } = useTheme();
  return (
    <ThemedView type="backgroundElement" {...props} style={[
      styles.card,
      variant === 'resident' && { backgroundColor: resident.card, borderColor: resident.border, borderWidth: 1, borderRadius: ResidentLayout.panelRadius },
      variant === 'residentRow' && { backgroundColor: resident.card, borderRadius: 0, padding: ResidentLayout.rowPadding },
      style,
    ]}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
});
