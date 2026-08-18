import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Href, Link, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { CustomAccentColorModal } from '@/components/custom-accent-color-modal';
import { DeleteAccountModal } from '@/components/delete-account-modal';
import { Divider } from '@/components/divider';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PreferenceToggle } from '@/components/preference-toggle';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsIcon } from '@/components/settings-icon';
import { ThemedText } from '@/components/themed-text';
import { ACCENT_COLORS, Fonts, Spacing } from '@/constants/theme';
import { getMobileFontFamily, MOBILE_FONT_OPTIONS } from '@/constants/fonts';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { useAuth } from '@/hooks/use-auth';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { MAX_CUSTOM_COLORS, useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { supabase } from '@/lib/supabase';

// supabase.functions.invoke() surfaces a non-2xx response as a generic
// FunctionsHttpError ("Edge Function returned a non-2xx status code") — the
// actual `{ error: "..." }` body our edge functions send (e.g. export's
// rate-limit message, delete's failure reasons) only lives on error.context,
// the raw Response. Unwrap it so Alert.alert shows the real message instead
// of a useless generic one.
async function toEdgeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return new Error(body.error);
    } catch {
      // Response wasn't JSON (or already consumed) — fall through to the generic error.
    }
  }
  return error instanceof Error ? error : new Error('Something went wrong. Please try again.');
}

