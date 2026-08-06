import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Href, Link, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PreferenceToggle } from '@/components/preference-toggle';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsIcon } from '@/components/settings-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT_COLORS, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';

export default function SettingsScreen() {
  const { session, logout } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { scheme, accentColor, setThemePreference, setAccentColor } = useThemePreference();

  // Presentational only for this pass, per the plan's explicit scope call — App Theme is
  // the one Preferences control that's real.
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    // Stays on this screen the whole time — logout() flips into Guest Mode instead of
    // returning to Onboarding, so this just re-renders with the guest view once it
    // resolves (see useAuth's logout for why isGuest is set before the signOut await).
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="smallBold" style={[styles.headerTitle, { color: theme.onPrimary }]}>
          Settings
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {session ? (
          <Section title="Account">
            <Card>
              <Link href="/settings/profile" asChild>
                <Pressable style={styles.row}>
                  <Avatar fullName={profile?.full_name ?? 'Resident'} />
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold">{profile?.full_name ?? '—'}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Edit Profile
                    </ThemedText>
                  </View>
                  <Chevron />
                </Pressable>
              </Link>
              <Divider />
              <Link href="/settings/change-password" asChild>
                <Pressable style={styles.row}>
                  <SettingsIcon name="lock-closed" />
                  <ThemedText style={styles.rowLabel}>Change Password</ThemedText>
                  <Chevron />
                </Pressable>
              </Link>
            </Card>
          </Section>
        ) : null}

        <Section title="Preferences">
          <Card>
            {session ? (
              <>
                <View style={styles.row}>
                  <SettingsIcon name="notifications" />
                  <View style={styles.rowText}>
                    <ThemedText>Push Notifications</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Alerts and updates
                    </ThemedText>
                  </View>
                  <PreferenceToggle value={pushEnabled} onValueChange={setPushEnabled} />
                </View>
                <Divider />
                <View style={styles.row}>
                  <SettingsIcon name="chatbubble-ellipses" />
                  <View style={styles.rowText}>
                    <ThemedText>SMS Notifications</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Urgent community alerts
                    </ThemedText>
                  </View>
                  <PreferenceToggle value={smsEnabled} onValueChange={setSmsEnabled} />
                </View>
                <Divider />
              </>
            ) : null}

            <View style={styles.themeSection}>
              <View style={styles.themeRow}>
                <SettingsIcon name="color-palette" />
                <ThemedText style={styles.rowLabel}>App Theme</ThemedText>
              </View>

              <SegmentedControl
                variant="outline"
                segments={[
                  { key: 'light', label: 'Light' },
                  { key: 'dark', label: 'Dark' },
                ]}
                activeKey={scheme}
                onChange={(key) => setThemePreference(key as ThemePreference)}
              />

              <View style={styles.swatchRow}>
                {ACCENT_COLORS.map((color) => (
                  <Pressable key={color} onPress={() => setAccentColor(color)}>
                    <View style={[styles.swatch, { backgroundColor: color }]}>
                      {accentColor === color ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        </Section>

        {session ? (
          <Section title="Privacy & Data">
            <Card>
              <View style={styles.row}>
                <SettingsIcon name="download" />
                <ThemedText style={styles.rowLabel}>Download My Data</ThemedText>
                <Chevron />
              </View>
              <Divider />
              <View style={styles.row}>
                <SettingsIcon name="trash" color={theme.accentRed} />
                <ThemedText style={[styles.rowLabel, { color: theme.accentRed }]}>Delete My Account</ThemedText>
                <Chevron color={theme.accentRed} />
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title="About">
          <Card>
            <AboutRow icon="help-circle" label="Help Center" href="/settings/help" />
            <Divider />
            <AboutRow icon="document-text" label="Terms & Privacy Policy" href="/settings/terms-privacy" />
            <Divider />
            <View style={styles.row}>
              <SettingsIcon name="information-circle" />
              <ThemedText style={styles.rowLabel}>App Version</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                v{Constants.expoConfig?.version ?? '1.0.0'}
              </ThemedText>
            </View>
            <Divider />
            <AboutRow icon="people" label="About Us" href="/settings/about" />
          </Card>
        </Section>

        <Section title="Session">
          <Card>
            {session ? (
              <Pressable style={styles.row} onPress={handleLogout}>
                <SettingsIcon name="log-out" color={theme.accentRed} />
                <ThemedText style={[styles.rowLabel, { color: theme.accentRed }]}>Logout</ThemedText>
                <Chevron color={theme.accentRed} />
              </Pressable>
            ) : (
              <Pressable style={styles.row} onPress={() => router.push('/(auth)/login')}>
                <SettingsIcon name="log-in" color={theme.accentRed} />
                <ThemedText style={[styles.rowLabel, { color: theme.accentRed }]}>Login</ThemedText>
                <Chevron color={theme.accentRed} />
              </Pressable>
            )}
          </Card>
        </Section>
      </ScrollView>

      <LoadingOverlay visible={isLoggingOut} label="Logging out..." />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function Chevron({ color }: { color?: string }) {
  return (
    <ThemedText themeColor={color ? undefined : 'textSecondary'} style={color ? { color } : undefined}>
      {'›'}
    </ThemedText>
  );
}

function AboutRow({
  icon,
  label,
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.row}>
        <SettingsIcon name={icon} />
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <Chevron />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
  },
  content: {
    padding: Spacing.three,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowLabel: {
    flex: 1,
  },
  themeSection: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'center',
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
