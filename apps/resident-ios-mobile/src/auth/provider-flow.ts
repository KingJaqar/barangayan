import { RequestGate } from './request-gate';

export type Provider = 'google' | 'apple';
export type AttemptIntent = 'sign_in' | 'sign_up' | 'link' | 'reauthenticate';
/** What a fresh same-account provider authentication unlocks. Only reauthentication has one. */
export type ReauthPurpose = 'set_password' | 'delete_account';
export type AttemptPhase = 'issued' | 'exchanging' | 'consumed' | 'complete';
/** Non-secret bookkeeping only: provider codes, tokens and nonces never enter storage. */
export type ProviderAttempt = {
  id: string;
  provider: Provider;
  intent: AttemptIntent;
  purpose: ReauthPurpose | null;
  started: number;
  expectedUserId: string | null;
  userId: string | null;
  phase: AttemptPhase;
};

export const ATTEMPT_KEY = 'resident-ios.provider-attempt.v1';
export const ATTEMPT_LIFETIME_MS = 10 * 60_000;
const INTENTS: readonly AttemptIntent[] = ['sign_in', 'sign_up', 'link', 'reauthenticate'];
const PHASES: readonly AttemptPhase[] = ['issued', 'exchanging', 'consumed', 'complete'];
const PURPOSES: readonly ReauthPurpose[] = ['set_password', 'delete_account'];

export function parseAttempt(raw: string | null, now = Date.now()): ProviderAttempt | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (typeof v.id !== 'string' || !v.id || (v.provider !== 'google' && v.provider !== 'apple')) return null;
    if (!INTENTS.includes(v.intent as AttemptIntent) || !PHASES.includes(v.phase as AttemptPhase)) return null;
    if (typeof v.started !== 'number' || now < v.started || now - v.started > ATTEMPT_LIFETIME_MS) return null;
    if (!(v.expectedUserId === null || typeof v.expectedUserId === 'string')) return null;
    if (!(v.userId === null || typeof v.userId === 'string')) return null;
    const intent = v.intent as AttemptIntent;
    const phase = v.phase as AttemptPhase;
    if ((intent === 'link' || intent === 'reauthenticate') && !v.expectedUserId) return null;
    if ((phase === 'consumed' || phase === 'complete') && !v.userId) return null;
    // A reauthentication without a stated purpose cannot unlock any sensitive action.
    const purpose = intent === 'reauthenticate' ? v.purpose : null;
    if (intent === 'reauthenticate' && !PURPOSES.includes(purpose as ReauthPurpose)) return null;
    return { id: v.id, provider: v.provider, intent, purpose: purpose as ReauthPurpose | null, started: v.started,
      expectedUserId: v.expectedUserId as string | null, userId: v.userId as string | null, phase };
  } catch { return null; }
}

export type SessionIdentity = { id: string; providers: readonly string[]; lastSignIn: number };
export type FlowDependencies<Credential> = {
  read: () => Promise<string | null>;
  write: (attempt: ProviderAttempt) => Promise<void>;
  current: () => Promise<SessionIdentity | null>;
  /** Establishes the session for the credential and returns the exchanged user id. */
  exchange: (credential: Credential) => Promise<string>;
  discardUnexpectedSession: (userId: string) => Promise<void>;
  /** Idempotently provisions the minimal resident profile for the verified identity. */
  provision: () => Promise<void>;
  gate: RequestGate;
};

/**
 * One provider attempt from credential to provisioned profile. The browser result, a late
 * deep link and a retry all use the same consumption checkpoints, so a credential is exchanged
 * at most once and a wrong or replaced account never completes the attempt.
 */
export class ProviderAuthFlow<Credential> {
  private inFlight: { fingerprint: string | null; promise: Promise<ProviderAttempt> } | null = null;
  private consumed: { id: string; fingerprint: string } | null = null;

  constructor(
    private readonly provider: Provider,
    private readonly deps: FlowDependencies<Credential>,
    private readonly fingerprintOf: (credential: Credential) => string,
    private readonly names: { provider: string } = { provider: provider === 'google' ? 'Google' : 'Apple' },
  ) {}

