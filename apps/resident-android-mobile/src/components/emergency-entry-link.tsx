import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Opens the public evacuation-centers screen, which needs no sign-in (DRRM routing plan R6,
 * invariant 9). Shown where authentication or account setup could otherwise hold a resident.
 */
export function EmergencyEntryLink({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open evacuation centers and routes, no sign-in needed"
      onPress={() => router.push('/emergency-centers')}
      style={[styles.link, { backgroundColor: theme.background, borderColor: theme.accentRed }, style]}>
      <Ionicons name="navigate-circle-outline" size={20} color={theme.accentRed} />
      <ThemedText type="smallBold" style={{ color: theme.accentRed }}>
        Evacuation centers & routes (no sign-in needed)
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
  },
});
