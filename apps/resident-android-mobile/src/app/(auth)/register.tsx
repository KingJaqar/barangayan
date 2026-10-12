import { EMAIL_OTP_REGISTRATION_METADATA, residentEmailStepSchema, residentCodeStepSchema, residentSetupFailure } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthHeader } from '@/components/auth-header';
import { GoogleButton } from '@/components/google-button';
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
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.primary }]} edges={['left', 'right']}>
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <AuthHeader title="Create Account" onBack={back} />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.intro}>
          <ThemedText accessibilityRole="header" style={styles.title}>{step === 'email' ? 'Verify your email' : 'Enter your code'}</ThemedText>
          <ThemedText style={styles.description} themeColor="textSecondary">{step === 'email' ? 'We’ll email you a 6-digit code to get started.' : 'Enter the 6-digit code we sent to'}</ThemedText>
          {step === 'code' && <ThemedText style={styles.email} selectable>{email}</ThemedText>}
        </View>
        <View style={styles.form}>
        {step === 'email' ? <TextField label="Email address" accessibilityLabel="Email address" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" placeholder="name@example.com" returnKeyType="done" onSubmitEditing={send} value={email} editable={!loading} onChangeText={setEmail} style={[styles.input, { backgroundColor: theme.background, borderColor: theme.textSecondary }]} /> : <TextField key="email-code" label="Confirmation code" accessibilityLabel="Six-digit email code" autoComplete="sms-otp" textContentType="oneTimeCode" keyboardType="number-pad" maxLength={6} value={code} editable={!loading} onChangeText={value => setCode(value.replace(/\D/g, ''))} style={[styles.input, styles.codeInput, { backgroundColor: theme.background, borderColor: theme.textSecondary }]} />}
        {step === 'code' && <ThemedText type="small" style={styles.helper} themeColor="textSecondary">Your code expires in 1 hour.</ThemedText>}
        {error && <ThemedText type="small" accessibilityLiveRegion="polite" themeColor="accentRed">{error}</ThemedText>}
        {step === 'code' ? <>
          <ContinueButton label="Verify and continue" loading={loading} disabled={code.length !== 6} onPress={verify} />
          <View style={styles.secondaryActions}>
            <CodeAction label={seconds ? `Resend in ${seconds}s` : 'Resend code'} disabled={loading || !deadlineReady || seconds > 0} onPress={send} />
            <CodeAction label="Change email" disabled={loading} onPress={back} />
          </View>
        </> : <>
          <ContinueButton label={seconds ? `Continue in ${seconds}s` : 'Continue'} loading={loading} disabled={!email.trim() || !deadlineReady || seconds > 0} onPress={send} />
          <ThemedText type="small" style={styles.helper} themeColor="textSecondary">Next, you’ll add your details and create a password.</ThemedText>
        </>}
        </View>
        {step === 'email' && <>
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="small" themeColor="textSecondary">or</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
          </View>
          <GoogleButton label="Continue with Google" intent="sign_up" disabled={loading} />
          <View style={styles.loginRow}>
            <ThemedText type="small" themeColor="textSecondary">Already have an account?</ThemedText>
            <CodeAction label="Log in" disabled={loading} onPress={openLogin} />
          </View>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  </SafeAreaView>;
}

function ContinueButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  const unavailable = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable, busy: loading }}
    disabled={unavailable} onPress={onPress}
    style={({ pressed }) => [styles.continueButton, { backgroundColor: theme.primary }, unavailable && styles.disabled, pressed && !unavailable && styles.pressed]}>
    {loading ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onPrimary }]}>{label}</ThemedText>}
  </Pressable>;
}

function CodeAction({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.textAction, pressed && !disabled && styles.pressed]}>
    <ThemedText type="smallBold" style={[styles.link, { color: disabled ? theme.textSecondary : theme.text }]}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, width: '100%', maxWidth: 480, alignSelf: 'center' },
  intro: { gap: 8, marginBottom: 28 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  email: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  form: { gap: 16 },
  input: { minHeight: 56, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14 },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '600' },
  helper: { fontWeight: '400' },
  continueButton: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 16, lineHeight: 24 },
  disabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 24 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  loginRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20 },
  textAction: { minHeight: 44, paddingHorizontal: 4, paddingVertical: 10, justifyContent: 'center', borderRadius: 8, flexShrink: 1 },
  link: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.65 },
});
