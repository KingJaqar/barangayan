import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PasswordRecoveryScreen, RecoveryButton, RecoveryError, recoveryStyles } from '@/components/password-recovery-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { passwordRecovery } from '@/lib/supabase';
import { recoveryErrorMessage } from '@/lib/password-recovery';
import { authSetupRequests } from '@/lib/setup-request';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session, setPasswordRecovery } = useAuth();
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (loading || authSetupRequests.busy) return;
    setError(null);
    setLoading(true);
    // Not signInWithOtp — that sends Supabase's magic-link template. Password recovery
    // (and the mailer_templates_recovery_content template customized to show the code)
    // is resetPasswordForEmail, paired with verifyOtp({ type: 'recovery', ... }).
    try {
      const recoveryEmail = await passwordRecovery.send(email, session?.user);
      // Keep the recovery stack reachable while verifyOtp establishes a session.
      setPasswordRecovery(true);
      router.push({ pathname: '/(auth)/otp', params: { type: 'recovery', email: recoveryEmail } });
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryScreen
      step={1}
      title="Recover your account"
      description="We'll email you a six-digit code so you can choose a new password.">
      <View style={recoveryStyles.form}>
        <TextField
          label="Email address"
          accessibilityLabel="Email address"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!session && !loading}
          style={[recoveryStyles.field, { backgroundColor: theme.background }]}
        />
        {session ? (
          <ThemedText themeColor="textSecondary" style={recoveryStyles.help}>
            We'll use the email linked to your account.
          </ThemedText>
        ) : null}
        <RecoveryError message={error} />
        <RecoveryButton label="Send reset code" loading={loading} disabled={!email.trim()} onPress={handleSend} />
      </View>
    </PasswordRecoveryScreen>
  );
}