  finish(credential?: Credential): Promise<ProviderAttempt> {
    const fingerprint = credential === undefined ? null : this.fingerprintOf(credential);
    if (this.inFlight) {
      if (fingerprint && this.inFlight.fingerprint && fingerprint !== this.inFlight.fingerprint) {
        return Promise.reject(new Error(`A different ${this.names.provider} response is already being processed.`));
      }
      return this.inFlight.promise;
    }
    const promise = this.perform(credential, fingerprint).finally(() => { this.inFlight = null; });
    this.inFlight = { fingerprint, promise };
    return promise;
  }

  private async perform(credential: Credential | undefined, fingerprint: string | null): Promise<ProviderAttempt> {
    const name = this.names.provider;
    let attempt = parseAttempt(await this.deps.read());
    if (!attempt || attempt.provider !== this.provider) throw new Error(`${name} sign-in expired. Please start again.`);
    let current = await this.deps.current();
    if (attempt.expectedUserId && current?.id !== attempt.expectedUserId) {
      throw new Error(`The account changed. Start ${name} authentication again from the correct account.`);
    }
    if (this.consumed?.id === attempt.id && fingerprint && fingerprint !== this.consumed.fingerprint) {
      throw new Error('This response belongs to a different sign-in attempt.');
    }
    // Crash after exchange but before the checkpoint: reconcile a NEW session whose Auth-owned
    // sign-in time belongs to this attempt and that carries this provider. No re-exchange.
    if (attempt.phase === 'exchanging' && !attempt.expectedUserId && current?.providers.includes(this.provider) && current.lastSignIn >= attempt.started) {
      attempt = { ...attempt, phase: 'consumed', userId: current.id };
      await this.deps.write(attempt);
    }
    if (attempt.phase === 'issued' || attempt.phase === 'exchanging') {
      if (credential === undefined || !fingerprint) throw new Error(`No verified ${name} response is available. Start sign-in again.`);
      await this.deps.write({ ...attempt, phase: 'exchanging' });
      const issued = attempt;
      attempt = await this.deps.gate.run(async () => {
        const exchangedUserId = await this.deps.exchange(credential);
        if (issued.expectedUserId && exchangedUserId !== issued.expectedUserId) {
          // The SDK installs its exchanged session before returning, so rejecting the response
          // alone would leave the wrong resident signed in.
          await this.deps.discardUnexpectedSession(exchangedUserId);
          throw new Error(`A different ${name} account was selected. Sign in to your original account and try again.`);
        }
        current = await this.deps.current();
        if (current?.id !== exchangedUserId) throw new Error(`The session changed after ${name} authentication. Start again.`);
        if (!current.providers.includes(this.provider)) throw new Error(`${name} authentication did not confirm the intended account.`);
        const pending = parseAttempt(await this.deps.read());
        if (pending?.id !== issued.id) throw new Error('The sign-in attempt changed.');
        this.consumed = { id: issued.id, fingerprint };
        const consumed: ProviderAttempt = { ...issued, phase: 'consumed', userId: current.id };
        // Also runs after a UI watchdog timeout, so a retry provisions the verified session
        // without presenting the consumed credential again.
        await this.deps.write(consumed);
        return consumed;
      });
    }
    if (!current || current.id !== attempt.userId || !current.providers.includes(this.provider)) {
      throw new Error('This sign-in attempt belongs to another session. Start again.');
    }
    if (attempt.phase !== 'complete') {
      await this.deps.provision();
      // Ownership is checked again after provisioning; a late completion cannot route a new user.
      const latest = await this.deps.current();
      const pending = parseAttempt(await this.deps.read());
      if (latest?.id !== attempt.userId || pending?.id !== attempt.id) throw new Error('The account or sign-in attempt changed.');
      attempt = { ...attempt, phase: 'complete' };
      await this.deps.write(attempt);
    }
    return attempt;
  }
}
