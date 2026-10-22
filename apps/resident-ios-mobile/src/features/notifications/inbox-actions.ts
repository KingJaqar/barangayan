import { createSingleFlight } from '../../data/mutation';
import type { BulkResult } from '../../data/resident-api';
import { residentError } from '../../lib/errors';

/** The writes the controller needs; `residentApi` satisfies it, and tests supply a double. */
export type InboxApi = {
  setInboxRead(id: string, read: boolean): Promise<void>;
  unreadInboxIds(signal: AbortSignal): Promise<string[]>;
  markInboxRead(ids: readonly string[]): Promise<BulkResult>;
};

export type InboxActionState = {
  /** Optimistic read values by entry id; they hide the stored value until the list is re-read. */
  overrides: Readonly<Record<string, boolean>>;
  busy: boolean;
  message: string;
  failed: boolean;
};

const IDLE: InboxActionState = { overrides: {}, busy: false, message: '', failed: false };
const UNCONFIRMED = ' The change may have been saved; the list was refreshed to show what is stored.';

/**
 * Individual and bulk read/unread changes for the inbox (A44, P17-T04). Inbox read state is its own: it never touches an
 * announcement's or a resolved report's read state, which Reports owns.
 *
 * - One write runs at a time; a second activation while one is running sends nothing.
 * - The new value is shown at once and removed again if the write fails or is not confirmed.
 * - "Mark all" acts on the entries that were unread when it was tapped, in order, and stops at the first failure. Entries that
 *   arrive afterwards stay unread because they were never seen.
 * - After every write `settled` re-reads the list and counter; optimistic values are dropped only once that read is back, and
 *   nothing is written after `dispose`.
 */
export class InboxActions {
  private state: InboxActionState = IDLE;
  private readonly listeners = new Set<() => void>();
  private readonly gate = createSingleFlight();
  private readonly controller = new AbortController();
  private disposed = false;

  constructor(private readonly api: InboxApi, private readonly settled: () => Promise<void>) {}

  getState = (): InboxActionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.listeners.clear();
  }

  private set(patch: Partial<InboxActionState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private override(ids: readonly string[], value: boolean | null): void {
    const next = { ...this.state.overrides };
    for (const id of ids) {
      if (value === null) delete next[id];
      else next[id] = value;
    }
    this.set({ overrides: next });
  }

  async setRead(id: string, read: boolean, announce = true): Promise<void> {
    if (this.disposed || this.gate.running) return;
    this.set({ busy: true, message: '', failed: false });
    this.override([id], read);
    const outcome = await this.gate.run(() => this.api.setInboxRead(id, read));
    if (outcome.status === 'busy' || this.disposed) return;
    if (outcome.status === 'committed') this.set({ busy: false, message: announce ? (read ? 'Marked as read.' : 'Marked as unread.') : '', failed: false });
    else {
      this.override([id], null);
      this.set({ busy: false, failed: true, message: residentError(outcome.error) + (outcome.status === 'unknown' ? UNCONFIRMED : '') });
    }
    await this.refreshThenForget([id]);
  }

  async markAllRead(): Promise<void> {
    if (this.disposed || this.gate.running) return;
    this.set({ busy: true, message: '', failed: false });
    let ids: string[] = [];
    const outcome = await this.gate.run(async () => {
      ids = await this.api.unreadInboxIds(this.controller.signal);
      if (!ids.length || this.disposed) return null;
      this.override(ids, true);
      return this.api.markInboxRead(ids);
    });
    if (outcome.status === 'busy' || this.disposed) return;
    if (outcome.status !== 'committed') {
      this.override(ids, null);
      this.set({ busy: false, failed: true, message: residentError(outcome.error) + (outcome.status === 'unknown' ? UNCONFIRMED : '') });
    } else if (outcome.value === null) {
      this.set({ busy: false, failed: false, message: 'No unread notifications.' });
    } else {
      const { requested, done, failure } = outcome.value;
      if (failure) this.set({ busy: false, failed: true, message: `Marked ${done} of ${requested} notifications as read. ${residentError(failure)}` });
      else if (done < requested) this.set({ busy: false, failed: false, message: `Marked ${done} of ${requested} notifications as read; ${requested - done} changed meanwhile and were left as they are.` });
      else this.set({ busy: false, failed: false, message: `Marked ${done} ${done === 1 ? 'notification' : 'notifications'} as read.` });
      // A partly applied snapshot cannot say which ids were stored, so only the re-read decides.
      if (failure || done < requested) this.override(ids, null);
    }
    await this.refreshThenForget(ids);
  }

  private async refreshThenForget(ids: readonly string[]): Promise<void> {
    try {
      await this.settled();
    } finally {
      this.override(ids, null);
    }
  }
}
