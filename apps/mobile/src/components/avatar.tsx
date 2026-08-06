import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Initials-based avatar — no photo storage exists yet (same deferral as Register/
 * Profile's ID upload), so this stands in for a real profile photo.
 */
export function Avatar({ fullName, size = 48 }: { fullName: string; size?: number }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primary },
      ]}>
      <ThemedText type="smallBold" style={[styles.initials, { color: theme.onPrimary }]}>
        {getInitials(fullName)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 16,
  },
});
