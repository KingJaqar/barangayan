import type { z } from 'zod';
import { DataError } from '../../data/outcome';
import type { qrAttemptRow } from '../../data/schemas';
import { qrImageSource, type CancelStatus, type CheckStatus, type CreateResult, type QrSource } from './qr-functions';

export const POLL_INTERVAL_MS = 5000;
/** After this many failed status checks in a row the automatic checks stop and the resident decides. */
export const MAX_CHECK_FAILURES = 5;
/** The device clock may run ahead of the server's: a QR is not called expired until the server agrees or this passes. */
export const EXPIRY_GRACE_MS = 2 * 60 * 1000;

export type QrPhase = 'creating' | 'pending' | 'paid' | 'expired' | 'cancelled' | 'error';
export type QrState = {
  phase: QrPhase;
  source: QrSource | null;
  /** The request was already settled before this visit (nothing new was charged). */
  paidEarlier: boolean;
  checking: boolean;
  cancelling: boolean;
  /** Automatic checks stopped after repeated failures; the resident can check again. */
  pollingPaused: boolean;
  message: string | null;
};

export type QrSessionDeps = {
  functions: {
    create(signal?: AbortSignal): Promise<CreateResult>;
    check(paymentId: string, signal?: AbortSignal): Promise<CheckStatus>;
    cancel(paymentId: string): Promise<CancelStatus>;
  };
  /** Authoritative reads of the resident's own records (row-level security applies). */
  reads: {
    openAttempt(signal: AbortSignal): Promise<z.infer<typeof qrAttemptRow> | null>;
    status(paymentId: string, signal: AbortSignal): Promise<string | null>;
    hasPaid(signal: AbortSignal): Promise<boolean>;
  };
  now(): number;
  describe(error: unknown): string;
};

export type CancelResolution = { kind: 'cancelled' | 'expired' | 'paid' | 'unconfirmed' | 'failed'; message: string };
const CANCELLED_TEXT = 'Your QR PH payment was cancelled. You can start a new payment at any time.';
const EXPIRED_TEXT = 'This QR code had already expired, so there was nothing left to cancel.';
const PAID_TEXT = 'This payment was already completed.';

/**
 * Cancels one QR PH attempt and reports what is true afterwards. A settlement that won the race
 * is `paid`; a lost reply is reconciled with the stored status and, when that cannot be read
 * either, reported as `unconfirmed` (the QR may still be active) rather than as cancelled.
 */
export type CancelDeps = Pick<QrSessionDeps, 'describe'> & {
  functions: Pick<QrSessionDeps['functions'], 'cancel'>;
  reads: Pick<QrSessionDeps['reads'], 'status'>;
};
export async function resolveCancel(deps: CancelDeps, paymentId: string, signal: AbortSignal): Promise<CancelResolution> {
  const fromStatus = (status: string | null): CancelResolution | null => {
    if (status === 'cancelled') return { kind: 'cancelled', message: CANCELLED_TEXT };
    if (status === 'expired' || status === 'failed') return { kind: 'expired', message: EXPIRED_TEXT };
    if (status === 'paid' || status === 'refunded') return { kind: 'paid', message: PAID_TEXT };
    return null;
  };
  const reconcile = async (): Promise<CancelResolution> => {
    try {
      const known = fromStatus(await deps.reads.status(paymentId, signal));
      if (known) return known;
    } catch { /* reported below */ }
    return { kind: 'unconfirmed', message: 'We could not confirm the cancellation. The QR code may still be active. Check again before paying or leaving this screen.' };
  };
  try {
    const result = await deps.functions.cancel(paymentId);
    if (result === 'cancelled') return { kind: 'cancelled', message: CANCELLED_TEXT };
    if (result === 'closed') return { kind: 'expired', message: EXPIRED_TEXT };
    if (result === 'paid') return { kind: 'paid', message: PAID_TEXT };
    return await reconcile();
  } catch (error) {
    if (error instanceof DataError && (error.kind === 'unknown-commit' || error.kind === 'timeout' || error.code === 'payment_already_completed')) return reconcile();
    return { kind: 'failed', message: deps.describe(error) };
  }
}

const IDLE: QrState = { phase: 'creating', source: null, paidEarlier: false, checking: false, cancelling: false, pollingPaused: false, message: null };

