import { changePasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { ActionSuccessModal } from '@/components/services/action-success-modal';
import { GoogleButton } from '@/components/google-button';
import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ResidentPasswordStep, type ResidentPasswordDraft } from '@/components/resident-password-step';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clearGoogleReauthentication, googleReauthentication } from '@/lib/google-auth';
import { passwordMode, type ReauthenticationState } from '@/lib/sensitive-auth';
import { authSetupRequests } from '@/lib/setup-request';
import { supabase } from '@/lib/supabase';

// ─── Live per-field validation ────────────────────────────────────────────────
// Mirrors the Register screen's as-you-type treatment (register.tsx's fieldStatus/
// validatePassword) — a red alert or green check appears below New Password the
// moment its value becomes invalid/valid, instead of waiting for Update Password
// to be pressed. Empty fields stay silent until a submit attempt populates
// fieldErrors (the "required" message).
function validateNewPassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters';
  return PASSWORD_COMPLEXITY_REGEX.test(value)
    ? null
    : 'Add an uppercase letter, a number, and a special character';
}

function fieldStatus(
  value: string,
  submitError: string | undefined,
  validate?: (value: string) => string | null,
  successMessage = ' ',
): { error?: string; success?: string } {
  if (!value) return submitError ? { error: submitError } : {};
  const message = validate?.(value);
  if (message) return { error: message };
  return { success: successMessage };
}

/** Centered, auto-dismissing confirmation used after the password update succeeds. */
function ResultPopup({
  visible,
  onDismiss,
  title = 'Password Updated',
  subtitle = 'Your password has been changed successfully.',
}: {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
}) {
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss.current(), 2200);
    return () => clearTimeout(timer);
  }, [visible]);
  return <ActionSuccessModal visible={visible} title={title} message={subtitle} onConfirm={onDismiss} />;
}

// Mode comes from the server-maintained password state: true → change with the
// current password; null (unknown history) → manage, never "not set"; false → first
// password, unlocked only by fresh same-account Google authentication.
export default function ChangePasswordScreen() {
  const { session, setup } = useAuth();
  const userId = session?.user.id ?? null;
  const creating = passwordMode(setup) === 'create_with_google';
  // Stay on first-password setup for this user after its own success refreshes the
  // status to passwordSet=true, so its confirmation can finish returning to Settings.
  const [firstPasswordUser, setFirstPasswordUser] = useState<string | null>(null);
  useEffect(() => { if (creating && userId) setFirstPasswordUser(userId); }, [creating, userId]);
  if (userId && (creating || firstPasswordUser === userId)) return <FirstPasswordFromSettings key={userId} />;
  return <ChangeOrManagePassword />;
}

