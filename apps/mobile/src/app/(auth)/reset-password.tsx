import { newPasswordSchema } from '@barangayan/shared';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { setPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
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
    const { error: updateError } = await supabase.auth.updateUser({ password: result.data.password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // The recovery session (established by verifyOtp on the previous screen) is now a
    // real login — clearing this is what lets Stack.Protected route into (app).
    setPasswordRecovery(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Reset Password
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Please create a strong, secure new password for your account.
        </ThemedText>

        <TextField
          label="New Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
        />
        <TextField
          label="Confirm New Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
        />

        {error ? (
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton label="Update Password" loading={loading} onPress={handleUpdate} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
  },
});
