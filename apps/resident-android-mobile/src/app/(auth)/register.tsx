import { EMAIL_OTP_REGISTRATION_METADATA, residentEmailStepSchema, residentCodeStepSchema, residentSetupFailure } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthHeader } from '@/components/auth-header';
import { GoogleButton } from '@/components/google-button';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { authSetupRequests, SetupOwner, SetupTimeout, RESEND_DEADLINE_KEY, resendSeconds, readResendDeadline } from '@/lib/setup-request';

/** Only email/code live here. A verified session moves into server-owned setup. */
export default function RegisterScreen() {
  const router = useRouter(), theme = useTheme();
  const { setSetupIntent } = useAuth();
  const owner = useRef(new SetupOwner());
  const [email, setEmail] = useState(''), [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [deadline, setDeadline] = useState(0), [clock, setClock] = useState(() => Date.now());
  const [deadlineReady, setDeadlineReady] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const seconds = resendSeconds(deadline, clock);
  useEffect(() => {
    const scope = owner.current, owns = scope.ticket();
    void AsyncStorage.getItem(RESEND_DEADLINE_KEY).then(value => { if (owns()) { setDeadline(readResendDeadline(value)); setDeadlineReady(true); } })
      .catch(() => { if (owns()) { setError('Unable to read resend timing. Reopen registration and retry.'); } });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setClock(Date.now()); });
    return () => { scope.invalidate(); clearInterval(timer); listener.remove(); };
  }, []);
  function back() {
    if (authSetupRequests.busy) { setError('The earlier request is still finishing. Please wait before changing email or leaving.'); return; }
    owner.current.invalidate(); setCode(''); setError(null);
    if (step === 'code') { setStep('email'); return; }
    setEmail(''); void setSetupIntent('sign_in'); router.replace('/(auth)/auth-choice');
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  async function send() {
    if (!deadlineReady || resendSeconds(deadline) || loading) return;
    const parsed = residentEmailStepSchema.safeParse({ email });
    setError(null);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (authSetupRequests.busy) { setError('The earlier request is still finishing. Please wait before retrying.'); return; }
    const owns = owner.current.ticket();
    setEmail(parsed.data.email); setCode(''); setLoading(true);
    const until = Date.now() + 60_000;
    setDeadline(until); setClock(Date.now());
    try {
      await authSetupRequests.run(async () => {
        await AsyncStorage.setItem(RESEND_DEADLINE_KEY, String(until));
        await setSetupIntent('email_signup');
        if (!owns()) throw new Error('Registration was cancelled.');
        const { error: sendError } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: true, data: EMAIL_OTP_REGISTRATION_METADATA } });
        if (sendError) throw sendError;
      });
      if (owns()) setStep('code');
    } catch (cause) {
      if (!owns()) return;
      if (cause instanceof SetupTimeout) setStep('code'); // Delivery can still have happened.
      setError(cause instanceof SetupTimeout ? cause.message : residentSetupFailure(cause as { code?: string; status?: number; name?: string }).message);
    } finally { if (owns()) setLoading(false); }
  }
  async function verify() {
    if (loading) return;
    const parsed = residentCodeStepSchema.safeParse({ code });
    setError(null);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const owns = owner.current.ticket(); setLoading(true);
    try {
      await authSetupRequests.run(async () => {
        await setSetupIntent('email_signup');
        if (!owns()) throw new Error('Registration was cancelled.');
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: 'email' });
        if (verifyError) throw verifyError;
        if (!data.session) throw new Error('Verification did not establish a session.');
      });
      if (owns()) { setCode(''); setEmail(''); }
      // AuthProvider/Stack.Protected owns navigation; retain the verified session.
    } catch (cause) {
      if (owns()) setError(cause instanceof SetupTimeout ? cause.message : residentSetupFailure(cause as { code?: string; status?: number; name?: string }).message);
    } finally { if (owns()) setLoading(false); }
  }
  function openLogin() {
    if (authSetupRequests.busy) { setError('Please wait for the earlier request to finish.'); return; }
    owner.current.invalidate(); setEmail(''); setCode('');
    void setSetupIntent('sign_in'); router.replace('/(auth)/login');
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }} edges={['top', 'left', 'right']}>
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AuthHeader title="Create Account" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ThemedText type={step === 'email' ? 'title' : 'heading'}>{step === 'email' ? 'Verify your email first' : 'Enter your email code'}</ThemedText>
        <ThemedText themeColor="textSecondary">{step === 'email' ? 'We will send you a six-digit code. After verification, add your details and create a password.' : `Enter the six-digit code sent to ${email}. Your code expires after one hour.`}</ThemedText>
        {step === 'email' ? <TextField label="Email Address" accessibilityLabel="Email Address" required autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} editable={!loading} onChangeText={setEmail} /> : <TextField label="Email Code" accessibilityLabel="Six-digit email code" required autoComplete="sms-otp" textContentType="oneTimeCode" keyboardType="number-pad" maxLength={6} value={code} editable={!loading} onChangeText={value => setCode(value.replace(/\D/g, ''))} />}
        {error && <ThemedText accessibilityLiveRegion="polite" themeColor="accentRed">{error}</ThemedText>}
        {step === 'code' ? <>
          <PrimaryButton label="Verify and continue" loading={loading} onPress={verify} />
          <View style={styles.secondaryActions}>
            <CodeAction label={seconds ? `Resend in ${seconds}s` : 'Resend code'} disabled={loading || !deadlineReady || seconds > 0} onPress={send} />
            <CodeAction label="Change email" disabled={loading} onPress={back} />
          </View>
          <View style={styles.loginRow}>
            <ThemedText type="small" themeColor="textSecondary">Already have an account?</ThemedText>
            <CodeAction label="Log in" disabled={loading} onPress={openLogin} />
          </View>
        </> : <>
          <PrimaryButton label={seconds ? `Send code in ${seconds}s` : 'Send email code'} loading={loading} disabled={loading || !deadlineReady || seconds > 0} onPress={send} />
          <GoogleButton label="Sign up with Google" intent="sign_up" disabled={loading} />
          <PrimaryButton label="Already have an account? Log in" variant="secondary" disabled={loading} onPress={openLogin} />
        </>}
      </ScrollView>
    </View>
  </SafeAreaView>;
}

function CodeAction({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.textAction, pressed && !disabled && styles.pressed]}>
    <ThemedText type="smallBold" style={{ color: disabled ? theme.textSecondary : theme.primary }}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  loginRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
  textAction: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 8, flexShrink: 1 },
  pressed: { opacity: 0.65 },
});