export default function SettingsScreen() {
  const { session, logout } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { scheme, accentColor, setThemePreference, setAccentColor, customColors, addCustomColor, removeCustomColor } =
    useThemePreference();
  const [isCustomColorModalVisible, setIsCustomColorModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const { fontId, setFontId } = useFontPreference();
  const { pushEnabled, setPushEnabled } = useNotificationPreferences();

  // SMS stays local-state only — no backend requested, out of scope per the plan.
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  async function handleLogout() {
    // Stays on this screen the whole time — logout() flips into Guest Mode instead of
    // returning to Onboarding, so this just re-renders with the guest view once it
    // resolves (see useAuth's logout for why isGuest is set before the signOut await).
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  }

  // ── Data Privacy Act: Download My Data ───────────────────────────────────
  // Asks for a format *before* calling the edge function — the export is
  // rate-limited (see export-my-data/index.ts), so the format picker itself
  // must not spend a call; only the actually-chosen export does.
  function handleDownloadData() {
    if (!session) return;
    Alert.alert('Download My Data', 'Choose a format for your export.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'PDF (readable)', onPress: () => runDataExport('pdf') },
      { text: 'JSON (raw data)', onPress: () => runDataExport('json') },
    ]);
  }

  async function runDataExport(format: 'json' | 'pdf') {
    setIsExportingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-my-data');
      if (error) throw await toEdgeFunctionError(error);

      const dateStr = new Date().toISOString().slice(0, 10);
      const canShare = await Sharing.isAvailableAsync();

      // Legacy filesystem API throughout this function, not the new File/Paths
      // one: in Expo Go, Paths.cache resolves to an experience-isolated
      // directory that Expo Go's bundled Android FileProvider config doesn't
      // recognize, so sharing a URI under it fails with "Not allowed to read
      // file under given URL". FileSystem.cacheDirectory (legacy) is the one
      // directory Expo Go's sharing has reliably supported for years.
      const FileSystem = await import('expo-file-system/legacy');

      if (format === 'pdf') {
        const [{ buildDataExportHtml }, Print] = await Promise.all([
          import('@/lib/data-export-pdf'),
          import('expo-print'),
        ]);
        const { uri: printedUri } = await Print.printToFileAsync({
          html: buildDataExportHtml(data as Record<string, unknown>),
        });

        // printToFileAsync is native Android code — it writes straight into
        // the OS-level cache dir, bypassing expo-file-system entirely, so its
        // output isn't under the scoped directory above either. Copying it
        // there first is the same fix as the JSON case, one layer down: get
        // the file into the one place Expo Go's FileProvider will actually
        // let expo-sharing read from.
        const fileUri = `${FileSystem.cacheDirectory}barangayan-my-data-${dateStr}.pdf`;
        await FileSystem.copyAsync({ from: printedUri, to: fileUri });

        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save my data' });
        } else {
          Alert.alert('Export Ready', `Your data was saved to ${fileUri}`);
        }
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}barangayan-my-data-${dateStr}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save my data' });
      } else {
        Alert.alert('Export Ready', `Your data was saved to ${fileUri}`);
      }
    } catch (e: unknown) {
      Alert.alert('Export Failed', e instanceof Error ? e.message : 'Could not export your data. Please try again.');
    } finally {
      setIsExportingData(false);
    }
  }

  // ── Data Privacy Act: Delete My Account ──────────────────────────────────
  // Two gates before this irreversible action runs: a plain confirm dialog,
  // then a password re-entry modal (a session left open on a shared/lost
  // device shouldn't be enough on its own to permanently delete an account).
  function handleDeleteAccount() {
    if (!session) return;
    Alert.alert(
      'Delete Your Account?',
      'This permanently anonymizes your profile and signs you out of Barangayan for good. Your service request and incident history stays on file for the barangay\'s records, but is no longer linked to your name. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: () => setIsDeleteModalVisible(true) },
      ],
    );
  }

  async function confirmDeleteAccount(password: string) {
    const email = session?.user?.email;
    if (!email) {
      throw new Error('Your account has no email on file, so your password cannot be verified. Contact barangay staff for help.');
    }

    // Re-authenticate first — mirrors change-password.tsx's rationale: the
    // delete-my-account function only checks that the caller holds *a*
    // valid session, not that the person holding it is the account owner
    // right now.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
    if (reauthError) {
      if (reauthError.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Incorrect password.');
      }
      if (reauthError.message.toLowerCase().includes('rate limit')) {
        throw new Error('Too many attempts. Please wait a moment and try again.');
      }
      throw reauthError;
    }

    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-my-account');
      if (error) throw await toEdgeFunctionError(error);
      setIsDeleteModalVisible(false);
      await logout();
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Settings
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
        {session ? (
          <Section title="Account">
            <Card>
              <Link href="/settings/profile" asChild>
                <Pressable style={styles.row}>
                  <Avatar
                    fullName={profile?.full_name ?? 'Resident'}
                    imageUrl={(profile as any)?.avatar_url ?? null}
                  />
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
              <Divider />
              {/* Deferred verification — nonblocking, informational only. Once SMTP is
                  available this becomes an active "Verify Email" entry point. */}
              <View style={styles.row}>
                <SettingsIcon name="mail" />
                <View style={styles.rowText}>
                  <ThemedText>Email Verification</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {profile?.email_verification_status === 'verified'
                      ? 'Your email is verified ✓'
                      : 'Verify Your Email'}
                  </ThemedText>
                </View>
              </View>
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

              <ScrollableChevronRow contentContainerStyle={styles.swatchRow}>
                {ACCENT_COLORS.map((color) => (
                  <Pressable key={color} onPress={() => setAccentColor(color)}>
                    <View style={[styles.swatch, { backgroundColor: color }]}>
                      {accentColor === color ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
                    </View>
                  </Pressable>
                ))}

                {customColors.length > 0 ? <View style={[styles.swatchDivider, { backgroundColor: theme.backgroundSelected }]} /> : null}

                {customColors.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setAccentColor(color)}
                    onLongPress={() =>
                      Alert.alert('Remove Custom Color', `Remove ${color} from your saved colors?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeCustomColor(color) },
                      ])
                    }>
                    <View style={[styles.swatch, { backgroundColor: color }]}>
                      {accentColor === color ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
                    </View>
                  </Pressable>
                ))}

                <Pressable onPress={() => setIsCustomColorModalVisible(true)}>
                  <View style={[styles.swatch, styles.addSwatch, { borderColor: theme.backgroundSelected }]}>
                    <Ionicons name="add" size={20} color={theme.textSecondary} />
                  </View>
                </Pressable>
              </ScrollableChevronRow>

              {customColors.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.customColorHint}>
                  {customColors.length}/{MAX_CUSTOM_COLORS} custom colors saved · hold a swatch to remove it
                </ThemedText>
              ) : null}
            </View>

            <Divider />

            <View style={styles.themeSection}>
              <View style={styles.themeRow}>
                <SettingsIcon name="text" />
                <ThemedText style={styles.rowLabel}>Font Style</ThemedText>
              </View>

              <ScrollableChevronRow contentContainerStyle={styles.fontRow}>
                {MOBILE_FONT_OPTIONS.map((font) => {
                  const isActive = fontId === font.id;
                  return (
                    <Pressable key={font.id} onPress={() => setFontId(font.id)}>
                      <View
                        style={[
                          styles.fontChip,
                          {
                            backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                            borderColor: isActive ? theme.primary : theme.backgroundSelected,
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.fontChipLabel,
                            { color: isActive ? '#ffffff' : theme.text, fontFamily: getMobileFontFamily(font.id) },
                          ]}>
                          {font.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollableChevronRow>
            </View>
          </Card>
        </Section>

        {session ? (
          <Section title="Privacy & Data">
            <Card>
              <Pressable style={styles.row} onPress={handleDownloadData} disabled={isExportingData}>
                <SettingsIcon name="download" />
                <ThemedText style={styles.rowLabel}>
                  {isExportingData ? 'Preparing export…' : 'Download My Data'}
                </ThemedText>
                <Chevron />
              </Pressable>
              <Divider />
              <Pressable style={styles.row} onPress={handleDeleteAccount} disabled={isDeletingAccount}>
                <SettingsIcon name="trash" color={theme.accentRed} />
                <ThemedText style={[styles.rowLabel, { color: theme.accentRed }]}>Delete My Account</ThemedText>
                <Chevron color={theme.accentRed} />
              </Pressable>
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
      </View>

      <LoadingOverlay
        // While the password modal is open it shows its own inline spinner
        // (see DeleteAccountModal) — the full-screen overlay only takes over
        // once that modal has closed and the final logout() is in flight, so
        // the two loading indicators never stack.
        visible={isLoggingOut || (isDeletingAccount && !isDeleteModalVisible)}
        label={isDeletingAccount ? 'Deleting account...' : 'Logging out...'}
      />

      <DeleteAccountModal
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={confirmDeleteAccount}
      />

      <CustomAccentColorModal
        visible={isCustomColorModalVisible}
        onClose={() => setIsCustomColorModalVisible(false)}
        atLimit={customColors.length >= MAX_CUSTOM_COLORS}
        onSave={(color) => {
          const added = addCustomColor(color);
          if (added) setAccentColor(color);
          return added;
        }}
      />
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
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
    paddingHorizontal: Spacing.two,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: Spacing.one,
  },
  addSwatch: {
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  customColorHint: {
    textAlign: 'center',
  },
  fontRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  fontChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fontChipLabel: {
    fontSize: 14,
  },
});
