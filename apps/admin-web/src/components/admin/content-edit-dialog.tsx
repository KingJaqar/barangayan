'use client';

import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useMountTransition } from '@/hooks/use-mount-transition';
import styles from './content-edit-dialog.module.css';

function subscribeToMotion(onChange: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', onChange);
  return () => preference.removeEventListener('change', onChange);
}
const reducedMotionSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotionSnapshot = () => false;

/** Native modality keeps dropdown portals, validation, and focus inside the editor. */
export function ContentEditDialog({ open, title, description, context, busy = false, wide = false, onClose, children }: {
  open: boolean; title: string; description: string; context: ReactNode; busy?: boolean;
  wide?: boolean; onClose: () => void; children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const motion = useMountTransition(open);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, reducedMotionSnapshot, serverMotionSnapshot);
  const rendered = reducedMotion ? open : motion.rendered;
  const visible = reducedMotion ? open : motion.visible;

  useLayoutEffect(() => {
    if (!rendered || !dialog.current) return;
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    element.querySelector('section')?.getBoundingClientRect();
    element.querySelector<HTMLElement>('input:not(:disabled):not([type="hidden"]), [data-admin-select-trigger]:not(:disabled), textarea:not(:disabled)')?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [rendered]);

  function dismiss() { if (open && !busy) onClose(); }

  if (!rendered) return null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-context ${id}-description`}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled):not([data-admin-select-backing]), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className={styles.backdrop} data-visible={visible} aria-hidden="true" onClick={dismiss} />
    <section className={`${styles.panel} ${wide ? styles.wide : ''}`} data-visible={visible} onTransitionEnd={motion.onTransitionEnd}>
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
          <p id={`${id}-context`} className={styles.context}>{context}</p>
          <p id={`${id}-description`} className={styles.description}>{description}</p>
        </div>
        <button type="button" className={styles.closeButton} aria-label="Close edit dialog" disabled={busy} onClick={dismiss}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.content} inert={!open}>{children}</div>
    </section>
  </dialog>;
}
