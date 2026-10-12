import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { GuestBrowseButton } from '@/components/guest-browse-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * App entry / auth gate. Layout mirrors Settings > Profile's brand-green header
 * treatment: a theme.primary hero panel (logo + tagline) with the interactive
 * content living in a white sheet that overlaps it — see AGENTS.md task note
 * "copy the profile header style" for why this isn't a plain centered form.
 */
export default function AuthChoiceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height - insets.top - insets.bottom < 600;
  const badgeSize = compact ? 72 : height < 740 ? 112 : 160;
  const logoSize = compact ? 52 : height < 740 ? 80 : 112;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['top', 'left', 'right']}>
      <ScrollView style={[styles.root, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false} alwaysBounceVertical={false} overScrollMode="never">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: theme.primary, paddingTop: compact ? 12 : 20, paddingBottom: compact ? 32 : 40 }]}>
          <View style={[styles.logoBadge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize * 0.27 }]}>
            <Image
              source={require('../../../assets/logo/barangayan-logo-1024.png')}
              style={{ width: logoSize, height: logoSize }}
              contentFit="contain"
              accessibilityLabel="Barangayan logo"
            />
          </View>
          <ThemedText style={[styles.heroTitle, { color: theme.onPrimary }]}>Barangayan</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.onPrimary }]}>
            One barangay, one account.
          </ThemedText>
        </View>

        {/* ── Sheet ────────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.two },
          ]}>
          <ThemedText style={styles.sheetTitle}>Get Started</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sheetSubtitle}>
            Stay connected to your barangay community.
          </ThemedText>

          <View style={styles.actions}>
            <PrimaryButton
              label="Create an Account"
              onPress={() => router.push('/(auth)/register')}
            />
            <PrimaryButton
              label="I'm a Resident, Log In"
              variant="secondary"
              onPress={() => router.push('/(auth)/login')}
            />
          </View>

          <View style={styles.guestAction}>
            <GuestBrowseButton />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  hero: {
    alignItems: 'center',
    gap: 6,
  },
  logoBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 26, lineHeight: 30, fontWeight: '700' },
  heroSubtitle: { fontSize: 14, lineHeight: 20, opacity: 0.85, textAlign: 'center' },

  sheet: {
    flex: 1,
    marginTop: -Spacing.four,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingTop: 20,
  },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  sheetSubtitle: { fontSize: 14, marginTop: Spacing.one, lineHeight: 20 },

  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  guestAction: { marginTop: Spacing.one },
});
