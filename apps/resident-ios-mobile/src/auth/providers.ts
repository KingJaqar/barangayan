import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@barangayan/shared';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { appleNamesFrom, createAppleNonce } from './apple-nonce';
import { buildCallbackUrl, callbackFailureMessage, parseCallback } from './callback-url';
import { clearAppleAuthorizationCode, holdAppleAuthorizationCode } from './apple-authorization';
import { reauthenticationState, type ReauthenticationState } from './fresh-authentication';
import {
  ATTEMPT_KEY, parseAttempt, ProviderAuthFlow,
  type AttemptIntent, type Provider, type ProviderAttempt, type ReauthPurpose, type SessionIdentity,
} from './provider-flow';
import { authRequests, RequestGate } from './request-gate';

type Client = SupabaseClient<Database>;
type AppleCredential = { identityToken: string; nonce: string; fullName: { givenName: string | null; familyName: string | null } | null };

/** The registered OAuth callback for this build, or null when no URL scheme is configured (PR-03). */
export function configuredCallbackUrl(): string | null {
  try {
    const scheme = Linking.createURL('auth/callback').split(':')[0];
    return buildCallbackUrl(scheme);
  } catch { return null; }
}

const write = (attempt: ProviderAttempt) => AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
export async function pendingProviderAttempt(): Promise<ProviderAttempt | null> {
  return parseAttempt(await AsyncStorage.getItem(ATTEMPT_KEY));
}
export async function clearProviderAttempt(): Promise<void> {
  await AsyncStorage.removeItem(ATTEMPT_KEY);
}

export function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

const newAttemptId = () => `${Date.now()}-${Crypto.randomUUID()}`;
const hashHex = async (value: string) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, Uint8Array.from(value, (char) => char.charCodeAt(0))));

