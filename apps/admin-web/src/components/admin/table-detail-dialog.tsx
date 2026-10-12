'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal focus containment, Escape and background inertness. */
export function TableDetailDialog({ label, onClose, children, preventClose = false }: {
  label: string; onClose: () => void; children: ReactNode; preventClose?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} aria-label={label} onCancel={event => { event.preventDefault(); if (!preventClose) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !preventClose) onClose(); }}
    className="fixed m-auto max-h-[95vh] w-full max-w-2xl overflow-visible bg-transparent p-4 text-zinc-900 backdrop:bg-black/50 dark:text-zinc-100">
    {children}
  </dialog>;
}

export function TableDetailState({ status, onClose, onRetry }: {
  status: 'loading' | 'error' | 'unavailable'; onClose: () => void; onRetry: () => void;
}) {
  return <div className="rounded-2xl bg-white p-6 dark:bg-zinc-900" role={status === 'loading' ? 'status' : 'alert'}>
    <p>{status === 'loading' ? 'Loading current details…' : status === 'unavailable'
      ? 'This record is no longer available. It may have been removed or your access changed.'
      : 'Could not reload this record. Retry to view current details.'}</p>
    {status !== 'loading' && <button type="button" onClick={onRetry}>Retry details</button>}
    <button type="button" onClick={onClose} className="ml-3">Close details</button>
  </div>;
}
