import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { ANDROID_AUTH_CALLBACK, androidCallbackCode, ensureGoogleResidentProfile } from '@barangayan/shared';
import { supabase } from './supabase';

const PENDING = 'resident-google-pkce-started';
let starting = false;
let exchange: Promise<void> | null = null;
let lastCallback: string | null = null;

/** One exchange for browser result, warm link and callback route arriving together. */
export async function finishGoogleAuth(url: string): Promise<void> {
  const code = androidCallbackCode(url);
  if (exchange) return exchange;
  exchange = (async () => {
    if (lastCallback !== url) {
      const started = Number(await AsyncStorage.getItem(PENDING));
      if (!started || Date.now() - started > 10 * 60_000) throw new Error('Sign-in expired. Please start Google sign-in again.');
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error('Sign-in expired or could not be verified. Please try again.');
      // Remember a consumed code before provisioning, so a network failure can
      // retry profile setup without attempting another PKCE exchange.
      lastCallback = url;
      await AsyncStorage.removeItem(PENDING);
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Unable to verify your session. Please sign in again.');
    await ensureGoogleResidentProfile(supabase, user);
  })();
  try { await exchange; } finally { exchange = null; }
}

export async function startGoogleAuth(link = false): Promise<void> {
  if (starting) return;
  starting = true; lastCallback = null;
  try {
    await AsyncStorage.setItem(PENDING, String(Date.now()));
    const options = { redirectTo: ANDROID_AUTH_CALLBACK, skipBrowserRedirect: true };
    const result = link ? await supabase.auth.linkIdentity({ provider: 'google', options }) : await supabase.auth.signInWithOAuth({ provider: 'google', options });
    if (result.error || !result.data.url) throw new Error('Unable to start Google sign-in. Check your connection and retry.');
    const browser = await WebBrowser.openAuthSessionAsync(result.data.url, ANDROID_AUTH_CALLBACK);
    if (browser.type === 'success') await finishGoogleAuth(browser.url);
    else if (!lastCallback) {
      await AsyncStorage.removeItem(PENDING);
      throw new Error('Google sign-in cancelled. You can try again.');
    }
  } finally { starting = false; }
}
