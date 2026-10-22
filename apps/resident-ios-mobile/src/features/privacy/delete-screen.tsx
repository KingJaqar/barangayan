import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { takeAppleAuthorizationCode } from '../../auth/apple-authorization';
import { authRequests } from '../../auth/request-gate';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Destination, EmptyState, Field, Loading, Notice, Screen } from '../../components/ui';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { ReauthenticateButtons } from '../auth/parts';
import { PRIVACY_COPY } from './copy';
import { DELETE_CONTRACT_VERSION, runDelete, type DeleteOutcome } from './delete-run';
import { hasAnyProof, proofMethods } from './delete-proof';
import { callFunction } from './function-call';

export function DeleteScreen() {
  return <RequireResident purpose="delete your account">{releaseGates.accountDeletion ? <Delete /> : <Screen><EmptyState title={PRIVACY_COPY.deleteUnavailable.title} message={PRIVACY_COPY.deleteUnavailable.message} /></Screen>}</RequireResident>;
}

/**
 * Delete My Account (A46): the warning and what is erased or kept, a fresh same-account proof (password or provider), one explicit
 * final confirmation and the server's truthful result. Only `completed` ends the session; anything else says what happened and offers a retry.
 */
function Delete() {
  const { client, session, logout } = useResident();
  const { setup, providers, refreshSetup } = useAuthFlow();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [providerNotice, setProviderNotice] = useState('');
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void providers.clearReauthentication().catch(() => undefined); }; }, [providers]);
  const userId = session?.user.id ?? null;
  const status = setup.state === 'ready' ? setup.status : null;
  const methods = status ? proofMethods(status) : null;

  const checkProvider = useCallback(async () => {
    try {
      const state = await providers.reauthentication('delete_account');
      if (!alive.current) return;
      setProviderReady(state === 'fresh');
      setProviderNotice(state === 'fresh' || state === 'none' ? '' : PRIVACY_COPY.deleteProviderExpired);
    } catch { if (alive.current) { setProviderReady(false); setProviderNotice(PRIVACY_COPY.deleteProviderExpired); } }
  }, [providers]);

  async function submit(proof: 'password' | 'provider') {
    if (running.current || authRequests.busy || !userId || !status) return;
    running.current = true;
    setBusy(true); setOutcome(null); setPasswordError(''); setProviderNotice('');
    try {
      if (proof === 'password') {
        const email = session?.user.email;
        if (!email) { setPasswordError(PRIVACY_COPY.deleteNoEmail); return; }
        if (!password) { setPasswordError('Enter your current password.'); return; }
        // Checking the password refreshes the Auth-recorded authentication time, which the server requires to be recent.
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          setPasswordError(error.code === 'invalid_credentials' ? PRIVACY_COPY.deleteWrongPassword : error.status === 429 || error.code === 'over_request_rate_limit' ? PRIVACY_COPY.deleteTooMany : 'We could not check your password. Check your connection and try again.');
          return;
        }
        if (data.user?.id !== userId) { setPasswordError('The account changed. Log in to your own account and try again.'); return; }
      } else if ((await providers.reauthentication('delete_account')) !== 'fresh') {
        setProviderReady(false); setProviderNotice(PRIVACY_COPY.deleteProviderExpired);
        return;
      }
      if (!(await confirmDestructive({ title: PRIVACY_COPY.deleteFinalTitle, message: PRIVACY_COPY.deleteFinalMessage, confirmLabel: PRIVACY_COPY.deleteFinalConfirm }))) return;
      const appleCode = status.hasAppleIdentity ? takeAppleAuthorizationCode(userId) : null;
      const result = await runDelete(() => callFunction(client, 'delete-my-account', { contractVersion: DELETE_CONTRACT_VERSION, ...(appleCode ? { appleAuthorizationCode: appleCode } : {}) }));
      if (result.status === 'completed') {
        await logout('account-deleted');
        router.replace('/auth/choice');
        return;
      }
      if (!alive.current) return;
      setOutcome(result);
      if (result.status === 'reauthenticate') { setProviderReady(false); void providers.clearReauthentication().catch(() => undefined); }
    } catch { if (alive.current) setOutcome({ status: 'failed', message: 'Your account could not be deleted right now. Nothing has been reported as deleted. Please try again.' }); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }

  return <Screen>
    <Card>
      <Body heading>{PRIVACY_COPY.deleteTitle}</Body>
      <Body>{PRIVACY_COPY.deleteIntro}</Body>
      <Body role="footnote" tone="secondary">{PRIVACY_COPY.deleteErased}</Body>
      <Body role="footnote" tone="secondary">{PRIVACY_COPY.deleteRetained}</Body>
      {releaseGates.completeExport && <Destination title={PRIVACY_COPY.exportTitle} detail={PRIVACY_COPY.deleteExportFirst} href="/settings/download-data" />}
    </Card>
    {setup.state === 'loading' && <Loading label={PRIVACY_COPY.deleteChecking} />}
    {setup.state === 'error' && <Card><Notice tone="danger" message={PRIVACY_COPY.deleteStatusError} /><Action label="Try again" secondary onPress={() => void refreshSetup()} /></Card>}
    {methods && !hasAnyProof(methods) && <Notice tone="danger" message={PRIVACY_COPY.deleteNoEmail} />}
    {methods && hasAnyProof(methods) && <Card>
      {methods.password && <>
        <Field label={PRIVACY_COPY.deletePasswordLabel} required error={passwordError || undefined} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" editable={!busy} />
        <Action label={busy ? PRIVACY_COPY.deleteWorking : PRIVACY_COPY.deleteButton} destructive disabled={busy || !password} onPress={() => void submit('password')} />
      </>}
      {(methods.google || methods.apple) && <>
        <Body tone="secondary">{methods.apple ? PRIVACY_COPY.deleteAppleRequired : PRIVACY_COPY.deleteProviderHint}</Body>
        <ReauthenticateButtons purpose="delete_account" disabled={busy} onComplete={() => void checkProvider()} />
        {!!providerNotice && <Notice tone="danger" message={providerNotice} />}
        {providerReady && <Action label={busy ? PRIVACY_COPY.deleteWorking : PRIVACY_COPY.deleteButton} destructive disabled={busy} onPress={() => void submit('provider')} />}
      </>}
    </Card>}
    {busy && <Loading label={PRIVACY_COPY.deleteWorking} />}
    {outcome && <Notice tone="danger" message={outcome.message} />}
    <Action label={PRIVACY_COPY.deleteCancel} secondary disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