function sourceFromAttempt(row: z.infer<typeof qrAttemptRow>, now: number): QrSource | null {
  const image = row.qr_image_url ? qrImageSource(row.qr_image_url) : null;
  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : Number.NaN;
  if (!image || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return {
    paymentId: row.id, transactionRef: row.paymongo_payment_intent_id, qrImage: image, expiresAt,
    documentFeeCentavos: row.document_fee_centavos ?? row.amount_centavos, amountCentavos: row.amount_centavos,
  };
}

/**
 * One QR PH payment attempt of one request, as a plain state machine so that its fault
 * handling is testable without a renderer (A16, F03, F09). It owns no timers: the screen calls
 * `poll()` on its interval while focused and foregrounded, and `refreshFromRecord()` when a
 * realtime signal arrives.
 *
 * - Creation is idempotent on the server (an open QR is resumed), but it is never retried
 *   automatically; a lost reply is reconciled against the stored attempt before anything is shown.
 * - Every reply is tied to the epoch it was sent in. Cancelling, expiring or settling starts a
 *   new epoch, so a poll that was already in flight cannot overwrite the newer outcome.
 */
export class QrSession {
  private state: QrState = IDLE;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private failures = 0;
  private starting = false;
  private disposed = false;
  private controller = new AbortController();

  constructor(private readonly deps: QrSessionDeps) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = () => this.state;

  private set(patch: Partial<QrState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** Stops everything in flight: late replies are dropped and nothing further is sent. Reversible with `open()`. */
  close() {
    this.disposed = true;
    this.epoch += 1;
    this.starting = false;
    this.controller.abort();
  }

  open() {
    if (!this.disposed) return;
    this.disposed = false;
    this.controller = new AbortController();
  }

  /** Creates the QR or resumes the open one. Ignored while a start is already running. */
  async start() {
    if (this.starting || this.disposed) return;
    this.starting = true;
    const epoch = ++this.epoch;
    this.failures = 0;
    this.set({ ...IDLE });
    try {
      const created = await this.deps.functions.create(this.controller.signal);
      if (epoch !== this.epoch) return;
      if (created.kind === 'paid') this.set({ phase: 'paid', paidEarlier: true, source: null });
      else this.set({ phase: 'pending', source: created.source });
    } catch (error) {
      if (epoch !== this.epoch) return;
      await this.reconcileCreate(error, epoch);
    } finally {
      if (epoch === this.epoch) this.starting = false;
    }
  }

  private async reconcileCreate(error: unknown, epoch: number) {
    const lost = error instanceof DataError && (error.kind === 'unknown-commit' || error.kind === 'timeout');
    if (!lost) {
      this.set({ phase: 'error', message: this.deps.describe(error) });
      return;
    }
    try {
      if (await this.deps.reads.hasPaid(this.controller.signal)) {
        if (epoch === this.epoch) this.set({ phase: 'paid', paidEarlier: true });
        return;
      }
      const attempt = await this.deps.reads.openAttempt(this.controller.signal);
      const source = attempt ? sourceFromAttempt(attempt, this.deps.now()) : null;
      if (epoch !== this.epoch) return;
      if (source) this.set({ phase: 'pending', source });
      else this.set({ phase: 'error', message: 'We could not confirm whether a QR code was created. Check your connection, then try again.' });
    } catch {
      if (epoch === this.epoch) this.set({ phase: 'error', message: 'We could not confirm whether a QR code was created. Check your connection, then try again.' });
    }
  }

  /** One automatic check; does nothing when it would overlap another action or the checks are paused. */
  async poll() {
    if (this.state.pollingPaused) return;
    await this.check();
  }

  /** A status check against the provider (resident-initiated checks resume automatic ones). */
  async check(manual = false) {
    const { phase, source, checking, cancelling } = this.state;
    if (phase !== 'pending' || !source || checking || cancelling || this.disposed) return;
    if (manual) { this.failures = 0; this.set({ pollingPaused: false, message: null }); }
    const epoch = this.epoch;
    this.set({ checking: true });
    try {
      const status = await this.deps.functions.check(source.paymentId, this.controller.signal);
      if (epoch !== this.epoch) return;
      this.failures = 0;
      this.apply(status, source);
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.failures += 1;
      const stop = this.failures >= MAX_CHECK_FAILURES;
      this.set({ pollingPaused: stop, message: stop ? `${this.deps.describe(error)} Automatic checking is paused.` : null });
    } finally {
      this.set({ checking: false });
    }
  }

  private apply(status: CheckStatus, source: QrSource) {
    if (status === 'paid') { this.epoch += 1; this.set({ phase: 'paid', paidEarlier: false, message: null }); return; }
    if (status === 'expired' || status === 'failed') { this.epoch += 1; this.set({ phase: 'expired', message: null }); return; }
    // The provider still reports it open. A device clock past the expiry only shows the time
    // as up; the QR is closed once the server agrees or the grace period has passed.
    if (this.deps.now() > source.expiresAt + EXPIRY_GRACE_MS) { this.epoch += 1; this.set({ phase: 'expired', message: null }); }
  }

  /** A realtime change of the payment row: re-read the record and follow it (never trust the payload). */
  async refreshFromRecord() {
    const { phase, source, cancelling } = this.state;
    if (phase !== 'pending' || !source || cancelling || this.disposed) return;
    const epoch = this.epoch;
    try {
      const status = await this.deps.reads.status(source.paymentId, this.controller.signal);
      if (epoch !== this.epoch || status === null) return;
      if (status === 'paid' || status === 'refunded') { this.epoch += 1; this.set({ phase: 'paid', paidEarlier: false, message: null }); }
      else if (status === 'cancelled') { this.epoch += 1; this.set({ phase: 'cancelled', message: null }); }
      else if (status === 'expired' || status === 'failed') { this.epoch += 1; this.set({ phase: 'expired', message: null }); }
    } catch {
      // The interval check will follow; a failed refresh changes nothing.
    }
  }

  /**
   * Cancels this attempt only; the request itself is untouched (A14-007, A14-009). See
   * `resolveCancel` for how a lost reply and a settlement race are reconciled.
   */
  async cancel(): Promise<CancelResolution | { kind: 'ignored'; message: string }> {
    const { phase, source, cancelling } = this.state;
    if (phase !== 'pending' || !source || cancelling || this.disposed) return { kind: 'ignored', message: '' };
    // A new epoch first, so a poll already in flight cannot overwrite the result below.
    const epoch = ++this.epoch;
    this.set({ cancelling: true, message: null });
    const resolution = await resolveCancel(this.deps, source.paymentId, this.controller.signal);
    if (epoch !== this.epoch) return resolution;
    if (resolution.kind === 'cancelled') this.set({ phase: 'cancelled', cancelling: false, message: resolution.message });
    else if (resolution.kind === 'expired') this.set({ phase: 'expired', cancelling: false, message: resolution.message });
    else if (resolution.kind === 'paid') this.set({ phase: 'paid', paidEarlier: false, cancelling: false, message: resolution.message });
    else this.set({ cancelling: false, message: resolution.message });
    return resolution;
  }
}
