import { changePasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFlow } from '../../../auth/auth-flow';
import type { ReauthenticationState } from '../../../auth/fresh-authentication';
import { passwordMode } from '../../../auth/setup-route';
import { authRequests, Ownership, WriteBoundary } from '../../../auth/request-gate';
import { classifyFailure } from '../../../data/outcome';
import { RequireResident } from '../../../components/require-resident';
import { Action, Body, Card, Field, Notice, Screen, useDiscardGuard } from '../../../components/ui';
import { emptyPasswordDraft, PasswordStep, type PasswordDraft } from '../../../features/auth/password-step';
import { ReauthenticateButtons } from '../../../features/auth/parts';
import { useResident } from '../../../lib/runtime';
import { useLatest } from '../../../lib/use-latest';

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

export default function ChangePasswordRoute() {
  return <RequireResident purpose="change your password"><PasswordRouter /></RequireResident>;
}

/**
 * The mode comes from the server-maintained password state: a known password is changed with the
 * current one; unknown legacy history is managed (never "not set"); no password at all is created
 * only after fresh same-account provider confirmation.
 */
function PasswordRouter() {
  const { session } = useResident();
  const { setup } = useAuthFlow();
  const userId = session?.user.id ?? null;
  const creating = passwordMode(setup) === 'create_with_provider';
  // Stay on first-password setup after its own success refreshes the status to "set".
  const [firstPasswordUser, setFirstPasswordUser] = useState<string | null>(null);
  if (creating && userId && firstPasswordUser !== userId) setFirstPasswordUser(userId);
  if (userId && (creating || firstPasswordUser === userId)) return <FirstPassword key={userId} />;
  return <ChangeOrManage />;
}

function ChangeOrManage() {
  const { client, session, setRecovery } = useResident();
  const { setup, refreshSetup, refreshError } = useAuthFlow();
  const router = useRouter();
  const mode = passwordMode(setup);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const ownership = useRef(new Ownership());
  useEffect(() => { const owner = ownership.current; return () => owner.invalidate(); }, []);
  useDiscardGuard(!busy && !success && !!(currentPassword || newPassword || confirmPassword));

  function recover() {
    if (busy || authRequests.busy) return;
    void setRecovery(true).then(() => router.replace('/auth/recovery')).catch(() => setMessage('Unable to start recovery. Please try again.'));
  }

  async function submit() {
    if (busy || uncertain || authRequests.busy) return;
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([key, values]) => [key, values?.[0]])));
      setMessage('Check the highlighted fields.');
      return;
    }
    const email = session?.user.email;
    if (!email) { setMessage('Your account has no sign-in email on file, so the current password cannot be checked. Contact your barangay for help.'); return; }
    setBusy(true); setMessage(''); setErrors({});
    const owns = ownership.current.ticket();
    const write = new WriteBoundary();
    try {
      // updateUser does not check the old password: re-authenticate first so a left-open
      // session cannot silently take over the account.
      await authRequests.run(async () => {
        if (!owns()) return;
        const { data: reauth, error: reauthError } = await client.auth.signInWithPassword({ email, password: parsed.data.currentPassword });
        if (reauthError) throw reauthError;
        if (!owns()) return;
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!owns()) return;
        if (reauth.user?.id !== session?.user.id || data.session?.user.id !== session?.user.id) throw new Error('Account changed');
        write.begin();
        const { error: updateError } = await client.auth.updateUser({ password: parsed.data.newPassword });
        if (updateError) throw updateError;
      });
      if (!owns()) return;
      // The server observer records the write; refresh so Settings labels follow.
      void refreshSetup();
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setSuccess(true); setMessage('Your password was changed.');
    } catch (cause) {
      if (!owns()) return;
      const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
      if (write.started && code !== 'weak_password' && code !== 'same_password' && classifyFailure(cause, { write: true }) === 'unknown-commit') {
        setUncertain(true);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setMessage('The password change could not be confirmed. Use password recovery to confirm access before another change.');
      } else if (code === 'invalid_credentials') setErrors({ currentPassword: 'Current password is incorrect' });
      else if (code === 'same_password') setMessage('Choose a password different from your current one.');
      else if (code === 'weak_password') setMessage('Choose a stronger password.');
      else setMessage('Your password could not be changed. Check your connection and account, then retry or use password recovery.');
    }
    finally { write.close(); if (owns()) setBusy(false); }
  }

  if (mode === 'loading' || mode === 'error' || mode === 'recover_only') {
    return <Screen><Card>
      <Body>{mode === 'loading' ? 'Checking your password status…'
        : mode === 'error' ? 'Your password status could not be loaded. Retry before changing it.'
        : 'Your account has no password and no linked Google or Apple sign-in to confirm it is you. Use password recovery to set a password through your email.'}</Body>
      {mode === 'error' && <Action label="Retry" onPress={() => void refreshSetup()} />}
      {mode === 'recover_only' && <Action label="Recover password by email" onPress={recover} />}
    </Card></Screen>;
  }
  const newInvalid = newPassword.length > 0 && (newPassword.length < 8 || !PASSWORD_COMPLEXITY_REGEX.test(newPassword));
  const matching = !!newPassword && !!confirmPassword && newPassword === confirmPassword;
  return <Screen>
    <Body heading>{mode === 'manage' ? 'Manage password' : 'Change password'}</Body>
    <Body tone="secondary">{mode === 'manage'
      ? 'Your account has an existing password we cannot confirm. Enter it to change it, or recover it by email if you do not know it.'
      : 'Enter your current password, then choose a new one: at least 8 characters with an uppercase letter, a number and a special character.'}</Body>
    {!!refreshError && <Notice tone="danger" message={refreshError} />}
    <Card>
      <Field label="Current password" required error={errors.currentPassword} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" editable={!busy && !success && !uncertain} />
      <Action label="Forgot password?" secondary disabled={busy} onPress={recover} />
      <Field label="New password" required error={errors.newPassword ?? (newInvalid ? 'Use 8+ characters with an uppercase letter, a number and a special character' : undefined)} value={newPassword} onChangeText={setNewPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy && !success && !uncertain} />
      <Field label="Confirm new password" required error={errors.confirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy && !success && !uncertain} />
      {!!newPassword && !!confirmPassword && <Body tone={matching ? 'primary' : 'danger'} role="footnote">{matching ? 'Passwords match' : "Passwords don't match"}</Body>}
    </Card>
    {!!message && <Notice tone={success ? 'primary' : 'danger'} message={message} />}
    <Action label={busy ? 'Changing password…' : 'Change password'} disabled={busy || success || uncertain} onPress={() => void submit()} />
    {uncertain && <Action label="Confirm access through password recovery" secondary disabled={busy} onPress={recover} />}
    {mode === 'manage' && <Action label="Recover password by email" secondary disabled={busy} onPress={recover} />}
    {success && <Action label="Done" secondary onPress={() => router.back()} />}
  </Screen>;
}

