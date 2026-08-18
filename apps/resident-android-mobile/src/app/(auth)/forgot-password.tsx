import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { setPasswordRecovery } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    setLoading(true);
    // Not signInWithOtp — that sends Supabase's magic-link template. Password recovery
    // (and the mailer_templates_recovery_content template customized to show the code)
    // is resetPasswordForEmail, paired with verifyOtp({ type: 'recovery', ... }).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    // Set BEFORE navigating to the OTP screen — verifyOtp establishes a real session,
    // and this flag is what stops Stack.Protected from bouncing straight into (app)
    // before the user has set a new password. See use-auth.tsx.
    setPasswordRecovery(true);
    router.push({ pathname: '/(auth)/otp', params: { type: 'recovery', email } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Forgot Password
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Enter your email and we'll send you a code to reset your password.
        </ThemedText>

        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {error ? (
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton label="Send Reset Code" loading={loading} onPress={handleSend} />
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
