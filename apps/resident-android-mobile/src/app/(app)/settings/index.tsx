import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { Ionicons } from '@expo/vector-icons';
import { idVerificationState } from '@barangayan/shared';
import Constants from 'expo-constants';
import { Href, Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Alert, Animated as NativeAnimated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { CustomAccentColorModal } from '@/components/custom-accent-color-modal';
import { DeleteAccountModal } from '@/components/delete-account-modal';
import { Divider } from '@/components/divider';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PrimaryButton } from '@/components/primary-button';
import { PreferenceToggle } from '@/components/preference-toggle';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsIcon } from '@/components/settings-icon';
import { ThemedText } from '@/components/themed-text';
import { ACCENT_COLORS, Spacing } from '@/constants/theme';
import { getResidentTheme } from '@/constants/resident-theme';
import { getMobileFontFamily, MOBILE_FONT_OPTIONS } from '@/constants/fonts';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { useAuth } from '@/hooks/use-auth';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { MAX_CUSTOM_COLORS, useThemePreference } from '@/hooks/use-theme-preference';
import { clearGoogleReauthentication, googleReauthentication, startGoogleAuth } from '@/lib/google-auth';
import { accountSettingsRows, deletionConfirmation } from '@/lib/sensitive-auth';
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
  const { session, logout, setup, setupRefreshError, refreshCompletion } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError } = useProfile();
  const idVerified = !profileLoading && !profileError && idVerificationState(profile) === 'verified';
  const idStatus = idVerified ? 'Verified' : profileLoading ? 'Checking verification…' : profileError ? 'Verification unavailable' : profile?.id_verification_status === 'pending' ? 'Pending verification' : profile?.id_verification_status === 'verification_failed' ? 'Verification failed — try again' : 'Not verified';
  const rows = accountSettingsRows(setup);
  const router = useRouter();
  const theme = useTheme();
  const reduced = useResidentReducedMotion(true);
  const bottomTabInset = useFloatingTabInset();
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
  const [isConfirmingGoogle, setIsConfirmingGoogle] = useState(false);
  const [isGoogleDeleteReady, setIsGoogleDeleteReady] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  async function handleLogout() {
    // Auth removes the signed-in stack and opens Log In after logout.
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
    // The confirmation step depends on the server-maintained password state: an
    // existing (or unknown legacy) password is re-entered; a passwordless Google
    // resident confirms with fresh same-account Google authentication instead.
    const method = deletionConfirmation(setup);
    if (method === 'unavailable') {
      Alert.alert('Account Status Unavailable', 'We could not confirm how to verify your account. Retry, then try again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => { void refreshCompletion(); } },
      ]);
      return;
    }
    if (method === 'recover_first') {
      Alert.alert('Set a Password First', 'Your account has no password and no linked Google sign-in to confirm it is you. Set a password with password recovery from Change Password, then delete your account.');
      return;
    }
    Alert.alert(
      'Delete Your Account?',
      'This permanently anonymizes your profile and signs you out of Barangayan for good. Your service request and incident history stays on file for the barangay\'s records, but is no longer linked to your name. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        method === 'google'
          ? { text: 'Confirm with Google', style: 'destructive', onPress: () => { void confirmDeleteWithGoogle(); } }
          : { text: 'Delete Account', style: 'destructive', onPress: () => setIsDeleteModalVisible(true) },
      ],
    );
  }

  // ── Passwordless Google deletion ─────────────────────────────────────────
  // Results are rendered from state (inline notice / modal), not Alert: an Alert
  // raised while Android is returning from the browser can be silently dropped.
  async function confirmDeleteWithGoogle() {
    if (isConfirmingGoogle || isDeletingAccount) return;
    setDeleteNotice(null);
    setIsConfirmingGoogle(true);
    try {
      await startGoogleAuth('reauthenticate', 'delete_account');
    } catch (e: unknown) {
      setDeleteNotice(`Account not deleted. ${e instanceof Error ? e.message : 'Google confirmation did not finish.'}`);
      return;
    } finally {
      setIsConfirmingGoogle(false);
    }
    await offerGoogleConfirmedDeletion();
  }

  // Runs after the in-app return and after a callback that routed back to Settings.
  // Still requires an explicit final tap; cancelling consumes the confirmation.
  const offerGoogleConfirmedDeletion = useCallback(async () => {
    setIsGoogleDeleteReady((await googleReauthentication('delete_account').catch(() => 'none')) === 'fresh');
  }, []);
  // Only the focused Settings screen may show the final dialog.
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    void offerGoogleConfirmedDeletion();
    return () => setIsFocused(false);
  }, [offerGoogleConfirmedDeletion]));

  function cancelGoogleDeletion() {
    if (isDeletingAccount) return;
    setIsGoogleDeleteReady(false);
    setDeleteNotice('Account not deleted.');
    void clearGoogleReauthentication().catch(() => {});
  }

  async function deleteAfterGoogle() {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      // Recheck at the moment of the irreversible request, not when the dialog opened.
      if ((await googleReauthentication('delete_account')) !== 'fresh') {
        throw new Error('Your Google confirmation expired. Start Delete My Account again.');
      }
      const { error } = await supabase.functions.invoke('delete-my-account');
      if (error) throw await toEdgeFunctionError(error);
      setIsGoogleDeleteReady(false);
      await logout();
    } catch (e: unknown) {
      void clearGoogleReauthentication().catch(() => {});
      setIsGoogleDeleteReady(false);
      setDeleteNotice(`Account not deleted. ${e instanceof Error ? e.message : 'Please try again.'}`);
    } finally {
      setIsDeletingAccount(false);
    }
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
    const { data: reauthData, error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
    if (!reauthError && reauthData.user?.id !== session?.user.id) {
      throw new Error('The account changed. Sign in to your own account and try again.');
    }
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
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + Spacing.three }]}>
        {session ? (
          <>
          <Card variant="resident" style={styles.profileCard}>
            <Link href="/settings/profile" asChild>
              <Pressable style={styles.profileRow} accessibilityRole="button" accessibilityLabel={`${profile?.full_name ?? 'Profile'}, Edit Profile, ${rows.profile.subtitle}`}>
                <Avatar fullName={profile?.full_name ?? 'Resident'} imageUrl={profile?.avatar_url} size={80} foregroundColor={theme.resident.onAccent} />
                <View style={styles.rowText}>
                  <ThemedText style={styles.profileName}>{profile?.full_name ?? 'Resident'}</ThemedText>
                  <ThemedText style={styles.profileEmail} themeColor="textSecondary">{profile?.email ?? session.user.email}</ThemedText>
                  <ThemedText style={[styles.editProfile, { color: theme.resident.accentText }]}>Edit Profile</ThemedText>
                  {rows.profile.warning ? <StatusLine text={rows.profile.subtitle} warning /> : null}
                </View>
              </Pressable>
            </Link>
          </Card>
          <Section title="Account">
            <Card variant="resident">
              <Link href="/settings/valid-id" asChild>
                <Pressable accessibilityRole="button" style={styles.row} accessibilityLabel={`Valid ID, ${idStatus}`}>
                  <SettingsIcon name="card" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>Valid ID</ThemedText>
                    <View style={styles.verifiedStatus}>
                      <Ionicons name={idVerified ? 'checkmark-circle' : 'warning'} size={16} color={idVerified ? theme.resident.success : theme.resident.danger} accessible={false} />
                      <ThemedText type="small" style={{ color: idVerified ? theme.resident.success : theme.resident.danger }}>{idStatus}</ThemedText>
                    </View>
                  </View>
                  <Chevron />
                </Pressable>
              </Link>
              <Divider variant="resident" />
              <Link href="/settings/change-password" asChild>
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={[rows.password.title, rows.password.subtitle].filter(Boolean).join(', ')}>
                  <SettingsIcon name="lock-closed" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>{rows.password.title}</ThemedText>
                    {rows.password.subtitle ? <StatusLine text={rows.password.subtitle} warning={rows.password.warning} /> : null}
                  </View>
                  <Chevron />
                </Pressable>
              </Link>
              {setupRefreshError ? (
                <>
                  <Divider variant="resident" />
                  <Pressable
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={`${setupRefreshError} Retry account status`}
                    onPress={() => { void refreshCompletion(); }}>
                    <SettingsIcon name="refresh" />
                    <View style={styles.rowText}>
                      <ThemedText>Retry account status</ThemedText>
                      <ThemedText type="small" themeColor="accentRed" accessibilityLiveRegion="polite">
                        {setupRefreshError}
                      </ThemedText>
                    </View>
                  </Pressable>
                </>
              ) : null}
              <Divider variant="resident" />
              <Link href="/settings/email-verification" asChild>
              <Pressable accessibilityRole="button" style={styles.row}>
                <SettingsIcon name="mail" />
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>Email Verification</ThemedText>
                  {profile?.email_verification_status === 'verified' ? (
                    <View style={styles.verifiedStatus} accessibilityLabel="Your email is verified">
                      <Ionicons name="checkmark-circle" size={16} color={theme.resident.success} />
                      <ThemedText type="smallBold" style={{ color: theme.resident.success }}>Verified</ThemedText>
                    </View>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">Verify Your Email</ThemedText>
                  )}
                </View>
                <Chevron />
              </Pressable>
              </Link>
              <Divider variant="resident" />
              <Link href="/settings/location-verification" asChild>
                <Pressable accessibilityRole="button" style={styles.row}>
                  <SettingsIcon name="location" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>Location Verification</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {profile?.verified_location
                        ? 'Your location is verified ✓'
                        : 'Pin your exact location'}
                    </ThemedText>
                  </View>
                  <Chevron />
                </Pressable>
              </Link>
            </Card>
          </Section>
          </>
        ) : null}

        <Section title="Preferences">
          <Card variant="resident">
            {session ? (
              <>
                <View style={styles.row}>
                  <SettingsIcon name="notifications" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>Push Notifications</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Alerts and updates
                    </ThemedText>
                  </View>
                  <PreferenceToggle label="Push Notifications" value={pushEnabled} onValueChange={setPushEnabled} />
                </View>
                <Divider variant="resident" />
                <View style={styles.row}>
                  <SettingsIcon name="chatbubble-ellipses" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>SMS Notifications</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Local preference only · SMS delivery is unavailable
                    </ThemedText>
                  </View>
                  <PreferenceToggle label="SMS Notifications — local preference only" value={smsEnabled} onValueChange={setSmsEnabled} />
                </View>
                <Divider variant="resident" />
              </>
            ) : null}

            <View style={styles.themeSection}>
              <View style={styles.themeRow}>
                <SettingsIcon name="color-palette" />
                <ThemedText style={styles.rowLabel}>App Theme</ThemedText>
              </View>

              <SegmentedControl
                presentation="resident"
                variant="outline"
                segments={[
                  { key: 'light', label: 'Light' },
                  { key: 'dark', label: 'Dark' },
                ]}
                activeKey={scheme}
                onChange={setThemePreference}
              />

              <ScrollableChevronRow label="accent colors" contentContainerStyle={styles.swatchRow}>
                {ACCENT_COLORS.map((color) => (
                  <AccentSwatch key={color} color={color} reduced={reduced} selected={accentColor.toLowerCase() === color.toLowerCase()} onSelect={() => setAccentColor(color)} />
                ))}

                {customColors.length > 0 ? <View style={[styles.swatchDivider, { backgroundColor: theme.backgroundSelected }]} /> : null}

                {customColors.map((color) => (
                  <AccentSwatch
                    key={color}
                    color={color}
                    reduced={reduced}
                    selected={accentColor.toLowerCase() === color.toLowerCase()}
                    onSelect={() => setAccentColor(color)}
                    onRemove={() =>
                      Alert.alert('Remove Custom Color', `Remove ${color} from your saved colors?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeCustomColor(color) },
                      ])
                    }
                  />
                ))}

                <Pressable accessibilityRole="button" accessibilityLabel="Add a custom color" onPress={() => setIsCustomColorModalVisible(true)}>
                  <View style={[styles.swatch, styles.addSwatch, { borderColor: theme.backgroundSelected }]}>
                    <Ionicons name="add" size={20} color={theme.textSecondary} />
                  </View>
                </Pressable>
              </ScrollableChevronRow>

              <ThemedText type="small" themeColor="textSecondary" style={styles.customColorHint}>
                {customColors.length}/{MAX_CUSTOM_COLORS} custom colors saved · hold a swatch to remove it
              </ThemedText>
            </View>

            <Divider variant="resident" />

            <View style={styles.themeSection}>
              <View style={styles.themeRow}>
                <SettingsIcon name="text" />
                <ThemedText style={styles.rowLabel}>Font Style</ThemedText>
              </View>

              <ScrollableChevronRow label="fonts" contentContainerStyle={styles.fontRow}>
                {MOBILE_FONT_OPTIONS.map((font) => {
                  const isActive = fontId === font.id;
                  return (
                    <Pressable key={font.id} accessibilityRole="button" accessibilityLabel={font.label} accessibilityState={{ selected: isActive }} onPress={() => setFontId(font.id)}>
                      <View
                        style={[
                          styles.fontChip,
                          {
                            backgroundColor: isActive ? theme.resident.accent : theme.resident.card,
                            borderColor: isActive ? theme.resident.accentText : theme.resident.border,
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.fontChipLabel,
                            { color: isActive ? theme.resident.onAccent : theme.resident.text, fontFamily: getMobileFontFamily(font.id) },
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
            <Card variant="resident">
              <Pressable accessibilityRole="button" style={styles.row} onPress={handleDownloadData} disabled={isExportingData}>
                <SettingsIcon name="download" />
                <ThemedText style={styles.rowLabel}>
                  {isExportingData ? 'Preparing export…' : 'Download My Data'}
                </ThemedText>
                <Chevron />
              </Pressable>
              <Divider variant="resident" />
              <Pressable accessibilityRole="button" style={styles.row} onPress={handleDeleteAccount} disabled={isDeletingAccount || isConfirmingGoogle}>
                <SettingsIcon name="trash" color={theme.resident.danger} />
                <ThemedText style={[styles.rowLabel, { color: theme.resident.danger }]}>
                  {isConfirmingGoogle ? 'Confirming with Google…' : 'Delete My Account'}
                </ThemedText>
                <Chevron color={theme.resident.danger} />
              </Pressable>
              {deleteNotice ? (
                <ThemedText type="small" themeColor="accentRed" accessibilityLiveRegion="polite" style={styles.deleteNotice}>
                  {deleteNotice}
                </ThemedText>
              ) : null}
            </Card>
          </Section>
        ) : null}

        <Section title="About">
          <Card variant="resident">
            <AboutRow icon="help-circle" label="Help Center" href="/settings/help" />
            <Divider variant="resident" />
            <AboutRow icon="document-text" label="Terms & Privacy Policy" href="/settings/terms-privacy" />
            <Divider variant="resident" />
            <View style={styles.row}>
              <SettingsIcon name="information-circle" />
              <ThemedText style={styles.rowLabel}>App Version</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Constants.expoConfig?.version ? `v${Constants.expoConfig.version}` : 'Unavailable'}
              </ThemedText>
            </View>
            <Divider variant="resident" />
            <AboutRow icon="people" label="About Us" href="/settings/about" />
          </Card>
        </Section>

        <Section title="Session">
          <Card variant="resident">
            {session ? (
              <Pressable accessibilityRole="button" style={styles.row} onPress={handleLogout}>
                <SettingsIcon name="log-out" color={theme.resident.danger} />
                <ThemedText style={[styles.rowLabel, { color: theme.resident.danger }]}>Logout</ThemedText>
                <Chevron color={theme.resident.danger} />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" style={styles.row} onPress={() => router.push('/(auth)/login')}>
                <SettingsIcon name="log-in" color={theme.resident.danger} />
                <ThemedText style={[styles.rowLabel, { color: theme.resident.danger }]}>Login</ThemedText>
                <Chevron color={theme.resident.danger} />
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

      <GoogleDeletionDialog visible={isGoogleDeleteReady && isFocused && !!session} busy={isDeletingAccount}
        onCancel={cancelGoogleDeletion} onConfirm={() => { void deleteAfterGoogle(); }} />

      <DeleteAccountModal
        presentation="resident"
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={confirmDeleteAccount}
      />

      <CustomAccentColorModal
        initialColor={accentColor}
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
      <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function GoogleDeletionDialog({ visible, busy, onCancel, onConfirm }: {
  visible: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const { resident } = useTheme();
  const { mounted, panel, scrim, reduced } = useReportModalMotion(visible, 200, 200);
  return <Modal visible={mounted} transparent animationType="none" onRequestClose={onCancel}>
    <View style={styles.confirmOverlay}>
      <NativeAnimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel account deletion" />
      <NativeAnimated.View accessibilityViewIsModal pointerEvents={visible ? 'auto' : 'none'} style={[styles.confirmSheet, { backgroundColor: resident.card, opacity: panel,
        transform: [{ scale: reduced ? 1 : panel.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }]}>
        <ThemedText accessibilityRole="header" style={styles.confirmTitle}>Permanently Delete Account?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.confirmText}>Google confirmed it is you. Deleting cannot be undone.</ThemedText>
        <PrimaryButton presentation="resident" label="Delete Account" variant="destructiveFilled" loading={busy} onPress={onConfirm} />
        <PrimaryButton presentation="resident" label="Cancel" variant="secondary" disabled={busy} onPress={onCancel} />
      </NativeAnimated.View>
    </View>
  </Modal>;
}

function AccentSwatch({ color, selected, onSelect, onRemove, reduced }: {
  color: string; selected: boolean; onSelect: () => void; onRemove?: () => void; reduced: boolean;
}) {
  const { resident } = useTheme();
  const swatch = getResidentTheme('light', color);
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : scale.value }] }));
  useEffect(() => { if (reduced) scale.value = 1; return () => cancelAnimation(scale); }, [reduced, scale]);
  return <Animated.View style={motion}>
    <Pressable onPress={onSelect} onLongPress={onRemove} delayLongPress={550}
      onPressIn={() => { scale.value = reduced ? 1 : withTiming(0.95, { duration: 150, easing: Easing.bezier(0, 0, 0.58, 1) }); }}
      onPressOut={() => { scale.value = reduced ? 1 : withTiming(1, { duration: 150, easing: Easing.bezier(0, 0, 0.58, 1) }); }}
      accessibilityRole="button" accessibilityLabel={`${onRemove ? 'Custom color' : 'Accent color'} ${color}`}
      accessibilityHint={onRemove ? 'Hold to remove this saved color' : undefined} accessibilityState={{ selected }}
      style={[styles.swatchRing, { borderColor: selected ? resident.text : 'transparent' }]}>
      <View style={[styles.swatch, { backgroundColor: color, borderWidth: 1, borderColor: resident.controlBorder }]}>
        {selected ? <Ionicons name="checkmark" size={20} color={swatch.onAccent} /> : null}
      </View>
    </Pressable>
  </Animated.View>;
}

/** Secondary row text; a warning adds an icon and color, never color alone. */
function StatusLine({ text, warning }: { text: string; warning: boolean }) {
  const theme = useTheme();
  if (!warning) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    );
  }
  return (
    <View style={styles.warningLine}>
      <Ionicons name="alert-circle" size={14} color={theme.resident.danger} accessible={false} />
      <ThemedText type="small" themeColor="accentRed">
        {text}
      </ThemedText>
    </View>
  );
}

function Chevron({ color }: { color?: string }) {
  const { resident } = useTheme();
  return <Ionicons name="chevron-forward" size={20} color={color ?? resident.muted} accessible={false} />;
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
      <Pressable accessibilityRole="button" style={styles.row}>
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

  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  verifiedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '600',
  },
  rowTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '600' },
  warningLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  deleteNotice: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  confirmSheet: {
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  confirmTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  confirmText: {
    lineHeight: 20,
  },
  themeSection: {
    padding: 16,
    gap: 12,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  fontChipLabel: {
    fontSize: 14,
  },
  profileCard: { marginBottom: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  profileName: { fontSize: 19, lineHeight: 24, fontWeight: '800' },
  profileEmail: { fontSize: 13.5, lineHeight: 19 },
  editProfile: { fontSize: 13.5, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  swatchRing: { padding: 2, borderWidth: 2, borderRadius: 26 },
});
