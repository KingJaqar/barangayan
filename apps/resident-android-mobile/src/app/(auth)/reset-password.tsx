import { newPasswordSchema } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PasswordRecoveryScreen, RecoveryButton, RecoveryError, recoveryStyles } from '@/components/password-recovery-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { passwordRecovery } from '@/lib/supabase';
import { recoveryErrorMessage } from '@/lib/password-recovery';
import { authSetupRequests } from '@/lib/setup-request';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setPasswordRecovery, refreshCompletion } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const requirements = [
    { label: '8 or more characters', met: password.length >= 8 },
    { label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  async function handleUpdate() {
    if (loading || authSetupRequests.busy) return;
    setError(null);
    setFieldErrors({});

    const result = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await passwordRecovery.update(result.data.password, result.data.confirmPassword);
      setPassword('');
      setConfirmPassword('');
      await refreshCompletion();
      // The verified recovery session is now a normal login.
      setPasswordRecovery(false);
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryScreen
      step={3}
      title="Create a new password"
      description="Choose a strong password to keep your account secure.">
      <View style={recoveryStyles.form}>
        <TextField
          label="New Password"
          accessibilityLabel="New password"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          passwordVisibility={{ visible: showPassword, onToggle: () => setShowPassword((visible) => !visible) }}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          error={fieldErrors.password}
          style={[recoveryStyles.field, { backgroundColor: theme.background }]}
        />
        <View style={styles.requirements}>
          {requirements.map(({ label, met }) => (
            <View key={label} style={styles.requirement}>
              <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={met ? theme.accentGreen : theme.textSecondary} />
              <ThemedText themeColor={met ? 'accentGreen' : 'textSecondary'} style={recoveryStyles.help}>{label}</ThemedText>
            </View>
          ))}
        </View>
        <TextField
          label="Confirm New Password"
          accessibilityLabel="Confirm new password"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          passwordVisibility={{ visible: showConfirm, onToggle: () => setShowConfirm((visible) => !visible) }}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
          error={fieldErrors.confirmPassword}
          success={confirmPassword && confirmPassword === password ? 'Passwords match' : undefined}
          style={[recoveryStyles.field, { backgroundColor: theme.background }]}
        />
        <RecoveryError message={error} />
        <RecoveryButton label="Update password" loading={loading} onPress={handleUpdate} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          style={({ pressed }) => [recoveryStyles.textLink, { opacity: loading || pressed ? 0.5 : 1 }]}
          onPress={() => {
            if (authSetupRequests.busy) return;
            passwordRecovery.clear();
            router.replace('/(auth)/forgot-password');
          }}>
          <ThemedText style={recoveryStyles.textLinkLabel}>Request a new reset code</ThemedText>
        </Pressable>
      </View>
    </PasswordRecoveryScreen>
  );
}

const styles = StyleSheet.create({
  requirements: { gap: Spacing.two, marginTop: -Spacing.two },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
