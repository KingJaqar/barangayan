import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Centered, blocking loading indicator for a short-lived async action (e.g. Settings >
 * Logout's "Logging out..." while supabase.auth.signOut() is in flight) — a translucent
 * scrim behind a theme-aware card, so it reads correctly in both Light and Dark mode and
 * with any accent color.
 */
export function LoadingOverlay({ visible, label }: { visible: boolean; label: string }) {
  const theme = useTheme();

  return (
    // No animationType: RN Web's fade/slide transitions wait on a CSS `animationend`
    // event before actually unmounting, which never fires if the tab isn't being
    // painted/composited (e.g. backgrounded) — better for a functional loading
    // indicator to show/hide immediately than to risk getting stuck on-screen.
    <Modal visible={visible} transparent statusBarTranslucent>
      <View style={styles.scrim}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="smallBold">{label}</ThemedText>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    minWidth: 180,
  },
});
