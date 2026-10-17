import { DataError } from '../../data/outcome';
import type { CheckInReceipt } from '../../data/resident-api';
import { residentError } from '../../lib/errors';
import { parseCenterScan, type ScanRejection } from './payloads';

/**
 * What the scanner shows. Only `confirmed` is attendance, and only because the server's receipt arrived (or was read back from
 * the resident's own stored check-ins). `unconfirmed` keeps the scanned center in memory as a non-confirmed attempt: it is never
 * stored, queued or counted, and "Try again" asks the server again (a repeat within ten minutes returns the first check-in).
 */
export type ScanState =
  | { kind: 'scanning' }
  | { kind: 'processing'; centerId: string }
  | { kind: 'confirmed'; receipt: CheckInReceipt }
  | { kind: 'rejected'; reason: ScanRejection; message: string }
  | { kind: 'failed'; message: string }
  | { kind: 'unconfirmed'; centerId: string; message: string }
  | { kind: 'unavailable' };

export type ScanDependencies = {
  barangayId: string;
  /** The `evacuationCheckin` release gate. Closed: nothing is parsed and nothing is sent. */
  available: boolean;
  checkIn(centerId: string): Promise<CheckInReceipt>;
};

export const UNCONFIRMED_MESSAGE = 'We could not confirm your check-in, so it is not counted as attendance yet. Check your connection and try again — trying again will not record you twice. If you are at the center, ask staff for help.';

/**
 * Framework-free scan-to-check-in state machine. A scan is acted on only while `scanning`; every other state ignores further
 * frames, so the camera reporting one code many times produces one request. Answers that arrive after `reset` or while the
 * controller is inactive are discarded; an attempt cut off by going inactive is reported as unconfirmed, never as a success.
 */
export class ScanController {
  private current: ScanState;
  private generation = 0;
  private active = true;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly dependencies: ScanDependencies) {
    this.current = dependencies.available ? { kind: 'scanning' } : { kind: 'unavailable' };
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = (): ScanState => this.current;

  private set(state: ScanState) {
    this.current = state;
    for (const listener of [...this.listeners]) listener();
  }

  /** One decoded code from the camera. */
  handleScan(raw: string): void {
    if (!this.active || this.current.kind !== 'scanning') return;
    const parsed = parseCenterScan(raw, this.dependencies.barangayId);
    if (!parsed.ok) { this.set({ kind: 'rejected', reason: parsed.reason, message: parsed.message }); return; }
    void this.send(parsed.centerId);
  }

  /** Asks again for the same center after an unconfirmed attempt. */
  retry(): void {
    if (!this.active || this.current.kind !== 'unconfirmed') return;
    void this.send(this.current.centerId);
  }

  /** Back to scanning after a result the resident has read. */
  reset(): void {
    if (!this.active || this.current.kind === 'processing') return;
    this.generation += 1;
    this.set(this.dependencies.available ? { kind: 'scanning' } : { kind: 'unavailable' });
  }

  /**
   * False while the scanner is closed or unmounted: late answers are discarded and an in-flight attempt becomes `unconfirmed`
   * (the server may have recorded it). Reversible, so a remounted screen simply continues.
   */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active) return;
    this.generation += 1;
    if (this.current.kind === 'processing') this.current = { kind: 'unconfirmed', centerId: this.current.centerId, message: UNCONFIRMED_MESSAGE };
  }

  private async send(centerId: string): Promise<void> {
    const attempt = ++this.generation;
    this.set({ kind: 'processing', centerId });
    try {
      const receipt = await this.dependencies.checkIn(centerId);
      if (!this.active || attempt !== this.generation) return;
      this.set({ kind: 'confirmed', receipt });
    } catch (error) {
      if (!this.active || attempt !== this.generation) return;
      if (error instanceof DataError && error.kind === 'unknown-commit') this.set({ kind: 'unconfirmed', centerId, message: UNCONFIRMED_MESSAGE });
      else this.set({ kind: 'failed', message: residentError(error) });
    }
  }
}
