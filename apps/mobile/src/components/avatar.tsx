import { Ionicons } from '@expo/vector-icons';
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
 * Profile's ID upload), so this stands in for a real profile photo. Pass `icon` instead
 * of `fullName` for a non-person placeholder (e.g. Home's guest-mode "Login" avatar).
 */
export function Avatar({
  fullName,
  size = 48,
  icon,
  color,
}: {
  fullName?: string;
  size?: number;
  /** Renders this Ionicons glyph instead of computing initials from fullName. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the default theme.primary background — e.g. theme.accentRed for guest. */
  color?: string;
}) {
  const theme = useTheme();
  const backgroundColor = color ?? theme.primary;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}>
      {icon ? (
        <Ionicons name={icon} size={size * 0.5} color={theme.onPrimary} />
      ) : (
        <ThemedText
          type="smallBold"
          style={[styles.initials, { color: theme.onPrimary, fontSize: size * 0.33 }]}>
          {getInitials(fullName ?? '?')}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {},
});
