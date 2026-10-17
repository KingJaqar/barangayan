import { createSingleFlight } from '../../data/mutation';
import { residentError } from '../../lib/errors';

export type ActionApi = {
  confirmIncident: (id: string) => Promise<'confirmed' | 'already'>;
  withdrawIncident: (id: string) => Promise<void>;
};

export type ActionOutcome =
  | { kind: 'confirmed' }
  /** The server already had this resident's confirmation (a repeat or a concurrent tap). */
  | { kind: 'already' }
  | { kind: 'withdrawn' }
  /** The server refused: nothing changed. */
  | { kind: 'failed'; message: string }
  /** The reply was lost: the screen re-reads the report before claiming anything. */
  | { kind: 'unknown'; message: string }
  /** Another action of this controller is still running; nothing was sent. */
  | { kind: 'busy' };

/**
 * One single-flight boundary for corroboration and withdrawal of a concern (plan P12-T06): two
 * quick taps send one request, nothing is retried automatically, and a lost reply is reported as
 * unknown for the caller to reconcile with a fresh read.
 */
export function createIncidentActions(api: ActionApi) {
  const flight = createSingleFlight();
  async function run<T>(operation: () => Promise<T>, done: (value: T) => ActionOutcome): Promise<ActionOutcome> {
    const outcome = await flight.run(operation);
    if (outcome.status === 'committed') return done(outcome.value);
    if (outcome.status === 'busy') return { kind: 'busy' };
    if (outcome.status === 'unknown') return { kind: 'unknown', message: residentError(outcome.error) };
    return { kind: 'failed', message: residentError(outcome.error) };
  }
  return {
    get running() { return flight.running; },
    confirm: (id: string) => run(() => api.confirmIncident(id), (value): ActionOutcome => ({ kind: value })),
    withdraw: (id: string) => run(() => api.withdrawIncident(id), (): ActionOutcome => ({ kind: 'withdrawn' })),
  };
}
