import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GuestAuthCalloutProps {
  tabName?: string;
  /** Overrides the default (household-oriented) explanation. */
  message?: string;
  /** Overrides the default headline. */
  title?: string;
  /** Ionicons name shown in the badge above the headline. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Set false to show only the Log In button. */
  showRegister?: boolean;
}

// Airbnb-style prompt: roomy card, left-aligned bold headline, muted copy and
// full-width stacked buttons (solid primary above an outlined secondary).
export function GuestAuthCallout({
  message = 'Log in or register an account to manage your household members and track family check-in status during emergencies.',
  title = 'Log in to continue',
  icon = 'people-outline',
  showRegister = true,
}: GuestAuthCalloutProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={[styles.iconBadge, { backgroundColor: `${theme.primary}1A` }]}>
          <Ionicons name={icon} size={28} color={theme.primary} />
        </View>

        <View style={styles.textBlock}>
          <ThemedText style={[styles.title, { color: theme.text }]}>{title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {message}
          </ThemedText>
        </View>

        <View style={styles.buttonColumn}>
          <Link href="/(auth)/login" asChild>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
              style={StyleSheet.flatten([styles.button, { backgroundColor: theme.primary }])}>
              <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>Log in</ThemedText>
            </Pressable>
          </Link>

          {showRegister && (
            <Link href="/(auth)/register" asChild>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                style={StyleSheet.flatten([styles.button, styles.outlined, { borderColor: theme.text }])}>
                <ThemedText style={[styles.buttonText, { color: theme.text }]}>Create account</ThemedText>
              </Pressable>
            </Link>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.five,
    gap: Spacing.five,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: { elevation: 4 },
    }),
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttonColumn: {
    gap: Spacing.three,
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
