export function createQueryGate() {
  let version = 0;
  let identity = '';
  return {
    begin(nextIdentity: string) { identity = nextIdentity; return ++version; },
    isCurrent(token: number, nextIdentity: string) { return token === version && identity === nextIdentity; },
    dispose() { version++; identity = ''; },
  };
}

/** Coalesce bursts into one active refresh and one pending reconciliation; defer during edits. */
export function createRefreshCoordinator(refresh: () => Promise<void>, onError: (error: unknown) => void) {
  let active = false, queued = false, editing = false, disposed = false;
  async function run() {
    if (disposed || editing || active || !queued) return;
    active = true; queued = false;
    try { await refresh(); }
    catch (error) { queued = false; if (!disposed) onError(error); }
    finally { active = false; if (!disposed && queued && !editing) void run(); }
  }
  return {
    request() { if (!disposed) { queued = true; void run(); } },
    setEditing(value: boolean) { editing = value; if (!value) void run(); },
    dispose() { disposed = true; queued = false; },
  };
}
