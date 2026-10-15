import { residentEmailStepSchema } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { loginErrorMessage } from '../../auth/login-error';
import { authRequests, Ownership, SetupTimeout } from '../../auth/request-gate';
import { Action, Body, Card, Destination, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { AuthenticatedRedirect, ProviderButtons, SignedOutBanner } from './parts';

export default function LoginScreen() {
  const { client } = useResident();
  const { setIntent, setGuest } = useAuthFlow();
  const router = useRouter();
  const owner = useRef(new Ownership());
  useEffect(() => { const scope = owner.current; return () => scope.invalidate(); }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [error, setError] = useState('');

  async function login() {
    if (busy || providerBusy) return;
    const parsed = residentEmailStepSchema.safeParse({ email });
    if (!parsed.success) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    const owns = owner.current.ticket();
    setError('');
    setBusy(true);
    try {
      await setIntent('sign_in');
      await authRequests.run(async () => {
        if (!owns()) return;
        const { error: signInError } = await client.auth.signInWithPassword({ email: parsed.data.email, password });
        if (signInError) throw signInError;
      });
      if (owns()) setPassword('');
    } catch (cause) {
      if (owns()) setError(cause instanceof SetupTimeout ? cause.message : loginErrorMessage(cause));
    } finally { if (owns()) setBusy(false); }
  }
  const disabled = busy || providerBusy;
  return <Screen>
    <AuthenticatedRedirect />
    <Body heading>Welcome back</Body>
    <Body tone="secondary">Log in to connect with your barangay.</Body>
    <SignedOutBanner />
    <Card>
      <Field label="Email" required value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" editable={!disabled} />
      <Field label="Password" required value={password} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" editable={!disabled} />
      {!!error && <Notice tone="danger" message={error} />}
      <Action label={busy ? 'Logging in…' : 'Log in'} disabled={disabled} onPress={() => void login()} />
      <Destination title="Forgot password?" href="/auth/recovery" />
    </Card>
    <ProviderButtons mode="sign_in" disabled={busy} onBusyChange={setProviderBusy} />
    <Card>
      <Destination title="Create an account" href="/auth/register" />
      <Action label="Continue as guest" secondary disabled={disabled} onPress={() => { setGuest(true); router.replace('/home'); }} />
    </Card>
  </Screen>;
}
