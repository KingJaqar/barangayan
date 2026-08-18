import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
 * Avatar — shows a profile photo when `imageUrl` is provided, otherwise falls
 * back to computed initials from `fullName`, or an icon glyph when `icon` is set.
 *
 * Pass `icon` instead of `fullName` for a non-person placeholder (e.g. Home's
 * guest-mode "Login" avatar). The `imageUrl` prop accepts any public URL (the
 * avatar_url stored in the profiles table).
 */
export function Avatar({
  fullName,
  imageUrl,
  size = 48,
  icon,
  color,
}: {
  fullName?: string;
  /** Public URL of the resident's profile photo. When set, renders the photo
   *  instead of initials. Supply the avatar_url from the profiles table. */
  imageUrl?: string | null;
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
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : icon ? (
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
    overflow: 'hidden',
  },
  initials: {},
});
