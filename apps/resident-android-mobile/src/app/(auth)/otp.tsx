import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { PasswordRecoveryScreen, RecoveryButton, RecoveryCodeInput, RecoveryError, recoveryStyles } from '@/components/password-recovery-screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { passwordRecovery } from '@/lib/supabase';
import { recoveryErrorMessage } from '@/lib/password-recovery';
import { authSetupRequests } from '@/lib/setup-request';

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
  const email = typeof params.email === 'string' ? params.email : '';
  const { session, setPasswordRecovery } = useAuth();

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
    if (loading || resending || authSetupRequests.busy) return;
    setError(null);
    setLoading(true);
    try {
      setPasswordRecovery(true);
      await passwordRecovery.verify(email, code, session?.user);
      setCode('');
      router.replace('/(auth)/reset-password');
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (loading || resending || secondsLeft > 0 || authSetupRequests.busy) return;
    setError(null);
    setResending(true);
    try {
      await passwordRecovery.send(email, session?.user);
      setCode('');
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');

  return (
    <PasswordRecoveryScreen
      step={2}
      title="Check your inbox"
      description={`Enter the six-digit code sent to ${maskedEmail}.`}>
      <View style={recoveryStyles.form}>
        <RecoveryCodeInput
          value={code}
          onChangeText={setCode}
          disabled={loading || resending}
        />
        <RecoveryError message={error} />
        <RecoveryButton
          label="Verify code"
          loading={loading}
          disabled={!/^\d{6}$/.test(code) || resending}
          onPress={handleVerify}
        />
        <View style={recoveryStyles.footer}>
          <ThemedText themeColor="textSecondary" style={recoveryStyles.help}>
            Didn't receive it? Check your spam folder, or request another code.
          </ThemedText>
          <Pressable
            onPress={handleResend}
            disabled={secondsLeft > 0 || loading || resending}
            accessibilityRole="button"
            accessibilityState={{ disabled: secondsLeft > 0 || loading || resending, busy: resending }}
            style={({ pressed }) => [recoveryStyles.textLink, { opacity: loading || resending || pressed ? 0.5 : 1 }]}>
            <ThemedText themeColor={secondsLeft > 0 ? 'textSecondary' : 'text'} style={recoveryStyles.textLinkLabel}>
              {resending ? 'Sending code…' : secondsLeft > 0 ? `Resend code in 00:${String(secondsLeft).padStart(2, '0')}` : 'Resend code'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </PasswordRecoveryScreen>
  );
}
