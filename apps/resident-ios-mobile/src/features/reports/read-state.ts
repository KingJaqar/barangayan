import { createSingleFlight } from '../../data/mutation';
import type { BulkResult } from '../../data/resident-api';
import { residentError } from '../../lib/errors';

/** The writes the controller needs; `residentApi` satisfies it, and tests supply a double. */
export type ReadStateApi = {
  markAnnouncementRead(id: string): Promise<void>;
  markAnnouncementUnread(id: string): Promise<void>;
  setIncidentRead(id: string, read: boolean): Promise<void>;
  unreadAnnouncementIds(signal: AbortSignal): Promise<string[]>;
  markAnnouncementsRead(ids: readonly string[]): Promise<BulkResult>;
  unreadResolvedIncidentIds(signal: AbortSignal): Promise<string[]>;
  markIncidentsRead(ids: readonly string[]): Promise<BulkResult>;
};

type Kind = 'announcements' | 'incidents';
export type ReadState = {
  /** Optimistic read values by record id; they hide the stored value until the list is re-read. */
  announcements: Readonly<Record<string, boolean>>;
  incidents: Readonly<Record<string, boolean>>;
  busy: boolean;
  message: string;
  failed: boolean;
};

const IDLE: ReadState = { announcements: {}, incidents: {}, busy: false, message: '', failed: false };
const UNCONFIRMED = ' The change may have been saved; the list was refreshed to show what is stored.';

/**
 * Individual and bulk read/unread changes for announcements and resolved reports (A35, A36).
 *
 * - One write runs at a time; a second activation while one is running sends nothing.
 * - The new value is shown at once and removed again if the write fails or is not confirmed,
 *   so the screen never keeps a state the server did not accept.
 * - "Mark all" acts on the ids that were unread when it was tapped, in order, and stops at the
 *   first failure. Items that arrive afterwards stay unread because they were never seen.
 * - After every write `settled` re-reads the lists and counters; the optimistic values are
 *   dropped only once that read is back, and nothing is written after `dispose`.
 */
export class ReadActions {
  private state: ReadState = IDLE;
  private readonly listeners = new Set<() => void>();
  private readonly gate = createSingleFlight();
  private readonly controller = new AbortController();
  private disposed = false;

  constructor(private readonly api: ReadStateApi, private readonly settled: () => Promise<void>) {}

  getState = (): ReadState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** The resident left the screen or the account changed: late replies change nothing. */
  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.listeners.clear();
  }

  setAnnouncementRead(id: string, read: boolean): Promise<void> {
    return this.single('announcements', id, read, () => (read ? this.api.markAnnouncementRead(id) : this.api.markAnnouncementUnread(id)),
      read ? 'Marked as read.' : 'Marked as unread.');
  }

  setIncidentRead(id: string, read: boolean): Promise<void> {
    return this.single('incidents', id, read, () => this.api.setIncidentRead(id, read), read ? 'Marked as read.' : 'Marked as unread.');
  }

  markAllAnnouncementsRead(): Promise<void> {
    return this.bulk('announcements', 'announcements', (signal) => this.api.unreadAnnouncementIds(signal), (ids) => this.api.markAnnouncementsRead(ids));
  }

  markAllResolvedRead(): Promise<void> {
    return this.bulk('incidents', 'resolved reports', (signal) => this.api.unreadResolvedIncidentIds(signal), (ids) => this.api.markIncidentsRead(ids));
  }

  private set(patch: Partial<ReadState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private override(kind: Kind, ids: readonly string[], value: boolean | null): void {
    const next = { ...this.state[kind] };
    for (const id of ids) {
      if (value === null) delete next[id];
      else next[id] = value;
    }
    this.set({ [kind]: next } as Pick<ReadState, Kind>);
  }

  private async single(kind: Kind, id: string, read: boolean, write: () => Promise<void>, success: string): Promise<void> {
    if (this.disposed || this.gate.running) return;
    this.set({ busy: true, message: '', failed: false });
    this.override(kind, [id], read);
    const outcome = await this.gate.run(write);
    if (outcome.status === 'busy' || this.disposed) return;
    if (outcome.status === 'committed') this.set({ busy: false, message: success, failed: false });
    else {
      this.override(kind, [id], null);
      this.set({ busy: false, failed: true, message: residentError(outcome.error) + (outcome.status === 'unknown' ? UNCONFIRMED : '') });
    }
    await this.refreshThenForget(kind, [id]);
  }

  private async bulk(kind: Kind, noun: string, snapshot: (signal: AbortSignal) => Promise<string[]>, write: (ids: string[]) => Promise<BulkResult>): Promise<void> {
    if (this.disposed || this.gate.running) return;
    this.set({ busy: true, message: '', failed: false });
    let ids: string[] = [];
    const outcome = await this.gate.run(async () => {
      ids = await snapshot(this.controller.signal);
      if (!ids.length || this.disposed) return null;
      this.override(kind, ids, true);
      return write(ids);
    });
    if (outcome.status === 'busy' || this.disposed) return;
    if (outcome.status !== 'committed') {
      this.override(kind, ids, null);
      this.set({ busy: false, failed: true, message: residentError(outcome.error) + (outcome.status === 'unknown' ? UNCONFIRMED : '') });
    } else if (outcome.value === null) {
      this.set({ busy: false, failed: false, message: `No unread ${noun}.` });
    } else {
      const { requested, done, failure } = outcome.value;
      if (failure) this.set({ busy: false, failed: true, message: `Marked ${done} of ${requested} ${noun} as read. ${residentError(failure)}` });
      else if (done < requested) this.set({ busy: false, failed: false, message: `Marked ${done} of ${requested} ${noun} as read; ${requested - done} changed meanwhile and were left as they are.` });
      else this.set({ busy: false, failed: false, message: `Marked ${done} ${noun} as read.` });
      // A partly applied snapshot cannot say which ids were stored, so only the re-read decides.
      if (failure || done < requested) this.override(kind, ids, null);
    }
    await this.refreshThenForget(kind, ids);
  }

  private async refreshThenForget(kind: Kind, ids: readonly string[]): Promise<void> {
    try {
      await this.settled();
    } finally {
      this.override(kind, ids, null);
    }
  }
}
