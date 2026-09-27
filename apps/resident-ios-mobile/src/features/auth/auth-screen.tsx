import { loginSchema } from '@barangayan/shared';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Destination, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { residentError } from '../../lib/errors';

export default function AuthScreen() {
  const { client, session } = useResident();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (session) return <Redirect href="/(tabs)/home" />;
  async function login() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const input = loginSchema.parse({ email: email.trim(), password });
      const { error: authError } = await client.auth.signInWithPassword(input);
      if (authError) throw authError;
      setPassword('');
    } catch (failure) { setError(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><Body heading>Welcome to Barangayan</Body><Body>Connect with your barangay, request documents, and stay informed.</Body><Card>
    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" editable={!busy} />
    <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoCapitalize="none" editable={!busy} />
    {registered === '1' && <Notice message="Your account was created. Sign in to continue." />}{!!error && <Notice message={error} />}<Action label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void login()} disabled={busy} />
    <Destination title="Forgot password?" href="/recovery" /><Destination title="Create an account" href="/register" />
  </Card><Destination title="Continue as a guest" href="/(tabs)/home" detail="Browse public information. Sign in for personal services." /></Screen>;
}
