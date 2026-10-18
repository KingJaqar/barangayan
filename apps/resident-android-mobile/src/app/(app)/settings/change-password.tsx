import { changePasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '@/components/google-button';
import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { ResidentPasswordStep, type ResidentPasswordDraft } from '@/components/resident-password-step';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useFontPreference } from '@/hooks/use-font-preference';
import { getMobileFontFamily } from '@/constants/fonts';
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
  const theme = useTheme();
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (!visible) return;
    scale.value = 0.85;
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
    const timer = setTimeout(onDismiss, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[styles.popupBackdrop, { backgroundColor: theme.text + '73' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <Animated.View
          style={[
            cardStyle,
            styles.popupCard,
            { backgroundColor: theme.background, borderColor: theme.backgroundSelected, shadowColor: theme.text },
          ]}>
          <View style={[styles.popupIconWrap, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={30} color={theme.onPrimary} />
          </View>
          <ThemedText type="heading" style={styles.popupTitle}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.popupSubtitle}>
            {subtitle}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
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
  const { fontId } = useFontPreference();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session, setup, refreshCompletion, setPasswordRecovery, setupRefreshError } = useAuth();
  const mode = passwordMode(setup);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/settings');
            }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color={theme.onPrimary} />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              {mode === 'manage' ? 'Manage Password' : mode === 'recover_only' ? 'Set Password' : 'Change Password'}
            </ThemedText>
          </View>
        </View>

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
            {mode === 'error' ? <PrimaryButton label="Retry" onPress={() => { void refreshCompletion(); }} /> : null}
            {mode === 'recover_only' ? (
              <PrimaryButton label="Recover password by email" onPress={handleForgotPassword} />
            ) : null}
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={[styles.content, styles.passwordContent]} keyboardShouldPersistTaps="handled">
              <View
                style={[
                  styles.introCard,
                  styles.passwordIntroCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                ]}>
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
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                ]}>
                <TextField
                  style={{ fontFamily: getMobileFontFamily(fontId) }}
                  label="Current Password"
                  required
                  value={currentPassword}
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
                  <ThemedText type="link" style={{ color: theme.primary, fontWeight: '600' }}>
                    Forgot Password?
                  </ThemedText>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
                <TextField
                  style={{ fontFamily: getMobileFontFamily(fontId) }}
                  label="New Password"
                  required
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  {...fieldStatus(newPassword, fieldErrors.newPassword, validateNewPassword, 'Password strength: good')}
                  passwordVisibility={{ visible: showNew, onToggle: () => setShowNew((v) => !v) }}
                />
                <TextField
                  style={{ fontFamily: getMobileFontFamily(fontId) }}
                  label="Confirm New Password"
                  required
                  value={confirmPassword}
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
                      color={passwordsMatch ? theme.accentGreen : theme.accentRed}
                    />
                    <ThemedText type="small" style={{ color: passwordsMatch ? theme.accentGreen : theme.accentRed }}>
                      {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {error ? (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(150)}
                  style={[styles.errorBanner, { backgroundColor: theme.background, borderColor: theme.accentRed }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.accentRed} />
                  <ThemedText type="small" themeColor="accentRed" style={styles.errorText}>
                    {error}
                  </ThemedText>
                </Animated.View>
              ) : null}

              <PrimaryButton label="Update Password" loading={loading} onPress={handleUpdate} />
              {mode === 'manage' ? (
                <PrimaryButton
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
  const insets = useSafeAreaInsets();
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
        {notice ? <ThemedText accessibilityLiveRegion="polite" style={{ padding: Spacing.three, backgroundColor: theme.background }}>{notice}</ThemedText> : null}
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
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable onPress={leave} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color={theme.onPrimary} />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>Set Password</ThemedText>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.introCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
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
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two + Spacing.one,
  },
  passwordContent: {
    gap: Spacing.two,
  },
  passwordIntroCard: {
    paddingVertical: Spacing.two,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two + Spacing.one,
  },
  intro: {
    flex: 1,
    lineHeight: 20,
  },
  fieldsCard: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.half,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginVertical: -Spacing.one,
  },
  passwordMatchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two + Spacing.one,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  popupBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  popupCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  popupIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  popupTitle: {
    textAlign: 'center',
  },
  popupSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
