import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { ANDROID_AUTH_CALLBACK, ensureGoogleResidentProfile } from '@barangayan/shared';
import { supabase } from './supabase';
import { authSetupRequests, SetupRequestGate } from './setup-request';
import { GoogleAuthFlow, GOOGLE_ATTEMPT_KEY, parseGoogleAttempt, type GoogleAttempt, type GoogleIntent, type GoogleReauthPurpose } from './google-auth-flow';
import { reauthenticationState } from './sensitive-auth';

let starting = false;
const reads = new SetupRequestGate();
const write = (attempt: GoogleAttempt) => AsyncStorage.setItem(GOOGLE_ATTEMPT_KEY, JSON.stringify(attempt));
const flow = new GoogleAuthFlow({
  read: () => AsyncStorage.getItem(GOOGLE_ATTEMPT_KEY), write, gate: authSetupRequests,
  current: async () => {
    const { data, error } = await reads.run(() => supabase.auth.getUser());
    if (error && error.name !== 'AuthSessionMissingError') throw new Error('Unable to check your session. Check your connection and retry.');
    const user = data.user;
    return user ? { id: user.id, google: !!user.identities?.some(identity => identity.provider === 'google'), lastSignIn: Date.parse(user.last_sign_in_at ?? '') } : null;
  },
  exchange: async code => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw new Error('Google sign-in could not be verified. Retry or start again.');
    return data.user.id;
  },
  discardUnexpectedSession: async uid => {
    // Cleanup needs local session ownership, not another network-dependent
    // user lookup. The exchange already verified the unexpected user's ID.
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== uid) throw new Error('The session changed. Sign out and authenticate your original account again.');
    const result = await supabase.auth.signOut({ scope: 'local' });
    if (result.error) throw new Error('Unable to clear the unintended session. Sign out and authenticate your original account again.');
  },
  provision: async () => {
    const { data, error } = await reads.run(() => supabase.auth.getUser());
    if (error || !data.user) throw new Error('Unable to verify your session. Please sign in again.');
    await ensureGoogleResidentProfile(supabase, data.user);
  },
});
export const finishGoogleAuth = (url?: string) => flow.finish(url);
export async function pendingGoogleAuth() { return parseGoogleAttempt(await AsyncStorage.getItem(GOOGLE_ATTEMPT_KEY)); }

/** Rechecks the stored completed attempt against the CURRENT Auth session each time. */
export async function googleReauthentication(purpose: GoogleReauthPurpose) {
  const [{ data }, attempt] = await Promise.all([supabase.auth.getSession(), pendingGoogleAuth()]);
  return reauthenticationState({ attempt, purpose, accessToken: data.session?.access_token, userId: data.session?.user.id });
}
/** Single use: a confirmed or abandoned sensitive action cannot be repeated from it. */
export async function clearGoogleReauthentication() {
  const attempt = await pendingGoogleAuth();
  if (attempt?.intent === 'reauthenticate') await AsyncStorage.removeItem(GOOGLE_ATTEMPT_KEY);
}

export async function startGoogleAuth(intent: GoogleIntent = 'sign_in', purpose: GoogleReauthPurpose | null = null): Promise<GoogleAttempt> {
  if (intent === 'reauthenticate' && !purpose) throw new Error('Choose the account action to confirm before authenticating.');
  if (starting || authSetupRequests.busy) throw new Error('An earlier sign-in request is still finishing. Please wait.');
  starting = true;
  try {
    const { data, error } = await reads.run(() => supabase.auth.getSession());
    if (error) throw new Error('Unable to check your session. Retry.');
    const uid = data.session?.user.id ?? null;
    if (['link', 'reauthenticate'].includes(intent) && !uid) throw new Error('Sign in to your account first.');
    if (['sign_in', 'sign_up'].includes(intent) && uid) throw new Error('Sign out before signing in to another account.');
    const attempt: GoogleAttempt = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, intent, purpose: intent === 'reauthenticate' ? purpose : null, started: Date.now(), expectedUserId: uid, userId: null, phase: 'issued' };
    await write(attempt);
    const options = { redirectTo: ANDROID_AUTH_CALLBACK, skipBrowserRedirect: true };
    const result = await authSetupRequests.run(() => intent === 'link'
      ? supabase.auth.linkIdentity({ provider: 'google', options })
      : supabase.auth.signInWithOAuth({ provider: 'google', options }));
    if (result.error || !result.data.url) throw new Error('Unable to start Google authentication. Check your connection and retry.');
    const browser = await WebBrowser.openAuthSessionAsync(result.data.url, ANDROID_AUTH_CALLBACK);
    if (browser.type === 'success') return await finishGoogleAuth(browser.url);
    const latest = await pendingGoogleAuth();
    if (latest?.id === attempt.id && ['consumed','complete','exchanging'].includes(latest.phase)) return await finishGoogleAuth();
    if (latest?.id === attempt.id) await AsyncStorage.removeItem(GOOGLE_ATTEMPT_KEY);
    throw new Error('Google sign-in cancelled. You can try again.');
  } finally { starting = false; }
}
