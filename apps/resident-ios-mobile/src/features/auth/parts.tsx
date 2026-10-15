import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import type { ReauthPurpose } from '../../auth/provider-flow';
import { isAppleSignInAvailable } from '../../auth/providers';
import { Action, Body, Destination, Loading, Notice } from '../../components/ui';
import { useResident, type SignedOutNotice } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { space } from '../../lib/theme';

/**
 * Sends a signed-in resident to the authorized next screen: the server-owned setup step while
 * setup is outstanding, otherwise the remembered private destination or Home. It decides from the
 * server-confirmed status and runs once per decision.
 */
export function AuthenticatedRedirect() {
  const { session, recovery } = useResident();
  const flow = useAuthFlow();
  const router = useRouter();
  const flowRef = useLatest(flow);
  const waiting = flow.route.destination === 'status_loading';
  const kind = !session || recovery || waiting ? 'none' : !flow.appAllowed ? 'setup' : flow.destination === '/home' ? 'home' : flow.destination;
  const userId = session?.user.id;
  useEffect(() => {
    if (kind === 'none') return;
    const current = flowRef.current;
    const href = kind === 'home' ? current.takeReturnPath() : kind === 'setup' ? '/account-setup' : kind;
    router.replace(href as Href);
  }, [kind, userId, router, flowRef]);
  return session && !recovery ? <Loading label="Opening your account…" /> : null;
}

/** Public emergency information stays reachable while required setup is outstanding. */
export function EmergencyEntry() {
  return <Destination title="Emergency information" detail="Public evacuation centers and emergency contacts" href="/emergency" />;
}

const NOTICE_COPY: Record<SignedOutNotice, string> = {
  'logged-out': 'You have been logged out.',
  'session-ended': 'Your session has ended. Log in again to continue.',
  'access-denied': 'This account cannot use the resident app. Log in with a resident account.',
};

/** One-time feedback for why the resident is back at the signed-out entry. */
export function SignedOutBanner() {
  const { notice, dismissNotice, session } = useResident();
  if (!notice || session) return null;
  return <View style={{ gap: space[2] }}><Notice message={NOTICE_COPY[notice]} tone={notice === 'logged-out' ? 'primary' : 'danger'} />
    <Action label="Dismiss" secondary onPress={dismissNotice} /></View>;
}

/** Google and native Apple sign-in/sign-up. The result is routed by the server-owned setup status. */
export function ProviderButtons({ mode, disabled = false, onBusyChange }: { mode: 'sign_in' | 'sign_up'; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { providers, setIntent, refreshSetup } = useAuthFlow();
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    active.current = true;
    void isAppleSignInAvailable().then((available) => { if (active.current) setAppleAvailable(available); });
    return () => { active.current = false; };
  }, []);
  async function run(start: () => ReturnType<typeof providers.startGoogle>) {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(''); onBusyChange?.(true);
    try {
      const attempt = await start();
      // The session exists now; record why it was created so the right setup step follows.
      await setIntent(attempt.intent === 'sign_up' ? 'provider_signup' : 'sign_in', attempt.userId ?? undefined);
      await refreshSetup();
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'Sign-in could not be completed. Please try again.');
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
      onBusyChange?.(false);
    }
  }
  const intent = mode;
  const unavailable = disabled || busy;
  return <View style={{ gap: space[3] }}>
    {appleAvailable && <AppleAuthentication.AppleAuthenticationButton
      buttonType={mode === 'sign_up' ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={{ width: '100%', height: 50, opacity: unavailable ? 0.5 : 1 }}
      onPress={() => { if (!unavailable) void run(() => providers.startApple(intent)); }} />}
    <Action label={busy ? 'Waiting for Google…' : mode === 'sign_up' ? 'Continue with Google' : 'Sign in with Google'} secondary disabled={unavailable}
      hint={providers.callbackAvailable ? undefined : 'Not available in this build'} onPress={() => void run(() => providers.startGoogle(intent))} />
    {!!error && <Notice tone="danger" message={error} />}
    {!providers.callbackAvailable && <Body tone="secondary" role="footnote">Google sign-in becomes available once this build has its sign-in link configured. You can use your email instead.</Body>}
  </View>;
}

/**
 * Confirms the signed-in account with a provider it already has (Google or Apple). The result is
 * a completed same-account attempt that a sensitive screen rechecks against the live session.
 */
export function ReauthenticateButtons({ purpose, disabled = false, onComplete }: { purpose: ReauthPurpose; disabled?: boolean; onComplete: () => void }) {
  const { providers, setup } = useAuthFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    active.current = true;
    void isAppleSignInAvailable().then((available) => { if (active.current) setAppleAvailable(available); });
    return () => { active.current = false; };
  }, []);
  const status = setup.state === 'ready' ? setup.status : null;
  async function run(start: () => ReturnType<typeof providers.startGoogle>) {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError('');
    try {
      await start();
      if (active.current) onComplete();
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'Confirmation could not be completed. Please try again.');
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <View style={{ gap: space[3] }}>
    {status?.hasAppleIdentity && appleAvailable && <Action label={busy ? 'Waiting for Apple…' : 'Confirm with Apple'} secondary disabled={disabled || busy}
      onPress={() => void run(() => providers.startApple('reauthenticate', purpose))} />}
    {status?.hasGoogleIdentity && <Action label={busy ? 'Waiting for Google…' : 'Confirm with Google'} secondary disabled={disabled || busy}
      onPress={() => void run(() => providers.startGoogle('reauthenticate', purpose))} />}
    {!!error && <Notice tone="danger" message={error} />}
  </View>;
}
