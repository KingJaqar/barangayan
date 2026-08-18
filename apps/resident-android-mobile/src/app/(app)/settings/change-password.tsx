import { changePasswordSchema } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** Centered, auto-dismissing confirmation used after the password update succeeds. */
function ResultPopup({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
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
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.popupBackdrop}>
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
            Password Updated
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.popupSubtitle}>
            Your password has been changed successfully.
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useAuth();

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
      const { error: reauthError } = await supabase.auth.signInWithPassword({
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

      const { error: updateError } = await supabase.auth.updateUser({ password: result.data.newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Change Password
            </ThemedText>
          </View>
        </View>

        {!session ? (
          <View style={styles.content}>
            <GuestPrompt label="Log in to change your password." />
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View
                style={[
                  styles.introCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                ]}>
                <View style={[styles.introIconWrap, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                </View>
                <ThemedText themeColor="textSecondary" style={styles.intro}>
                  Enter your current password, then choose a new one (at least 8 characters).
                </ThemedText>
              </View>

              <View
                style={[
                  styles.fieldsCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                ]}>
                <TextField
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  error={fieldErrors.currentPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  passwordVisibility={{ visible: showCurrent, onToggle: () => setShowCurrent((v) => !v) }}
                />
                <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
                <TextField
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  error={fieldErrors.newPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  passwordVisibility={{ visible: showNew, onToggle: () => setShowNew((v) => !v) }}
                />
                <TextField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  error={fieldErrors.confirmPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  passwordVisibility={{ visible: showConfirm, onToggle: () => setShowConfirm((v) => !v) }}
                />
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

              <View style={styles.submitBtn}>
                <PrimaryButton label="Update Password" loading={loading} onPress={handleUpdate} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      <ResultPopup visible={showSuccess} onDismiss={() => { setShowSuccess(false); router.back(); }} />
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
    fontFamily: Fonts.gideonRoman,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  introIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    flex: 1,
    lineHeight: 20,
  },
  fieldsCard: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.half,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: Spacing.one,
  },
  popupBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
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
