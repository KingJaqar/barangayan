'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

/** Keep a row action locked through its prerequisites, write and read-back. */
export function useRowAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function runAction(action: () => Promise<void>, before?: () => Promise<boolean>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (before && !await before()) return;
      await action();
    } catch {
      toast.showError('The action could not be completed. Check your connection and retry.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return { busy, runAction };
}
