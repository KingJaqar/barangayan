'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { TableDetailDialog } from './table-detail-dialog';

/** Keep profile dialogs in the existing modal, with explicit keyboard wrapping. */
export function ProfileDialog({ label, onClose, children, preventClose = false }: {
  label: string; onClose: () => void; children: ReactNode; preventClose?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!returnFocus.current && document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    const previous = returnFocus.current;
    return () => { queueMicrotask(() => { if (previous?.isConnected) previous.focus(); }); };
  }, []);
  function containFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(content.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? [])
      .filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0);
    const first = controls[0]; const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <TableDetailDialog label={label} onClose={onClose} preventClose={preventClose}>
    <div ref={content} className="contents" role="presentation" onKeyDown={containFocus}>{children}</div>
  </TableDetailDialog>;
}
