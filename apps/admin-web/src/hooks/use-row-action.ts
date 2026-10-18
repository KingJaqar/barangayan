'use client';

import { useRef, useState } from 'react';
import { beginAttempt, notify as toast } from '@/lib/notify';

/** Keep a row action locked through its prerequisites, write and read-back. */
export function useRowAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);


  async function runAction(action: () => Promise<void>, before?: () => Promise<boolean>) {
    const toastAttempt = beginAttempt('runAction');
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (before && !await before()) return;
      await action();
    } catch {
      toast.error('The action could not be completed. Check your connection and retry.', { id: toastAttempt });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return { busy, runAction };
}
