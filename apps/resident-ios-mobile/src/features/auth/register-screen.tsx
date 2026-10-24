import { EMAIL_OTP_REGISTRATION_METADATA, residentCodeStepSchema, residentEmailStepSchema, residentSetupFailure } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { RESEND_DEADLINE_KEY } from '../../auth/hints';
import { authRequests, Ownership, readResendDeadline, RESEND_WINDOW_MS, resendSeconds, SetupTimeout } from '../../auth/request-gate';
import { Action, Body, Card, Destination, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { AuthenticatedRedirect, ProviderButtons } from './parts';

type Failure = { code?: string; status?: number; name?: string };

/** Email and code only. A verified session continues into server-owned setup. */
export default function RegisterScreen() {
  const { client } = useResident();
  const { setIntent } = useAuthFlow();
  const router = useRouter();
  const owner = useRef(new Ownership());
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [deadline, setDeadline] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [deadlineReady, setDeadlineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [error, setError] = useState('');
  const seconds = resendSeconds(deadline, clock);
  const disabled = busy || providerBusy;

  useEffect(() => {
    const scope = owner.current;
    const owns = scope.ticket();
    void AsyncStorage.getItem(RESEND_DEADLINE_KEY).then((value) => {
      if (owns()) { setDeadline(readResendDeadline(value)); setDeadlineReady(true); }
    }).catch(() => { if (owns()) { setDeadlineReady(true); } });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') setClock(Date.now()); });
    return () => { scope.invalidate(); clearInterval(timer); lifecycle.remove(); };
  }, []);

  async function send() {
    if (!deadlineReady || resendSeconds(deadline) > 0 || disabled) return;
    const parsed = residentEmailStepSchema.safeParse({ email });
    setError('');
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (authRequests.busy) { setError('The earlier request is still finishing. Please wait before retrying.'); return; }
    const owns = owner.current.ticket();
    setEmail(parsed.data.email); setCode(''); setBusy(true);
    const until = Date.now() + RESEND_WINDOW_MS;
    setDeadline(until); setClock(Date.now());
    try {
      await authRequests.run(async () => {
        await AsyncStorage.setItem(RESEND_DEADLINE_KEY, String(until));
        await setIntent('email_signup');
        if (!owns()) throw new Error('Registration was cancelled.');
        const { error: sendError } = await client.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: true, data: EMAIL_OTP_REGISTRATION_METADATA } });
        if (sendError) throw sendError;
      });
      if (owns()) setStep('code');
    } catch (cause) {
      if (!owns()) return;
      // The mail may still have been sent when the wait ended; let the resident enter the code.
      if (cause instanceof SetupTimeout) setStep('code');
      setError(cause instanceof SetupTimeout ? cause.message : residentSetupFailure(cause as Failure).message);
    } finally { if (owns()) setBusy(false); }
  }

  async function verify() {
    if (disabled) return;
    const parsed = residentCodeStepSchema.safeParse({ code });
    setError('');
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const owns = owner.current.ticket();
    setBusy(true);
    try {
      await authRequests.run(async () => {
        await setIntent('email_signup');
        if (!owns()) throw new Error('Registration was cancelled.');
        const { data, error: verifyError } = await client.auth.verifyOtp({ email, token: parsed.data.code, type: 'email' });
        if (verifyError) throw verifyError;
        if (!data.session) throw new Error('Verification did not establish a session.');
      });
      // Navigation follows the verified session and the server's setup status.
      if (owns()) { setCode(''); setEmail(''); }
    } catch (cause) {
      if (owns()) setError(cause instanceof SetupTimeout ? cause.message : residentSetupFailure(cause as Failure).message);
    } finally { if (owns()) setBusy(false); }
  }

  function changeEmail() {
    if (authRequests.busy) { setError('The earlier request is still finishing. Please wait before changing your email.'); return; }
    owner.current.invalidate();
    setCode(''); setError(''); setStep('email');
  }

  return <Screen>
    <AuthenticatedRedirect />
    <Body heading>{step === 'email' ? 'Verify your email' : 'Enter your code'}</Body>
    <Body tone="secondary">{step === 'email' ? 'We will email you a six-digit code to get started.' : `Enter the six-digit code we sent to ${email}. If it has expired, request a new code.`}</Body>
    <Card>
      {step === 'email'
        ? <Field label="Email address" required value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" editable={!disabled} />
        : <Field label="Confirmation code" required value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!disabled} />}
      {!!error && <Notice tone="danger" message={error} />}
      {step === 'code' ? <>
        <Action label={busy ? 'Verifying…' : 'Verify and continue'} disabled={disabled || code.length !== 6} onPress={() => void verify()} />
        <Action label={seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'} secondary disabled={disabled || !deadlineReady || seconds > 0} onPress={() => void send()} />
        <Action label="Change email" secondary disabled={disabled} onPress={changeEmail} />
      </> : <>
        <Action label={busy ? 'Sending…' : seconds > 0 ? `Continue in ${seconds}s` : 'Continue'} disabled={disabled || !email.trim() || !deadlineReady || seconds > 0} onPress={() => void send()} />
        <Body tone="secondary" role="footnote">Next, you will add your details and create a password.</Body>
      </>}
    </Card>
    {step === 'email' && <>
      <ProviderButtons mode="sign_up" disabled={busy} onBusyChange={setProviderBusy} />
      <Card><Destination title="I already have an account — log in" href="/auth/login" /></Card>
      <Action label="Back" secondary disabled={disabled} onPress={() => router.canGoBack() ? router.back() : router.replace('/auth/choice')} />
    </>}
  </Screen>;
}
