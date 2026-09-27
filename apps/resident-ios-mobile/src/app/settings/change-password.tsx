import { changePasswordSchema } from '@barangayan/shared';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Field, Notice, Screen } from '../../components/ui';
import { PublicError, residentError } from '../../lib/errors';
import { useResident } from '../../lib/runtime';

export default function ChangePasswordScreen() {
  const { client, session } = useResident();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  if (!session) return <Redirect href="/auth" />;
  async function submit() {
    if (busy) return;
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const input = changePasswordSchema.parse({ currentPassword, newPassword, confirmPassword });
      const email = session?.user.email;
      if (!email) throw new PublicError('Your account has no sign-in email. Contact your barangay for help.');
      const { error: reauthError } = await client.auth.signInWithPassword({ email, password: input.currentPassword });
      if (reauthError) throw reauthError;
      const { error } = await client.auth.updateUser({ password: input.newPassword });
      if (error) throw error;
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSuccess(true); setMessage('Your password was changed.');
    } catch (failure) { setMessage(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><Body heading>Change password</Body><Card><Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry textContentType="password" editable={!busy} /><Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry textContentType="newPassword" editable={!busy} /><Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" editable={!busy} /></Card>{!!message && <Notice message={message} />}<Action label={busy ? 'Changing password…' : 'Change password'} disabled={busy || success} onPress={() => void submit()} /></Screen>;
}
