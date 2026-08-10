import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const RESEND_COOLDOWN_SECONDS = 45;

type OtpParams = {
  // Only 'recovery' is supported now — signup OTP was removed when email
  // confirmation was disabled (migration 0012 / register.tsx refactor).
  type: 'recovery';
  email: string;
};

// Password-recovery OTP screen. The signup branch was removed: with Confirm Email
// disabled in the hosted project, signUp() creates a live session immediately, so
// signup OTP is neither sent nor needed. Profile creation now happens via a database
// trigger (handle_new_user) — see migration 0012 and register.tsx.
export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<OtpParams>();
  const { email } = params;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'recovery',
      email,
      token: code,
    });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace('/(auth)/reset-password');
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  const maskedEmail = email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Enter Reset Code
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          We've sent a 6-digit code to{'\n'}
          {maskedEmail}
        </ThemedText>

        <TextField
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={styles.codeInput}
        />

        {error ? (
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}

        {secondsLeft > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Resend code in 00:{String(secondsLeft).padStart(2, '0')}
          </ThemedText>
        ) : (
          <PrimaryButton label="Resend Code" variant="secondary" loading={resending} onPress={handleResend} />
        )}

        <PrimaryButton
          label="Verify"
          loading={loading}
          disabled={code.length !== 6}
          onPress={handleVerify}
        />
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
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 26,
  },
  subtitle: {
    textAlign: 'center',
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
