import { DataError, toDataError, type FailureKind } from './outcome';

export type MutationOutcome<T> =
  | { status: 'committed'; value: T }
  | { status: 'failed'; kind: FailureKind; error: DataError }
  /** The write may have committed. The caller reconciles with an authoritative read. */
  | { status: 'unknown'; error: DataError }
  /** Another run of this mutation is still in flight; nothing was sent. */
  | { status: 'busy' };

/**
 * Single-flight boundary for one mutation (plan P02-T02, handoff P0 button rule: two rapid
 * activations create at most one server attempt). There are no automatic retries: a
 * transport failure after the request left the device is reported as `unknown`, never
 * resent, unless the operation itself reconciles through an idempotency contract.
 */
export function createSingleFlight() {
  let running = false;
  return {
    get running() { return running; },
    async run<T>(operation: () => Promise<T>): Promise<MutationOutcome<T>> {
      if (running) return { status: 'busy' };
      running = true;
      try {
        return { status: 'committed', value: await operation() };
      } catch (failure) {
        const error = toDataError(failure, { write: true });
        return error.kind === 'unknown-commit' ? { status: 'unknown', error } : { status: 'failed', kind: error.kind, error };
      } finally {
        running = false;
      }
    },
  };
}
