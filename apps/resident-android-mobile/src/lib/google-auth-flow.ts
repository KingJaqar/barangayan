import { androidCallbackCode } from '@barangayan/shared';
import { SetupRequestGate } from './setup-request';

export type GoogleIntent = 'sign_in' | 'sign_up' | 'link' | 'reauthenticate';
/** What a fresh same-user Google authentication unlocks. Only reauthentication has one. */
export type GoogleReauthPurpose = 'set_password' | 'delete_account';
export type GoogleAttempt = { id: string; intent: GoogleIntent; purpose: GoogleReauthPurpose | null; started: number; expectedUserId: string | null; userId: string | null; phase: 'issued' | 'exchanging' | 'consumed' | 'complete' };
export const GOOGLE_ATTEMPT_KEY = 'resident-google-pkce-v2';
export function parseGoogleAttempt(raw: string | null, now = Date.now()): GoogleAttempt | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value.id !== 'string' || !value.id || !['sign_in','sign_up','link','reauthenticate'].includes(value.intent)
      || !['issued','exchanging','consumed','complete'].includes(value.phase) || typeof value.started !== 'number'
      || now < value.started || now - value.started > 600_000
      || !(value.expectedUserId === null || typeof value.expectedUserId === 'string')
      || !(value.userId === null || typeof value.userId === 'string')) return null;
    if (['link','reauthenticate'].includes(value.intent) && !value.expectedUserId) return null;
    if (['consumed','complete'].includes(value.phase) && !value.userId) return null;
    // A reauthentication without a stated purpose cannot unlock any sensitive action.
    const purpose = value.intent === 'reauthenticate' ? value.purpose : null;
    if (value.intent === 'reauthenticate' && !['set_password', 'delete_account'].includes(purpose)) return null;
    return { id: value.id, intent: value.intent, purpose, started: value.started, expectedUserId: value.expectedUserId, userId: value.userId, phase: value.phase };
  } catch { return null; }
}
type SessionIdentity = { id: string; google: boolean; lastSignIn: number };
export type GoogleFlowDependencies = {
  read: () => Promise<string | null>;
  write: (attempt: GoogleAttempt) => Promise<void>;
  current: () => Promise<SessionIdentity | null>;
  exchange: (code: string) => Promise<string>;
  discardUnexpectedSession: (userId: string) => Promise<void>;
  provision: () => Promise<void>;
  gate: SetupRequestGate;
};

/** Browser result and warm/cold deep link use the same consumption checkpoint.
 * Persist only purpose/owner/phase. OAuth codes and URLs never enter storage. */
export class GoogleAuthFlow {
  private inFlight: { code: string | null; promise: Promise<GoogleAttempt> } | null = null;
  private consumed: { id: string; code: string } | null = null;
  constructor(private deps: GoogleFlowDependencies) {}
  finish(url?: string): Promise<GoogleAttempt> {
    const code = url ? androidCallbackCode(url) : null;
    if (this.inFlight) {
      if (code && this.inFlight.code && code !== this.inFlight.code) return Promise.reject(new Error('A different Google callback is already being processed.'));
      return this.inFlight.promise;
    }
    const promise = this.perform(code).finally(() => { this.inFlight = null; });
    this.inFlight = { code, promise };
    return promise;
  }
  private async perform(code: string | null): Promise<GoogleAttempt> {
    let attempt = parseGoogleAttempt(await this.deps.read());
    if (!attempt) throw new Error('Google sign-in expired. Please start again.');
    let current = await this.deps.current();
    if (attempt.expectedUserId && current?.id !== attempt.expectedUserId) throw new Error('The account changed. Start Google authentication again from the correct account.');
    if (this.consumed?.id === attempt.id && code && code !== this.consumed.code) throw new Error('This callback belongs to a different sign-in attempt.');
    // Crash after exchange but before checkpoint: reconcile a NEW, Google-authenticated
    // session whose Auth-owned sign-in time belongs to this attempt. No re-exchange.
    if (attempt.phase === 'exchanging' && !attempt.expectedUserId && current?.google && current.lastSignIn >= attempt.started) {
      attempt = { ...attempt, phase: 'consumed', userId: current.id }; await this.deps.write(attempt);
    }
    if (attempt.phase === 'issued' || attempt.phase === 'exchanging') {
      if (!code) throw new Error('No verified Google callback is available. Start sign-in again.');
      const exchanging = { ...attempt, phase: 'exchanging' as const };
      await this.deps.write(exchanging);
      const issued = attempt;
      attempt = await this.deps.gate.run(async () => {
        const exchangedUserId = await this.deps.exchange(code);
        if (issued.expectedUserId && exchangedUserId !== issued.expectedUserId) {
          // The SDK installs its exchanged session before returning. Rejecting
          // the callback alone would leave the wrong resident signed in.
          await this.deps.discardUnexpectedSession(exchangedUserId);
          throw new Error('A different Google account was selected. Sign in to your original account and try again.');
        }
        current = await this.deps.current();
        if (current?.id !== exchangedUserId) throw new Error('The session changed after Google authentication. Start again.');
        if (!current || !current.google) throw new Error('Google authentication did not confirm the intended account.');
        const pending = parseGoogleAttempt(await this.deps.read());
        if (pending?.id !== issued.id) throw new Error('The sign-in attempt changed.');
        this.consumed = { id: issued.id, code };
        const consumed = { ...issued, phase: 'consumed' as const, userId: current.id };
        // This checkpoint also runs after a UI watchdog timeout. A retry can
        // provision the verified session without reusing the consumed code.
        await this.deps.write(consumed); return consumed;
      });
    }
    if (!current || current.id !== attempt.userId || !current.google) throw new Error('This sign-in attempt belongs to another session. Start again.');
    if (attempt.phase !== 'complete') {
      await this.deps.provision();
      // Check ownership again after provisioning; late completion cannot route a new user.
      const latest = await this.deps.current();
      const pending = parseGoogleAttempt(await this.deps.read());
      if (latest?.id !== attempt.userId || pending?.id !== attempt.id) throw new Error('The account or sign-in attempt changed.');
      attempt = { ...attempt, phase: 'complete' }; await this.deps.write(attempt);
    }
    return attempt;
  }
}
