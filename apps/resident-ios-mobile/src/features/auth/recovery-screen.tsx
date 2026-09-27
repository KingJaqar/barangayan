import { newPasswordSchema } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';
import { Action, Body, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { PublicError, residentError } from '../../lib/errors';

export default function RecoveryScreen() {
  const { client, session, recovery, setRecovery, logout } = useResident();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const verified = recovery && !!session;
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(residentError(error)); } finally { setBusy(false); }
  }
  async function send() {
    if (session) throw new PublicError('Sign out before starting account recovery.');
    const validated = z.string().email().parse(email.trim());
    if (Date.now() - sentAt < 45000) { setMessage('Please wait 45 seconds before requesting another code.'); return; }
    await setRecovery(true);
    const { error } = await client.auth.resetPasswordForEmail(validated);
    if (error) throw error;
    setSent(true); setSentAt(Date.now()); setMessage('If this email has an account, a reset code has been sent.');
  }
  return <Screen><Body>Use the reset code from your email. Your personal records remain protected during recovery.</Body>
    {verified ? <><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" /><Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" /><Action label="Save new password" disabled={busy} onPress={() => void run(async () => {
      const input = newPasswordSchema.parse({ password, confirmPassword });
      const { error } = await client.auth.updateUser({ password: input.password });
      if (error) throw error;
      setPassword(''); setConfirmPassword(''); await setRecovery(false); router.replace('/(tabs)/home');
    })} /></> : <><Field label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" editable={!busy} />
      <Action label={sent ? 'Resend reset code' : 'Send reset code'} disabled={busy} onPress={() => void run(send)} />
      {sent && <><Field label="Reset code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} /><Action label="Verify code" disabled={busy} onPress={() => void run(async () => {
        const token = z.string().regex(/^\d{6}$/, 'Enter the six-digit code').parse(code);
        const { error } = await client.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' });
        if (error) throw error;
        setCode('');
      })} /></>}
    </>}
    {!!message && <Notice message={message} />}<Action label="Cancel recovery" secondary disabled={busy} onPress={() => void run(async () => { await logout(); router.replace('/auth'); })} />
  </Screen>;
}
