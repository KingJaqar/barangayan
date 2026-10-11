export class SetupTimeout extends Error {
  constructor() { super('This is taking longer than expected. The result is not yet known. Wait for the connection to finish, then review or retry.'); this.name = 'SetupTimeout'; }
}

/** A watchdog ends the spinner, never the underlying operation's ownership.
 * Even after timeout/unmount, a second mutation cannot race the first transport. */
export class SetupRequestGate {
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

// Shared by OTP, OAuth and password writes, including screens that have unmounted.
export const authSetupRequests = new SetupRequestGate();
export const profileSetupRequests = new SetupRequestGate();
export const RESEND_DEADLINE_KEY = 'resident-otp-resend-deadline-v1';

/** Close the write boundary when its UI wait ends. A late preflight read must
 * never begin a credential mutation after a watchdog has already returned. */
export class SetupWriteBoundary {
  private closed = false;
  private began = false;
  get started() { return this.began; }
  begin() {
    if (this.closed) throw new Error('The account check finished after the wait ended. Check your connection and retry.');
    this.began = true;
  }
  close() { this.closed = true; }
}
export function resendSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function readResendDeadline(value: string | null, now = Date.now()) {
  const deadline = Number(value);
  // A corrupt/future storage value must not indefinitely disable registration.
  return Number.isFinite(deadline) && deadline > now && deadline <= now + 60_000 ? deadline : 0;
}

export class SetupOwner {
  private generation = 0;
  invalidate() { this.generation++; }
  ticket() { const generation = this.generation; return () => generation === this.generation; }
}
