import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { SettingsRow } from '@/components/settings-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

// Settings landing screen — one scrollable screen with sections (Account, Preferences,
// Privacy & Data, About), matching the design file. Preferences toggles and Privacy&Data
// actions are inline here, not separate pushed screens; Profile/Change Password/Terms &
// Privacy/About/Help Center are. Toggle/action wiring is real UI, not yet backed by
// Supabase — that lands with the rest of the "Static shells" task.
export default function SettingsScreen() {
  const { session } = useAuth();
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {session ? (
        <Section title="Account">
          <SettingsRow label="Profile" href="/settings/profile" subtitle="View and edit your details" />
          <SettingsRow label="Change Password" href="/settings/change-password" />
        </Section>
      ) : (
        <Section title="Account">
          <ThemedView type="backgroundElement" style={styles.guestCard}>
            <ThemedText type="small" themeColor="textSecondary">
              You're browsing as a guest. Log in or create an account to request documents,
              track requests, and see your profile.
            </ThemedText>
            <PrimaryButton label="Log In" onPress={() => router.push('/(auth)/login')} />
            <PrimaryButton
              label="Create an Account"
              variant="secondary"
              onPress={() => router.push('/(auth)/register')}
            />
          </ThemedView>
        </Section>
      )}

      <Section title="Preferences">
        <ToggleRow label="Push Notifications" />
        <ToggleRow label="SMS Notifications" />
      </Section>

      {session ? (
        <Section title="Privacy & Data">
          <ThemedText themeColor="textSecondary" type="small">
            Download My Data / Delete My Account — coming soon.
          </ThemedText>
        </Section>
      ) : null}

      <Section title="About">
        <SettingsRow label="Help Center" href="/settings/help" />
        <SettingsRow label="Terms & Privacy Policy" href="/settings/terms-privacy" />
        <SettingsRow label="About Barangayan" href="/settings/about" />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function ToggleRow({ label }: { label: string }) {
  return (
    <View style={styles.toggleRow}>
      <ThemedText>{label}</ThemedText>
      <Switch value={false} onValueChange={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
    opacity: 0.6,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  guestCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
});
