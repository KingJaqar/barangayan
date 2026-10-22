/** Both a transport abort and a local deadline: an unresolved auth/fetch must release the UI. */
export async function attendanceRequest<T>(parent: AbortSignal, run: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  if (parent.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('Attendance request ended.');
      return run(controller.signal);
    }), new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error('Attendance request ended.'));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
      timer = setTimeout(abort, 15000);
    })]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    parent.removeEventListener('abort', abort);
    if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
  }
}

