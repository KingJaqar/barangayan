import AsyncStorage from '@react-native-async-storage/async-storage';
import { ATTEMPT_KEY } from './provider-flow';

/** Non-secret navigation hints. Passwords, codes, tokens and nonces are never stored here. */
export const SETUP_INTENT_KEY = 'resident-ios.setup-intent.v1';
export const RESEND_DEADLINE_KEY = 'resident-ios.otp-resend-deadline.v1';
export const AUTH_HINT_KEYS = [SETUP_INTENT_KEY, RESEND_DEADLINE_KEY, ATTEMPT_KEY] as const;

/** Removes every auth hint on logout, account switch and fresh install. */
export async function clearAuthHints(): Promise<void> {
  await AsyncStorage.multiRemove([...AUTH_HINT_KEYS]);
}
