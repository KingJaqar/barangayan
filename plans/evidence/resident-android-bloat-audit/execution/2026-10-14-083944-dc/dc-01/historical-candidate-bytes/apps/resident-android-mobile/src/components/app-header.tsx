import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Full-bleed green banner (logo + "Barangayan" wordmark) shared by Home and Services.
 * Bleeds into the status-bar area via useSafeAreaInsets() — the screen root using this
 * must be a plain View (not SafeAreaView), same as Home's/Settings' existing pattern. */
export function AppHeader() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.banner, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
      <Image
        source={require('@/assets/logo/barangayan-logo-1024.png')}
        style={styles.bannerLogo}
        contentFit="contain"
      />
      <ThemedText type="smallBold" style={[styles.bannerWordmark, { color: theme.onPrimary }]}>
        Barangayan
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  bannerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  bannerWordmark: {
    fontFamily: Fonts.serif,
    fontSize: 20,
  },
});