/**
 * First password for a passwordless provider resident. The write is unlocked only by a completed
 * same-user `set_password` provider attempt recorded by Auth within the application window; it is
 * rechecked right before updateUser and consumed afterwards or when the resident leaves.
 */
function FirstPassword() {
  const { setRecovery } = useResident();
  const { providers, refreshSetup } = useAuthFlow();
  const router = useRouter();
  const [reauth, setReauth] = useState<ReauthenticationState | 'checking'>('checking');
  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const draftRef = useLatest(draft);
  const check = useCallback(async () => {
    try { setReauth(await providers.reauthentication('set_password')); } catch { setReauth('none'); }
  }, [providers]);
  useFocusEffect(useCallback(() => { void check(); }, [check]));
  // Confirmation is single use: it ends when the resident leaves this screen.
  useEffect(() => () => { void providers.clearReauthentication().catch(() => undefined); }, [providers]);

  function leave() {
    if (authRequests.busy) { setNotice('A request is still finishing. Please wait before leaving.'); return; }
    if (draftRef.current.uncertain) { setNotice('Confirm whether your entered password was saved, or use password recovery, before leaving.'); return; }
    setDraft(emptyPasswordDraft);
    void providers.clearReauthentication().catch(() => undefined);
    router.back();
  }

  if (done) {
    return <Screen><Card><Body heading>Password set</Body><Body tone="secondary">You can now also sign in with your email and password.</Body>
      <Action label="Done" onPress={() => router.back()} /></Card></Screen>;
  }
  if (reauth === 'fresh') {
    return <>
      <PasswordStep variant="settings" required={false} draft={draft} onDraftChange={setDraft}
        beforeWrite={async () => {
          if ((await providers.reauthentication('set_password')) !== 'fresh') {
            setReauth('expired');
            throw new Error('Your confirmation expired. Confirm again before setting a password.');
          }
        }}
        onSaved={async () => {
          await providers.clearReauthentication().catch(() => undefined);
          await refreshSetup();
          setDone(true);
        }}
        onSkip={leave} onBack={leave}
        onRecover={() => { void setRecovery(true).then(() => router.replace('/auth/recovery')).catch(() => setNotice('Unable to start recovery. Please try again.')); }} />
      {!!notice && <Notice message={notice} />}
    </>;
  }
  return <Screen>
    <Body heading>Set password</Body>
    <Body tone="secondary">Your account does not have a password yet. To protect it, first confirm it is you with the same provider you use to sign in. You will then have 5 minutes to set your password.</Body>
    {reauth === 'checking' && <Notice message="Checking your confirmation…" />}
    {(reauth === 'expired' || reauth === 'mismatch') && <Notice tone="danger" message="Your confirmation expired or did not match this account. Confirm again." />}
    <ReauthenticateButtons purpose="set_password" disabled={reauth === 'checking'} onComplete={() => { void check(); }} />
    {!!notice && <Notice message={notice} />}
    <Action label="Cancel" secondary onPress={leave} />
  </Screen>;
}
