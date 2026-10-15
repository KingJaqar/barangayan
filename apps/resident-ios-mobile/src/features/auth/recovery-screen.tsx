import { PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { RECOVERY_RESEND_SECONDS, recoveryErrorMessage } from '../../auth/recovery-flow';
import { authRequests, resendSeconds } from '../../auth/request-gate';
import { Action, Body, Card, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { AuthenticatedRedirect } from './parts';

type Step = 'email' | 'code' | 'password' | 'done';

/** Password recovery: email, six-digit code, then a new password for the verified session only. */
export default function RecoveryScreen() {
  const { session, setRecovery, logout } = useResident();
  const { refreshSetup, recoveryFlow } = useAuthFlow();
  const router = useRouter();
  // Verifying a code signs the resident in, which remounts this screen: the verified state lives
  // in the flow, so a remounted screen resumes at the password step.
  const flow = useRef(recoveryFlow);
  const [step, setStep] = useState<Step>(() => recoveryFlow.isVerified && session ? 'password' : 'email');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [verifiedHere, setVerifiedHere] = useState(() => recoveryFlow.isVerified);
  const seconds = resendSeconds(deadline, clock);
  // A signed-in resident recovers the address of their own account only.
  const [signedInAtStart] = useState(() => !!session);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') setClock(Date.now()); });
    return () => { clearInterval(timer); lifecycle.remove(); };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (failure) { setMessage(recoveryErrorMessage(failure)); } finally { setBusy(false); }
  }
  const account = signedInAtStart ? session?.user : null;

  async function send() {
    if (seconds > 0) return;
    const sentTo = await flow.current.send(email, account);
    setEmail(sentTo);
    await setRecovery(true);
    setDeadline(Date.now() + RECOVERY_RESEND_SECONDS * 1000); setClock(Date.now());
    setCode(''); setStep('code');
    setMessage('If this email has an account, a six-digit reset code has been sent.');
  }
  async function verify() {
    await flow.current.verify(email, code, account);
    setCode(''); setVerifiedHere(true); setStep('password');
  }
  async function update() {
    await flow.current.update(password, confirmPassword);
    setPassword(''); setConfirmPassword('');
    await setRecovery(false);
    await refreshSetup();
    setStep('done');
  }
  async function cancel() {
    if (authRequests.busy || busy) { setMessage('A request is still finishing. Please wait before leaving.'); return; }
    flow.current.clear();
    try {
      if (verifiedHere) {
        // The only session here came from this code; leaving without a password ends it.
        await logout();
        router.replace('/auth/login');
        return;
      }
      await setRecovery(false);
      if (router.canGoBack()) router.back(); else router.replace(session ? '/home' : '/auth/choice');
    } catch { setMessage('Unable to leave recovery. Please try again.'); }
  }

  const met = [
    { label: '8 or more characters', ok: password.length >= 8 },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
    { label: 'A special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passwordsMatch = !!password && password === confirmPassword;
  const strong = password.length >= 8 && PASSWORD_COMPLEXITY_REGEX.test(password);

  if (step === 'done') return <Screen><AuthenticatedRedirect /><Notice message="Your password was updated." /></Screen>;
  return <Screen>
    <Body heading>{step === 'email' ? 'Recover your account' : step === 'code' ? 'Check your inbox' : 'Create a new password'}</Body>
    <Body tone="secondary">{step === 'email' ? 'We will email you a six-digit code so you can choose a new password.'
      : step === 'code' ? 'Enter the six-digit code sent to your email.' : 'Choose a strong password to keep your account secure.'}</Body>
    <Card>
      {step === 'email' && <>
        <Field label="Account email" required value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" editable={!busy && !account} />
        <Action label={busy ? 'Sending…' : 'Send reset code'} disabled={busy || !email.trim()} onPress={() => void run(send)} />
      </>}
      {step === 'code' && <>
        <Field label="Reset code" required value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!busy} />
        <Action label={busy ? 'Verifying…' : 'Verify code'} disabled={busy || code.length !== 6} onPress={() => void run(verify)} />
        <Action label={seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'} secondary disabled={busy || seconds > 0} onPress={() => void run(send)} />
        <Action label="Change email" secondary disabled={busy || !!account} onPress={() => { flow.current.clear(); setCode(''); setMessage(''); setStep('email'); }} />
      </>}
      {step === 'password' && <>
        <Field label="New password" required value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy} />
        {met.map((item) => <Body key={item.label} tone={item.ok ? 'primary' : 'secondary'} role="footnote">{item.ok ? '✓ ' : '○ '}{item.label}</Body>)}
        <Field label="Confirm new password" required value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy}
          error={confirmPassword && !passwordsMatch ? "Passwords don't match" : undefined} />
        {passwordsMatch && <Body tone="secondary" role="footnote">Passwords match</Body>}
        <Action label={busy ? 'Updating…' : 'Update password'} disabled={busy || !strong || !passwordsMatch} onPress={() => void run(update)} />
        <Action label="Request a new reset code" secondary disabled={busy} onPress={() => { flow.current.clear(); setPassword(''); setConfirmPassword(''); setMessage(''); setStep('email'); }} />
      </>}
      {!!message && <Notice message={message} />}
    </Card>
    <Action label="Cancel recovery" secondary disabled={busy} onPress={() => void cancel()} />
  </Screen>;
}
