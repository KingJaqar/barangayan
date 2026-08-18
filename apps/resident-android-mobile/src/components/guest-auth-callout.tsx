import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GuestAuthCalloutProps {
  tabName?: string;
}

export function GuestAuthCallout({ tabName = 'this section' }: GuestAuthCalloutProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="people-outline" size={28} color={theme.primary} />
        </View>

        <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
          Account Required
        </ThemedText>

        <ThemedText themeColor="textSecondary" style={styles.body}>
          Log in or register an account to manage your household members and track family check-in status during emergencies.
        </ThemedText>

        <View style={styles.buttonRow}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={StyleSheet.flatten([styles.primaryButton, { backgroundColor: theme.primary }])}>
              <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                Log In
              </ThemedText>
            </Pressable>
          </Link>

          <Link href="/(auth)/register" asChild>
            <Pressable style={StyleSheet.flatten([styles.secondaryButton, { borderColor: theme.primary }])}>
              <ThemedText style={[styles.secondaryButtonText, { color: theme.primary }]}>
                Create Account
              </ThemedText>
            </Pressable>
          </Link>
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
    paddingHorizontal: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
