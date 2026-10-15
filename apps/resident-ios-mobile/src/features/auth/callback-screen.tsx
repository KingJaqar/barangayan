import { useLinkingURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { isCallbackUrl } from '../../auth/callback-url';
import { pendingProviderAttempt } from '../../auth/providers';
import { Ownership } from '../../auth/request-gate';
import { Action, Body, Loading, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { AuthenticatedRedirect } from './parts';

/**
 * Completes a sign-in whose callback link reached the app outside the browser session result
 * (for example after a cold start). Only the exact registered callback with a pending, unexpired
 * attempt can proceed; anything else is explained and sent back to sign-in.
 */
export default function CallbackScreen() {
  const url = useLinkingURL();
  const { session } = useResident();
  const { providers, setIntent, refreshSetup } = useAuthFlow();
  const router = useRouter();
  const owner = useRef(new Ownership());
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const scope = owner.current;
    const owns = scope.ticket();
    void (async () => {
      const pending = await pendingProviderAttempt();
      if (!pending) throw new Error('No sign-in is pending. Start sign-in again.');
      if (pending.provider !== 'google') throw new Error('This sign-in does not use a link. Start sign-in again.');
      const callback = isCallbackUrl(url, providers.callbackUrl) ? url : undefined;
      const result = await providers.finishGoogle(callback);
      if (!owns()) return;
      await setIntent(result.intent === 'sign_up' ? 'provider_signup' : result.intent === 'link' ? 'settings_profile' : 'sign_in', result.userId ?? undefined);
      await refreshSetup();
      if (owns()) { setError(''); setFinished(true); }
    })().catch((cause: unknown) => {
      if (owns()) setError(cause instanceof Error ? cause.message : 'Unable to complete sign-in. Retry or start again.');
    });
    return () => { scope.invalidate(); };
  }, [url, attempt, providers, setIntent, refreshSetup]);

  return <Screen>
    {finished && <AuthenticatedRedirect />}
    {!error && <Loading label="Completing sign-in…" />}
    {!!error && <>
      <Body heading>Sign-in could not be completed</Body>
      <Notice tone="danger" message={error} />
      <Action label="Retry" onPress={() => { setError(''); setAttempt((value) => value + 1); }} />
      <Action label={session ? 'Return to the app' : 'Return to login'} secondary onPress={() => router.replace(session ? '/home' : '/auth/login')} />
    </>}
  </Screen>;
}