/** Provider authentication bound to one Supabase client (one per session epoch). */
export function createProviderAuth(client: Client) {
  const reads = new RequestGate();
  let starting = false;
  const callbackUrl = configuredCallbackUrl();

  async function current(): Promise<SessionIdentity | null> {
    const { data, error } = await reads.run(() => client.auth.getUser());
    if (error && error.name !== 'AuthSessionMissingError') throw new Error('Unable to check your session. Check your connection and retry.');
    const user = data.user;
    return user ? { id: user.id, providers: (user.identities ?? []).map((identity) => identity.provider), lastSignIn: Date.parse(user.last_sign_in_at ?? '') } : null;
  }
  async function discardUnexpectedSession(uid: string) {
    // Cleanup needs local session ownership, not another network-dependent lookup.
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== uid) throw new Error('The session changed. Sign out and authenticate your original account again.');
    const result = await client.auth.signOut({ scope: 'local' });
    if (result.error) throw new Error('Unable to clear the unintended session. Sign out and authenticate your original account again.');
  }
  const provision = (provider: Provider) => async () => {
    const { data, error } = await reads.run(() => client.auth.getUser());
    if (error || !data.user) throw new Error('Unable to verify your session. Please sign in again.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      // Provider data is only a hint; the RPC verifies the Auth-managed identity row.
      const { data: id, error: rpcError } = provider === 'google'
        ? await client.rpc('ensure_google_resident_profile').abortSignal(controller.signal)
        : await client.rpc('ensure_apple_resident_profile').abortSignal(controller.signal);
      if (rpcError || !id) throw new Error('Unable to save your resident account. Check your connection and retry.');
    } finally { clearTimeout(timer); }
  };

  const google = new ProviderAuthFlow<string>('google', {
    read: () => AsyncStorage.getItem(ATTEMPT_KEY), write, current, gate: authRequests,
    exchange: async (code) => {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.user) throw new Error('Google sign-in could not be verified. Retry or start again.');
      return data.user.id;
    },
    discardUnexpectedSession, provision: provision('google'),
  }, (code) => code);

  const apple = new ProviderAuthFlow<AppleCredential>('apple', {
    read: () => AsyncStorage.getItem(ATTEMPT_KEY), write, current, gate: authRequests,
    exchange: async (credential) => {
      const { data, error } = await client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: credential.nonce });
      if (error || !data.user) throw new Error('Sign in with Apple could not be verified. Retry or start again.');
      // Apple returns the name only on first authorization. It is stored as an editable
      // suggestion for the profile form; it never establishes residency or identity.
      const names = appleNamesFrom(credential.fullName);
      if (names.firstName || names.lastName) {
        await client.auth.updateUser({ data: { given_name: names.firstName, family_name: names.lastName } }).catch(() => undefined);
      }
      return data.user.id;
    },
    discardUnexpectedSession, provision: provision('apple'),
  }, (credential) => credential.identityToken);

  async function begin(provider: Provider, intent: AttemptIntent, purpose: ReauthPurpose | null) {
    if (intent === 'reauthenticate' && !purpose) throw new Error('Choose the account action to confirm before authenticating.');
    const { data, error } = await reads.run(() => client.auth.getSession());
    if (error) throw new Error('Unable to check your session. Retry.');
    const uid = data.session?.user.id ?? null;
    if ((intent === 'link' || intent === 'reauthenticate') && !uid) throw new Error('Sign in to your account first.');
    if ((intent === 'sign_in' || intent === 'sign_up') && uid) throw new Error('Sign out before signing in to another account.');
    const attempt: ProviderAttempt = {
      id: newAttemptId(), provider, intent, purpose: intent === 'reauthenticate' ? purpose : null,
      started: Date.now(), expectedUserId: uid, userId: null, phase: 'issued',
    };
    await write(attempt);
    return attempt;
  }

  async function startGoogle(intent: AttemptIntent = 'sign_in', purpose: ReauthPurpose | null = null): Promise<ProviderAttempt> {
    if (!callbackUrl) throw new Error('Google sign-in is not available in this build yet. Use your email and password.');
    if (starting || authRequests.busy) throw new Error('An earlier sign-in request is still finishing. Please wait.');
    starting = true;
    try {
      const attempt = await begin('google', intent, purpose);
      const options = { redirectTo: callbackUrl, skipBrowserRedirect: true };
      const result = await authRequests.run(() => intent === 'link'
        ? client.auth.linkIdentity({ provider: 'google', options })
        : client.auth.signInWithOAuth({ provider: 'google', options }));
      if (result.error || !result.data.url) throw new Error('Unable to start Google authentication. Check your connection and retry.');
      const browser = await WebBrowser.openAuthSessionAsync(result.data.url, callbackUrl);
      if (browser.type === 'success') return await finishGoogle(browser.url);
      const latest = await pendingProviderAttempt();
      if (latest?.id === attempt.id && ['consumed', 'complete', 'exchanging'].includes(latest.phase)) return await finishGoogle();
      if (latest?.id === attempt.id) await clearProviderAttempt();
      throw new Error('Google sign-in was cancelled. You can try again.');
    } finally { starting = false; }
  }

  /** Completes the stored Google attempt from the browser result URL (or reconciles without one). */
  function finishGoogle(url?: string): Promise<ProviderAttempt> {
    if (url === undefined) return google.finish();
    if (!callbackUrl) return Promise.reject(new Error('Google sign-in is not available in this build yet.'));
    const parsed = parseCallback(url, callbackUrl);
    if (!parsed.ok) return Promise.reject(new Error(callbackFailureMessage(parsed.reason)));
    return google.finish(parsed.code);
  }

  async function startApple(intent: AttemptIntent = 'sign_in', purpose: ReauthPurpose | null = null): Promise<ProviderAttempt> {
    if (intent === 'link') throw new Error('Linking Apple to an existing account is not available.');
    if (starting || authRequests.busy) throw new Error('An earlier sign-in request is still finishing. Please wait.');
    if (!(await isAppleSignInAvailable())) throw new Error('Sign in with Apple is not available on this device.');
    starting = true;
    try {
      await begin('apple', intent, purpose);
      const nonce = await createAppleNonce((length) => Crypto.getRandomBytes(length), hashHex);
      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: intent === 'reauthenticate' ? [] : [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: nonce.hashed,
        });
      } catch (cause) {
        await clearProviderAttempt();
        if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ERR_REQUEST_CANCELED') throw new Error('Sign in with Apple was cancelled. You can try again.');
        throw new Error('Sign in with Apple could not be completed. Please try again.');
      }
      if (!credential.identityToken) {
        await clearProviderAttempt();
        throw new Error('Apple did not return a sign-in token. Please try again.');
      }
      const completed = await apple.finish({ identityToken: credential.identityToken, nonce: nonce.raw, fullName: credential.fullName });
      if (intent === 'reauthenticate' && purpose === 'delete_account' && completed.userId && credential.authorizationCode) holdAppleAuthorizationCode(completed.userId, credential.authorizationCode);
      return completed;
    } finally { starting = false; }
  }

  /** Rechecks the stored completed attempt against the CURRENT Auth session each time. */
  async function reauthentication(purpose: ReauthPurpose): Promise<ReauthenticationState> {
    const [{ data }, attempt] = await Promise.all([client.auth.getSession(), pendingProviderAttempt()]);
    return reauthenticationState({ attempt, purpose, accessToken: data.session?.access_token, userId: data.session?.user.id });
  }
  /** Single use: a confirmed or abandoned sensitive action cannot be repeated from it. */
  async function clearReauthentication() {
    const attempt = await pendingProviderAttempt();
    clearAppleAuthorizationCode();
    if (attempt?.intent === 'reauthenticate') await clearProviderAttempt();
  }

  return { startGoogle, finishGoogle, startApple, reauthentication, clearReauthentication, callbackAvailable: callbackUrl !== null, callbackUrl };
}
export type ProviderAuth = ReturnType<typeof createProviderAuth>;

/**
 * Signs the resident out when Apple reports the credential revoked (or no longer found). The
 * credential-state call always throws on the Simulator and while offline, so an error is treated
 * as "unknown" and never as revocation.
 */
export function watchAppleCredential(session: Session, onRevoked: () => void): () => void {
  const identity = session.user.identities?.find((item) => item.provider === 'apple');
  const subject = identity?.identity_data && typeof identity.identity_data.sub === 'string' ? identity.identity_data.sub : null;
  if (!identity || !subject) return () => undefined;
  let active = true;
  async function check() {
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) return;
      const state = await AppleAuthentication.getCredentialStateAsync(subject as string);
      if (active && (state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED || state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND)) onRevoked();
    } catch { /* unknown state: keep the Auth session. */ }
  }
  void check();
  const revoke = AppleAuthentication.addRevokeListener(() => { if (active) onRevoked(); });
  const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
  return () => { active = false; revoke.remove(); lifecycle.remove(); };
}
