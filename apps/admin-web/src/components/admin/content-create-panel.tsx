'use client';

import { createContext, useContext, useLayoutEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { useMountTransition } from '@/hooks/use-mount-transition';
import { THEMED_SCROLLBAR_CLASS } from '@/lib/scrollbar';
import { SIDE_SHEET_FADE_TRANSITION, SIDE_SHEET_SLIDE_TRANSITION } from '@/lib/side-sheet-motion';
import styles from './content-forms.module.css';

const HideFormContext = createContext<(() => void) | null>(null);

type CreateForm = { label: string; title: string; description: string; content: ReactNode };

function subscribeToMotionPreference(onChange: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', onChange);
  return () => preference.removeEventListener('change', onChange);
}
const getReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const getServerReducedMotion = () => false;

/** Shares the notification drawer's motion and retains drafts between opens. */
export function ContentCreatePanel({ title, description, forms }: {
  title: string; description: string; forms: CreateForm[];
}) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [visited, setVisited] = useState<number[]>([]);

  function reveal(index: number) {
    setVisited(current => current.includes(index) ? current : [...current, index]);
    setOpen(index);
  }

  return <div className={styles.workspace}>
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.triggers}>
        {forms.map((form, index) => <button key={form.label} type="button"
          className={`${styles.createButton} ${index > 0 ? styles.secondaryCreate : ''}`} aria-haspopup="dialog" aria-expanded={open === index} aria-controls={visited.includes(index) ? `${id}-${index}` : undefined}
          onClick={() => reveal(index)}>
          <Plus size={16} aria-hidden="true" />{form.label}
        </button>)}
      </div>
    </div>
    {forms.map((form, index) => visited.includes(index) ? <ContentSideSheet key={form.label} id={`${id}-${index}`}
      form={form} open={open === index} onClose={() => setOpen(null)} /> : null)}
  </div>;
}

export function ContentSideSheet({ id, form, open, onClose, className }: {
  id: string; form: CreateForm; open: boolean; onClose: () => void; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const motion = useMountTransition(open);
  const reducedMotion = useSyncExternalStore(subscribeToMotionPreference, getReducedMotion, getServerReducedMotion);
  // Reduced motion closes the native modal immediately, releasing focus and
  // scrolling without waiting for the animated exit's fallback timer.
  const rendered = reducedMotion ? open : motion.rendered;
  const visible = reducedMotion ? open : motion.visible;
  const { onTransitionEnd } = motion;

  useLayoutEffect(() => {
    if (!rendered || !dialog.current) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    // Commit the offscreen starting position while the dialog is displayed,
    // before useMountTransition's animation frame applies translate-x-0.
    // A passive effect can run too late, making showModal snap to the end state.
    element.querySelector('section')?.getBoundingClientRect();
    // showModal auto-focuses a control in the offscreen sheet, which can
    // horizontally scroll the dialog and cancel out the slide's visible travel.
    element.scrollLeft = 0;
    document.body.style.overflow = 'hidden';
    element.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), [data-admin-select-trigger]:not([disabled]), select:not([disabled]):not([data-admin-select-backing]), textarea:not([disabled])')?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [rendered]);

  return <dialog ref={dialog} id={id} className={styles.sheetDialog} aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]):not([data-admin-select-backing]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={`${styles.backdrop} ${SIDE_SHEET_FADE_TRANSITION} ${visible ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={onClose} />
    <section className={`${styles.sheet} ${className ?? ''} ${SIDE_SHEET_SLIDE_TRANSITION} ${visible ? 'translate-x-0' : 'translate-x-full'}`} onTransitionEnd={onTransitionEnd}>
      <div className={styles.panelHeader}>
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">{form.title}</h2>
          <p id={`${id}-description`} className={styles.description}>{form.description}</p>
        </div>
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close form">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className={`${styles.panelBody} ${THEMED_SCROLLBAR_CLASS}`}>
        <HideFormContext.Provider value={onClose}>{form.content}</HideFormContext.Provider>
      </div>
    </section>
  </dialog>;
}

export function ContentFormActions({ busy, children, onCancel, className, cancelFirst = false }: {
  busy: boolean; children: ReactNode; onCancel?: () => void; className?: string; cancelFirst?: boolean;
}) {
  const hide = useContext(HideFormContext);
  const cancel = onCancel || hide ? <button type="button" disabled={busy} className={styles.secondaryButton}
    onClick={onCancel ?? hide ?? undefined}><X size={16} aria-hidden="true" />{onCancel ? 'Cancel' : 'Close'}</button> : null;
  return <div className={`${styles.actions} ${className ?? ''}`}>
    {cancelFirst ? cancel : null}
    {children}
    {cancelFirst ? null : cancel}
    {hide ? <span className={styles.draftHint}>Your entries stay here when you close this sheet.</span> : null}
  </div>;
}
