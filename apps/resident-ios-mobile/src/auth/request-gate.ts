/** Raised when the UI wait ends before the request does; the underlying outcome is not yet known. */
export class SetupTimeout extends Error {
  constructor() {
    super('This is taking longer than expected. The result is not yet known. Wait for the connection to finish, then review or retry.');
    this.name = 'SetupTimeout';
  }
}

/**
 * One in-flight identity/setup mutation at a time. A watchdog ends the caller's wait, never the
 * ownership of the underlying transport: even after a timeout or unmount, a second mutation
 * cannot race the first.
 */
export class RequestGate {
  private pending = false;
  get busy() { return this.pending; }
  async run<T>(work: () => PromiseLike<T>, timeout = 30_000): Promise<T> {
    if (this.pending) throw new Error('An earlier request is still finishing. Please wait before retrying.');
    this.pending = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const transport = Promise.resolve().then(work).finally(() => { this.pending = false; });
    try {
      return await Promise.race([transport, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SetupTimeout()), timeout);
      })]);
    } finally { clearTimeout(timer); }
  }
}

/** Shared by OTP, provider sign-in and password writes, including screens that have unmounted. */
export const authRequests = new RequestGate();
/** Profile-completion writes. */
export const profileRequests = new RequestGate();

/**
 * Closes the write boundary when the UI wait ends: a late preflight read must never begin a
 * credential mutation after a watchdog has already returned.
 */
export class WriteBoundary {
  private closed = false;
  private began = false;
  get started() { return this.began; }
  begin() {
    if (this.closed) throw new Error('The account check finished after the wait ended. Check your connection and retry.');
    this.began = true;
  }
  close() { this.closed = true; }
}

/** Invalidates callbacks of a screen or flow that no longer owns the account state. */
export class Ownership {
  private generation = 0;
  invalidate() { this.generation++; }
  ticket() { const generation = this.generation; return () => generation === this.generation; }
}

export const RESEND_WINDOW_MS = 60_000;
export function resendSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
/** A corrupt or far-future stored deadline must not disable registration indefinitely. */
export function readResendDeadline(value: string | null, now = Date.now()) {
  const deadline = Number(value);
  return Number.isFinite(deadline) && deadline > now && deadline <= now + RESEND_WINDOW_MS ? deadline : 0;
}
