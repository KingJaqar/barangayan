import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
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
  const { setGuest } = useAuth();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['top', 'left', 'right']}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: theme.primary, paddingTop: Spacing.five }]}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../../assets/logo/barangayan-logo-1024.png')}
              style={styles.logo}
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
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ThemedText style={styles.sheetTitle}>Get Started</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sheetSubtitle}>
            Join your community platform to stay connected, informed, and engaged.
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

          <Pressable
            onPress={() => {
              // Unlike the other transitions in this app, this one needs an explicit
              // navigate: entering guest mode makes BOTH (app) and (auth) reachable at
              // once (see _layout.tsx), so nothing auto-redirects away from this screen.
              setGuest(true);
              router.replace('/home');
            }}
            accessibilityRole="button"
            style={styles.guestLink}
            hitSlop={Spacing.two}>
            <ThemedText themeColor="textSecondary" style={styles.guestLinkText}>
              Browse public updates as a guest
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  logoBadge: {
    width: 220,
    height: 220,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  // 150% larger than the original 56×56 (56 + 150% = 140).
  logo: { width: 140, height: 140 },
  heroTitle: { fontSize: 26, fontWeight: '700' },
  heroSubtitle: { fontSize: 14, opacity: 0.85, textAlign: 'center' },

  sheet: {
    flex: 1,
    marginTop: -Spacing.five,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700' },
  sheetSubtitle: { fontSize: 14, marginTop: Spacing.one, lineHeight: 20 },

  actions: {
    gap: Spacing.two,
    marginTop: Spacing.five,
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    marginTop: Spacing.four,
    alignSelf: 'center',
  },
  guestLinkText: { fontSize: 14, fontWeight: '600' },
});
