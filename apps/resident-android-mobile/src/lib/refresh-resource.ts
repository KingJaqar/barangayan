interface RefreshSnapshot<T> {
  data: T | undefined;
  fetching: boolean;
  error: string | null;
}

/** One read owner per account/filter. Ordinary reads join; invalidations queue
 * one follow-up and prevent a pre-invalidation reply from being published. */
export class RefreshResource<T> {
  private snapshot: RefreshSnapshot<T> = { data: undefined, fetching: false, error: null };
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private revision = 0;
  private active = true;

  constructor(
    readonly key: string,
    private load: (signal: AbortSignal) => Promise<T>,
    private message: string,
    private reconcile: (previous: T | undefined, next: T) => T = (_, next) => next,
    private timeoutMs = 30_000,
  ) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(snapshot: RefreshSnapshot<T>) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
  activate = () => { this.active = true; };
  cancel = () => {
    this.active = false;
    this.revision++;
    this.controller?.abort();
    this.controller = null;
    this.pending = null;
    this.snapshot = { ...this.snapshot, fetching: false };
  };
  refresh = (): Promise<void> => {
    if (!this.active) return Promise.resolve();
    if (this.pending) return this.pending;
    this.publish({ ...this.snapshot, fetching: true, error: null });
    // Install ownership before invoking transport, including synchronous callers.
    const work = Promise.resolve().then(async () => {
      while (this.active && this.pending === work) {
        const revision = this.revision;
        const controller = new AbortController();
        this.controller = controller;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let removeAbortListener: (() => void) | undefined;
        try {
          const data = await Promise.race([this.load(controller.signal), new Promise<never>((_, reject) => {
            const abort = () => reject(new Error(this.message));
            controller.signal.addEventListener('abort', abort, { once: true });
            removeAbortListener = () => controller.signal.removeEventListener('abort', abort);
            timeout = setTimeout(() => controller.abort(), this.timeoutMs);
          })]);
          if (!this.active || this.pending !== work) return;
          if (revision === this.revision) {
            if (controller.signal.aborted) throw new Error(this.message);
            this.publish({ data: this.reconcile(this.snapshot.data, data), fetching: false, error: null });
            return;
          }
        } catch {
          if (!this.active || this.pending !== work) return;
          if (revision === this.revision) {
            this.publish({ ...this.snapshot, fetching: false, error: this.message });
            return;
          }
        } finally {
          clearTimeout(timeout);
          removeAbortListener?.();
          if (this.controller === controller) this.controller = null;
        }
      }
    }).finally(() => { if (this.pending === work) this.pending = null; });
    this.pending = work;
    return work;
  };
  invalidate = (): Promise<void> => {
    this.revision++;
    this.controller?.abort();
    return this.refresh();
  };
}