function ChangeOrManagePassword() {
  const router = useRouter();
  const theme = useTheme();
  const { session, setup, refreshCompletion, setPasswordRecovery, setupRefreshError } = useAuth();
  const mode = passwordMode(setup);
  const pull = usePullRefresh([refreshCompletion]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const updating = useRef(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const hasEnteredBothPasswords = newPassword.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = hasEnteredBothPasswords && newPassword === confirmPassword;
  // The status row below is the single place that reports a mismatch in real time —
  // same treatment as Register's Confirm Password field. Keep any other Confirm
  // Password validation message, but avoid duplicating the schema's mismatch message
  // directly under the field after submission.
  const confirmPasswordError =
    fieldErrors.confirmPassword === "Passwords don't match" ? undefined : fieldErrors.confirmPassword;

  function handleForgotPassword() {
    if (loading) return;
    // Enable the existing login recovery stack before leaving the signed-in screen.
    setPasswordRecovery(true);
    router.replace('/(auth)/forgot-password');
  }

  async function handleUpdate() {
    if (updating.current) return;
    setError(null);
    setFieldErrors({});

    const result = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    const email = session?.user?.email;
    if (!email) {
      setError('Your account has no email on file, so the current password cannot be verified. Contact barangay staff for help.');
      return;
    }

    updating.current = true;
    setLoading(true);
    try {
      // Supabase's updateUser() doesn't check the old password — re-authenticate first so a
      // stolen/left-open session can't silently take over the account by setting a new one.
      const { data: reauthData, error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: result.data.currentPassword,
      });

      if (reauthError) {
        if (reauthError.message.toLowerCase().includes('invalid login credentials')) {
          setFieldErrors({ currentPassword: 'Current password is incorrect' });
        } else if (reauthError.message.toLowerCase().includes('rate limit')) {
          setError('Too many attempts. Please wait a moment and try again.');
        } else {
          setError(reauthError.message);
        }
        return;
      }
      if (reauthData.user?.id !== session?.user.id) {
        setError('The account changed. Sign in to your own account and try again.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: result.data.newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // The server observer records this write; refresh so Settings labels follow.
      void refreshCompletion();

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowSuccess(true);
    } catch {
      setError('Check your connection and try again.');
    } finally {
      updating.current = false;
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
      <View style={{ flex: 1, backgroundColor: theme.resident.card }}>
        <AuthHeader presentation="resident" title={mode === 'manage' ? 'Manage Password' : mode === 'recover_only' ? 'Set Password' : 'Change Password'} onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/settings');
        }} />

        {!session ? (
          <View style={styles.content}>
            <GuestPrompt label="Log in to change your password." />
          </View>
        ) : mode === 'loading' || mode === 'error' || mode === 'recover_only' ? (
          <View style={styles.content}>
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">
              {mode === 'loading'
                ? 'Checking your password status…'
                : mode === 'error'
                  ? 'Your password status could not be loaded. Retry before changing it.'
                  : 'Your account has no password and no linked Google sign-in to confirm it is you. Use password recovery to set a password through your email.'}
            </ThemedText>
            {mode === 'error' ? <PrimaryButton presentation="resident" label="Retry" onPress={() => { void refreshCompletion(); }} /> : null}
            {mode === 'recover_only' ? (
              <PrimaryButton presentation="resident" label="Recover password by email" onPress={handleForgotPassword} />
            ) : null}
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
            <ScrollView contentContainerStyle={[styles.content, styles.passwordContent]} keyboardShouldPersistTaps="handled"
              refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
              <View
                style={[
                  styles.introCard,
                  styles.passwordIntroCard,
                  { backgroundColor: theme.resident.surface, borderColor: theme.resident.border },
                ]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.resident.accentText} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
                  {mode === 'manage'
                    ? 'Your account has an existing password we cannot confirm. Enter it to change it, or recover it by email if you do not know it.'
                    : 'Enter your current password, then choose a new one — at least 8 characters, with an uppercase letter, a number, and a special character.'}
                </ThemedText>
              </View>
              {setupRefreshError ? (
                <ThemedText type="small" accessibilityLiveRegion="polite" themeColor="accentRed">
                  {setupRefreshError}
                </ThemedText>
              ) : null}

              <View
                style={[
                  styles.fieldsCard,
                ]}>
                <TextField presentation="resident"
                  label="Current Password"
                  required
                  value={currentPassword}
                  editable={!loading}
                  onChangeText={setCurrentPassword}
                  error={fieldErrors.currentPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  passwordVisibility={{ visible: showCurrent, onToggle: () => setShowCurrent((v) => !v) }}
                />
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={loading}
                  accessibilityRole="link"
                  accessibilityState={{ disabled: loading }}
                  style={[styles.forgotLink, { opacity: loading ? 0.5 : 1 }]}>
                  <ThemedText type="link" style={{ color: theme.resident.accentText, fontWeight: '600' }}>
                    Forgot Password?
                  </ThemedText>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.resident.border }]} />
                <TextField presentation="resident"
                  label="New Password"
                  required
                  value={newPassword}
                  editable={!loading}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  {...fieldStatus(newPassword, fieldErrors.newPassword, validateNewPassword, 'Password strength: good')}
                  passwordVisibility={{ visible: showNew, onToggle: () => setShowNew((v) => !v) }}
                />
                <TextField presentation="resident"
                  label="Confirm New Password"
                  required
                  value={confirmPassword}
                  editable={!loading}
                  onChangeText={setConfirmPassword}
                  error={confirmPasswordError}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  passwordVisibility={{ visible: showConfirm, onToggle: () => setShowConfirm((v) => !v) }}
                />
                {hasEnteredBothPasswords ? (
                  <View accessibilityLiveRegion="polite" style={styles.passwordMatchIndicator}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={16}
                      color={passwordsMatch ? theme.resident.success : theme.resident.danger}
                    />
                    <ThemedText type="small" style={{ color: passwordsMatch ? theme.resident.success : theme.resident.danger }}>
                      {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {error ? (
                <View accessibilityLiveRegion="polite"
                  style={[styles.errorBanner, { backgroundColor: theme.resident.card, borderColor: theme.resident.danger }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.resident.danger} />
                  <ThemedText type="small" style={[styles.errorText, { color: theme.resident.danger }]}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              <PrimaryButton presentation="resident" label="Update Password" loading={loading} onPress={handleUpdate} />
              {mode === 'manage' ? (
                <PrimaryButton presentation="resident"
                  label="Recover password by email"
                  variant="secondary"
                  disabled={loading}
                  onPress={handleForgotPassword}
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      <ResultPopup visible={showSuccess} onDismiss={() => { setShowSuccess(false); router.dismissTo('/settings'); }} />
    </SafeAreaView>
  );
}

/** First password from Settings for a passwordless Google resident. The write is
 * unlocked only by a completed same-user `set_password` Google attempt whose
 * Auth-recorded oauth sign-in is within the application window; it is rechecked
 * right before updateUser and consumed afterwards (or when the resident leaves). */
function FirstPasswordFromSettings() {
  const router = useRouter();
  const theme = useTheme();
  const { refreshCompletion } = useAuth();
  const [reauth, setReauth] = useState<ReauthenticationState | 'checking'>('checking');
  const [draft, setDraft] = useState<ResidentPasswordDraft>({ password: '', confirmPassword: '', uncertain: false });
  const [notice, setNotice] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const check = useCallback(async () => {
    try { setReauth(await googleReauthentication('set_password')); }
    catch { setReauth('none'); }
  }, []);
  useFocusEffect(useCallback(() => { void check(); }, [check]));
  const pull = usePullRefresh([check]);

  function leave() {
    if (authSetupRequests.busy) { setNotice('A request is still finishing. Please wait before leaving.'); return true; }
    if (draft.uncertain) { setNotice('Confirm whether your entered password was saved, or use password recovery, before leaving.'); return true; }
    setDraft({ password: '', confirmPassword: '', uncertain: false });
    void clearGoogleReauthentication().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
    return true;
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', leave);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.uncertain]);

  if (reauth === 'fresh') {
    return (
      <>
        <ResidentPasswordStep
          variant="settings"
          required={false}
          draft={draft}
          onDraftChange={setDraft}
          beforeWrite={async () => {
            if ((await googleReauthentication('set_password')) !== 'fresh') {
              setReauth('expired');
              throw new Error('Your Google confirmation expired. Confirm with Google again before setting a password.');
            }
          }}
          onSaved={async () => {
            await clearGoogleReauthentication().catch(() => {});
            await refreshCompletion();
            setShowSuccess(true);
          }}
          onSkip={() => { leave(); }}
          onBack={() => { leave(); }}
        />
        {notice ? <ThemedText accessibilityLiveRegion="polite" style={{ padding: Spacing.three, backgroundColor: theme.resident.card }}>{notice}</ThemedText> : null}
        <ResultPopup
          visible={showSuccess}
          title="Password Set"
          subtitle="You can now also sign in with your email and password."
          onDismiss={() => { setShowSuccess(false); router.dismissTo('/settings'); }}
        />
      </>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
      <View style={{ flex: 1, backgroundColor: theme.resident.card }}>
        <AuthHeader presentation="resident" title="Set Password" onBack={leave} />
        <ScrollView contentContainerStyle={styles.content}
          refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
          <View style={[styles.introCard, { backgroundColor: theme.resident.surface, borderColor: theme.resident.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.resident.accentText} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
              Your account does not have a password yet. To protect it, first confirm it is you with the same
              Google account. You will then have 5 minutes to set your password.
            </ThemedText>
          </View>
          {reauth === 'checking' ? (
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">Checking your Google confirmation…</ThemedText>
          ) : reauth === 'expired' || reauth === 'mismatch' ? (
            <ThemedText accessibilityLiveRegion="polite" themeColor="accentRed">
              Your Google confirmation expired or did not match this account. Confirm with Google again.
            </ThemedText>
          ) : null}
          <GoogleButton
            label="Confirm with Google"
            intent="reauthenticate"
            purpose="set_password"
            disabled={reauth === 'checking'}
            onComplete={() => { void check(); }}
          />
          {notice ? <ThemedText accessibilityLiveRegion="polite">{notice}</ThemedText> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  passwordContent: { gap: 16 },
  passwordIntroCard: { paddingVertical: 12 },
  introCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  intro: { flex: 1, fontSize: 14, lineHeight: 20 },
  fieldsCard: { gap: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  forgotLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -8 },
  passwordMatchIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  errorText: { flex: 1, lineHeight: 20 },
});
